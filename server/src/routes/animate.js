const cache = new Map()
const CACHE_TTL = 120_000

export async function setupAnimateRoute(app) {

  app.post('/api/animate/identify', async (req, reply) => {
    const { imageBase64 } = req.body || {}
    if (!imageBase64) return reply.code(400).send({ error: 'Missing imageBase64' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return reply.code(500).send({ error: 'ANTHROPIC_API_KEY not set' })

    const cacheKey = imageBase64.slice(0, 120)
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      console.log('[animate] cache hit →', cached.data.label)
      return reply.send(cached.data)
    }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          system: 'You are a visual analysis assistant. Always respond with valid JSON only, no markdown, no explanation.',
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
              { type: 'text', text: `What is in this image? Respond with JSON only:
{"type":"drawing","label":"fish","behavior":"swim","svg":"<svg viewBox=\\"0 0 120 80\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"}

type: "text" if handwritten words/letters, "drawing" if sketch
label: the exact word(s) if text, single English noun if drawing
behavior: swim|drive|fly|bounce|fall|walk|float|spin|roam
svg: colorful illustration viewBox="0 0 120 80", no background rect

Behavior guide:
fish/whale/shark/sea creature → swim
car/truck/bus/train/vehicle → drive
bird/plane/butterfly/rocket → fly
ball/balloon/bubble → bounce
star/leaf/snow/petal → fall
person/human/cat/dog/animal → walk
cloud/ghost/jellyfish → float
flower/sun/wheel/spiral → spin
text: use the word meaning to decide behavior` }
            ]
          }]
        })
      })

      if (!res.ok) {
        const err = await res.text()
        console.error('[animate] Anthropic error:', res.status, err.slice(0, 150))
        return reply.code(500).send({ error: `API error ${res.status}` })
      }

      const data = await res.json()
      let text = (data.content?.[0]?.text || '').trim()
      text = text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim()

      let parsed
      try { parsed = JSON.parse(text) }
      catch (e) {
        console.error('[animate] parse error:', text.slice(0, 150))
        return reply.send({ type:'drawing', label:'object', behavior:'roam', svg: defaultSVG() })
      }

      const valid = ['swim','drive','fly','bounce','fall','walk','float','spin','roam']
      if (!valid.includes(parsed.behavior)) parsed.behavior = getBehavior(parsed.label, parsed.type)
      if (!parsed.svg?.startsWith('<svg')) parsed.svg = defaultSVG()

      console.log(`[animate] "${parsed.label}" → ${parsed.behavior} | svg:${!!parsed.svg}`)

      cache.set(cacheKey, { ts: Date.now(), data: parsed })
      setTimeout(() => cache.delete(cacheKey), CACHE_TTL)
      return reply.send(parsed)

    } catch (err) {
      console.error('[animate] exception:', err.message)
      return reply.code(500).send({ error: err.message })
    }
  })
}

function getBehavior(label, type) {
  const l = (label || '').toLowerCase()
  if (type === 'text') {
    if (/fish|whale|swim|ocean|sea/.test(l)) return 'swim'
    if (/fly|bird|plane|air/.test(l)) return 'fly'
    if (/car|drive|road/.test(l)) return 'drive'
    if (/star|fall|rain|snow|leaf/.test(l)) return 'fall'
    return 'float'
  }
  if (/fish|whale|shark|dolphin|seal|octopus|tuna|crab/.test(l)) return 'swim'
  if (/car|truck|bus|train|bike|motorcycle|van|jeep/.test(l)) return 'drive'
  if (/bird|butterfly|bee|plane|airplane|ufo|dragon|eagle|bat/.test(l)) return 'fly'
  if (/ball|balloon|bubble/.test(l)) return 'bounce'
  if (/star|leaf|snowflake|petal|feather/.test(l)) return 'fall'
  if (/person|human|man|woman|boy|girl|stick|cat|dog|rabbit|bear/.test(l)) return 'walk'
  if (/cloud|jellyfish|ghost/.test(l)) return 'float'
  if (/flower|sun|wheel|spiral/.test(l)) return 'spin'
  return 'roam'
}

function defaultSVG() {
  return `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="40" r="28" fill="#7F77DD" opacity="0.85"/>
    <circle cx="60" cy="40" r="18" fill="#AFA9EC" opacity="0.7"/>
    <circle cx="60" cy="40" r="8" fill="white" opacity="0.9"/>
  </svg>`
}

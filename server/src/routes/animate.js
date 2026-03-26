const cache = new Map()
const CACHE_TTL = 120_000
const MODELS = ['gemini-2.0-flash-lite', 'gemini-2.0-flash']

export async function setupAnimateRoute(app) {

  // Tăng timeout cho Fastify route này
  app.post('/api/animate/identify', {
    config: { timeout: 120000 },
  }, async (req, reply) => {
    const { imageBase64 } = req.body || {}
    if (!imageBase64) return reply.code(400).send({ error: 'Missing imageBase64' })

    const allKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
    ].filter(Boolean)

    if (!allKeys.length) return reply.code(500).send({ error: 'No GEMINI_API_KEY set' })

    // Cache check
    const cacheKey = imageBase64.slice(0, 120)
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      console.log('[animate] cache hit →', cached.data.label)
      return reply.send(cached.data)
    }

    // Thử từng key × model, retry với backoff nếu bị limit
    const MAX_ATTEMPTS = 3
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      for (const key of allKeys) {
        for (const model of MODELS) {
          try {
            const result = await callGemini(key, model, imageBase64)
            if (result.rateLimited) {
              console.log(`[animate] key...${key.slice(-4)} ${model}: 429`)
              continue
            }
            cache.set(cacheKey, { ts: Date.now(), data: result })
            setTimeout(() => cache.delete(cacheKey), CACHE_TTL)
            console.log(`[animate] OK: "${result.label}" → ${result.behavior}`)
            return reply.send(result)
          } catch (err) {
            console.error(`[animate] ${model}:`, err.message.slice(0, 60))
          }
        }
      }

      if (attempt < MAX_ATTEMPTS - 1) {
        const wait = 8000 * (attempt + 1)
        console.log(`[animate] all limited, wait ${wait/1000}s...`)
        await sleep(wait)
      }
    }

    console.log('[animate] fallback after retries')
    return reply.send({ type:'drawing', label:'object', behavior:'roam', svg: defaultSVG(), fallback: true })
  })
}

async function callGemini(apiKey, model, imageBase64) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: 'image/png', data: imageBase64 } },
          { text: `What is in this image? Reply ONLY with JSON (no markdown):
{"type":"drawing","label":"fish","behavior":"swim","svg":"<svg viewBox=\\"0 0 120 80\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"}

type: "text" if handwritten words, "drawing" if sketch
label: the word(s) or single English noun
behavior: swim|drive|fly|bounce|fall|walk|float|spin|roam
svg: colorful illustration viewBox="0 0 120 80" no background

fish/whale→swim, car/truck/train→drive, bird/plane→fly, ball/balloon→bounce, star/leaf→fall, person/cat/dog→walk, cloud/ghost→float, flower/sun→spin` }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
    })
  })

  if (res.status === 429) return { rateLimited: true }
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 80)}`)

  const data = await res.json()
  let text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
  text = text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim()

  let parsed
  try { parsed = JSON.parse(text) }
  catch { return { type:'drawing', label:'object', behavior:'roam', svg: defaultSVG() } }

  const valid = ['swim','drive','fly','bounce','fall','walk','float','spin','roam']
  if (!valid.includes(parsed.behavior)) parsed.behavior = getBehavior(parsed.label, parsed.type)
  if (!parsed.svg?.startsWith('<svg')) parsed.svg = defaultSVG()
  return parsed
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

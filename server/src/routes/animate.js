// Cache kết quả 60s để tránh gọi API lặp lại
const cache = new Map()
const CACHE_TTL = 60_000

// Model list đúng tên theo Gemini API v1beta hiện tại
const MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
]

export async function setupAnimateRoute(app) {

  app.post('/api/animate/identify', async (req, reply) => {
    const { imageBase64 } = req.body || {}
    if (!imageBase64) return reply.code(400).send({ error: 'Missing imageBase64' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return reply.code(500).send({ error: 'GEMINI_API_KEY not set' })

    // Cache key từ 100 ký tự đầu của base64
    const cacheKey = imageBase64.slice(0, 100)
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      console.log('[animate] cache hit')
      return reply.send(cached.data)
    }

    let lastError = ''
    for (const model of MODELS) {
      try {
        const result = await callGemini(apiKey, model, imageBase64)
        if (result.rateLimited) {
          console.log(`[animate] ${model} rate limited, trying next...`)
          lastError = result.error
          await sleep(500)
          continue
        }
        // Lưu cache
        cache.set(cacheKey, { ts: Date.now(), data: result })
        setTimeout(() => cache.delete(cacheKey), CACHE_TTL)
        return reply.send(result)
      } catch (err) {
        lastError = err.message
        console.error(`[animate] ${model} error:`, err.message.slice(0, 120))
      }
    }

    // Tất cả fail — trả fallback có SVG mặc định thay vì null
    console.log('[animate] all failed, using fallback. Last error:', lastError.slice(0,100))
    return reply.send({
      type: 'drawing', label: 'object', behavior: 'roam',
      svg: defaultSVG(), fallback: true,
    })
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
          { text: `What is drawn or written in this image?

Reply with JSON only (no markdown):
{"type":"drawing","label":"fish","behavior":"swim","svg":"SVG_HERE"}

type: "text" if handwritten words, "drawing" if sketch
label: exact word(s) if text, or single English noun if drawing
behavior: swim/drive/fly/bounce/fall/walk/float/spin/roam
svg: clean colorful SVG viewBox="0 0 120 80", no background

Behavior guide: fish/whale=swim, car/truck=drive, bird/plane=fly, ball=bounce, star/leaf=fall, person/cat=walk, cloud=float, flower/sun=spin` }
        ]
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
    })
  })

  if (res.status === 429) return { rateLimited: true, error: `429 on ${model}` }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body.slice(0, 150)}`)
  }

  const data = await res.json()
  let text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
  text = text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim()

  let parsed
  try { parsed = JSON.parse(text) }
  catch {
    console.error(`[animate] parse fail:`, text.slice(0, 150))
    return { type: 'drawing', label: 'object', behavior: 'roam', svg: defaultSVG() }
  }

  const valid = ['swim','drive','fly','bounce','fall','walk','float','spin','roam']
  if (!valid.includes(parsed.behavior)) parsed.behavior = getBehavior(parsed.label, parsed.type)
  if (!parsed.svg || !parsed.svg.startsWith('<svg')) parsed.svg = defaultSVG()

  console.log(`[animate] ${model}: "${parsed.label}" → ${parsed.behavior}`)
  return parsed
}

function getBehavior(label, type) {
  const l = (label || '').toLowerCase()
  if (type === 'text') {
    if (/whale|fish|shark|swim|ocean|sea/.test(l)) return 'swim'
    if (/fly|bird|sky|plane|air/.test(l)) return 'fly'
    if (/car|drive|race|road/.test(l)) return 'drive'
    if (/star|fall|rain|snow|leaf/.test(l)) return 'fall'
    return 'float'
  }
  if (/fish|whale|shark|dolphin|seal|octopus|tuna|crab/.test(l)) return 'swim'
  if (/car|truck|bus|train|bike|motorcycle|van|jeep/.test(l)) return 'drive'
  if (/bird|butterfly|bee|plane|airplane|ufo|dragon|eagle|bat|kite/.test(l)) return 'fly'
  if (/ball|balloon|bubble/.test(l)) return 'bounce'
  if (/star|leaf|snowflake|petal|feather/.test(l)) return 'fall'
  if (/person|human|man|woman|boy|girl|stick|cat|dog|rabbit|bear/.test(l)) return 'walk'
  if (/cloud|jellyfish|ghost/.test(l)) return 'float'
  if (/flower|sun|wheel|spiral/.test(l)) return 'spin'
  return 'roam'
}

function defaultSVG() {
  return `<svg viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="40" r="25" fill="#7F77DD" opacity="0.8"/>
    <circle cx="60" cy="40" r="15" fill="#AFA9EC" opacity="0.6"/>
    <circle cx="60" cy="40" r="6" fill="white" opacity="0.9"/>
  </svg>`
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

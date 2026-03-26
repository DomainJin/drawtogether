const cache = new Map()
const CACHE_TTL = 120_000  // 2 phút

// Queue để tránh gọi API đồng thời
let lastCallTime = 0
const MIN_INTERVAL = 4000  // 4s giữa các call (15 req/phút = 1 req/4s)

const MODELS = ['gemini-2.0-flash-lite', 'gemini-2.0-flash']

// Hỗ trợ nhiều key luân phiên: GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3
let keyIndex = 0
function getNextKey(env) {
  const keys = [
    env.GEMINI_API_KEY,
    env.GEMINI_API_KEY_2,
    env.GEMINI_API_KEY_3,
  ].filter(Boolean)
  if (!keys.length) return null
  const key = keys[keyIndex % keys.length]
  keyIndex++
  return key
}

export async function setupAnimateRoute(app) {

  app.post('/api/animate/identify', async (req, reply) => {
    const { imageBase64 } = req.body || {}
    if (!imageBase64) return reply.code(400).send({ error: 'Missing imageBase64' })

    const apiKey = getNextKey(process.env)
    if (!apiKey) return reply.code(500).send({ error: 'GEMINI_API_KEY not set' })

    // Cache check
    const cacheKey = imageBase64.slice(0, 120)
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      console.log('[animate] cache hit →', cached.data.label)
      return reply.send(cached.data)
    }

    // Rate limit local: đợi đủ khoảng cách
    const now = Date.now()
    const wait = Math.max(0, MIN_INTERVAL - (now - lastCallTime))
    if (wait > 0) {
      console.log(`[animate] waiting ${wait}ms before API call`)
      await sleep(wait)
    }
    lastCallTime = Date.now()

    // Thử từng model với từng key
    let result = null
    const allKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
    ].filter(Boolean)

    outer:
    for (const key of allKeys) {
      for (const model of MODELS) {
        try {
          result = await callGemini(key, model, imageBase64)
          if (result.rateLimited) {
            console.log(`[animate] key...${key.slice(-4)} ${model} rate limited`)
            continue
          }
          break outer
        } catch (err) {
          console.error(`[animate] ${model}:`, err.message.slice(0, 80))
        }
      }
    }

    if (!result || result.rateLimited) {
      console.log('[animate] rate limited, returning fallback with default SVG')
      result = { type: 'drawing', label: 'object', behavior: 'roam', svg: defaultSVG(), rateLimited: true }
    }

    cache.set(cacheKey, { ts: Date.now(), data: result })
    setTimeout(() => cache.delete(cacheKey), CACHE_TTL)
    return reply.send(result)
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
          { text: `Identify what is drawn or written in this image.

Reply ONLY with JSON, no markdown:
{"type":"drawing","label":"fish","behavior":"swim","svg":"<svg viewBox=\\"0 0 120 80\\" xmlns=\\"http://www.w3.org/2000/svg\\">SHAPES_HERE</svg>"}

type: "text" if handwritten words/letters, "drawing" if sketch
label: the word(s) if text, or single English noun if drawing  
behavior: swim|drive|fly|bounce|fall|walk|float|spin|roam
svg: colorful illustration, viewBox="0 0 120 80", no background rect

Quick behavior guide:
fish/whale/shark/sea creature → swim
car/truck/bus/train/vehicle → drive  
bird/plane/butterfly/ufo → fly
ball/balloon/bubble → bounce
star/leaf/snow/petal → fall
person/human/cat/dog/animal → walk
cloud/ghost/jellyfish → float
flower/sun/wheel → spin
text label uses content to decide behavior` }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 800 }
    })
  })

  if (res.status === 429) return { rateLimited: true, error: `429 on ${model}` }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body.slice(0, 100)}`)
  }

  const data = await res.json()
  let text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
  text = text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim()

  let parsed
  try { parsed = JSON.parse(text) }
  catch {
    console.error('[animate] parse fail:', text.slice(0, 100))
    return { type:'drawing', label:'object', behavior:'roam', svg: defaultSVG() }
  }

  const valid = ['swim','drive','fly','bounce','fall','walk','float','spin','roam']
  if (!valid.includes(parsed.behavior)) parsed.behavior = getBehavior(parsed.label, parsed.type)
  if (!parsed.svg?.startsWith('<svg')) parsed.svg = defaultSVG()

  console.log(`[animate] ${model}: "${parsed.label}" → ${parsed.behavior}`)
  return parsed
}

function getBehavior(label, type) {
  const l = (label || '').toLowerCase()
  if (type === 'text') {
    if (/fish|whale|shark|swim|ocean|sea|water/.test(l)) return 'swim'
    if (/fly|bird|sky|plane|air/.test(l)) return 'fly'
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

const cache = new Map()
const CACHE_TTL = 120_000

const MODELS = ['gemini-2.0-flash-lite', 'gemini-2.0-flash']

export async function setupAnimateRoute(app) {

  app.post('/api/animate/identify', async (req, reply) => {
    // Tăng timeout cho route này lên 120s
    req.raw.setTimeout(120_000)

    const { imageBase64 } = req.body || {}
    if (!imageBase64) return reply.code(400).send({ error: 'Missing imageBase64' })

    const allKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
    ].filter(Boolean)

    if (!allKeys.length) return reply.code(500).send({ error: 'No GEMINI_API_KEY set' })

    const cacheKey = imageBase64.slice(0, 120)
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      console.log('[animate] cache hit →', cached.data.label)
      return reply.send(cached.data)
    }

    // Retry với exponential backoff — đợi đến khi được
    const MAX_ATTEMPTS = 8
    const BASE_WAIT = 5000   // 5s lần đầu
    const MAX_WAIT  = 40000  // tối đa 40s mỗi lần chờ

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Thử từng key × từng model
      for (const key of allKeys) {
        for (const model of MODELS) {
          try {
            const result = await callGemini(key, model, imageBase64)
            if (result.rateLimited) {
              console.log(`[animate] attempt ${attempt+1} key...${key.slice(-4)} ${model}: rate limited`)
              continue
            }
            // Thành công!
            cache.set(cacheKey, { ts: Date.now(), data: result })
            setTimeout(() => cache.delete(cacheKey), CACHE_TTL)
            console.log(`[animate] success on attempt ${attempt+1}: "${result.label}" → ${result.behavior}`)
            return reply.send(result)
          } catch (err) {
            console.error(`[animate] ${model} error:`, err.message.slice(0, 80))
          }
        }
      }

      // Tất cả key bị limit — tính thời gian chờ theo exponential backoff
      const waitMs = Math.min(BASE_WAIT * Math.pow(1.8, attempt), MAX_WAIT)
      console.log(`[animate] all keys rate limited, waiting ${Math.round(waitMs/1000)}s before retry ${attempt+2}/${MAX_ATTEMPTS}...`)
      await sleep(waitMs)
    }

    // Sau tất cả retry vẫn fail
    console.log('[animate] exhausted all retries, returning fallback')
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
          { text: `Identify what is drawn or written in this image.

Reply ONLY with JSON, no markdown:
{"type":"drawing","label":"fish","behavior":"swim","svg":"<svg viewBox=\\"0 0 120 80\\" xmlns=\\"http://www.w3.org/2000/svg\\">SHAPES_HERE</svg>"}

type: "text" if handwritten words/letters, "drawing" if sketch
label: word(s) if text, single English noun if drawing
behavior: swim|drive|fly|bounce|fall|walk|float|spin|roam
svg: colorful illustration viewBox="0 0 120 80", no background

Behavior: fish/whale→swim, car/truck/train→drive, bird/plane/butterfly→fly, ball/balloon→bounce, star/leaf/snow→fall, person/cat/dog→walk, cloud/ghost→float, flower/sun→spin` }
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
    if (/fish|whale|shark|swim|ocean|sea/.test(l)) return 'swim'
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

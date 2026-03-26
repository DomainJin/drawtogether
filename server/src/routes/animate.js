export async function setupAnimateRoute(app) {

  app.post('/api/animate/identify', async (req, reply) => {
    const { imageBase64 } = req.body || {}
    if (!imageBase64) return reply.code(400).send({ error: 'Missing imageBase64' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return reply.code(500).send({ error: 'GEMINI_API_KEY not set' })

    // Thử lần lượt các model, fallback nếu bị rate limit
    const models = [
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
    ]

    let lastError = ''
    for (const model of models) {
      try {
        const result = await callGemini(apiKey, model, imageBase64)
        if (result.rateLimited) {
          console.log(`[animate] ${model} rate limited, trying next...`)
          lastError = result.error
          continue
        }
        return reply.send(result)
      } catch (err) {
        lastError = err.message
        console.error(`[animate] ${model} error:`, err.message)
      }
    }

    // Tất cả bị rate limit — trả fallback thay vì crash
    console.log('[animate] all models rate limited, using fallback')
    return reply.send({
      type: 'drawing',
      label: 'object',
      behavior: 'roam',
      svg: null,
      fallback: true,
      error: lastError,
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
          { text: `Analyze this hand-drawn image. Respond with JSON only, no markdown.

Rules:
- If handwritten TEXT/words: type="text", label=exact words
- If DRAWING/sketch: type="drawing", label=one English noun

Behavior options:
swim(fish/whale/sea), drive(car/truck/train), fly(bird/plane/butterfly),
bounce(ball/balloon), fall(star/leaf/snow), walk(person/cat/dog),
float(cloud/ghost), spin(flower/sun), roam(other)

SVG rules: viewBox="0 0 120 80", colorful, no background rect
- text type: <text> centered, font-size="36", bold, colorful fill
- drawing type: colorful illustration with shapes

JSON format:
{"type":"drawing","label":"fish","behavior":"swim","svg":"<svg viewBox=\\"0 0 120 80\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"}` }
        ]
      }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1200 }
    })
  })

  if (res.status === 429) {
    const body = await res.text()
    return { rateLimited: true, error: `429 rate limit on ${model}` }
  }

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body.slice(0, 150)}`)
  }

  const data = await res.json()
  let text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
  text = text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim()

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    console.error(`[animate] parse error for ${model}:`, text.slice(0, 200))
    return { type: 'drawing', label: 'object', behavior: 'roam', svg: null }
  }

  const valid = ['swim','drive','fly','bounce','fall','walk','float','spin','roam']
  if (!valid.includes(parsed.behavior)) {
    parsed.behavior = getBehavior(parsed.label, parsed.type)
  }

  console.log(`[animate] ${model}: ${parsed.type} "${parsed.label}" → ${parsed.behavior} | svg:${!!parsed.svg}`)
  return parsed
}

function getBehavior(label, type) {
  const l = (label || '').toLowerCase()
  if (type === 'text') {
    if (/whale|fish|shark|swim|ocean|sea|water/.test(l)) return 'swim'
    if (/fly|bird|sky|plane|air|cloud/.test(l)) return 'fly'
    if (/car|drive|race|road|speed/.test(l)) return 'drive'
    if (/star|fall|rain|snow|leaf/.test(l)) return 'fall'
    if (/bounce|ball|jump/.test(l)) return 'bounce'
    return 'float'
  }
  if (/fish|whale|shark|dolphin|seal|squid|octopus|tuna|salmon|crab/.test(l)) return 'swim'
  if (/car|truck|bus|train|bike|motorcycle|vehicle|van|jeep|taxi/.test(l)) return 'drive'
  if (/bird|butterfly|bee|plane|airplane|ufo|dragon|eagle|owl|bat|kite/.test(l)) return 'fly'
  if (/ball|balloon|bubble|sphere/.test(l)) return 'bounce'
  if (/star|leaf|snowflake|petal|feather|rain|snow/.test(l)) return 'fall'
  if (/person|human|man|woman|boy|girl|stick|cat|dog|rabbit|bear/.test(l)) return 'walk'
  if (/cloud|jellyfish|ghost|smoke/.test(l)) return 'float'
  if (/flower|sun|wheel|spiral/.test(l)) return 'spin'
  return 'roam'
}

export async function setupAnimateRoute(app) {

  app.post('/api/animate/identify', async (req, reply) => {
    const { imageBase64 } = req.body || {}
    if (!imageBase64) return reply.code(400).send({ error: 'Missing imageBase64' })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return reply.code(500).send({ error: 'GEMINI_API_KEY not set' })

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  inline_data: {
                    mime_type: 'image/png',
                    data: imageBase64,
                  }
                },
                {
                  text: `Analyze this hand-drawn image and respond with JSON only.

Determine:
- Is it handwritten TEXT (letters/words)? → type="text", label=exact words read
- Is it a DRAWING/SKETCH? → type="drawing", label=single English noun

Pick behavior:
swim=fish/whale/sea creatures
drive=car/truck/vehicle/train
fly=bird/plane/butterfly/rocket
bounce=ball/balloon/bubble
fall=star/leaf/snow/petal
walk=person/cat/dog/animal
float=cloud/ghost/jellyfish
spin=flower/sun/wheel
roam=anything else

Create SVG viewBox="0 0 120 80":
- For text: large centered <text> element, bold, colorful, font-size 32-40
- For drawing: colorful illustration, vivid colors, recognizable shapes

Respond ONLY with this JSON structure, no markdown:
{"type":"drawing","label":"fish","behavior":"swim","svg":"<svg viewBox=\\"0 0 120 80\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"}`
                }
              ]
            }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 1500,
            }
          })
        }
      )

      if (!res.ok) {
        const err = await res.text()
        console.error('[animate] Gemini error:', res.status, err)
        return reply.code(500).send({ error: `Gemini API error ${res.status}: ${err.slice(0, 200)}` })
      }

      const data = await res.json()
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      console.log('[animate] raw:', text.slice(0, 200))

      // Strip markdown nếu có
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/,'').replace(/\s*```$/,'').trim()

      let parsed
      try {
        parsed = JSON.parse(text)
      } catch (e) {
        console.error('[animate] parse error:', e.message, '| raw:', text.slice(0, 300))
        return reply.send({ type: 'drawing', label: 'object', behavior: 'roam', svg: null })
      }

      // Validate behavior
      const valid = ['swim','drive','fly','bounce','fall','walk','float','spin','roam']
      if (!valid.includes(parsed.behavior)) {
        parsed.behavior = getBehavior(parsed.label, parsed.type)
      }

      console.log('[animate]', parsed.type, parsed.label, '→', parsed.behavior, '| svg:', !!parsed.svg)
      return reply.send(parsed)

    } catch (err) {
      console.error('[animate] exception:', err)
      return reply.code(500).send({ error: err.message })
    }
  })
}

function getBehavior(label, type) {
  const l = (label || '').toLowerCase()

  if (type === 'text') {
    if (/whale|fish|shark|swim|ocean|sea|water/.test(l)) return 'swim'
    if (/fly|bird|sky|plane|air|cloud/.test(l)) return 'fly'
    if (/car|drive|race|fast|road|speed/.test(l)) return 'drive'
    if (/star|fall|rain|snow|leaf/.test(l)) return 'fall'
    if (/bounce|ball|jump/.test(l)) return 'bounce'
    return 'float'
  }

  if (/fish|whale|shark|dolphin|seal|squid|octopus|tuna|salmon|crab/.test(l)) return 'swim'
  if (/car|truck|bus|train|bike|motorcycle|vehicle|van|jeep|taxi|tractor/.test(l)) return 'drive'
  if (/bird|butterfly|bee|plane|airplane|ufo|dragon|eagle|owl|bat|kite/.test(l)) return 'fly'
  if (/ball|balloon|bubble|sphere/.test(l)) return 'bounce'
  if (/star|leaf|snowflake|petal|feather|rain|snow/.test(l)) return 'fall'
  if (/person|human|man|woman|boy|girl|stick|cat|dog|rabbit|bear|fox/.test(l)) return 'walk'
  if (/cloud|jellyfish|ghost|smoke/.test(l)) return 'float'
  if (/flower|sun|wheel|spiral/.test(l)) return 'spin'
  return 'roam'
}

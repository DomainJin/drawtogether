export async function setupAnimateRoute(app) {

  app.post('/api/animate/identify', async (req, reply) => {
    const { imageBase64 } = req.body || {}
    if (!imageBase64) return reply.code(400).send({ error: 'Missing imageBase64' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return reply.code(500).send({ error: 'ANTHROPIC_API_KEY not set' })

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
          max_tokens: 1200,
          system: 'You are a visual analysis and SVG generation assistant. Always respond with valid JSON only, no markdown, no explanation.',
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: imageBase64 }
              },
              {
                type: 'text',
                text: `Analyze this hand-drawn image and respond with JSON.

First determine:
- Is it handwritten TEXT (letters/words)? → type="text", label=exact words read
- Is it a DRAWING/SKETCH? → type="drawing", label=single English noun

Then pick behavior:
swim=fish/whale/sea creatures, drive=car/truck/vehicle, fly=bird/plane/butterfly,
bounce=ball/balloon, fall=star/leaf/snow/petal, walk=person/cat/dog,
float=cloud/ghost/jellyfish, spin=flower/sun/wheel, roam=anything else

Then create SVG viewBox="0 0 120 80":
- For text: large centered <text> element, bold, colorful gradient, font-size 32-40
- For drawing: colorful illustration using shapes, vivid colors

JSON format (respond with this exact structure):
{"type":"drawing","label":"fish","behavior":"swim","svg":"<svg viewBox=\\"0 0 120 80\\" xmlns=\\"http://www.w3.org/2000/svg\\"><circle cx=\\"60\\" cy=\\"40\\" r=\\"20\\" fill=\\"orange\\"/></svg>"}`
              }
            ]
          }]
        })
      })

      if (!res.ok) {
        const err = await res.text()
        console.error('[animate] Anthropic error:', res.status, err)
        return reply.code(500).send({ error: `Anthropic API error ${res.status}` })
      }

      const data = await res.json()
      console.log('[animate] raw content:', data.content?.[0]?.text?.slice(0, 200))

      let text = (data.content?.[0]?.text || '').trim()
      // Strip markdown
      text = text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim()

      let parsed
      try {
        parsed = JSON.parse(text)
      } catch(e) {
        console.error('[animate] JSON parse failed:', e.message, '| raw:', text.slice(0, 300))
        // Fallback: trả về object với behavior roam nhưng không crash
        return reply.send({ type: 'drawing', label: 'object', behavior: 'roam', svg: null, parseError: text.slice(0, 100) })
      }

      // Validate/fix behavior
      const validBehaviors = ['swim','drive','fly','bounce','fall','walk','float','spin','roam']
      if (!validBehaviors.includes(parsed.behavior)) {
        parsed.behavior = getBehavior(parsed.label, parsed.type)
      }

      console.log('[animate] result:', parsed.type, parsed.label, parsed.behavior, 'svg:', parsed.svg?.slice(0,50))
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
    if (/whale|fish|shark|swim|ocean|sea|water|mermaid/.test(l)) return 'swim'
    if (/fly|bird|sky|plane|air|cloud|angel/.test(l)) return 'fly'
    if (/car|drive|race|fast|road|speed|truck/.test(l)) return 'drive'
    if (/star|fall|rain|snow|leaf|petal/.test(l)) return 'fall'
    if (/bounce|ball|jump|spring/.test(l)) return 'bounce'
    return 'float'
  }

  if (/fish|whale|shark|dolphin|seal|squid|octopus|tuna|salmon|crab|lobster|shrimp/.test(l)) return 'swim'
  if (/car|truck|bus|train|bike|motorcycle|vehicle|van|jeep|taxi|tractor|ambulance/.test(l)) return 'drive'
  if (/bird|butterfly|bee|plane|airplane|ufo|dragon|eagle|owl|bat|kite|parrot|hawk/.test(l)) return 'fly'
  if (/ball|balloon|bubble|sphere|orb/.test(l)) return 'bounce'
  if (/star|leaf|snowflake|petal|feather|raindrop|teardrop/.test(l)) return 'fall'
  if (/person|human|man|woman|boy|girl|stick|cat|dog|rabbit|bear|fox|penguin|duck/.test(l)) return 'walk'
  if (/cloud|jellyfish|ghost|smoke|spirit|angel|fairy/.test(l)) return 'float'
  if (/flower|sun|wheel|spiral|propeller|fan/.test(l)) return 'spin'
  return 'roam'
}

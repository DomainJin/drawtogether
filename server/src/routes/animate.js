export async function setupAnimateRoute(app) {

  app.post('/api/animate/identify', async (req, reply) => {
    const { imageBase64 } = req.body || {}
    if (!imageBase64) return reply.code(400).send({ error: 'Missing imageBase64' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return reply.code(500).send({ error: 'ANTHROPIC_API_KEY not set' })

    try {
      // Pass 1: nhận diện object/text
      const identifyRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
              { type: 'text', text: `Look at this image. Is it:
A) Handwritten text/words/letters → reply: TEXT: [the exact words you read]
B) A drawn object/sketch → reply: OBJECT: [one English noun, e.g. fish, car, star, person, bird, whale, balloon, flower]

Reply with ONLY one line in the format above, nothing else.` }
            ]
          }]
        })
      })

      const identData = await identifyRes.json()
      const identText = (identData.content?.[0]?.text || '').trim()
      console.log('[animate] identify result:', identText)

      let type = 'drawing'
      let label = 'object'

      if (identText.startsWith('TEXT:')) {
        type = 'text'
        label = identText.replace('TEXT:', '').trim()
      } else if (identText.startsWith('OBJECT:')) {
        type = 'drawing'
        label = identText.replace('OBJECT:', '').trim().toLowerCase().split(/\s+/)[0]
      }

      // Map label → behavior
      const behavior = getBehavior(label, type)
      console.log('[animate] label:', label, 'type:', type, 'behavior:', behavior)

      // Pass 2: sinh SVG đẹp
      const svgPrompt = type === 'text'
        ? `Create a beautiful decorative SVG of the text "${label}". 
Rules: viewBox="0 0 160 60", use <text> with large bold font (font-size="36"), 
apply a colorful gradient fill or bright stroke, maybe add small decorative elements around the text.
The text should be centered and clearly readable. No background.
Reply with ONLY the SVG tag, nothing else.`
        : `Create a clean colorful SVG illustration of a "${label}".
Rules: viewBox="0 0 120 80", use simple shapes (path/circle/rect/ellipse/polygon),
vivid appropriate colors (fish=orange, sky=blue, car=red/gray, star=yellow, etc),
recognizable silhouette, small details, no background rect, no text.
Reply with ONLY the SVG tag, nothing else.`

      const svgRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{ role: 'user', content: svgPrompt }]
        })
      })

      const svgData = await svgRes.json()
      let svg = (svgData.content?.[0]?.text || '').trim()
      svg = svg.replace(/^```svg\s*/,'').replace(/^```xml\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim()

      // Validate svg
      if (!svg.startsWith('<svg')) svg = null

      return reply.send({ type, label, behavior, svg })

    } catch (err) {
      console.error('[animate] error:', err)
      return reply.code(500).send({ error: err.message })
    }
  })
}

function getBehavior(label, type) {
  if (type === 'text') {
    // Chữ animate theo nội dung
    const l = label.toLowerCase()
    if (/whale|fish|shark|swim|ocean|sea|water/.test(l)) return 'swim'
    if (/fly|bird|sky|plane|air|cloud/.test(l)) return 'fly'
    if (/car|drive|race|fast|road|speed/.test(l)) return 'drive'
    if (/star|fall|rain|snow|leaf/.test(l)) return 'fall'
    if (/bounce|ball|jump/.test(l)) return 'bounce'
    return 'float' // text mặc định float
  }

  const l = label.toLowerCase()
  if (/fish|whale|shark|dolphin|seal|squid|octopus|tuna|salmon|crab/.test(l)) return 'swim'
  if (/car|truck|bus|train|bike|motorcycle|vehicle|van|jeep|taxi|rocket/.test(l)) return 'drive'
  if (/bird|butterfly|bee|plane|airplane|ufo|dragon|eagle|owl|bat|kite/.test(l)) return 'fly'
  if (/ball|balloon|bubble|sphere|orb/.test(l)) return 'bounce'
  if (/star|leaf|snowflake|petal|feather|rain|snow/.test(l)) return 'fall'
  if (/person|human|man|woman|boy|girl|stick|cat|dog|rabbit|bear/.test(l)) return 'walk'
  if (/cloud|jellyfish|ghost|smoke|spirit/.test(l)) return 'float'
  if (/flower|sun|wheel|spiral/.test(l)) return 'spin'
  return 'roam'
}

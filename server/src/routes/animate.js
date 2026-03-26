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
          max_tokens: 1500,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: imageBase64 }
              },
              {
                type: 'text',
                text: `Analyze this hand-drawn image carefully.

STEP 1 - Detect if it contains handwritten text/letters:
- If YES (contains readable words/letters): set type="text", label=the exact word(s) read
- If NO (it's a drawing/sketch): set type="drawing", label=one English noun describing what's drawn

STEP 2 - Choose behavior based on what you identified:
Behaviors: "swim" (fish/sea creatures), "drive" (vehicles/cars/trucks), "fly" (birds/planes/butterflies/balloons), "bounce" (balls/bubbles), "fall" (stars/leaves/snow/petals), "walk" (people/animals/stick figures), "spin" (stars/flowers/abstract), "float" (clouds/jellyfish/ghosts), "roam" (anything else)

STEP 3 - Create SVG:
- If type="text": create an SVG with the text rendered beautifully (decorative font style, colorful, maybe with relevant small icons)
- If type="drawing": create a clean beautiful SVG illustration of the object

SVG rules:
- viewBox="0 0 120 80" exactly
- Use vivid colors matching the object
- For text SVGs: use <text> element with large font, decorative style, gradient fill or stroke effects
- For drawing SVGs: use shapes to create recognizable illustration
- NO background rect

Respond ONLY with this JSON (no markdown, no explanation):
{"type":"drawing","label":"fish","behavior":"swim","svg":"<svg viewBox=\\"0 0 120 80\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"}`
              }
            ]
          }]
        })
      })

      const data = await res.json()
      let text = (data.content?.[0]?.text || '{}').trim()
      text = text.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/\s*```$/,'').trim()

      let parsed
      try { parsed = JSON.parse(text) }
      catch { parsed = { type: 'drawing', label: 'object', behavior: 'roam', svg: null } }

      return reply.send(parsed)
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })
}

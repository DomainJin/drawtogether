// Route proxy cho Anthropic — nhận diện VÀ vẽ lại SVG
export async function setupAnimateRoute(app) {

  // Nhận diện + sinh SVG đẹp
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
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: imageBase64 }
              },
              {
                type: 'text',
                text: `Look at this hand-drawn sketch and:
1. Identify what it is (one English word)
2. Create a clean, beautiful SVG illustration of that object

Rules for SVG:
- viewBox="0 0 120 80" exactly
- Use simple shapes: path, circle, rect, ellipse, polygon
- Make it look like a nice icon/illustration (not just outline)
- Use appropriate colors (car=gray/blue, fish=orange/blue, bird=sky blue, etc)
- Add small details to make it look good
- NO text, NO background rect
- Keep it simple but recognizable

Respond in this exact JSON format (no markdown):
{"label":"fish","behavior":"swim","svg":"<svg viewBox=\\"0 0 120 80\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"}`
              }
            ]
          }]
        })
      })

      const data = await res.json()
      let text = data.content?.[0]?.text?.trim() || '{}'

      // Strip markdown nếu có
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

      let parsed
      try {
        parsed = JSON.parse(text)
      } catch {
        // Fallback nếu parse lỗi
        parsed = { label: 'object', behavior: 'bounce', svg: null }
      }

      return reply.send(parsed)
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })
}

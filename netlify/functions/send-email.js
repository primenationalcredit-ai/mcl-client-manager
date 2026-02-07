export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } })
  }
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })

  try {
    const { to, subject, body } = await req.json()
    if (!to || !subject || !body) return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 })

    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.SENDGRID_FROM_EMAIL || 'noreply@asapcreditrepairusa.com', name: 'ASAP Credit Repair' },
        subject,
        content: [{ type: 'text/plain', value: body }, { type: 'text/html', value: body.replace(/\n/g, '<br>') }]
      })
    })

    if (r.status === 202 || r.status === 200) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    const err = await r.text()
    return new Response(JSON.stringify({ error: `SendGrid ${r.status}: ${err}` }), { status: 500 })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
}

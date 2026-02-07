// ═══════════════════════════════════════════════════════════════
// SEND EMAIL — Netlify Serverless Function → SendGrid
// Wraps plain-text body in branded ASAP Credit Repair HTML template
// ═══════════════════════════════════════════════════════════════

function brandedHtml(body) {
  const bodyHtml = body.replace(/\n/g, '<br>');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ASAP Credit Repair</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<!-- HEADER -->
<tr><td style="background:#0f172a;padding:28px 32px;text-align:center;">
  <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:800;letter-spacing:0.5px;">ASAP CREDIT REPAIR</h1>
  <p style="margin:4px 0 0;font-size:11px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;">McCarthy Law Partnership</p>
</td></tr>

<!-- ACCENT BAR -->
<tr><td style="height:4px;background:linear-gradient(90deg,#f59e0b,#ef4444,#8b5cf6);"></td></tr>

<!-- BODY -->
<tr><td style="padding:32px 32px 24px;font-size:15px;line-height:1.7;color:#334155;">
  ${bodyHtml}
</td></tr>

<!-- DIVIDER -->
<tr><td style="padding:0 32px;">
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;">
</td></tr>

<!-- FOOTER -->
<tr><td style="padding:24px 32px 28px;text-align:center;">
  <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#0f172a;">ASAP Credit Repair USA</p>
  <p style="margin:0 0 4px;font-size:12px;color:#64748b;">Helping Americans Repair Their Credit Since 2013</p>
  <p style="margin:0 0 12px;font-size:12px;color:#64748b;">&#128222; (888) 960-1802 &nbsp;|&nbsp; &#127760; asapcreditrepairusa.com</p>
  <p style="margin:0;font-size:10px;color:#94a3b8;">This email is regarding a potential legal matter on your credit report.<br>If you believe you received this email in error, please contact us.</p>
</td></tr>

<!-- BOTTOM BAR -->
<tr><td style="height:6px;background:#0f172a;border-radius:0 0 12px 12px;"></td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } })
  }
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })

  try {
    const { to, subject, body, clientName } = await req.json()
    if (!to || !subject || !body) return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 })

    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.SENDGRID_FROM_EMAIL || 'noreply@asapcreditrepairusa.com', name: 'ASAP Credit Repair' },
        subject,
        content: [
          { type: 'text/plain', value: body },
          { type: 'text/html', value: brandedHtml(body) }
        ]
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

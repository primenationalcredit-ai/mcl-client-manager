// SEND EMAIL - Joe's exact ASAP email design
// 4 monitoring sites only: 3 Scores, Free Score 360, National Credit Report, Credit Builder IQ

const MONITORING_HTML = `
<div class="section-box monitoring-box">
  <p class="monitoring-box-title">Free Trial Sites We Recommend</p>
  <div class="monitoring-item">
    <div class="logo-wrap"><img src="https://www.3scores.com/resources/images/lAO6xXw0TlS72sJ9nifo-3scores.com.svg" alt="3 Scores Logo"></div>
    <p><strong>3 Scores</strong></p>
    <p>Quick way to access your credit report details so you can send us updated reports.</p>
    <a href="https://www.rsptrack.com/click.track?CID=466744&AFID=426429" target="_blank" rel="noopener noreferrer">Sign Up Now</a>
  </div>
  <div class="monitoring-item">
    <div class="logo-wrap"><img src="https://www.freescore360.com/welcome/5v/images/wl/wl_www.freescore360.com_w440xh150.png" alt="Free Score 360 Logo"></div>
    <p><strong>Free Score 360</strong></p>
    <p>Monitoring access that makes it easy to pull and share your updated credit reports.</p>
    <a href="https://www.rsptrack.com/click.track?CID=402425&AFID=426429" target="_blank" rel="noopener noreferrer">Sign Up Now</a>
  </div>
  <div class="monitoring-item">
    <div class="logo-wrap"><img src="https://secure.nationalcreditreport.com/welcome/5v/images/wl/wl_secure.nationalcreditreport.com_w440xh150.png" alt="National Credit Report Logo"></div>
    <p><strong>National Credit Report</strong></p>
    <p>Access reports and scores so we can confirm whether the error was corrected.</p>
    <a href="https://www.rsptrack.com/click.track?CID=418993&AFID=426429" target="_blank" rel="noopener noreferrer">Sign Up Now</a>
  </div>
  <div class="monitoring-item" style="margin-bottom:0;">
    <div class="logo-wrap"><img src="https://cdn.prod.website-files.com/67ace1d4f27463423543d012/67acf19c604f4e7d650a3763_creditbuilderiq-logo.svg" alt="Credit Builder IQ Logo"></div>
    <p><strong>Credit Builder IQ</strong></p>
    <p>Simple option to get updated reports quickly and forward them to our team.</p>
    <a href="https://www.rsptrack.com/click.track?CID=468231&AFID=426429" target="_blank" rel="noopener noreferrer">Sign Up Now</a>
  </div>
</div>`;

function brandedHtml(body) {
  let bodyHtml = body.replace(/\{credit_monitoring\}/g, MONITORING_HTML);
  if (!bodyHtml.includes('<')) {
    bodyHtml = bodyHtml.replace(/\n/g, '<br>');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin:0; padding:0; font-family:Verdana,Geneva,sans-serif; background-color:#ffffff; }
  .main-container { max-width:600px; margin:20px auto; padding:20px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; background-color:#ffffff; }
  .header { text-align:center; margin-bottom:20px; }
  .header img { width:216px; height:auto; }
  .section-box { padding:20px; margin-bottom:20px; background-color:#ffffff; word-wrap:break-word; overflow-wrap:break-word; box-sizing:border-box; border-bottom:1px solid #ddd; }
  .section-box p { font-size:16px; line-height:1.6; color:#333333; margin:10px 0; }
  .notice-box { background-color:#f7f7f7; padding:20px; border-radius:8px; margin-bottom:20px; border-left:4px solid #003f87; }
  .advice-box { padding:20px; border-radius:8px; border:4px solid #003f87; color:#333333; background-color:#ffffff; }
  .monitoring-box { padding:20px; border:1px solid #ddd; border-radius:8px; margin-bottom:20px; background-color:#f9f9f9; box-sizing:border-box; max-width:100%; }
  .monitoring-box-title { font-size:20px; font-weight:bold; text-align:center; color:#003f87; margin:0 0 10px; }
  .monitoring-item { margin-bottom:18px; text-align:center; padding:18px 14px; border:1px solid #e3e3e3; border-radius:10px; background:#ffffff; }
  .logo-wrap { height:56px; display:flex; align-items:center; justify-content:center; margin-bottom:10px; }
  .monitoring-item img { max-width:210px; width:auto; height:42px; display:block; }
  .monitoring-item a { display:inline-block; margin:12px 0 0; padding:10px 18px; background-color:#003f87; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:bold; }
  .signature { font-family:Verdana,Geneva,sans-serif; color:#333333; }
  .signature a { color:#007bff; text-decoration:none; }
  .soft-note { background-color:#f7f7f7; padding:16px 18px; border-radius:8px; border-left:4px solid #c9952b; }
  .soft-note p { margin:0; font-size:15px; line-height:1.6; color:#333333; }
  .warning-box { background-color:#fff5f5; padding:20px; border-radius:8px; border-left:4px solid #dc2626; }
  .warning-box p { margin:0; font-size:15px; line-height:1.6; color:#333333; }
  .success-box { background-color:#f0fff4; padding:20px; border-radius:8px; border-left:4px solid #22c55e; }
  .success-box p { margin:0; font-size:16px; line-height:1.6; color:#333333; }
</style>
</head>
<body>
<div class="main-container">
  <div class="header"><img src="https://asapcreditrepairusa.com/img/ASAP-Logo-New-2021.png" alt="ASAP Credit Repair Logo" width="216" height="149"></div>

  ${bodyHtml}

  <div class="section-box signature" style="border-bottom:none;margin-bottom:0;">
    <p>Thanks,</p>
    <p><strong>FCRA Violation Team</strong></p>
    <p>ASAP Credit Repair</p>
    <p><a href="mailto:accounts@asapcreditrepairusa.com">accounts@asapcreditrepairusa.com</a></p>
  </div>
</div>
</body>
</html>`;
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' } })
  }
  if (req.method !== 'POST') return new Response('POST only', { status: 405 })
  try {
    const { to, subject, body, plain } = await req.json()
    if (!to || !subject || !body) return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 })
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'info@asapcreditrepairusa.com'
    const replyTo = process.env.SENDGRID_REPLY_TO || 'accounts@asapcreditrepairusa.com'
    const content = plain
      ? [{ type: 'text/plain', value: body }]
      : [
          { type: 'text/plain', value: body.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\{credit_monitoring\}/g, '') },
          { type: 'text/html', value: brandedHtml(body) }
        ]
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: 'ASAP Credit Repair - FCRA Compliance' },
        reply_to: { email: replyTo, name: 'ASAP Credit Repair' },
        subject,
        content
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
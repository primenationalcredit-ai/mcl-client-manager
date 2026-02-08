// ═══════════════════════════════════════════════════════════════
// SEND EMAIL — Clean branded design matching ASAP email style
// Logo + Verdana + notice boxes + credit monitoring with logos
// ═══════════════════════════════════════════════════════════════

const MONITORING_HTML = `
<div style="padding:20px;border:1px solid #ddd;border-radius:8px;margin:20px 0;background:#f9f9f9;">
  <p style="font-size:20px;font-weight:bold;text-align:center;color:#003f87;margin:0 0 20px;">Credit Monitoring Sites We Recommend:</p>

  <div style="margin-bottom:25px;text-align:center;">
    <img src="https://cdn.prod.website-files.com/672157d53b4367c5a087bdd2/6721626409e40720924245cf_logo.svg" alt="IdentityIQ" width="200" style="margin-bottom:10px;">
    <p style="font-size:14px;color:#333;margin:5px 0;"><strong>IdentityIQ</strong></p>
    <p style="font-size:13px;color:#555;margin:5px 20px;">Enhanced identity theft protection with dark web monitoring, daily credit report monitoring, and up to $1 million in identity theft insurance.</p>
    <a href="https://member.identityiq.com/get-all-your-reports-now.aspx?offercode=431263JR" target="_blank" style="display:inline-block;margin:10px 0;padding:10px 24px;background:#003f87;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">Sign Up Now</a>
  </div>

  <div style="margin-bottom:25px;text-align:center;">
    <img src="https://www.creditbuilderiq.com/aff/2/img/creditbuilderiq-logo.svg" alt="Credit Builder IQ" width="200" style="margin-bottom:10px;">
    <p style="font-size:14px;color:#333;margin:5px 0;"><strong>Credit Builder IQ</strong></p>
    <p style="font-size:13px;color:#555;margin:5px 20px;">Comprehensive identity protection with credit monitoring, social security number alerts, and full-service identity restoration support.</p>
    <a href="https://secure.rspcdn.com/xprr/red/PID/14547/SID/sid_here?AffiliateReferenceID=uniqueclickIDhere" target="_blank" style="display:inline-block;margin:10px 0;padding:10px 24px;background:#003f87;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">Sign Up Now</a>
  </div>

  <div style="margin-bottom:25px;text-align:center;">
    <img src="https://www.smartcredit.com/resources/images/sc/shared/logo.svg" alt="SmartCredit" width="200" style="margin-bottom:10px;">
    <p style="font-size:14px;color:#333;margin:5px 0;"><strong>SmartCredit</strong></p>
    <p style="font-size:13px;color:#555;margin:5px 20px;">Unique ScoreTracker and ScoreBuilder to help improve your credit, with real-time monitoring and identity theft alerts.</p>
    <a href="https://www.smartcredit.com/?PID=52188" target="_blank" style="display:inline-block;margin:10px 0;padding:10px 24px;background:#003f87;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">Sign Up Now</a>
  </div>

  <div style="margin-bottom:25px;text-align:center;">
    <img src="https://member.identityiq.com/WebResources/BusinessLogo/2023-01-27T202510.287Z.png" alt="Credit Score IQ" width="200" style="margin-bottom:10px;">
    <p style="font-size:14px;color:#333;margin:5px 0;"><strong>Credit Score IQ</strong></p>
    <p style="font-size:13px;color:#555;margin:5px 20px;">Score tracking and credit monitoring to help improve your credit with real-time alerts and identity theft protection.</p>
    <a href="https://secure.rspcdn.com/xprr/red/PID/14539/SID/sid_here?AffiliateReferenceID=uniqueclickIDhere" target="_blank" style="display:inline-block;margin:10px 0;padding:10px 24px;background:#003f87;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">Sign Up Now</a>
  </div>

  <div style="margin-bottom:25px;text-align:center;">
    <img src="https://www.freescore360.com/welcome/5v/images/wl/wl_www.freescore360.com_w440xh150.png" alt="Free Score 360" width="200" style="margin-bottom:10px;">
    <p style="font-size:14px;color:#333;margin:5px 0;"><strong>Free Score 360</strong></p>
    <p style="font-size:13px;color:#555;margin:5px 20px;">Comprehensive credit monitoring with access to your credit scores, detailed reports, and real-time alerts from all three major bureaus.</p>
    <a href="https://www.rsptrack.com/click.track?CID=402425&AFID=426429" target="_blank" style="display:inline-block;margin:10px 0;padding:10px 24px;background:#003f87;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">Sign Up Now</a>
  </div>

  <div style="margin-bottom:25px;text-align:center;">
    <img src="https://www.3scores.com/resources/images/lAO6xXw0TlS72sJ9nifo-3scores.com.svg" alt="3 Scores" width="200" style="margin-bottom:10px;">
    <p style="font-size:14px;color:#333;margin:5px 0;"><strong>3 Scores</strong></p>
    <p style="font-size:13px;color:#555;margin:5px 20px;">Simple and effective credit monitoring with access to your scores and reports from all three major bureaus. Track changes and spot errors.</p>
    <a href="https://secure.rspcdn.com/xprr/red/PID/13839/SID/sid_here?AffiliateReferenceID=uniqueclickIDhere" target="_blank" style="display:inline-block;margin:10px 0;padding:10px 24px;background:#003f87;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">Sign Up Now</a>
  </div>

  <div style="margin-bottom:25px;text-align:center;">
    <img src="https://www.myscoreiq.com/msiq/myscore/img/myScoreIQ-Logo.png" alt="My Score IQ" width="200" style="margin-bottom:10px;">
    <p style="font-size:14px;color:#333;margin:5px 0;"><strong>My Score IQ</strong></p>
    <p style="font-size:13px;color:#555;margin:5px 20px;">Comprehensive credit monitoring with FICO Scores from all three bureaus, daily monitoring, score tracking, and identity theft protection.</p>
    <a href="https://www.i2gtrk.com/2MRKPJ4/21QFCT5/?source_id=display&sub1=%7B119116%7D" target="_blank" style="display:inline-block;margin:10px 0;padding:10px 24px;background:#003f87;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">Sign Up Now</a>
  </div>

  <div style="margin-bottom:25px;text-align:center;">
    <img src="https://secure.nationalcreditreport.com/welcome/5v/images/wl/wl_secure.nationalcreditreport.com_w440xh150.png" alt="National Credit Report" width="200" style="margin-bottom:10px;">
    <p style="font-size:14px;color:#333;margin:5px 0;"><strong>National Credit Report</strong></p>
    <p style="font-size:13px;color:#555;margin:5px 20px;">Easy access to credit reports and scores from all three major bureaus with daily monitoring, credit alerts, and identity theft protection.</p>
    <a href="http://www.rsptrack.com/click.track?CID=418993&AFID=426429" target="_blank" style="display:inline-block;margin:10px 0;padding:10px 24px;background:#003f87;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">Sign Up Now</a>
  </div>

  <div style="margin-bottom:10px;text-align:center;">
    <img src="https://cdn.promocodes.com/img/merchants/20464/360-logo/v2/myfreescorenow-com-coupons.png" alt="My Free Score Now" width="200" style="margin-bottom:10px;">
    <p style="font-size:14px;color:#333;margin:5px 0;"><strong>My Free Score Now</strong></p>
    <p style="font-size:13px;color:#555;margin:5px 20px;">Quick and easy access to credit reports and scores from all three major bureaus with daily monitoring and personalized alerts.</p>
    <a href="https://myfreescorenow.com/enroll/?AID=LoansUnlimited&PID=86814" target="_blank" style="display:inline-block;margin:10px 0;padding:10px 24px;background:#003f87;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;font-size:14px;">Sign Up Now</a>
  </div>
</div>`;

function brandedHtml(body) {
  // Replace {credit_monitoring} placeholder with full monitoring section
  let bodyHtml = body.replace(/\{credit_monitoring\}/g, MONITORING_HTML);

  // If no HTML tags, convert newlines
  if (!bodyHtml.includes('<')) {
    bodyHtml = bodyHtml.replace(/\n/g, '<br>');
  }

  // Auto-link bare URLs
  bodyHtml = bodyHtml.replace(
    /(?<!href="|href='|">|src=")(https?:\/\/[^\s<"']+)/g,
    '<a href="$1" style="color:#003f87;text-decoration:underline;" target="_blank">$1</a>'
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:Verdana,Geneva,sans-serif;background-color:#ffffff;">
<div style="max-width:600px;margin:20px auto;padding:20px;border:1px solid #ddd;border-radius:8px;background-color:#ffffff;">

  <!-- Logo -->
  <div style="text-align:center;margin-bottom:20px;">
    <img src="https://asapcreditrepairusa.com/img/ASAP-Logo-New-2021.png" alt="ASAP Credit Repair" width="216" style="width:216px;">
  </div>

  <!-- Body -->
  <div style="padding:0 10px 20px;border-bottom:1px solid #ddd;">
    ${bodyHtml}
  </div>

  <!-- Signature -->
  <div style="padding:20px 10px 0;color:#333333;font-size:14px;">
    <p style="margin:0 0 4px;">Thanks,</p>
    <p style="margin:0 0 2px;"><strong>FCRA Compliance Team</strong></p>
    <p style="margin:0 0 2px;"><em>ASAP Credit Repair USA</em></p>
    <p style="margin:0 0 2px;">(888) 960-1802</p>
    <p style="margin:0;"><a href="mailto:accounts@asapcreditrepairusa.com" style="color:#007bff;text-decoration:none;">accounts@asapcreditrepairusa.com</a></p>
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

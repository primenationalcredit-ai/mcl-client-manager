import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const sb = createClient(url, key)

// ── Load all clients ──
export async function loadClients() {
  const { data, error } = await sb.from('clients').select('*').order('updated_at', { ascending: false })
  if (error) throw error
  return (data || []).map(r => ({
    id: r.id,
    name: r.name,
    email: r.email || '',
    phone: r.phone || '',
    status: r.status || 'new',
    notes: r.notes || '',
    introduced: r.introduced || false,
    address: r.address || '',
    ssnLast4: r.ssn_last4 || '',
    dob: r.dob || '',
    dealId: r.deal_id || '',
    mclCase: r.mcl_case || '',
    mclType: r.mcl_type || '',
    mclStatus: r.mcl_status || '',
    packetSentDate: r.packet_sent_date,
    mailDate: r.mail_date,
    mclContactDate: r.mcl_contact_date,
    disputeLetterSent: r.dispute_letter_sent,
    reportsRequestedDate: r.reports_requested_date,
    outcomeDate: r.outcome_date,
    filedDate: r.filed_date,
    inServiceDate: r.in_service_date,
    isNewLead: r.is_new_lead || false,
    seenByAgent: r.seen_by_agent ?? true,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    comms: r.comms || {},
    creditReports: r.credit_reports || [],
  }))
}

// ── Save a client (upsert) ──
export async function saveClient(c) {
  const row = {
    id: c.id,
    name: c.name,
    email: c.email || '',
    phone: c.phone || '',
    status: c.status || 'new',
    notes: c.notes || '',
    introduced: c.introduced || false,
    address: c.address || '',
    ssn_last4: c.ssnLast4 || '',
    dob: c.dob || '',
    deal_id: c.dealId || '',
    mcl_case: c.mclCase || '',
    mcl_type: c.mclType || '',
    mcl_status: c.mclStatus || '',
    packet_sent_date: c.packetSentDate || null,
    mail_date: c.mailDate || null,
    mcl_contact_date: c.mclContactDate || null,
    dispute_letter_sent: c.disputeLetterSent || null,
    reports_requested_date: c.reportsRequestedDate || null,
    outcome_date: c.outcomeDate || null,
    filed_date: c.filedDate || null,
    in_service_date: c.inServiceDate || null,
    is_new_lead: c.isNewLead || false,
    seen_by_agent: c.seenByAgent ?? true,
    comms: c.comms || {},
    credit_reports: c.creditReports || [],
    updated_at: new Date().toISOString(),
  }
  const { error } = await sb.from('clients').upsert(row, { onConflict: 'id' })
  if (error) console.error('Save client error:', error)
}

// ── Save multiple clients (batch upsert) ──
export async function saveClients(clients) {
  const rows = clients.map(c => ({
    id: c.id,
    name: c.name,
    email: c.email || '',
    phone: c.phone || '',
    status: c.status || 'new',
    notes: c.notes || '',
    introduced: c.introduced || false,
    address: c.address || '',
    ssn_last4: c.ssnLast4 || '',
    dob: c.dob || '',
    deal_id: c.dealId || '',
    mcl_case: c.mclCase || '',
    mcl_type: c.mclType || '',
    mcl_status: c.mclStatus || '',
    packet_sent_date: c.packetSentDate || null,
    mail_date: c.mailDate || null,
    mcl_contact_date: c.mclContactDate || null,
    dispute_letter_sent: c.disputeLetterSent || null,
    reports_requested_date: c.reportsRequestedDate || null,
    outcome_date: c.outcomeDate || null,
    filed_date: c.filedDate || null,
    in_service_date: c.inServiceDate || null,
    is_new_lead: c.isNewLead || false,
    seen_by_agent: c.seenByAgent ?? true,
    comms: c.comms || {},
    credit_reports: c.creditReports || [],
    updated_at: new Date().toISOString(),
  }))
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error } = await sb.from('clients').upsert(batch, { onConflict: 'id' })
    if (error) console.error('Batch save error:', error)
  }
}

// ── Delete a client ──
export async function deleteClient(id) {
  const { error } = await sb.from('clients').delete().eq('id', id)
  if (error) console.error('Delete error:', error)
}

// ── Activity log ──
export async function logActivity(clientId, detail, agent) {
  const { error } = await sb.from('activity_log').insert({
    client_id: clientId, detail, agent
  })
  if (error) console.error('Log error:', error)
}

// ── Settings ──
export async function loadSettings() {
  const { data, error } = await sb.from('settings').select('*').eq('id', 'main').maybeSingle()
  if (error) console.error('Settings load error:', error)
  return data || {}
}

export async function saveSettings(s) {
  const { error } = await sb.from('settings').upsert({ id: 'main', ...s })
  if (error) console.error('Settings save error:', error)
}

// ── Templates ──
export async function loadTemplates() {
  const { data, error } = await sb.from('templates').select('*').order('name')
  if (error) throw error
  const map = {}
  ;(data || []).forEach(t => { map[t.key] = { name: t.name, type: t.type, trigger: t.trigger_stage, subject: t.subject || '', body: t.body } })
  return map
}

export async function saveTemplate(key, tpl) {
  const { error } = await sb.from('templates').upsert({
    key, name: tpl.name, type: tpl.type, trigger_stage: tpl.trigger, subject: tpl.subject || '', body: tpl.body
  })
  if (error) console.error('Template save error:', error)
}

export async function deleteTemplate(key) {
  const { error } = await sb.from('templates').delete().eq('key', key)
  if (error) console.error('Template delete error:', error)
}

// ── Send Email (via Netlify function → SendGrid) ──
// From: accounts@asapcreditrepairusa.com | Signature: FCRA Compliance Team
export async function sendEmail({ to, subject, body, plain }) {
  const r = await fetch('/.netlify/functions/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body, plain: plain || false })
  })
  const d = await r.json()
  if (!r.ok) throw new Error(d.error || 'Email send failed')
  return d
}

// ── Send Email to McCarthy Law ──
export async function sendMclEmail({ subject, body }) {
  return sendEmail({
    to: 'FCRA@McCarthyLawyer.com',
    subject,
    body,
  })
}

// ── Send Text (via Zapier webhook → RingCentral) ──
export async function sendText({ to, body, clientName, webhookUrl }) {
  const r = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: to, message: body, client_name: clientName })
  })
  if (!r.ok) throw new Error('Text webhook failed')
  return { ok: true }
}

// ── Push email/phone back to Google Sheet (via Zapier webhook) ──
export async function pushToSheet({ clientName, email, phone, dealId, reportUrl, webhookUrl }) {
  const r = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: clientName,
      email: email || '',
      phone: phone || '',
      deal_id: dealId || '',
      report_url: reportUrl || '',
    })
  })
  if (!r.ok) throw new Error('Sheet update webhook failed')
  return { ok: true }
}

// ── Upload Credit Report to Supabase Storage ──
export async function uploadReport(clientId, file) {
  const ts = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${clientId}/${ts}_${safeName}`

  const { data, error } = await sb.storage
    .from('credit-reports')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) throw error

  const { data: urlData } = sb.storage
    .from('credit-reports')
    .getPublicUrl(path)

  return {
    name: file.name,
    url: urlData.publicUrl,
    uploaded_at: new Date().toISOString(),
    size: file.size,
  }
}

// ── Delete Credit Report from Supabase Storage ──
export async function deleteReport(url) {
  // Extract path from public URL
  const match = url.match(/credit-reports\/(.+)$/)
  if (!match) return
  const { error } = await sb.storage
    .from('credit-reports')
    .remove([match[1]])
  if (error) console.error('Delete report error:', error)
}

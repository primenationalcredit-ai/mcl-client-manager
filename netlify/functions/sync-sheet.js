// ═══════════════════════════════════════════════════════════
// SYNC SHEET — Pulls new leads from Google Sheet
// Callable: GET /.netlify/functions/sync-sheet
// Auto-called by app every 2 minutes via setInterval
// ═══════════════════════════════════════════════════════════

const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSs9OyAhWuv2BcenmZbtIEwD0R6UPZFpK0DYk0TfHkFZwO3ITY0mvMraxJ5X5BseiDaPtlbLpH1UKH-/pub?gid=1509920646&single=true&output=csv';

function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = [];
    let current = '', inQuotes = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    fields.push(current.trim());
    
    const name = fields[0] || '';
    const introduced = (fields[1] || '').toUpperCase() === 'TRUE';
    const email = fields[2] || '';
    const phone = fields[3] || '';
    const creditError = fields[4] || '';
    const notes = fields[5] || '';
    
    if (!name || name === '`') continue;
    const validEmail = email.includes('@') && email.includes('.') ? email : null;
    rows.push({ name, introduced, email: validEmail, phone: phone || null, creditError: creditError || null, notes: notes || null });
  }
  return rows;
}

export default async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  const SB_URL = process.env.VITE_SUPABASE_URL;
  const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY;

  if (!SB_URL || !SB_KEY) {
    return new Response(JSON.stringify({ error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars' }), { status: 500, headers });
  }

  try {
    // 1. Fetch sheet
    const sheetRes = await fetch(SHEET_CSV);
    if (!sheetRes.ok) {
      return new Response(JSON.stringify({ error: 'Sheet fetch failed: ' + sheetRes.status }), { status: 500, headers });
    }
    const csv = await sheetRes.text();
    const sheetRows = parseCSV(csv);

    // 2. Get existing clients
    const sbHeaders = {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json',
    };
    
    const existingRes = await fetch(SB_URL + '/rest/v1/mcl_clients?select=name,email', { headers: sbHeaders });
    if (!existingRes.ok) {
      const errText = await existingRes.text();
      return new Response(JSON.stringify({ error: 'Supabase fetch failed: ' + existingRes.status + ' - ' + errText }), { status: 500, headers });
    }
    const existing = await existingRes.json();
    const existingSet = new Set(existing.map(c => c.name ? c.name.toLowerCase().trim() : ''));

    // 3. Find new leads
    const newLeads = [];
    for (const row of sheetRows) {
      const key = row.name.toLowerCase().trim();
      if (existingSet.has(key)) continue;
      existingSet.add(key);
      newLeads.push({
        name: row.name,
        email: row.email,
        phone: row.phone,
        credit_error: row.creditError,
        stage: 'need_to_call',
        intro_type: 'no_answer',
        notes: row.notes,
      });
    }

    // 4. Insert new leads in batches of 50
    let inserted = 0;
    let insertErrors = [];
    for (let i = 0; i < newLeads.length; i += 50) {
      const batch = newLeads.slice(i, i + 50);
      const r = await fetch(SB_URL + '/rest/v1/mcl_clients', {
        method: 'POST',
        headers: Object.assign({}, sbHeaders, { 'Prefer': 'return=minimal' }),
        body: JSON.stringify(batch)
      });
      if (r.ok || r.status === 201) {
        inserted += batch.length;
      } else {
        const errText = await r.text();
        insertErrors.push('Batch ' + i + ': ' + r.status + ' - ' + errText);
      }
    }

    const result = { sheet_rows: sheetRows.length, existing: existing.length, new_inserted: inserted };
    if (insertErrors.length) result.insert_errors = insertErrors;
    return new Response(JSON.stringify(result), { status: 200, headers });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
  }
};

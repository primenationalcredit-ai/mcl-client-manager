// ═══════════════════════════════════════════════════════════
// SYNC SHEET — Pulls new leads from Google Sheet every minute
// Also callable manually: GET /.netlify/functions/sync-sheet
// ═══════════════════════════════════════════════════════════

const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-aIG0R1yc8KPTTmXLfUoAOjIv9oVVfGgDc_-M_i009NwwOJEiaoG9yLNkKDBZ4zMTBkYcOHw9qMn-/pub?gid=0&single=true&output=csv';

function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Simple CSV parse (handles quoted fields)
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
    const notes = fields[5] || '';
    
    if (!name || name === '`') continue;
    
    // Validate email (basic check)
    const validEmail = email.includes('@') && email.includes('.') ? email : null;
    
    rows.push({ name, introduced, email: validEmail, phone: phone || null, notes: notes || null });
  }
  return rows;
}

async function sbFetch(path, method = 'GET', body = null) {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1${path}`;
  const headers = {
    'apikey': process.env.VITE_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  };
  if (method === 'POST') headers['Prefer'] = 'return=minimal';
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (method === 'GET') return res.json();
  return res;
}

async function doSync() {
  // 1. Fetch sheet
  const res = await fetch(SHEET_CSV);
  if (!res.ok) return { error: `Sheet fetch failed: ${res.status}` };
  const csv = await res.text();
  const sheetRows = parseCSV(csv);
  
  // 2. Get existing clients from mcl_clients
  const existing = await sbFetch('/mcl_clients?select=name,email');
  const existingSet = new Set(existing.map(c => c.name?.toLowerCase().trim()));
  
  // 3. Find new leads (not already in mcl_clients)
  const newLeads = [];
  for (const row of sheetRows) {
    const key = row.name.toLowerCase().trim();
    if (existingSet.has(key)) continue;
    existingSet.add(key); // prevent dupes within same sheet
    newLeads.push({
      name: row.name,
      email: row.email,
      phone: row.phone,
      stage: 'no_answer',
      intro_type: 'no_answer',
      notes: row.notes,
    });
  }
  
  // 4. Insert new leads in batches of 50
  let inserted = 0;
  for (let i = 0; i < newLeads.length; i += 50) {
    const batch = newLeads.slice(i, i + 50);
    const r = await sbFetch('/mcl_clients', 'POST', batch);
    if (r.ok || r.status === 201) inserted += batch.length;
  }
  
  return { sheet_rows: sheetRows.length, existing: existing.length, new_inserted: inserted };
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }
  try {
    const result = await doSync();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};

export const config = {
  schedule: "* * * * *"
};

const PIPEDRIVE_API_TOKEN = '328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0';
const PIPEDRIVE_BASE = 'https://api.pipedrive.com/v1';

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { action } = body;

  // ── Load all deal field label options ──────────────────────────
  if (action === 'load_labels') {
    try {
      const res = await fetch(`${PIPEDRIVE_BASE}/dealFields?api_token=${PIPEDRIVE_API_TOKEN}`);
      const data = await res.json();
      if (!data.success) return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'Pipedrive error', raw: data }) };
      const labelField = data.data.find(f => f.key === 'label');
      const options = labelField?.options || [];
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, options }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: e.message }) };
    }
  }

  // ── Ensure a label exists (create if not) ──────────────────────
  if (action === 'ensure_label') {
    const { labelName, color } = body;
    try {
      const res = await fetch(`${PIPEDRIVE_BASE}/dealFields?api_token=${PIPEDRIVE_API_TOKEN}`);
      const data = await res.json();
      const labelField = data.data.find(f => f.key === 'label');
      if (!labelField) return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'No label field' }) };

      // Check if already exists
      const existing = labelField.options?.find(o => o.label === labelName);
      if (existing) return { statusCode: 200, headers, body: JSON.stringify({ success: true, options: labelField.options }) };

      // Create it
      const opts = [...(labelField.options || []), { label: labelName, color: color || 'blue' }];
      const putRes = await fetch(`${PIPEDRIVE_BASE}/dealFields/${labelField.id}?api_token=${PIPEDRIVE_API_TOKEN}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: opts })
      });
      const putData = await putRes.json();
      if (putData.success) return { statusCode: 200, headers, body: JSON.stringify({ success: true, options: putData.data.options }) };
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'Create failed', raw: putData }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: e.message }) };
    }
  }

  // ── Update a deal's label (main action) ───────────────────────
  if (action === 'update_label') {
    const { dealId, labelId, mclLabelIds } = body;
    // mclLabelIds: array of string IDs for all McCarthy labels (to replace)
    try {
      // GET current deal
      const getRes = await fetch(`${PIPEDRIVE_BASE}/deals/${dealId}?api_token=${PIPEDRIVE_API_TOKEN}`);
      const getData = await getRes.json();
      if (!getData.success) return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'Deal not found', raw: getData }) };

      // Parse existing labels
      let existingLabels = [];
      if (getData.data && getData.data.label) {
        existingLabels = String(getData.data.label).split(',').map(l => l.trim()).filter(Boolean);
      }

      // Strip all McCarthy labels, add new one
      const mclSet = new Set(mclLabelIds.map(String));
      const keepLabels = existingLabels.filter(id => !mclSet.has(id));
      keepLabels.push(String(labelId));

      // PUT updated labels
      const putRes = await fetch(`${PIPEDRIVE_BASE}/deals/${dealId}?api_token=${PIPEDRIVE_API_TOKEN}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: keepLabels.join(',') })
      });
      const putData = await putRes.json();
      if (putData.success) {
        return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'PUT failed', raw: putData }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: e.message }) };
    }
  }

  // ── Add a note to a deal ─────────────────────────────────────
  if (action === 'add_note') {
    const { dealId, content } = body;
    try {
      const res = await fetch(`${PIPEDRIVE_BASE}/notes?api_token=${PIPEDRIVE_API_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: parseInt(dealId), content, pinned_to_deal_flag: 1 })
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify({ success: data.success, data: data.data }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: e.message }) };
    }
  }

  // ── Add an activity (task) to a deal due today ────────────────
  if (action === 'add_activity') {
    const { dealId, subject, note } = body;
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`${PIPEDRIVE_BASE}/activities?api_token=${PIPEDRIVE_API_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_id: parseInt(dealId),
          subject: subject || 'FCRA Violation — Contact Client',
          type: 'task',
          due_date: today,
          note: note || ''
        })
      });
      const data = await res.json();
      return { statusCode: 200, headers, body: JSON.stringify({ success: data.success, data: data.data }) };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: e.message }) };
    }
  }

  // ── Get deal round dates ─────────────────────────────────────
  if (action === 'get_round_dates') {
    const { dealId } = body;
    const RD_FIELDS = {
      rd1: '6979c70df67f42c28dfcff39284ae17d564d600f',
      rd2: 'ff3697496664744d64d9f290766f919f40c23aa0',
      rd3: '8d681007c089ee4c7390c02ee2f027ca60374708',
      rd4: '1d1bc8fbf1b8982640ef70131f010908788a7bd0'
    };
    try {
      const res = await fetch(`${PIPEDRIVE_BASE}/deals/${dealId}?api_token=${PIPEDRIVE_API_TOKEN}`);
      const data = await res.json();
      if (!data.success) return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: 'Deal not found' }) };
      const d = data.data;
      return { statusCode: 200, headers, body: JSON.stringify({
        success: true,
        rd1: d[RD_FIELDS.rd1] || null,
        rd2: d[RD_FIELDS.rd2] || null,
        rd3: d[RD_FIELDS.rd3] || null,
        rd4: d[RD_FIELDS.rd4] || null
      })};
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: e.message }) };
    }
  }

  return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
};

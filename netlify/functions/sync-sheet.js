const SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSs9OyAhWuv2BcenmZbtIEwD0R6UPZFpK0DYk0TfHkFZwO3ITY0mvMraxJ5X5BseiDaPtlbLpH1UKH-/pub?gid=1509920646&single=true&output=csv';
const STAGE_ORDER = {need_to_call:0,lvm:1,contacted:2,waiting_mcl:3,packet_sent:4,disputes_mailed:5,waiting_reports:6};
function parseCSV(text) {
  var lines = text.split('\n'); if (lines.length < 2) return [];
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim(); if (!line) continue;
    var fields = []; var current = ''; var inQ = false;
    for (var j = 0; j < line.length; j++) {
      var ch = line[j];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { fields.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    fields.push(current.trim());
    var name = fields[0] || ''; if (!name || name.includes('@') || name.includes('TRUE') || name.includes('FALSE') || name.length < 3) continue;
    var email = fields[5] || '';
    var validEmail = email.includes('@') && email.includes('.') ? email : null;
    rows.push({ name:name, mclNotes:fields[1]||'', joesNotes:fields[2]||'', phone:fields[4]||null, email:validEmail,
      introMade:(fields[6]||'').toUpperCase()==='TRUE', mclContact:(fields[7]||'').toUpperCase()==='TRUE',
      notEligible:(fields[8]||'').toUpperCase()==='TRUE', disputeMailedToClient:fields[9]||null,
      clientConfirmedMailed:fields[10]||null, dueDate:fields[11]||null,
      agreement:(fields[12]||'').toUpperCase()==='TRUE' });
  }
  return rows;
}
function fmtD(d) { if (!d) return null; var p=d.split('/'); if(p.length===3){var y=p[2];if(y.length===2)y='20'+y;return y+'-'+p[0].padStart(2,'0')+'-'+p[1].padStart(2,'0');} return d; }
function getStage(row) {
  if (row.agreement) return {outcome:'litigation'};
  if (row.notEligible) return {outcome:'lost'};
  if (row.dueDate) { var due=new Date(row.dueDate); if(!isNaN(due)&&due<=new Date()) return {stage:'waiting_reports',round_over_date:fmtD(row.dueDate)}; return {stage:'disputes_mailed',round_over_date:fmtD(row.dueDate)}; }
  if (row.clientConfirmedMailed) return {stage:'disputes_mailed',disputes_mailed_to_cra:fmtD(row.clientConfirmedMailed)};
  if (row.disputeMailedToClient) return {stage:'packet_sent',disputes_mailed_to_client:fmtD(row.disputeMailedToClient)};
  if (row.mclContact) return {stage:'waiting_mcl'};
  if (row.introMade) return {stage:'contacted'};
  return {stage:'need_to_call'};
}
export default async (req) => {
  var H = {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'};
  if (req.method==='OPTIONS') return new Response('ok',{headers:H});
  var SB=process.env.VITE_SUPABASE_URL, SK=process.env.VITE_SUPABASE_ANON_KEY;
  if (!SB||!SK) return new Response(JSON.stringify({error:'Missing env vars'}),{status:500,headers:H});
  try {
    var sR=await fetch(SHEET_CSV); if(!sR.ok) return new Response(JSON.stringify({error:'Sheet fail:'+sR.status}),{status:500,headers:H});
    var csv=await sR.text(), sheetRows=parseCSV(csv);
    var sbH={'apikey':SK,'Authorization':'Bearer '+SK,'Content-Type':'application/json'};
    var eR=await fetch(SB+'/rest/v1/mcl_clients?select=id,name,email,phone,stage,outcome,credit_error,disputes_mailed_to_client,disputes_mailed_to_cra,round_over_date&limit=1000',{headers:sbH});
    if(!eR.ok){var et=await eR.text();return new Response(JSON.stringify({error:'SB fail:'+et}),{status:500,headers:H});}
    var existing=await eR.json(), eMap={};
    for(var c of existing){if(c.name)eMap[c.name.toLowerCase().trim()]=c;}
    var ins=0,upd=0,errs=[];
    for(var row of sheetRows){
      var key=row.name.toLowerCase().trim(), ss=getStage(row), db=eMap[key];
      if(!db){
        var nc={name:row.name,email:row.email,phone:row.phone,credit_error:row.mclNotes||null,notes:row.joesNotes||null,stage:ss.stage||'need_to_call',outcome:ss.outcome||null,intro_type:'no_answer'};
        if(ss.disputes_mailed_to_client)nc.disputes_mailed_to_client=ss.disputes_mailed_to_client;
        if(ss.disputes_mailed_to_cra)nc.disputes_mailed_to_cra=ss.disputes_mailed_to_cra;
        if(ss.round_over_date)nc.round_over_date=ss.round_over_date;
        var r=await fetch(SB+'/rest/v1/mcl_clients',{method:'POST',headers:Object.assign({},sbH,{'Prefer':'return=minimal'}),body:JSON.stringify(nc)});
        if(r.ok||r.status===201)ins++;else{var e=await r.text();errs.push('Ins '+row.name+':'+e);}
      } else {
        var u={};
        if(!db.phone&&row.phone)u.phone=row.phone;
        if(!db.email&&row.email)u.email=row.email;
        if(row.mclNotes&&row.mclNotes!==db.credit_error)u.credit_error=row.mclNotes;
        if(ss.outcome&&db.outcome!==ss.outcome){u.outcome=ss.outcome;u.outcome_at=new Date().toISOString();}
        if(ss.stage&&!db.outcome&&!ss.outcome){var co=STAGE_ORDER[db.stage]!==undefined?STAGE_ORDER[db.stage]:0,no=STAGE_ORDER[ss.stage]!==undefined?STAGE_ORDER[ss.stage]:0;if(no>co)u.stage=ss.stage;}
        if(ss.disputes_mailed_to_client&&!db.disputes_mailed_to_client)u.disputes_mailed_to_client=ss.disputes_mailed_to_client;
        if(ss.disputes_mailed_to_cra&&!db.disputes_mailed_to_cra)u.disputes_mailed_to_cra=ss.disputes_mailed_to_cra;
        if(ss.round_over_date&&!db.round_over_date)u.round_over_date=ss.round_over_date;
        if(Object.keys(u).length>0){var r2=await fetch(SB+'/rest/v1/mcl_clients?id=eq.'+db.id,{method:'PATCH',headers:Object.assign({},sbH,{'Prefer':'return=minimal'}),body:JSON.stringify(u)});if(r2.ok)upd++;else{var e2=await r2.text();errs.push('Upd '+row.name+':'+e2);}}
      }
    }
    var result={sheet_rows:sheetRows.length,existing:existing.length,new_inserted:ins,updated:upd};
    if(errs.length)result.errors=errs;
    return new Response(JSON.stringify(result),{status:200,headers:H});
  } catch(e){return new Response(JSON.stringify({error:e.message}),{status:500,headers:H});}
};

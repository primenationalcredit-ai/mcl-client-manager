import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as db from "./db";

// ═══════════════════════════════════════════════════════════════════════════════
// MCL CLIENT MANAGER v5 — Supabase + SendGrid + Zapier/RingCentral
// ═══════════════════════════════════════════════════════════════════════════════

const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS-aIG0R1yc8KPTTmXLfUoAOjIv9oVVfGgDc_-M_i009NwwOJEiaoG9yLNkKDBZ4zMTBkYcOHw9qMn-/pub?gid=0&single=true&output=csv";

const STAGES = [
  { id: "new", label: "New Referral", color: "#ef4444", icon: "🔴", desc: "No email/phone yet – needs first contact" },
  { id: "no_answer", label: "No Answer", color: "#eab308", icon: "📞", desc: "Called, no answer" },
  { id: "contacted", label: "Contacted", color: "#3b82f6", icon: "💬", desc: "Spoke with client" },
  { id: "agreed", label: "Agreed", color: "#f97316", icon: "🤝", desc: "Waiting MCL email reply" },
  { id: "email_replied", label: "Email Replied", color: "#22c55e", icon: "✉️", desc: "Replied to MCL email" },
  { id: "info_collected", label: "Info Collected", color: "#06b6d4", icon: "📝", desc: "MCL has client info" },
  { id: "mcl_reviewing", label: "MCL Reviewing", color: "#8b5cf6", icon: "⚖️", desc: "McCarthy reviewing case" },
  { id: "packet_sent", label: "Packet Sent", color: "#a855f7", icon: "📦", desc: "Dispute packet sent to client" },
  { id: "mail_sent", label: "Disputes Mailed", color: "#14b8a6", icon: "📬", desc: "Client mailed disputes" },
  { id: "first_dispute", label: "1st Dispute by MCL", color: "#0ea5e9", icon: "⚡", desc: "MCL sent first round" },
  { id: "reports_requested", label: "Reports Needed", color: "#6366f1", icon: "📊", desc: "Need updated reports" },
  { id: "in_service", label: "In Service (Wait)", color: "#78716c", icon: "⏳", desc: "In service – waiting for available date" },
  { id: "won", label: "Won – Litigation", color: "#16a34a", icon: "🏆", desc: "Proceeding with litigation" },
  { id: "lost", label: "Lost / Resolved", color: "#dc2626", icon: "❌", desc: "Resolved or disqualified" },
];
const SM = Object.fromEntries(STAGES.map(s => [s.id, s]));
const MCL_MAP = {"Need Date Disputes Mailed":"packet_sent","1st Dispute by McL":"first_dispute","Need Info (Pre-Review)":"info_collected","Need Info (Post-Review)":"info_collected","Approved - Entering Litigation":"won","In Litigation":"won","Disqualified":"lost","Resolved-NON-Lit":"lost"};
const gid = () => crypto.randomUUID();
const fmt = d => d ? new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "";
const fmtF = d => d ? new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "";
const dsince = d => d ? Math.floor((Date.now()-new Date(d).getTime())/864e5) : null;
const nn = n => n?.toLowerCase().replace(/[^a-z ]/g,"").replace(/\s+/g," ").trim()||"";
const parseCSV = t => { const rows=[]; let cur='',inQ=false,row=[]; for(let i=0;i<t.length;i++){const c=t[i]; if(c==='"'){if(inQ&&t[i+1]==='"'){cur+='"';i++}else inQ=!inQ}else if(c===','&&!inQ){row.push(cur.trim());cur=''}else if((c==='\n'||c==='\r')&&!inQ){if(c==='\r'&&t[i+1]==='\n')i++;row.push(cur.trim());cur='';if(row.some(x=>x))rows.push(row);row=[]}else cur+=c}if(cur||row.length){row.push(cur.trim());if(row.some(x=>x))rows.push(row)}return rows};

export default function App() {
  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState({});
  const [agent, setAgent] = useState("Joe");
  const [view, setView] = useState("pipeline");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [sendM, setSendM] = useState(null);
  const [toast, setToast] = useState(null);
  const [importRes, setImportRes] = useState(null);
  const [editTpl, setEditTpl] = useState(null);
  const [editTplD, setEditTplD] = useState({});
  const [csvUrl, setCsvUrl] = useState(CSV_URL);
  const [zapierUrl, setZapierUrl] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const tmr = useRef(null);
  const saveQ = useRef(new Map()); // queue of clients to save
  const saveTimer = useRef(null);

  // ── Load from Supabase ──
  useEffect(() => {
    (async () => {
      try {
        const [dbClients, dbTemplates, dbSettings] = await Promise.all([
          db.loadClients(),
          db.loadTemplates(),
          db.loadSettings()
        ]);
        if (dbClients.length > 0) setClients(dbClients);
        if (Object.keys(dbTemplates).length > 0) setTemplates(dbTemplates);
        if (dbSettings) {
          setAgent(dbSettings.agent_name || "Joe");
          setCsvUrl(dbSettings.csv_url || CSV_URL);
          setZapierUrl(dbSettings.zapier_url || "");
          setLastSync(dbSettings.last_sync || null);
        }
      } catch (e) {
        console.error("Load error:", e);
      }
      setLoading(false);
    })();
  }, []);

  // ── Debounced save: batches client updates ──
  const queueSave = useCallback((client) => {
    saveQ.current.set(client.id, client);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const batch = Array.from(saveQ.current.values());
      saveQ.current.clear();
      if (batch.length > 0) {
        try { await db.saveClients(batch); } catch (e) { console.error("Save error:", e); }
      }
    }, 1000); // saves 1s after last change
  }, []);

  // ── Save settings when they change ──
  const saveSettingsDebounced = useCallback(() => {
    db.saveSettings({ agent_name: agent, csv_url: csvUrl, zapier_url: zapierUrl, last_sync: lastSync }).catch(e => console.error(e));
  }, [agent, csvUrl, zapierUrl, lastSync]);

  // ── CSV Sync ──
  const syncCSV = useCallback(async (url) => {
    if (!url || syncing) return;
    setSyncing(true);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const rows = parseCSV(await r.text());
      if (rows.length < 2) throw new Error("No data");
      const ex = new Set(clients.map(c => nn(c.name)));
      let nc = 0;
      const newClients = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = (row[0]||"").trim();
        if (!name || name === '`') continue;
        const colC = (row[2]||"").trim();
        const colD = (row[3]||"").trim();
        const hasEmail = colC.includes("@");
        const hasPhone = (colD.replace(/\D/g,"")).length >= 7;
        if (!hasEmail && !hasPhone && !ex.has(nn(name))) {
          const colE = (row[4]||"").trim();
          const c = {
            id: gid(), name, email: "", phone: "", status: "new",
            notes: colE || "", introduced: false,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            address: "", ssnLast4: "", dob: "",
            mclCase: "", mclType: "", mclStatus: "",
            packetSentDate: null, mailDate: null, mclContactDate: null,
            disputeLetterSent: null, reportsRequestedDate: null,
            outcomeDate: null, filedDate: null,
            comms: {}, isNewLead: true, seenByAgent: false, inServiceDate: null,
          };
          newClients.push(c);
          ex.add(nn(name));
          nc++;
        }
      }
      if (nc > 0) {
        setClients(p => [...newClients, ...p]);
        // Save new clients to Supabase
        await db.saveClients(newClients);
        flash(`🆕 ${nc} new lead${nc>1?"s":""} from Google Sheet!`, "new");
      }
      setLastSync(new Date().toISOString());
    } catch (e) { console.error("Sync:", e); }
    setSyncing(false);
  }, [clients, syncing]);

  useEffect(() => {
    if (csvUrl && !loading) {
      syncCSV(csvUrl);
      tmr.current = setInterval(() => syncCSV(csvUrl), 120000);
      return () => clearInterval(tmr.current);
    }
  }, [csvUrl, loading]);

  // ── In-service date check ──
  useEffect(() => {
    if (!clients.length) return;
    let changed = false;
    const now = new Date();
    const upd = clients.map(c => {
      if (c.status === "in_service" && c.inServiceDate && now >= new Date(c.inServiceDate)) {
        changed = true;
        const nc = { ...c, status: "new", updatedAt: now.toISOString(), notes: c.notes + ` | [AUTO] In-service date reached ${fmt(c.inServiceDate)}` };
        queueSave(nc);
        return nc;
      }
      return c;
    });
    if (changed) setClients(upd);
  }, [clients]);

  // ── Helpers ──
  const flash = (msg, type="ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const upd = (id, u) => {
    setClients(p => p.map(c => {
      if (c.id !== id) return c;
      const nc = { ...c, ...u, updatedAt: new Date().toISOString() };
      queueSave(nc);
      return nc;
    }));
  };

  const addLog = (cid, detail) => db.logActivity(cid, detail, agent).catch(() => {});

  const moveStage = (cid, s) => {
    const c = clients.find(x => x.id === cid);
    if (!c) return;
    upd(cid, { status: s, isNewLead: false, seenByAgent: true });
    addLog(cid, `→ ${SM[s]?.label}`);
    flash(`${c.name} → ${SM[s]?.label}`);
  };

  // ── Send Communication ──
  const doSend = async (cid, tplKey, body, actuallySend) => {
    const c = clients.find(x => x.id === cid);
    const t = templates[tplKey];
    if (!c || !t) return;

    setSending(true);
    let sentOk = false;

    if (actuallySend) {
      try {
        if (t.type === "email" && c.email) {
          const subject = (t.subject || "").replace(/{name}/g, c.name.split(" ")[0]);
          await db.sendEmail({ to: c.email, subject, body, clientName: c.name });
          sentOk = true;
          flash(`📧 Email sent to ${c.email}!`);
        } else if (t.type === "text" && c.phone && zapierUrl) {
          await db.sendText({ to: c.phone, body, clientName: c.name, webhookUrl: zapierUrl });
          sentOk = true;
          flash(`📱 Text sent to ${c.phone}!`);
        } else {
          flash(t.type === "text" ? "⚠️ No phone or Zapier URL set" : "⚠️ No email on file", "err");
        }
      } catch (e) {
        console.error("Send error:", e);
        flash(`❌ Send failed: ${e.message}`, "err");
      }
    }

    // Mark as sent in comms log regardless (if user chose "mark as sent")
    upd(cid, {
      comms: { ...c.comms, [tplKey]: { at: new Date().toISOString(), a: agent, b: body, sent: actuallySend && sentOk } }
    });
    addLog(cid, `${actuallySend && sentOk ? "Sent" : "Marked"} "${t.name}" (${t.type})`);
    setSendM(null);
    setSending(false);
  };

  // ── MCL Import ──
  const handleImport = (text) => {
    const lines = text.split("\n");
    let cur = "";
    const entries = [];
    const pats = Object.keys(MCL_MAP);
    for (const line of lines) {
      for (const p of pats) if (line.includes(`Case Status = ${p}`)) cur = p;
      const m = line.match(/^([A-Z][a-z-]+(?:\s[A-Z][a-z-]*)*),\s*([A-Z][a-z]+(?:\s[A-Z][a-z-]*)*)\s+v\./);
      if (m && cur) entries.push({ name: `${m[2]} ${m[1]}`, mclStatus: cur, stage: MCL_MAP[cur] || "new" });
    }
    let matched = 0, updated = 0, nf = [];
    const nc = [...clients];
    entries.forEach(e => {
      const k = nn(e.name);
      const i = nc.findIndex(c => nn(c.name) === k || nn(c.name).includes(k) || k.includes(nn(c.name)));
      if (i >= 0) {
        matched++;
        const so = STAGES.map(s => s.id);
        if (so.indexOf(e.stage) > so.indexOf(nc[i].status) || e.stage === "won" || e.stage === "lost") {
          nc[i] = { ...nc[i], status: e.stage, mclStatus: e.mclStatus, updatedAt: new Date().toISOString() };
          queueSave(nc[i]);
          updated++;
        }
      } else nf.push(e.name);
    });
    setClients(nc);
    setImportRes({ total: entries.length, matched, updated, nf });
    flash(`Imported: ${entries.length} cases, ${updated} updated`);
  };

  // ── Computed ──
  const counts = useMemo(() => { const c = {}; STAGES.forEach(s => c[s.id] = 0); clients.forEach(x => { if (c[x.status] !== undefined) c[x.status]++; }); return c; }, [clients]);
  const newLeads = useMemo(() => clients.filter(c => c.status === "new"), [clients]);
  const unseenLeads = useMemo(() => clients.filter(c => c.isNewLead && !c.seenByAgent), [clients]);

  const actionQueue = useMemo(() => {
    const items = [];
    clients.forEach(c => {
      if (c.status === "first_dispute" && c.disputeLetterSent) {
        const days = dsince(c.disputeLetterSent);
        if (days >= 31 && !c.comms?.followup_31day_text && !c.comms?.followup_31day_email) {
          items.push({ type: "31day", client: c, days, priority: "high", label: `Day ${days}: Request updated reports`, templates: ["followup_31day_text", "followup_31day_email"] });
        }
      }
      if (c.status === "packet_sent" && !c.mailDate) {
        const days = dsince(c.updatedAt);
        if (days > 7 && !c.comms?.followup_mail && !c.comms?.followup_mail_email) {
          items.push({ type: "unmailed", client: c, days, priority: "medium", label: `${days}d: Haven't mailed disputes`, templates: ["followup_mail", "followup_mail_email"] });
        }
      }
      if (c.status === "no_answer") {
        const days = dsince(c.updatedAt);
        if (days > 3 && !c.comms?.intro_text_no_answer && !c.comms?.intro_email_no_answer) {
          items.push({ type: "no_answer", client: c, days, priority: "medium", label: `${days}d: No answer, needs intro`, templates: ["intro_text_no_answer", "intro_email_no_answer"] });
        }
      }
      if (c.status === "agreed") {
        const days = dsince(c.updatedAt);
        if (days > 2) items.push({ type: "agreed_wait", client: c, days, priority: "low", label: `${days}d: Waiting for MCL email reply`, templates: [] });
      }
      if (c.status === "in_service" && c.inServiceDate) {
        const du = Math.ceil((new Date(c.inServiceDate).getTime() - Date.now()) / 864e5);
        if (du <= 7 && du > 0) items.push({ type: "in_service_soon", client: c, days: du, priority: "low", label: `Available in ${du}d`, templates: ["in_service_ready"] });
      }
    });
    return items.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] || 0) - ({ high: 0, medium: 1, low: 2 }[b.priority] || 0));
  }, [clients]);

  const filtered = useMemo(() => {
    let r = clients;
    if (filter !== "all") r = r.filter(c => c.status === filter);
    if (search) { const t = search.toLowerCase(); r = r.filter(c => c.name.toLowerCase().includes(t) || c.email?.toLowerCase().includes(t) || c.phone?.includes(t)); }
    return r.sort((a, b) => {
      if (a.isNewLead && !a.seenByAgent && !(b.isNewLead && !b.seenByAgent)) return -1;
      if (!(a.isNewLead && !a.seenByAgent) && b.isNewLead && !b.seenByAgent) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }, [clients, filter, search]);

  // ── Styles ──
  const inp = { width:"100%",padding:"7px 10px",borderRadius:7,border:"1px solid #e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit" };
  const lbl = { fontSize:11,color:"#94a3b8",display:"block",marginBottom:2,fontWeight:600 };
  const bt = (bg,sm) => ({ padding:sm?"3px 8px":"6px 14px",borderRadius:6,border:"none",background:bg,color:"#fff",fontSize:sm?11:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" });
  const Badge = ({ s }) => { const st=SM[s]; return st ? <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,background:st.color+"15",color:st.color,border:`1px solid ${st.color}25`,whiteSpace:"nowrap"}}><span style={{fontSize:10}}>{st.icon}</span>{st.label}</span> : null; };
  const NewTag = () => <span style={{padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:800,background:"#ef4444",color:"#fff",animation:"pulse 2s infinite"}}>🔴 NEW</span>;
  const Sec = ({t,children}) => <div style={{marginBottom:16}}><div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6,textTransform:"uppercase",letterSpacing:0.8}}>{t}</div>{children}</div>;

  // ── LOADING SCREEN ──
  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#f5f7fa",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:12}}>⚖️</div>
        <div style={{fontSize:16,fontWeight:700,color:"#1e293b"}}>Loading MCL Client Manager...</div>
        <div style={{fontSize:12,color:"#94a3b8",marginTop:4}}>Connecting to database</div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // PIPELINE
  // ═══════════════════════════════════════════════════════════════════
  const Pipeline = () => (
    <div style={{padding:"16px 20px"}}>
      {newLeads.length > 0 && (
        <div style={{background:"linear-gradient(135deg,#fef2f2,#fee2e2,#fecaca)",border:"2px solid #ef4444",borderRadius:12,padding:"14px 18px",marginBottom:14,animation:unseenLeads.length>0?"glow 2s infinite":"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:28,animation:"bounce 1s infinite"}}>🔴</span>
              <div>
                <div style={{fontSize:18,fontWeight:800,color:"#991b1b"}}>{newLeads.length} New Lead{newLeads.length>1?"s":""}</div>
                <div style={{fontSize:12,color:"#b91c1c"}}>No email/phone yet — need to reach client</div>
              </div>
            </div>
            <button onClick={()=>{setView("clients");setFilter("new")}} style={bt("#ef4444")}>View All →</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {newLeads.slice(0,5).map(c=>(
              <div key={c.id} onClick={()=>setSel(c.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:!c.seenByAgent?"#fff":"#fff8f8",borderRadius:8,border:!c.seenByAgent?"2px solid #ef4444":"1px solid #fecaca",cursor:"pointer"}}>
                {!c.seenByAgent && <NewTag/>}
                <div style={{flex:1}}>
                  <span style={{fontWeight:700,fontSize:13}}>{c.name}</span>
                  {c.notes && <div style={{fontSize:10,color:"#94a3b8",marginTop:1}}>{c.notes.substring(0,80)}</div>}
                </div>
                <div style={{display:"flex",gap:3}}>
                  <button onClick={e=>{e.stopPropagation();moveStage(c.id,"no_answer")}} style={bt("#eab308",true)}>📞</button>
                  <button onClick={e=>{e.stopPropagation();moveStage(c.id,"contacted")}} style={bt("#3b82f6",true)}>💬</button>
                  <button onClick={e=>{e.stopPropagation();moveStage(c.id,"in_service");setSel(c.id)}} style={bt("#78716c",true)}>⏳</button>
                </div>
              </div>
            ))}
            {newLeads.length>5 && <div style={{textAlign:"center",fontSize:12,color:"#991b1b",fontWeight:600}}>+ {newLeads.length-5} more →</div>}
          </div>
        </div>
      )}
      {actionQueue.length>0 && (
        <div onClick={()=>setView("actions")} style={{background:"linear-gradient(135deg,#fef3c7,#fde68a)",border:"1px solid #f59e0b",borderRadius:10,padding:"10px 14px",marginBottom:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><div style={{fontSize:14,fontWeight:700,color:"#92400e"}}>📋 Action Queue</div><div style={{fontSize:12,color:"#a16207"}}>{actionQueue.length} items need approval</div></div>
          <span style={{fontSize:22,fontWeight:800,color:"#78350f"}}>{actionQueue.length}</span>
        </div>
      )}
      {csvUrl && (
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10,fontSize:11,color:"#64748b"}}>
          <span style={{width:8,height:8,borderRadius:"50%",background:syncing?"#eab308":"#22c55e"}}/>
          {syncing?"Syncing...": `Sheet synced ${lastSync?fmt(lastSync):"never"}`}
          <button onClick={()=>syncCSV(csvUrl)} style={{...bt("#64748b",true),padding:"1px 6px",fontSize:10}}>↻</button>
        </div>
      )}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {[{l:"🏆 Won",c:counts.won,bg:"#ecfdf5",bc:"#10b981",tc:"#047857"},{l:"❌ Lost",c:counts.lost,bg:"#fef2f2",bc:"#ef4444",tc:"#b91c1c"},{l:"⏳ In Service",c:counts.in_service,bg:"#f5f5f4",bc:"#78716c",tc:"#44403c"},{l:"📊 Active",c:clients.length-(counts.won||0)-(counts.lost||0)-(counts.in_service||0),bg:"#eff6ff",bc:"#3b82f6",tc:"#1d4ed8"}].map((x,i)=>(
          <div key={i} style={{background:x.bg,border:`1px solid ${x.bc}`,borderRadius:10,padding:"10px 14px",flex:"1 1 110px"}}>
            <div style={{fontSize:12,fontWeight:700,color:x.tc}}>{x.l}</div>
            <div style={{fontSize:22,fontWeight:800,color:x.tc}}>{x.c}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))",gap:8}}>
        {STAGES.filter(s=>!["won","lost","new","in_service"].includes(s.id)).map(s=>(
          <div key={s.id} onClick={()=>{setView("clients");setFilter(s.id)}} style={{background:"#fff",borderRadius:10,border:`2px solid ${s.color}20`,padding:12,cursor:"pointer",position:"relative",overflow:"hidden"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=s.color} onMouseLeave={e=>e.currentTarget.style.borderColor=s.color+"20"}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:s.color}}/>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:16}}>{s.icon}</span><span style={{fontSize:22,fontWeight:800,color:s.color}}>{counts[s.id]||0}</span></div>
            <div style={{fontSize:11,fontWeight:700,marginTop:2}}>{s.label}</div>
            <div style={{fontSize:10,color:"#94a3b8"}}>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // ACTION QUEUE
  // ═══════════════════════════════════════════════════════════════════
  const ActionQueue = () => (
    <div style={{padding:"14px 20px"}}>
      <h3 style={{margin:"0 0 4px",fontSize:15}}>📋 Action Queue</h3>
      <p style={{fontSize:12,color:"#64748b",margin:"0 0 14px"}}>Review and approve — nothing sends until you click.</p>
      {actionQueue.length===0 ? <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}><div style={{fontSize:36}}>✅</div>All clear!</div> : (
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {actionQueue.map((item,idx)=>{
            const c=item.client;
            const pc={high:{bg:"#fef2f2",bc:"#fecaca",tc:"#991b1b",badge:"#ef4444"},medium:{bg:"#fffbeb",bc:"#fde68a",tc:"#92400e",badge:"#f59e0b"},low:{bg:"#f8fafc",bc:"#e2e8f0",tc:"#475569",badge:"#94a3b8"}}[item.priority];
            return (
              <div key={`${c.id}-${idx}`} style={{padding:"12px 16px",background:pc.bg,borderRadius:10,border:`1px solid ${pc.bc}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",flexWrap:"wrap",gap:8}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:4,background:pc.badge,color:"#fff",textTransform:"uppercase"}}>{item.priority}</span>
                      <span style={{fontWeight:700,fontSize:13}}>{c.name}</span>
                      <Badge s={c.status}/>
                    </div>
                    <div style={{fontSize:12,color:pc.tc,marginTop:3}}>{item.label}</div>
                    {Object.keys(c.comms||{}).length>0 && (
                      <div style={{display:"flex",gap:3,marginTop:4,flexWrap:"wrap"}}>
                        {Object.entries(c.comms).map(([k,v])=>(
                          <span key={k} style={{fontSize:9,padding:"1px 5px",borderRadius:8,background:v.sent?"#d1fae5":"#fef3c7",color:v.sent?"#059669":"#a16207",border:`1px solid ${v.sent?"#6ee7b7":"#fde68a"}`}}>
                            {v.sent?"✓ Sent":"📋 Logged"} {templates[k]?.name||k}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                    {item.templates.map(k=>{const t=templates[k]; if(!t)return null; return <button key={k} onClick={()=>setSendM({cid:c.id,k})} style={bt(t.type==="email"?"#3b82f6":"#10b981",true)}>{t.type==="email"?"📧":"📱"} {t.name.length>16?t.name.slice(0,14)+"…":t.name}</button>})}
                    <button onClick={()=>setSel(c.id)} style={bt("#64748b",true)}>View</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // CLIENT LIST
  // ═══════════════════════════════════════════════════════════════════
  const ClientList = () => (
    <div style={{padding:"12px 20px"}}>
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        <input type="text" placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} style={{...inp,flex:"1 1 160px"}}/>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{...inp,width:"auto",cursor:"pointer"}}>
          <option value="all">All ({clients.length})</option>
          {STAGES.map(s=><option key={s.id} value={s.id}>{s.icon} {s.label} ({counts[s.id]})</option>)}
        </select>
        <button onClick={()=>setShowAdd(true)} style={bt("#0f172a")}>+ Add</button>
      </div>
      <div style={{fontSize:11,color:"#94a3b8",marginBottom:4}}>{filtered.length} clients</div>
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        {filtered.map(c=>{
          const unseen=c.isNewLead&&!c.seenByAgent;
          const sc=Object.keys(c.comms||{}).length;
          const inSvc=c.status==="in_service";
          return (
            <div key={c.id} onClick={()=>setSel(c.id)}
              style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:unseen?"#fef2f2":inSvc?"#f5f5f4":"#fff",borderRadius:8,border:unseen?"2px solid #ef4444":"1px solid #f1f5f9",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background=unseen?"#fee2e2":"#f8fafc"} onMouseLeave={e=>e.currentTarget.style.background=unseen?"#fef2f2":inSvc?"#f5f5f4":"#fff"}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  {unseen&&<NewTag/>}
                  <span style={{fontWeight:700,fontSize:13}}>{c.name}</span>
                  <Badge s={c.status}/>
                  {sc>0&&<span style={{fontSize:10,color:"#64748b",background:"#f1f5f9",padding:"1px 5px",borderRadius:6}}>{sc} sent</span>}
                  {inSvc&&c.inServiceDate&&<span style={{fontSize:10,color:"#78716c"}}>Available: {fmt(c.inServiceDate)}</span>}
                </div>
                <div style={{fontSize:11,color:"#94a3b8",marginTop:1,display:"flex",gap:10}}>
                  {c.email&&<span>📧 {c.email}</span>}
                  {c.phone&&<span>📞 {c.phone}</span>}
                  {!c.email&&!c.phone&&c.status==="new"&&<span style={{color:"#ef4444",fontWeight:600}}>⚠️ No contact info</span>}
                </div>
              </div>
              {c.status==="new"&&<div style={{display:"flex",gap:3}}>
                <button onClick={e=>{e.stopPropagation();moveStage(c.id,"no_answer")}} style={bt("#eab308",true)}>📞</button>
                <button onClick={e=>{e.stopPropagation();moveStage(c.id,"contacted")}} style={bt("#3b82f6",true)}>💬</button>
              </div>}
              <span style={{fontSize:16,color:"#cbd5e1"}}>›</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // CLIENT DETAIL
  // ═══════════════════════════════════════════════════════════════════
  const Detail = () => {
    const c=clients.find(x=>x.id===sel);
    if(!c)return null;
    const [en,setEn]=useState(c.notes||""); const [ea,setEa]=useState(c.address||"");
    const [es,setEs]=useState(c.ssnLast4||""); const [ed,setEd]=useState(c.dob||"");
    const [ee,setEe]=useState(c.email||""); const [ep,setEp]=useState(c.phone||"");
    const sv=()=>upd(c.id,{notes:en,address:ea,ssnLast4:es,dob:ed,email:ee,phone:ep});
    useEffect(()=>{if(c.isNewLead&&!c.seenByAgent)upd(c.id,{seenByAgent:true})},[c.id]);

    return (
      <div style={{position:"fixed",top:0,right:0,bottom:0,width:"min(620px,96vw)",background:"#fff",boxShadow:"-4px 0 30px rgba(0,0,0,0.12)",zIndex:1000,overflowY:"auto"}}>
        <div style={{padding:"14px 18px",borderBottom:"1px solid #f1f5f9",position:"sticky",top:0,background:"#fff",zIndex:1,display:"flex",justifyContent:"space-between"}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8}}><h2 style={{margin:0,fontSize:18}}>{c.name}</h2>{c.isNewLead&&<NewTag/>}</div>
            <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
              <Badge s={c.status}/>
              {c.mclCase&&<span style={{fontSize:11,color:"#8b5cf6",fontWeight:600}}>⚖️ {c.mclCase}</span>}
              {c.mclStatus&&<span style={{fontSize:10,color:"#64748b",background:"#f1f5f9",padding:"1px 6px",borderRadius:6}}>{c.mclStatus}</span>}
            </div>
          </div>
          <button onClick={()=>setSel(null)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#94a3b8"}}>✕</button>
        </div>
        <div style={{padding:"14px 18px"}}>
          <Sec t="Pipeline Stage">
            <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
              {STAGES.map(s=>(
                <button key={s.id} onClick={()=>moveStage(c.id,s.id)}
                  style={{padding:"3px 8px",borderRadius:5,border:c.status===s.id?`2px solid ${s.color}`:"1px solid #e2e8f0",background:c.status===s.id?s.color+"12":"#fff",color:c.status===s.id?s.color:"#64748b",fontSize:10,fontWeight:c.status===s.id?700:500,cursor:"pointer",fontFamily:"inherit"}}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </Sec>

          {(c.status==="in_service"||c.inServiceDate) && (
            <Sec t="⏳ In-Service Schedule">
              <p style={{fontSize:11,color:"#78716c",margin:"0 0 6px"}}>Set date when client becomes available for MCL. Auto-moves to follow-up when date arrives.</p>
              <input type="date" value={c.inServiceDate?c.inServiceDate.substring(0,10):""} onChange={e=>{upd(c.id,{inServiceDate:e.target.value||null,status:e.target.value?"in_service":c.status});addLog(c.id,`In-service: ${e.target.value}`)}} style={inp}/>
            </Sec>
          )}

          <Sec t="Communications">
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {Object.entries(templates).map(([k,t])=>{
                const sent=!!c.comms?.[k]; const cd=c.comms?.[k];
                return (
                  <div key={k} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:8,background:sent?(cd?.sent?"#ecfdf5":"#fefce8"):"#f8fafc",border:`1px solid ${sent?(cd?.sent?"#6ee7b7":"#fde68a"):"#e2e8f0"}`}}>
                    <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:sent?(cd?.sent?t.type==="email"?"#3b82f6":"#10b981":"#eab308"):"#e2e8f0",color:sent?"#fff":"#94a3b8",fontSize:11,fontWeight:700}}>{sent?(cd?.sent?"✓":"📋"):"○"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:600,color:sent?"#0f172a":"#64748b"}}>{t.type==="email"?"📧":"📱"} {t.name}</div>
                      {sent&&<div style={{fontSize:10,color:"#94a3b8"}}>{cd?.sent?"Sent":"Logged"} {fmtF(cd.at)} by {cd.a}</div>}
                    </div>
                    {!sent ? <button onClick={()=>setSendM({cid:c.id,k})} style={bt(t.type==="email"?"#3b82f6":"#10b981",true)}>Send</button>
                      : <button onClick={()=>{const nc={...c.comms};delete nc[k];upd(c.id,{comms:nc})}} style={{...bt("#94a3b8",true),background:"#e2e8f0",color:"#64748b"}}>Undo</button>}
                  </div>
                );
              })}
            </div>
          </Sec>

          <Sec t="Key Dates">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {[["Dispute Letter Sent","disputeLetterSent"],["Packet Sent","packetSentDate"],["Client Mailed","mailDate"],["MCL Contact","mclContactDate"],["Reports Requested","reportsRequestedDate"],["Filed Date","filedDate"],["Outcome Date","outcomeDate"],["In-Service Date","inServiceDate"]].map(([l,k])=>(
                <div key={k}><label style={lbl}>{l}</label><input type="date" value={c[k]?c[k].substring(0,10):""} onChange={e=>{upd(c.id,{[k]:e.target.value||null});addLog(c.id,`${l}: ${e.target.value}`)}} style={inp}/></div>
              ))}
            </div>
            {c.status==="first_dispute"&&c.disputeLetterSent&&(
              <div style={{marginTop:8,padding:8,background:dsince(c.disputeLetterSent)>=31?"#fef2f2":"#f0fdf4",borderRadius:6,fontSize:12,fontWeight:600,color:dsince(c.disputeLetterSent)>=31?"#991b1b":"#166534"}}>
                {dsince(c.disputeLetterSent)>=31?`🔴 Day ${dsince(c.disputeLetterSent)} — follow up NOW!`:`Day ${dsince(c.disputeLetterSent)} of 31 — follow up in ${31-dsince(c.disputeLetterSent)} days`}
              </div>
            )}
          </Sec>

          <Sec t="Contact Info">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              <div><label style={lbl}>Email</label><input value={ee} onChange={e=>setEe(e.target.value)} onBlur={sv} style={inp}/></div>
              <div><label style={lbl}>Phone</label><input value={ep} onChange={e=>setEp(e.target.value)} onBlur={sv} style={inp}/></div>
              <div style={{gridColumn:"1/-1"}}><label style={lbl}>Address</label><input value={ea} onChange={e=>setEa(e.target.value)} onBlur={sv} style={inp}/></div>
              <div><label style={lbl}>Last 4 SSN</label><input value={es} onChange={e=>setEs(e.target.value)} onBlur={sv} maxLength={4} style={inp}/></div>
              <div><label style={lbl}>DOB</label><input type="date" value={ed} onChange={e=>setEd(e.target.value)} onBlur={sv} style={inp}/></div>
            </div>
          </Sec>

          <Sec t="Notes"><textarea value={en} onChange={e=>setEn(e.target.value)} onBlur={sv} rows={3} style={{...inp,resize:"vertical",fontFamily:"inherit"}}/></Sec>
          <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #f1f5f9"}}>
            <button onClick={async()=>{if(confirm(`Delete ${c.name}?`)){await db.deleteClient(c.id);setClients(p=>p.filter(x=>x.id!==c.id));setSel(null)}}} style={{...bt("#ef4444"),opacity:0.6}}>🗑️ Delete</button>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // SYNC + IMPORT
  // ═══════════════════════════════════════════════════════════════════
  const SyncPage = () => {
    const [pt,setPt]=useState(""); const [lu,setLu]=useState(csvUrl);
    return (
      <div style={{padding:"14px 20px",maxWidth:700}}>
        <div style={{background:"#fff",borderRadius:12,padding:18,border:"1px solid #e2e8f0",marginBottom:20}}>
          <h3 style={{margin:"0 0 4px",fontSize:15}}>🔗 Google Sheet Live Sync</h3>
          <p style={{fontSize:12,color:"#64748b",margin:"0 0 10px"}}>Reads your published CSV every 2 min. Only flags clients with <b>no email AND no phone</b> as new leads.</p>
          {csvUrl&&<div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#f0fdf4",borderRadius:8,border:"1px solid #86efac"}}>
            <span style={{width:10,height:10,borderRadius:"50%",background:syncing?"#eab308":"#22c55e",flexShrink:0}}/>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#166534"}}>{syncing?"⏳ Syncing...":"✅ Connected"}</div><div style={{fontSize:11,color:"#15803d"}}>Last: {lastSync?fmtF(lastSync):"never"}</div></div>
            <button onClick={()=>syncCSV(csvUrl)} style={bt("#22c55e",true)}>↻ Sync Now</button>
          </div>}
          <label style={lbl}>Published CSV URL</label>
          <div style={{display:"flex",gap:8}}><input value={lu} onChange={e=>setLu(e.target.value)} style={{...inp,flex:1,fontSize:11}}/><button onClick={()=>{setCsvUrl(lu);saveSettingsDebounced();if(lu)syncCSV(lu);flash("Saved!")}} style={bt("#22c55e")}>{csvUrl?"Update":"Connect"}</button></div>
        </div>
        <div style={{background:"#fff",borderRadius:12,padding:18,border:"1px solid #e2e8f0"}}>
          <h3 style={{margin:"0 0 4px",fontSize:15}}>⚖️ Import McCarthy Law Report</h3>
          <p style={{fontSize:12,color:"#64748b",margin:"0 0 8px"}}>Paste MCL PDF text → matches clients → updates stages → queues actions for your approval.</p>
          <textarea value={pt} onChange={e=>setPt(e.target.value)} placeholder="Paste MCL report text..." rows={8} style={{...inp,fontFamily:"monospace",fontSize:11,resize:"vertical"}}/>
          <button onClick={()=>{if(pt.trim())handleImport(pt)}} style={{...bt("#8b5cf6"),marginTop:8}}>⚖️ Import</button>
          {importRes&&<div style={{marginTop:12,padding:12,background:"#f0fdf4",borderRadius:8,border:"1px solid #86efac"}}><div style={{fontSize:13,fontWeight:700,color:"#166534"}}>✅ Done</div><div style={{fontSize:12,color:"#15803d"}}>📋 {importRes.total} · 🔗 {importRes.matched} matched · ⬆️ {importRes.updated} updated</div>{importRes.nf.length>0&&<div style={{fontSize:11,color:"#92400e",marginTop:4}}>Not found: {importRes.nf.join(", ")}</div>}</div>}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════════════════════════════
  const Tpls = () => (
    <div style={{padding:"14px 20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
        <div><h3 style={{margin:0,fontSize:15}}>Templates</h3><p style={{margin:0,fontSize:11,color:"#94a3b8"}}>Use {"{name}"} and {"{agent}"}</p></div>
        <button onClick={()=>{const k="c_"+gid().slice(0,8); const tpl={name:"New Template",type:"text",trigger:"new",body:"Hi {name}, this is {agent}...",subject:""}; setTemplates(p=>({...p,[k]:tpl})); db.saveTemplate(k,tpl); setEditTpl(k); setEditTplD(tpl)}} style={bt("#0f172a")}>+ New</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {Object.entries(templates).map(([k,t])=>editTpl===k?(
          <div key={k} style={{background:"#f8fafc",borderRadius:10,padding:14,border:"1px solid #e2e8f0"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:6}}>
              <div><label style={lbl}>Name</label><input value={editTplD.name} onChange={e=>setEditTplD({...editTplD,name:e.target.value})} style={inp}/></div>
              <div><label style={lbl}>Type</label><select value={editTplD.type} onChange={e=>setEditTplD({...editTplD,type:e.target.value})} style={{...inp,fontFamily:"inherit"}}><option value="text">📱 Text</option><option value="email">📧 Email</option></select></div>
              <div><label style={lbl}>Trigger Stage</label><select value={editTplD.trigger} onChange={e=>setEditTplD({...editTplD,trigger:e.target.value})} style={{...inp,fontFamily:"inherit"}}>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            </div>
            {editTplD.type==="email"&&<div style={{marginBottom:6}}><label style={lbl}>Subject</label><input value={editTplD.subject||""} onChange={e=>setEditTplD({...editTplD,subject:e.target.value})} style={inp}/></div>}
            <div style={{marginBottom:6}}><label style={lbl}>Body</label><textarea value={editTplD.body} onChange={e=>setEditTplD({...editTplD,body:e.target.value})} rows={5} style={{...inp,resize:"vertical",fontFamily:"inherit"}}/></div>
            <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
              <button onClick={()=>{setTemplates(p=>{const n={...p};delete n[k];return n});db.deleteTemplate(k);setEditTpl(null);flash("Deleted")}} style={{...bt("#ef4444",true),marginRight:"auto"}}>Delete</button>
              <button onClick={()=>setEditTpl(null)} style={bt("#94a3b8",true)}>Cancel</button>
              <button onClick={()=>{setTemplates(p=>({...p,[k]:editTplD}));db.saveTemplate(k,editTplD);setEditTpl(null);flash("Saved")}} style={bt("#0f172a",true)}>Save</button>
            </div>
          </div>
        ):(
          <div key={k} onClick={()=>{setEditTpl(k);setEditTplD({...t})}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#fff",borderRadius:8,border:"1px solid #f1f5f9",cursor:"pointer"}}>
            <span style={{fontSize:16}}>{t.type==="email"?"📧":"📱"}</span>
            <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{t.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>Trigger: {SM[t.trigger]?.label} · {t.body.substring(0,50)}…</div></div>
            <span style={{fontSize:11,color:"#94a3b8"}}>Edit →</span>
          </div>
        ))}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════════
  const Settings = () => {
    const [za,setZa]=useState(zapierUrl);
    return (
    <div style={{padding:"14px 20px",maxWidth:560}}>
      <h3 style={{margin:"0 0 14px",fontSize:15}}>Settings</h3>

      <Sec t="Agent">
        <input value={agent} onChange={e=>setAgent(e.target.value)} onBlur={saveSettingsDebounced} style={inp}/>
      </Sec>

      <Sec t="📱 Zapier → RingCentral (Text Messages)">
        <p style={{fontSize:11,color:"#64748b",margin:"0 0 6px"}}>Paste your Zapier webhook URL. The app sends: phone, message, client_name</p>
        <div style={{display:"flex",gap:8}}>
          <input value={za} onChange={e=>setZa(e.target.value)} placeholder="https://hooks.zapier.com/hooks/catch/..." style={{...inp,flex:1,fontSize:11}}/>
          <button onClick={()=>{setZapierUrl(za);saveSettingsDebounced();flash("Saved!")}} style={bt("#22c55e")}>Save</button>
        </div>
        {zapierUrl && <div style={{marginTop:6,fontSize:11,color:"#22c55e",fontWeight:600}}>✅ Connected</div>}
      </Sec>

      <Sec t="📧 Email (SendGrid)">
        <p style={{fontSize:11,color:"#64748b",margin:0}}>SendGrid API key is set in Netlify env vars (SENDGRID_API_KEY, SENDGRID_FROM_EMAIL). Emails send via a serverless function.</p>
      </Sec>

      <Sec t="Data">
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{const d=JSON.stringify(clients,null,2);const b=new Blob([d],{type:"application/json"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=`mcl-${new Date().toISOString().slice(0,10)}.json`;a.click()}} style={{...bt("#3b82f6"),flex:1,textAlign:"center"}}>📥 Export JSON</button>
        </div>
      </Sec>
    </div>
  )};

  // ═══════════════════════════════════════════════════════════════════
  // SEND MODAL — Copy, Send, or both
  // ═══════════════════════════════════════════════════════════════════
  const SendModal = () => {
    if(!sendM)return null;
    const c=clients.find(x=>x.id===sendM.cid); const t=templates[sendM.k]; if(!c||!t)return null;
    const prev=t.body.replace(/{name}/g,c.name.split(" ")[0]).replace(/{agent}/g,agent);
    const [body,setBody]=useState(prev);
    const canSend = t.type==="email" ? !!c.email : (!!c.phone && !!zapierUrl);
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setSendM(null)}>
        <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,padding:20,maxWidth:520,width:"100%",maxHeight:"85vh",overflowY:"auto"}}>
          <h3 style={{margin:"0 0 2px",fontSize:15}}>{t.type==="email"?"📧":"📱"} {t.name}</h3>
          <p style={{margin:"0 0 12px",fontSize:12,color:"#64748b"}}>
            To: <b>{c.name}</b> — {t.type==="email" ? (c.email||<span style={{color:"#ef4444"}}>No email on file</span>) : (c.phone||<span style={{color:"#ef4444"}}>No phone on file</span>)}
          </p>
          {t.subject&&<div style={{marginBottom:8}}><label style={lbl}>Subject</label><input value={t.subject.replace(/{name}/g,c.name.split(" ")[0])} readOnly style={inp}/></div>}
          <div style={{marginBottom:12}}><label style={lbl}>Message (edit before sending)</label><textarea value={body} onChange={e=>setBody(e.target.value)} rows={6} style={{...inp,resize:"vertical",fontFamily:"inherit"}}/></div>

          {!canSend && (
            <div style={{padding:"8px 12px",background:"#fef3c7",borderRadius:8,border:"1px solid #fde68a",fontSize:12,color:"#92400e",marginBottom:12}}>
              ⚠️ {t.type==="text" ? (c.phone ? "No Zapier webhook URL set — go to Settings" : "No phone number on file for this client") : "No email on file for this client"}. You can still copy the message and send manually.
            </div>
          )}

          <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"space-between"}}>
            <button onClick={()=>{navigator.clipboard?.writeText(body);flash("📋 Copied!")}} style={bt("#64748b")}>📋 Copy Text</button>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setSendM(null)} style={bt("#94a3b8")}>Cancel</button>
              <button onClick={()=>doSend(sendM.cid,sendM.k,body,false)} style={bt("#eab308")} disabled={sending}>📋 Log Only</button>
              {canSend && <button onClick={()=>doSend(sendM.cid,sendM.k,body,true)} style={bt(t.type==="email"?"#3b82f6":"#10b981")} disabled={sending}>
                {sending?"Sending...":t.type==="email"?"📧 Send Email":"📱 Send Text"}
              </button>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ADD MODAL
  const AddModal = () => {
    const [f,setF]=useState({name:"",email:"",phone:"",notes:""});
    if(!showAdd)return null;
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setShowAdd(false)}>
        <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,padding:20,maxWidth:420,width:"100%"}}>
          <h3 style={{margin:"0 0 12px",fontSize:15}}>Add Client</h3>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div><label style={lbl}>Name *</label><input value={f.name} onChange={e=>setF({...f,name:e.target.value})} style={inp} autoFocus/></div>
            <div><label style={lbl}>Email</label><input value={f.email} onChange={e=>setF({...f,email:e.target.value})} style={inp}/></div>
            <div><label style={lbl}>Phone</label><input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} style={inp}/></div>
            <div><label style={lbl}>Notes</label><textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})} rows={2} style={{...inp,fontFamily:"inherit"}}/></div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}>
            <button onClick={()=>setShowAdd(false)} style={bt("#94a3b8")}>Cancel</button>
            <button onClick={async()=>{if(!f.name)return;const nc={id:gid(),...f,status:"new",introduced:false,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),address:"",ssnLast4:"",dob:"",mclCase:"",mclType:"",mclStatus:"",packetSentDate:null,mailDate:null,mclContactDate:null,disputeLetterSent:null,reportsRequestedDate:null,outcomeDate:null,filedDate:null,comms:{},isNewLead:true,seenByAgent:false,inServiceDate:null};setClients(p=>[nc,...p]);await db.saveClient(nc);setShowAdd(false);flash("Added!","new")}} style={bt("#0f172a")}>Add</button>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // MAIN
  // ═══════════════════════════════════════════════════════════════════
  const nav = [
    {id:"pipeline",l:"Pipeline",i:"📊"},
    {id:"actions",l:"Actions",i:"📋",b:actionQueue.length},
    {id:"clients",l:"Clients",i:"👥"},
    {id:"sync",l:"Sync",i:"🔗"},
    {id:"templates",l:"Templates",i:"📝"},
    {id:"settings",l:"Settings",i:"⚙️"},
  ];

  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:"#f5f7fa",minHeight:"100vh",color:"#1e293b"}}>
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>⚖️</span>
          <div><div style={{fontWeight:800,fontSize:14,color:"#fff"}}>MCL Client Manager</div><div style={{fontSize:9,color:"#94a3b8"}}>ASAP Credit Repair × McCarthy Law</div></div>
          {unseenLeads.length>0&&<div onClick={()=>setView("pipeline")} style={{background:"#ef4444",color:"#fff",borderRadius:12,padding:"2px 10px",fontSize:11,fontWeight:700,animation:"pulse 1.5s infinite",marginLeft:8,cursor:"pointer"}}>🆕 {unseenLeads.length} NEW</div>}
        </div>
        <div style={{display:"flex",gap:1}}>
          {nav.map(t=>(
            <button key={t.id} onClick={()=>setView(t.id)} style={{padding:"5px 10px",borderRadius:6,border:"none",background:view===t.id?"rgba(255,255,255,0.13)":"transparent",color:view===t.id?"#fff":"#94a3b8",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:3}}>
              <span style={{fontSize:12}}>{t.i}</span><span className="nl">{t.l}</span>
              {t.b>0&&<span style={{background:"#ef4444",color:"#fff",borderRadius:10,padding:"0 5px",fontSize:9,fontWeight:700}}>{t.b}</span>}
            </button>
          ))}
        </div>
      </div>
      {view==="pipeline"&&<Pipeline/>}
      {view==="actions"&&<ActionQueue/>}
      {view==="clients"&&<ClientList/>}
      {view==="sync"&&<SyncPage/>}
      {view==="templates"&&<Tpls/>}
      {view==="settings"&&<Settings/>}
      {sel&&<Detail/>}
      <SendModal/>
      <AddModal/>
      {toast&&<div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",padding:"8px 18px",borderRadius:10,background:toast.type==="new"?"#ef4444":toast.type==="err"?"#dc2626":"#0f172a",color:"#fff",fontSize:12,fontWeight:600,zIndex:5000,boxShadow:"0 4px 20px rgba(0,0,0,0.2)",animation:"slideUp 0.3s"}}>{toast.msg}</div>}
      <style>{`
        @keyframes slideUp{from{transform:translateX(-50%) translateY(20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}
        @keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}50%{box-shadow:0 0 20px 4px rgba(239,68,68,0.15)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
        @keyframes slideIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
        @media(max-width:640px){.nl{display:none}}
      `}</style>
    </div>
  );
}

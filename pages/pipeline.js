import { useState, useEffect, useRef } from "react";
import { logAction } from "../lib/activitylog";
import { getDeals, addDeal, updateDeal, deleteDeal, addActivity, getActivitiesForDeal, getSalespersons, getContacts } from "../lib/firebase";
import Modal from "../components/Modal";
import toast from "react-hot-toast";

const STAGES = ["Lead","Qualified","Proposal","Negotiation","Won","Lost"];
const LEAD_STATUSES = ["Cold","Warm","Hot"];
const PARTY_TYPES = ["Super Stockist","Distributor / Dealer","Retailer","Surgical / Pharma Dealer","Export","Loose / OEM"];
const LEAD_TYPES = ["B2B","B2C","B2G"];
const ACT_TYPES = ["WhatsApp","Call","Meeting","Sample"];

const STAGE_CONFIG = {
  Lead:        { border:"#94a3b8", bg:"#f8fafc", badge:"#64748b" },
  Qualified:   { border:"#3b82f6", bg:"#eff6ff", badge:"#2563eb" },
  Proposal:    { border:"#8b5cf6", bg:"#f5f3ff", badge:"#7c3aed" },
  Negotiation: { border:"#f59e0b", bg:"#fffbeb", badge:"#d97706" },
  Won:         { border:"#10b981", bg:"#ecfdf5", badge:"#059669" },
  Lost:        { border:"#ef4444", bg:"#fef2f2", badge:"#dc2626" },
};

const STATUS_STYLE = {
  Hot:  { bg:"#fee2e2", color:"#b91c1c", dot:"#ef4444" },
  Warm: { bg:"#fef3c7", color:"#92400e", dot:"#f59e0b" },
  Cold: { bg:"#dbeafe", color:"#1e40af", dot:"#3b82f6" },
};

const ACT_TYPE_ICON = { WhatsApp:"✉️", Call:"📞", Meeting:"🗓️", Sample:"" };

const EMPTY_DEAL = {
  title:"", contactId:"", contact:"", phone:"", company:"", value:"",
  stage:"Lead", leadStatus:"Cold", partyType:"", leadType:"B2B",
  salesperson:"Unassigned", followUpDate:"", notes:""
};

// Deal title is no longer manually typed — it's derived from the selected
// contact so it always stays in sync with who the deal is actually for.
function buildDealTitle(contact, company) {
  if (contact && company) return `${contact} — ${company}`;
  if (contact) return contact;
  if (company) return company;
  return "Untitled deal";
}

function Avatar({ name, size=28 }) {
  const colors = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444"];
  let h=0; for(let c of (name||"")) h=c.charCodeAt(0)+((h<<5)-h);
  const bg = colors[Math.abs(h)%colors.length];
  return (
    <div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:700,color:"white",flexShrink:0}}>
      {(name||"?").charAt(0).toUpperCase()}
    </div>
  );
}

// Safely run a non-critical action (like audit logging) without ever
// letting it surface as a false "failed" toast for an action that
// actually already succeeded.
async function safeLog(fn) {
  try { await fn(); } catch (e) { console.error("logAction error (non-blocking):", e); }
}

function exportPipelineCSV(rows, label) {
  if (rows.length === 0) return toast.error("No deals to export");
  const csvRows = [
    ["Deal","Contact","Company","Phone","Stage","Lead Status","Party Type","Lead Type","Salesperson","Value (₹)","Follow-up Date","Notes"],
    ...rows.map(d => [
      d.title||"", d.contact||"", d.company||"", d.phone||"", d.stage||"",
      d.leadStatus||"", d.partyType||"", d.leadType||"", d.salesperson||"",
      d.value||"0", d.followUpDate||"", d.notes||""
    ])
  ];
  const csv = csvRows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pipeline-${label}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast.success("Exported ✅");
}

export default function PipelinePage({ currentUser }) {
  /* ── SALESPERSON-LOCK ADDITIONS — added per request ─────────────────
     isAdmin / mySalesperson computed once here so they can be reused
     everywhere below without changing any other existing logic. */
  const isAdmin = currentUser?.role === "admin";
  const mySalesperson = currentUser?.salesperson || "Unassigned";
  /* ──────────────────────────────────────────────────────────────── */

  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [filterSP, setFilterSP] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterLeadType, setFilterLeadType] = useState("All");
  const [filterPartyType, setFilterPartyType] = useState("All");
  const [showDealModal, setShowDealModal] = useState(false);
  const [editDeal, setEditDeal] = useState(null);
  const [dealForm, setDealForm] = useState(EMPTY_DEAL);
  const [contactSearch, setContactSearch] = useState("");
  const [contactResults, setContactResults] = useState([]);
  const [showContactDrop, setShowContactDrop] = useState(false);
  const [actModal, setActModal] = useState(null);
  const [actForm, setActForm] = useState({ type:"Email", subject:"", notes:"", followUpDate:"" });
  const [dealActivities, setDealActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const dragDeal = useRef(null);
  const dragOver = useRef(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (openMenuId && !e.target.closest("[data-deal-menu]") && !e.target.closest("[data-deal-menu-popup]")) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  async function load() {
    setLoading(true);
    try {
      const sp = currentUser?.role !== "admin" ? currentUser?.salesperson : null;
      const [d, c, s] = await Promise.all([getDeals(sp), getContacts(sp), getSalespersons()]);
      setDeals(d); setContacts(c); setSalespersons(s);
    } catch { toast.error("Could not load"); }
    finally { setLoading(false); }
  }

  function searchContacts(q) {
    setContactSearch(q);
    if (!q.trim()) { setContactResults([]); setShowContactDrop(false); return; }
    const r = contacts.filter(c =>
      c.phone?.includes(q) || c.name?.toLowerCase().includes(q.toLowerCase()) ||
      c.company?.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 8);
    setContactResults(r); setShowContactDrop(r.length > 0);
  }

  function selectContact(c) {
    setDealForm(f => ({
      ...f, contactId:c.id, contact:c.name, phone:c.phone||"", company:c.company||"",
      /* SALESPERSON-LOCK: non-admins always keep their own name here,
         regardless of whose contact this is. */
      salesperson: isAdmin ? (c.salesperson || f.salesperson) : mySalesperson,
      partyType:c.partyType||f.partyType,
      title: buildDealTitle(c.name, c.company||"")
    }));
    setContactSearch(`${c.name}${c.phone?" — "+c.phone:""}`);
    setShowContactDrop(false);
  }

  function openAdd() {
    /* SALESPERSON-LOCK: pre-fill with the logged-in salesperson's own name
       instead of "Unassigned" when they open the Add deal form. */
    setDealForm({ ...EMPTY_DEAL, salesperson: isAdmin ? "Unassigned" : mySalesperson });
    setEditDeal(null); setContactSearch(""); setShowDealModal(true);
  }
  function openEdit(deal) {
    setDealForm({...EMPTY_DEAL,...deal}); setEditDeal(deal);
    setContactSearch(deal.contact?`${deal.contact}${deal.phone?" — "+deal.phone:""}` : "");
    setShowDealModal(true);
  }

  async function saveDeal() {
    if (!dealForm.contactId && !dealForm.contact) return toast.error("Please select a contact");
    // Title is always derived from the current contact/company, never
    // hand-typed, so edits to the contact stay reflected automatically.
    /* SALESPERSON-LOCK: force the salesperson field server-side too, so a
       non-admin can never end up saving a deal under someone else's name
       even if the form state was somehow tampered with. */
    const finalForm = {
      ...dealForm,
      title: buildDealTitle(dealForm.contact, dealForm.company),
      salesperson: isAdmin ? dealForm.salesperson : mySalesperson,
    };
    setSaving(true);
    try {
      if (editDeal) {
        await updateDeal(editDeal.id, finalForm);
        toast.success("Deal updated ✅");
        const action = finalForm.stage === "Won" ? "Won Deal" : finalForm.followUpDate !== editDeal.followUpDate ? "Marked Follow-up" : "Updated Lead";
        await safeLog(() => logAction(currentUser, action, { dealTitle: finalForm.title, stage: finalForm.stage, followUpDate: finalForm.followUpDate }));
      } else {
        await addDeal(finalForm);
        toast.success("Deal added ✅");
        await safeLog(() => logAction(currentUser, "Added Lead", { dealTitle: finalForm.title, contact: finalForm.contact, company: finalForm.company }));
      }
      setShowDealModal(false); load();
    } catch (e) {
      console.error("Deal save error:", e);
      toast.error("Failed to save: " + (e?.message || "unknown error"));
    }
    finally { setSaving(false); }
  }

  async function openActModal(deal) {
    setActModal(deal); setActForm({ type:"Email", subject:"", notes:"", followUpDate: deal.followUpDate || "" });
    setDealActivities(await getActivitiesForDeal(deal.id));
  }

  async function saveActivity() {
    if (!actForm.subject.trim()) return toast.error("Subject required");
    setSaving(true);
    try {
      // 1. The actual save — this is the only thing that determines success/failure
      await addActivity({ ...actForm, dealId:actModal.id, dealTitle:actModal.title, contact:actModal.contact, company:actModal.company, salesperson:actModal.salesperson });
      toast.success("Activity logged ✅");

      // 2. Everything below is "nice to have" — none of it should ever
      //    turn a successful save into a false "Failed" toast.
      await safeLog(() => logAction(currentUser, "Logged Activity", { dealTitle: actModal.title, activityType: actForm.type, subject: actForm.subject }));

      if (actForm.followUpDate && actForm.followUpDate !== actModal.followUpDate) {
        try { await updateDeal(actModal.id, { followUpDate: actForm.followUpDate }); }
        catch (e) { console.error("Follow-up date update failed (non-blocking):", e); }
      }

      setActForm({ type:"Email", subject:"", notes:"", followUpDate:"" });
      try { setDealActivities(await getActivitiesForDeal(actModal.id)); }
      catch (e) { console.error("Refresh activity list failed (non-blocking):", e); }
    } catch (e) {
      // Only the real addActivity() failure lands here now
      console.error("Activity save error:", e);
      toast.error("Failed to log activity: " + (e?.message || "unknown error"));
    }
    finally { setSaving(false); }
  }

  async function remove(id) {
    if (!confirm("Delete this deal?")) return;
    const delDeal = deals.find(d=>d.id===id);
    await deleteDeal(id);
    await safeLog(() => logAction(currentUser, "Deleted Lead", { dealTitle: delDeal?.title || id }));
    toast.success("Deleted");
    setDeals(d => d.filter(x => x.id !== id));
  }

  function onDragStart(deal) { dragDeal.current = deal; }
  async function onDrop(stage) {
    if (!dragDeal.current || dragDeal.current.stage === stage) { dragDeal.current=null; return; }
    await updateDeal(dragDeal.current.id, { stage });
    await safeLog(() => logAction(currentUser, stage === 'Won' ? 'Won Deal' : 'Moved Stage', { dealTitle: dragDeal.current.title, stage }));
    toast.success(`Moved to ${stage} 📌`);
    dragDeal.current = null; load();
  }

  function timeAgo(ts) {
    if (!ts) return "Just now";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const s = (Date.now()-d)/1000;
    if (s<60) return "Just now";
    if (s<3600) return `${Math.floor(s/60)}m ago`;
    if (s<86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  }

  function fullDateTime(ts) {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
  }

  function parseDate(str) {
    if (!str) return null;
    // Handle DD-MM-YYYY format stored from old data
    if (str.includes("-") && str.split("-")[0].length === 2) {
      const [d,m,y] = str.split("-");
      return new Date(`${y}-${m}-${d}`);
    }
    return new Date(str);
  }

  function formatDate(str) {
    if (!str) return null;
    const d = parseDate(str);
    if (!d || isNaN(d)) return str;
    return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
  }

  function isOverdue(str) {
    if (!str) return false;
    const d = parseDate(str);
    if (!d || isNaN(d)) return false;
    return d < new Date(new Date().toDateString());
  }

  function isToday(str) {
    if (!str) return false;
    const d = parseDate(str);
    if (!d || isNaN(d)) return false;
    const t = new Date();
    return d.getDate()===t.getDate() && d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear();
  }

  const filtered = deals.filter(d => {
    const matchSP = filterSP === "All" || d.salesperson === filterSP;
    const matchStatus = filterStatus === "All" || d.leadStatus === filterStatus;
    const matchLeadType = filterLeadType === "All" || d.leadType === filterLeadType;
    const matchPartyType = filterPartyType === "All" || d.partyType === filterPartyType;
    return matchSP && matchStatus && matchLeadType && matchPartyType;
  });

  const totalValue = filtered.filter(d=>d.stage!=="Lost").reduce((s,d)=>s+(parseFloat(d.value)||0),0);
  const todayStr = new Date().toISOString().slice(0,10);
  const todayFollowUps = filtered.filter(d => {
    if (!d.followUpDate) return false;
    const fd = d.followUpDate;
    if (fd === todayStr) return true;
    // also check DD-MM-YYYY
    if (fd.includes("-") && fd.split("-")[0].length === 2) {
      const [day,mon,yr] = fd.split("-");
      return `${yr}-${mon}-${day}` === todayStr;
    }
    return false;
  });
  const setF = f => e => setDealForm(p => ({...p,[f]:e.target.value}));

  // ── Breakdown by Lead Type / Party Type / Lead Status — uses the
  // currently filtered set so it always matches what's on the board. ──
  const leadTypeBreakdown = LEAD_TYPES.map(t => ({ key:t, count: filtered.filter(d=>d.leadType===t).length }));
  const partyTypeBreakdown = PARTY_TYPES.map(t => ({ key:t, count: filtered.filter(d=>d.partyType===t).length }));
  const statusBreakdown = LEAD_STATUSES.map(s => ({ key:s, count: filtered.filter(d=>d.leadStatus===s).length }));
  const unsetPartyCount = filtered.filter(d=>!d.partyType).length;

  function exportLabel() {
    const parts = [];
    if (filterSP !== "All") parts.push(filterSP.toLowerCase().replace(/\s+/g,"-"));
    if (filterLeadType !== "All") parts.push(filterLeadType.toLowerCase());
    if (filterPartyType !== "All") parts.push(filterPartyType.toLowerCase().replace(/[^a-z0-9]+/g,"-"));
    if (filterStatus !== "All") parts.push(filterStatus.toLowerCase());
    return parts.length ? parts.join("_") : "all";
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:"#f8fafc"}}>

      {/* Header */}
      <div style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"16px 24px"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"}}>
          <div>
            <h1 style={{fontSize:"18px",fontWeight:700,color:"#0f172a",margin:0}}>Pipeline</h1>
            <p style={{fontSize:"13px",color:"#64748b",margin:"2px 0 0"}}>
              <span style={{fontWeight:600,color:"#6366f1"}}>₹{totalValue.toLocaleString("en-IN")}</span> total · {filtered.length} deals
              {todayFollowUps.length > 0 && (
                <span style={{marginLeft:"10px",background:"#fef3c7",color:"#92400e",fontSize:"11px",padding:"2px 8px",borderRadius:"20px",fontWeight:600}}>
                  📅 {todayFollowUps.length} follow-up{todayFollowUps.length>1?"s":""} today
                </span>
              )}
            </p>
          </div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"}}>
            <select className="input" style={{width:"150px"}} value={filterSP} onChange={e=>setFilterSP(e.target.value)}>
              <option value="All">All salespersons</option>
              <option value="Unassigned">Unassigned</option>
              {salespersons.map(s=><option key={s.id}>{s.name}</option>)}
            </select>
            <select className="input" style={{width:"110px"}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
              <option value="All">All status</option>
              {LEAD_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
            <select className="input" style={{width:"110px"}} value={filterLeadType} onChange={e=>setFilterLeadType(e.target.value)}>
              <option value="All">All lead type</option>
              {LEAD_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
            <select className="input" style={{width:"160px"}} value={filterPartyType} onChange={e=>setFilterPartyType(e.target.value)}>
              <option value="All">All party type</option>
              {PARTY_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
            <button onClick={()=>setShowBreakdown(v=>!v)}
              style={{display:"inline-flex",alignItems:"center",gap:"6px",padding:"7px 12px",borderRadius:"8px",border:"1px solid #e2e8f0",background:showBreakdown?"#eef2ff":"white",color:"#6366f1",fontSize:"13px",fontWeight:600,cursor:"pointer"}}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/></svg>
              Breakdown
            </button>
            <button onClick={()=>exportPipelineCSV(filtered, exportLabel())}
              style={{display:"inline-flex",alignItems:"center",gap:"6px",padding:"7px 12px",borderRadius:"8px",border:"1px solid #16a34a",background:"#f0fdf4",color:"#16a34a",fontSize:"13px",fontWeight:600,cursor:"pointer"}}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Export
            </button>
            <button className="btn btn-primary" onClick={openAdd} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none"}}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Add deal
            </button>
          </div>
        </div>
      </div>

      {/* Breakdown panel — list + counts for Lead Type / Party Type / Status */}
      {showBreakdown && (
        <div style={{background:"white",borderBottom:"1px solid #e2e8f0",padding:"16px 24px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"16px"}}>
            <div>
              <p style={{fontSize:"11px",fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 8px"}}>Lead type</p>
              <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                {leadTypeBreakdown.map(b=>(
                  <button key={b.key} onClick={()=>setFilterLeadType(filterLeadType===b.key?"All":b.key)}
                    style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",borderRadius:"6px",border:"none",cursor:"pointer",background:filterLeadType===b.key?"#eef2ff":"#f8fafc",fontSize:"12px"}}>
                    <span style={{color:"#374151",fontWeight:500}}>{b.key}</span>
                    <span style={{color:"#6366f1",fontWeight:700}}>{b.count}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={{fontSize:"11px",fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 8px"}}>Party type</p>
              <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                {partyTypeBreakdown.map(b=>(
                  <button key={b.key} onClick={()=>setFilterPartyType(filterPartyType===b.key?"All":b.key)}
                    style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",borderRadius:"6px",border:"none",cursor:"pointer",background:filterPartyType===b.key?"#eef2ff":"#f8fafc",fontSize:"12px"}}>
                    <span style={{color:"#374151",fontWeight:500}}>{b.key}</span>
                    <span style={{color:"#6366f1",fontWeight:700}}>{b.count}</span>
                  </button>
                ))}
                {unsetPartyCount > 0 && (
                  <div style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",fontSize:"12px"}}>
                    <span style={{color:"#94a3b8"}}>Not set</span>
                    <span style={{color:"#94a3b8",fontWeight:700}}>{unsetPartyCount}</span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <p style={{fontSize:"11px",fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.05em",margin:"0 0 8px"}}>Lead status</p>
              <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                {statusBreakdown.map(b=>{
                  const ss = STATUS_STYLE[b.key];
                  return (
                    <button key={b.key} onClick={()=>setFilterStatus(filterStatus===b.key?"All":b.key)}
                      style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",borderRadius:"6px",border:"none",cursor:"pointer",background:filterStatus===b.key?ss.bg:"#f8fafc",fontSize:"12px"}}>
                      <span style={{color:filterStatus===b.key?ss.color:"#374151",fontWeight:500}}>{b.key}</span>
                      <span style={{color:filterStatus===b.key?ss.color:"#6366f1",fontWeight:700}}>{b.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <p style={{fontSize:"11px",color:"#94a3b8",margin:"12px 0 0"}}>Click a row to filter the board by that category. Export uses whatever filters are currently active.</p>
        </div>
      )}

      {/* Stage summary bar */}
      <div style={{display:"flex",gap:"1px",background:"#e2e8f0",borderBottom:"1px solid #e2e8f0"}}>
        {STAGES.map(stage => {
          const count = filtered.filter(d=>d.stage===stage).length;
          const val = filtered.filter(d=>d.stage===stage).reduce((s,d)=>s+(parseFloat(d.value)||0),0);
          const cfg = STAGE_CONFIG[stage];
          return (
            <div key={stage} style={{flex:1,background:"white",padding:"8px 12px",borderTop:`3px solid ${cfg.border}`}}>
              <p style={{fontSize:"11px",fontWeight:700,color:cfg.badge,margin:0,textTransform:"uppercase",letterSpacing:"0.05em"}}>{stage}</p>
              <p style={{fontSize:"13px",fontWeight:700,color:"#0f172a",margin:"2px 0 0"}}>{count}</p>
              {val>0 && <p style={{fontSize:"10px",color:"#94a3b8",margin:0}}>₹{(val/1000).toFixed(0)}k</p>}
            </div>
          );
        })}
      </div>

      {/* Board */}
      {loading ? (
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",flex:1,color:"#94a3b8",fontSize:"14px"}}>Loading pipeline...</div>
      ) : (
        <div style={{display:"flex",gap:"12px",overflowX:"auto",padding:"16px",flex:1,alignItems:"flex-start"}}>
          {STAGES.map(stage => {
            const stageDeals = filtered.filter(d=>d.stage===stage);
            const cfg = STAGE_CONFIG[stage];
            return (
              <div key={stage} style={{flexShrink:0,width:"230px",minHeight:"200px"}}
                onDragOver={e=>e.preventDefault()} onDrop={()=>onDrop(stage)}>

                {/* Column header */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px",padding:"0 2px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                    <div style={{width:"10px",height:"10px",borderRadius:"50%",background:cfg.border,flexShrink:0}}/>
                    <span style={{fontSize:"12px",fontWeight:700,color:"#374151",textTransform:"uppercase",letterSpacing:"0.06em"}}>{stage}</span>
                  </div>
                  <span style={{fontSize:"11px",fontWeight:700,color:"white",background:cfg.badge,borderRadius:"20px",padding:"1px 8px"}}>{stageDeals.length}</span>
                </div>

                {/* Cards */}
                <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                  {stageDeals.map(deal => {
                    const ss = STATUS_STYLE[deal.leadStatus] || STATUS_STYLE.Cold;
                    const overdue = isOverdue(deal.followUpDate);
                    const menuOpen = openMenuId === deal.id;
                    return (
                      <div key={deal.id} className="deal-card" draggable onDragStart={()=>onDragStart(deal)}
                        onClick={()=>openEdit(deal)}
                        style={{borderLeft:`3px solid ${cfg.border}`,padding:"10px 12px",cursor:"pointer",position:"relative"}}>

                        {/* Status badge + three-dot menu, top right */}
                        <div style={{position:"absolute",top:"8px",right:"8px",display:"flex",alignItems:"center",gap:"4px"}} data-deal-menu>
                          {deal.leadStatus && (
                            <span style={{fontSize:"9px",fontWeight:700,background:ss.bg,color:ss.color,padding:"2px 6px",borderRadius:"20px",display:"flex",alignItems:"center",gap:"3px"}}>
                              <span style={{width:"4px",height:"4px",borderRadius:"50%",background:ss.dot,display:"inline-block"}}/>
                              {deal.leadStatus}
                            </span>
                          )}
                          <button onClick={(e)=>{
                              e.stopPropagation();
                              if (menuOpen) { setOpenMenuId(null); return; }
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPos({ top: rect.bottom + 4, left: Math.min(rect.right - 150, window.innerWidth - 158) });
                              setOpenMenuId(deal.id);
                            }}
                            style={{width:"20px",height:"20px",borderRadius:"6px",border:"none",background:menuOpen?"#e0e7ff":"transparent",color:"#94a3b8",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            <svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="6" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="18" r="1.8"/></svg>
                          </button>
                        </div>

                        {/* Contact + company, one line each */}
                        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"4px",paddingRight:"56px"}}>
                          <Avatar name={deal.contact || deal.title} size={22}/>
                          <div style={{minWidth:0,flex:1}}>
                            <p style={{fontSize:"12px",fontWeight:600,color:"#0f172a",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{deal.contact || deal.title}</p>
                            <p style={{fontSize:"10px",color:"#94a3b8",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {deal.company}{deal.partyType && (deal.company ? ` · ${deal.partyType}` : deal.partyType)}
                            </p>
                          </div>
                        </div>

                        {/* Value + follow-up, one row */}
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
                          <span style={{fontSize:"12px",fontWeight:600,color: deal.value ? "#6366f1" : "#cbd5e1"}}>
                            {deal.value ? `₹${parseFloat(deal.value).toLocaleString("en-IN")}` : "No value"}
                          </span>
                          <div style={{display:"flex",alignItems:"center",gap:"6px",flexShrink:0}}>
                            {deal.salesperson && deal.salesperson!=="Unassigned" && (
                              <span style={{fontSize:"9px",color:"#0369a1"}}>👤 {deal.salesperson}</span>
                            )}
                            {deal.followUpDate && (
                              <span style={{fontSize:"9px",fontWeight:600,color:overdue?"#dc2626":"#15803d"}}>
                                {overdue?"⚠ ":"📅 "}{formatDate(deal.followUpDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {stageDeals.length===0 && (
                    <div style={{border:"2px dashed #e2e8f0",borderRadius:"10px",padding:"20px",textAlign:"center",color:"#cbd5e1",fontSize:"12px"}}>
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Card action menu — rendered once at the page level as position:fixed
          so it always floats above every card, instead of getting clipped
          by neighboring cards when positioned relative to its own card. */}
      {openMenuId && (() => {
        const menuDeal = deals.find(d => d.id === openMenuId);
        if (!menuDeal) return null;
        return (
          <div data-deal-menu-popup onClick={e=>e.stopPropagation()}
            style={{position:"fixed",top:menuPos.top,left:menuPos.left,width:"150px",background:"white",border:"1px solid #e2e8f0",borderRadius:"10px",boxShadow:"0 10px 30px rgba(0,0,0,0.18)",zIndex:1000,overflow:"hidden"}}>
            <button onClick={()=>{setOpenMenuId(null);openEdit(menuDeal);}}
              style={{width:"100%",textAlign:"left",padding:"8px 12px",border:"none",background:"none",cursor:"pointer",fontSize:"12px",color:"#374151",display:"flex",alignItems:"center",gap:"8px"}}
              onMouseOver={e=>e.currentTarget.style.background="#f8fafc"} onMouseOut={e=>e.currentTarget.style.background="none"}>
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              Edit
            </button>
            <button onClick={()=>{setOpenMenuId(null);openActModal(menuDeal);}}
              style={{width:"100%",textAlign:"left",padding:"8px 12px",border:"none",background:"none",cursor:"pointer",fontSize:"12px",color:"#374151",display:"flex",alignItems:"center",gap:"8px"}}
              onMouseOver={e=>e.currentTarget.style.background="#f8fafc"} onMouseOut={e=>e.currentTarget.style.background="none"}>
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              Activity
            </button>
            {menuDeal.phone && (
              <a href={`tel:${menuDeal.phone.replace(/\D/g,"")}`} onClick={()=>setOpenMenuId(null)}
                style={{width:"100%",textAlign:"left",padding:"8px 12px",border:"none",background:"none",cursor:"pointer",fontSize:"12px",color:"#374151",display:"flex",alignItems:"center",gap:"8px",textDecoration:"none"}}
                onMouseOver={e=>e.currentTarget.style.background="#f8fafc"} onMouseOut={e=>e.currentTarget.style.background="none"}>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                Call
              </a>
            )}
            {menuDeal.phone && (
              <a href={`https://wa.me/91${menuDeal.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" onClick={()=>setOpenMenuId(null)}
                style={{width:"100%",textAlign:"left",padding:"8px 12px",border:"none",background:"none",cursor:"pointer",fontSize:"12px",color:"#16a34a",display:"flex",alignItems:"center",gap:"8px",textDecoration:"none"}}
                onMouseOver={e=>e.currentTarget.style.background="#f0fdf4"} onMouseOut={e=>e.currentTarget.style.background="none"}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
            )}
            <div style={{borderTop:"1px solid #f1f5f9"}}/>
            <button onClick={()=>{setOpenMenuId(null);remove(menuDeal.id);}}
              style={{width:"100%",textAlign:"left",padding:"8px 12px",border:"none",background:"none",cursor:"pointer",fontSize:"12px",color:"#ef4444",display:"flex",alignItems:"center",gap:"8px"}}
              onMouseOver={e=>e.currentTarget.style.background="#fef2f2"} onMouseOut={e=>e.currentTarget.style.background="none"}>
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16"/></svg>
              Delete
            </button>
          </div>
        );
      })()}

      {/* Add/Edit Deal Modal */}
      {showDealModal && (
        <Modal title={editDeal?"Edit deal":"Add deal"} onClose={()=>setShowDealModal(false)}>
          <div style={{maxHeight:"70vh",overflowY:"auto",paddingRight:"4px"}}>
            <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
              {/* Contact search */}
              <div style={{position:"relative"}}>
                <label style={{display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px"}}>
                  Search contact * <span style={{color:"#94a3b8",fontWeight:400}}>(name or phone)</span>
                </label>
                <input className="input" placeholder="Type name or phone..." value={contactSearch}
                  onChange={e=>searchContacts(e.target.value)}
                  onFocus={()=>contactSearch&&setShowContactDrop(contactResults.length>0)} />
                {showContactDrop && (
                  <div style={{position:"absolute",zIndex:50,width:"100%",background:"white",border:"1px solid #e2e8f0",borderRadius:"10px",boxShadow:"0 10px 40px rgba(0,0,0,0.12)",marginTop:"4px",overflow:"hidden"}}>
                    {contactResults.map(c=>(
                      <button key={c.id} onClick={()=>selectContact(c)}
                        style={{width:"100%",textAlign:"left",padding:"10px 14px",border:"none",background:"none",cursor:"pointer",borderBottom:"1px solid #f1f5f9"}}
                        onMouseOver={e=>e.currentTarget.style.background="#f5f3ff"} onMouseOut={e=>e.currentTarget.style.background="none"}>
                        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                          <Avatar name={c.name} size={26}/>
                          <div>
                            <p style={{fontSize:"13px",fontWeight:600,color:"#0f172a",margin:0}}>{c.name}</p>
                            <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{c.company}{c.phone&&` · ${c.phone}`}{c.partyType&&` · ${c.partyType}`}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {dealForm.contact && (
                  <p style={{fontSize:"11px",color:"#059669",marginTop:"4px",fontWeight:500}}>
                    ✅ Deal name: <strong>{buildDealTitle(dealForm.contact, dealForm.company)}</strong>
                  </p>
                )}
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                <div>
                  <label style={{display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px"}}>Deal value (₹)</label>
                  <input className="input" placeholder="50000" value={dealForm.value} onChange={setF("value")} />
                </div>
                <div>
                  <label style={{display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px"}}>Lead type</label>
                  <select className="input" value={dealForm.leadType} onChange={setF("leadType")}>
                    {LEAD_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px"}}>Party type</label>
                <select className="input" value={dealForm.partyType} onChange={setF("partyType")}>
                  <option value="">Select party type</option>
                  {PARTY_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label style={{display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"6px"}}>Lead status</label>
                <div style={{display:"flex",gap:"6px"}}>
                  {LEAD_STATUSES.map(s=>{
                    const ss = STATUS_STYLE[s];
                    const active = dealForm.leadStatus===s;
                    return (
                      <button key={s} onClick={()=>setDealForm(f=>({...f,leadStatus:s}))}
                        style={{flex:1,padding:"8px",borderRadius:"8px",fontSize:"13px",fontWeight:600,cursor:"pointer",border:`2px solid ${active?ss.dot:"#e2e8f0"}`,background:active?ss.bg:"white",color:active?ss.color:"#94a3b8",transition:"all 0.15s"}}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                <div>
                  <label style={{display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px"}}>Stage</label>
                  <select className="input" value={dealForm.stage} onChange={setF("stage")}>
                    {STAGES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px"}}>Follow-up date</label>
                  <input className="input" type="date" value={dealForm.followUpDate} onChange={setF("followUpDate")} />
                </div>
              </div>

              {/* SALESPERSON-LOCK: this block replaces the old plain dropdown.
                  Admin still gets the same dropdown as before. Non-admin sees
                  their own name as locked, read-only text instead. */}
              <div>
                <label style={{display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px"}}>
                  Assigned salesperson {!isAdmin && <span style={{color:"#94a3b8",fontWeight:400}}>(you)</span>}
                </label>
                {isAdmin ? (
                  <select className="input" value={dealForm.salesperson} onChange={setF("salesperson")}>
                    <option>Unassigned</option>
                    {salespersons.map(s=><option key={s.id}>{s.name}</option>)}
                  </select>
                ) : (
                  <div className="input" style={{background:"#f8fafc",color:"#374151",fontWeight:600,cursor:"not-allowed",display:"flex",alignItems:"center",gap:"6px"}}>
                    <Avatar name={mySalesperson} size={18}/>
                    {mySalesperson}
                  </div>
                )}
              </div>

              <div>
                <label style={{display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px"}}>Notes</label>
                <textarea className="input" style={{resize:"none"}} rows={2} value={dealForm.notes} onChange={setF("notes")} />
              </div>

              <div style={{display:"flex",gap:"8px",paddingTop:"4px"}}>
                <button className="btn btn-secondary" style={{flex:1}} onClick={()=>setShowDealModal(false)}>Cancel</button>
                <button className="btn btn-primary" style={{flex:1,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none"}} onClick={saveDeal} disabled={saving}>
                  {saving?"Saving...":editDeal?"Update deal":"Add deal"}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Activity Modal */}
      {actModal && (
        <Modal title={`Log activity — ${actModal.title}`} onClose={()=>setActModal(null)}>
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"6px"}}>
              {ACT_TYPES.map(t=>(
                <button key={t} onClick={()=>setActForm(f=>({...f,type:t}))}
                  style={{padding:"8px",borderRadius:"8px",fontSize:"12px",fontWeight:600,cursor:"pointer",border:`2px solid ${actForm.type===t?"#6366f1":"#e2e8f0"}`,background:actForm.type===t?"#eef2ff":"white",color:actForm.type===t?"#6366f1":"#94a3b8",transition:"all 0.15s"}}>
                  {t}
                </button>
              ))}
            </div>
            <div>
              <label style={{display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px"}}>Subject *</label>
              <input className="input" placeholder="Follow-up call with client" value={actForm.subject} onChange={e=>setActForm(f=>({...f,subject:e.target.value}))} />
            </div>
            <div>
              <label style={{display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px"}}>Notes</label>
              <textarea className="input" style={{resize:"none"}} rows={2} placeholder="What was discussed?" value={actForm.notes} onChange={e=>setActForm(f=>({...f,notes:e.target.value}))} />
            </div>
            <div>
              <label style={{display:"block",fontSize:"11px",fontWeight:600,color:"#374151",marginBottom:"4px"}}>
                📅 Next follow-up date <span style={{color:"#94a3b8",fontWeight:400}}>(updates deal)</span>
              </label>
              <input className="input" type="date" value={actForm.followUpDate} onChange={e=>setActForm(f=>({...f,followUpDate:e.target.value}))} />
              {actForm.followUpDate && (
                <p style={{fontSize:"11px",color:"#059669",marginTop:"4px",fontWeight:500}}>
                  📅 Follow-up set for {new Date(actForm.followUpDate).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
                </p>
              )}
            </div>
            <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none"}} onClick={saveActivity} disabled={saving}>
              {saving?"Saving...":"Log activity"}
            </button>

            {/* Lead-wise activity history — every past entry for THIS deal,
                newest first, so it reads as a timeline of what happened and when. */}
            <div style={{borderTop:"1px solid #f1f5f9",paddingTop:"12px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px"}}>
                <p style={{fontSize:"11px",fontWeight:700,color:"#64748b",margin:0,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                  History for {actModal.title}
                </p>
                <span style={{fontSize:"11px",fontWeight:700,color:"white",background:"#6366f1",borderRadius:"20px",padding:"1px 8px"}}>
                  {dealActivities.length}
                </span>
              </div>
              {dealActivities.length===0 ? (
                <p style={{fontSize:"12px",color:"#94a3b8",textAlign:"center",padding:"12px 0"}}>No activity logged yet for this lead.</p>
              ) : (
                <div style={{display:"flex",flexDirection:"column",maxHeight:"220px",overflowY:"auto"}}>
                  {dealActivities.map((a,i)=>(
                    <div key={a.id} style={{display:"flex",gap:"10px",position:"relative",paddingBottom: i===dealActivities.length-1 ? 0 : "12px"}}>
                      {/* Timeline rail */}
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                        <div style={{width:"22px",height:"22px",borderRadius:"50%",background:"#eef2ff",color:"#6366f1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",flexShrink:0}}>
                          {ACT_TYPE_ICON[a.type] || "•"}
                        </div>
                        {i !== dealActivities.length-1 && (
                          <div style={{flex:1,width:"2px",background:"#e2e8f0",marginTop:"2px"}}/>
                        )}
                      </div>
                      {/* Entry content */}
                      <div style={{flex:1,paddingBottom:"2px"}}>
                        <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:"8px"}}>
                          <p style={{fontSize:"12px",fontWeight:700,color:"#0f172a",margin:0}}>{a.type}: {a.subject}</p>
                          <span style={{fontSize:"10px",color:"#94a3b8",flexShrink:0}}>{timeAgo(a.createdAt)}</span>
                        </div>
                        {a.notes && <p style={{fontSize:"11px",color:"#64748b",margin:"2px 0 0"}}>{a.notes}</p>}
                        <p style={{fontSize:"10px",color:"#cbd5e1",margin:"2px 0 0"}}>{fullDateTime(a.createdAt)}{a.salesperson && ` · ${a.salesperson}`}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { getDeals, addDeal, updateDeal, deleteDeal, addActivity, getActivitiesForDeal, getSalespersons, db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, updateDoc, doc } from "firebase/firestore";
import Modal from "../components/Modal";
import toast from "react-hot-toast";

const STAGES = ["Lead","Qualified","Proposal","Negotiation","Won","Lost"];
const STAGE_BORDER = { Lead:"border-t-gray-400", Qualified:"border-t-blue-400", Proposal:"border-t-purple-400", Negotiation:"border-t-amber-400", Won:"border-t-green-400", Lost:"border-t-red-400" };
const LEAD_TYPES = ["B2B","B2C","Government","Institutional","Referral","Other"];
const ACT_TYPES = ["Email","Call","Meeting","WhatsApp","Note"];
const EMPTY_DEAL = { title:"", company:"", value:"", stage:"Lead", contact:"", salesperson:"Unassigned", notes:"", leadType:"B2B", followUpDate:"" };
const EMPTY_ACT = { type:"Call", subject:"", notes:"", followUpDate:"", followUpTime:"" };

function daysInStage(deal) {
  if (!deal.stageChangedAt) return null;
  const d = deal.stageChangedAt.toDate ? deal.stageChangedAt.toDate() : new Date(deal.stageChangedAt);
  return Math.floor((Date.now() - d) / 86400000);
}

function timeAgo(ts) {
  if (!ts) return "Just now";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now()-d)/1000;
  if (diff<60) return "Just now";
  if (diff<3600) return `${Math.floor(diff/60)}m ago`;
  if (diff<86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

export default function PipelinePage() {
  const [deals, setDeals] = useState([]);
  const [archivedDeals, setArchivedDeals] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [filterSP, setFilterSP] = useState("All");
  const [showDealModal, setShowDealModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [editDeal, setEditDeal] = useState(null);
  const [dealForm, setDealForm] = useState(EMPTY_DEAL);
  const [actModal, setActModal] = useState(null);
  const [actForm, setActForm] = useState(EMPTY_ACT);
  const [dealActivities, setDealActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const dragDeal = useRef(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([getDeals(), getSalespersons()]);
      setDeals(d.filter(x => !x.archived));
      setArchivedDeals(d.filter(x => x.archived));
      setSalespersons(s);
    } catch { toast.error("Could not load pipeline"); }
    finally { setLoading(false); }
  }

  function openAdd() { setDealForm(EMPTY_DEAL); setEditDeal(null); setShowDealModal(true); }
  function openEdit(deal) { setDealForm({...EMPTY_DEAL,...deal}); setEditDeal(deal); setShowDealModal(true); }

  async function saveDeal() {
    if (!dealForm.title.trim()) return toast.error("Deal title required");
    setSaving(true);
    try {
      if (editDeal) {
        const stageChanged = editDeal.stage !== dealForm.stage;
        await updateDeal(editDeal.id, { ...dealForm, ...(stageChanged ? { stageChangedAt: new Date() } : {}) });
        toast.success("Deal updated ✅");
      } else {
        await addDeal({ ...dealForm, stageChangedAt: new Date() });
        toast.success("Deal added ✅");
      }
      setShowDealModal(false); load();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  async function archiveDeal(deal) {
    if (!confirm(`Archive "${deal.title}"? Find it in the Archive to restore or re-target.`)) return;
    await updateDeal(deal.id, { archived: true, archivedAt: new Date().toISOString() });
    toast.success("Deal archived");
    load();
  }

  async function restoreDeal(deal) {
    await updateDeal(deal.id, { archived: false, archivedAt: null });
    toast.success("Deal restored ✅");
    load();
  }

  async function openActModal(deal) {
    setActModal(deal); setActForm(EMPTY_ACT);
    const acts = await getActivitiesForDeal(deal.id);
    setDealActivities(acts);
  }

  async function saveActivity() {
    if (!actForm.subject.trim()) return toast.error("Subject required");
    setSaving(true);
    try {
      await addActivity({
        ...actForm,
        dealId: actModal.id,
        dealTitle: actModal.title,
        contact: actModal.contact,
        company: actModal.company,
        salesperson: actModal.salesperson,
      });
      toast.success("Activity logged ✅");
      setActForm(EMPTY_ACT);
      const acts = await getActivitiesForDeal(actModal.id);
      setDealActivities(acts);
    } catch { toast.error("Failed to log"); }
    finally { setSaving(false); }
  }

  function onDragStart(deal) { dragDeal.current = deal; }
  async function onDrop(stage) {
    if (!dragDeal.current || dragDeal.current.stage === stage) return;
    await updateDeal(dragDeal.current.id, { stage, stageChangedAt: new Date() });
    toast.success(`Moved to ${stage}`);
    dragDeal.current = null;
    load();
  }

  const filtered = filterSP === "All" ? deals : deals.filter(d => d.salesperson === filterSP);
  const totalValue = filtered.filter(d => d.stage !== "Lost").reduce((s, d) => s + (parseFloat(d.value)||0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500">Active: <span className="font-semibold text-gray-700">₹{totalValue.toLocaleString("en-IN")}</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-secondary" onClick={() => setShowArchive(true)}>🗂 Archive ({archivedDeals.length})</button>
          <select className="input w-44" value={filterSP} onChange={e=>setFilterSP(e.target.value)}>
            <option value="All">All salespersons</option>
            {salespersons.map(s=><option key={s.id}>{s.name}</option>)}
            <option>Unassigned</option>
          </select>
          <button className="btn btn-primary" onClick={openAdd}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add deal
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-3">💡 Drag & drop cards to move between stages</p>

      {loading ? <div className="text-center py-20 text-gray-400 text-sm">Loading...</div> : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map(stage => {
            const stageDeals = filtered.filter(d => d.stage === stage);
            const stageVal = stageDeals.reduce((s,d)=>s+(parseFloat(d.value)||0),0);
            return (
              <div key={stage} className={`flex-shrink-0 w-60 bg-gray-50 rounded-xl border-t-4 ${STAGE_BORDER[stage]} border border-gray-100`}
                onDragOver={e=>e.preventDefault()} onDrop={()=>onDrop(stage)}>
                <div className="px-3 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{stage}</span>
                    <span className="text-xs text-gray-400 bg-white border border-gray-100 rounded-full px-2 py-0.5">{stageDeals.length}</span>
                  </div>
                  {stageVal>0 && <p className="text-xs text-gray-400 mt-0.5">₹{stageVal.toLocaleString("en-IN")}</p>}
                </div>
                <div className="p-2 space-y-2 min-h-32">
                  {stageDeals.map(deal => {
                    const days = daysInStage(deal);
                    const overdue = deal.followUpDate && new Date(deal.followUpDate) < new Date();
                    return (
                      <div key={deal.id} draggable onDragStart={()=>onDragStart(deal)}
                        className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-medium text-gray-900 leading-tight">{deal.title}</p>
                          {deal.leadType && <span className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5 flex-shrink-0">{deal.leadType}</span>}
                        </div>
                        {deal.company && <p className="text-xs text-gray-400 mt-0.5">{deal.company}</p>}
                        {deal.contact && <p className="text-xs text-gray-400">👤 {deal.contact}</p>}
                        {deal.salesperson && deal.salesperson !== "Unassigned" && <p className="text-xs text-blue-500 mt-0.5">🧑‍💼 {deal.salesperson}</p>}
                        {deal.value && <p className="text-sm font-semibold text-blue-600 mt-2">₹{parseFloat(deal.value).toLocaleString("en-IN")}</p>}
                        {days !== null && (
                          <p className={`text-xs mt-1 ${days > 14 ? "text-red-400 font-medium" : "text-gray-400"}`}>
                            ⏱ {days}d in {stage}
                          </p>
                        )}
                        {deal.followUpDate && (
                          <p className={`text-xs mt-0.5 ${overdue ? "text-red-500 font-medium" : "text-green-600"}`}>
                            📅 Follow-up: {new Date(deal.followUpDate).toLocaleDateString("en-IN")} {overdue ? "⚠️ Overdue" : ""}
                          </p>
                        )}
                        <div className="flex gap-1 mt-2 border-t border-gray-50 pt-2">
                          <button onClick={()=>openEdit(deal)} title="Edit"
                            className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded py-1 transition-all">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            Edit
                          </button>
                          <button onClick={()=>openActModal(deal)} title="Log activity"
                            className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-green-600 hover:bg-green-50 rounded py-1 transition-all">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                            Activity
                          </button>
                          <button onClick={()=>archiveDeal(deal)} title="Archive"
                            className="flex items-center justify-center text-gray-300 hover:text-amber-400 hover:bg-amber-50 rounded p-1 transition-all">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {stageDeals.length===0 && <p className="text-xs text-gray-300 text-center pt-6">Drop here</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Deal Modal */}
      {showDealModal && (
        <Modal title={editDeal?"Edit deal":"Add deal"} onClose={()=>setShowDealModal(false)}>
          <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Deal title *</label>
              <input className="input" placeholder="New Enterprise Contract" value={dealForm.title} onChange={e=>setDealForm({...dealForm,title:e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Company</label>
                <input className="input" placeholder="Acme Corp" value={dealForm.company} onChange={e=>setDealForm({...dealForm,company:e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contact name</label>
                <input className="input" placeholder="Jane Smith" value={dealForm.contact} onChange={e=>setDealForm({...dealForm,contact:e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Deal value (₹)</label>
                <input className="input" placeholder="50000" value={dealForm.value} onChange={e=>setDealForm({...dealForm,value:e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lead type</label>
                <select className="input" value={dealForm.leadType} onChange={e=>setDealForm({...dealForm,leadType:e.target.value})}>
                  {LEAD_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
              <select className="input" value={dealForm.stage} onChange={e=>setDealForm({...dealForm,stage:e.target.value})}>
                {STAGES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assigned salesperson</label>
              <select className="input" value={dealForm.salesperson} onChange={e=>setDealForm({...dealForm,salesperson:e.target.value})}>
                <option>Unassigned</option>
                {salespersons.map(s=><option key={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up date</label>
              <input className="input" type="date" value={dealForm.followUpDate} onChange={e=>setDealForm({...dealForm,followUpDate:e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="input resize-none" rows={2} value={dealForm.notes} onChange={e=>setDealForm({...dealForm,notes:e.target.value})} />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn btn-secondary flex-1" onClick={()=>setShowDealModal(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={saveDeal} disabled={saving}>{saving?"Saving...":editDeal?"Update deal":"Add deal"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Activity Modal */}
      {actModal && (
        <Modal title={`Log activity — ${actModal.title}`} onClose={()=>setActModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <div className="grid grid-cols-5 gap-1">
                {ACT_TYPES.map(t=>(
                  <button key={t} onClick={()=>setActForm({...actForm,type:t})}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${actForm.type===t?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Subject *</label>
              <input className="input" placeholder="Follow-up call with client" value={actForm.subject} onChange={e=>setActForm({...actForm,subject:e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="input resize-none" rows={2} placeholder="What was discussed?" value={actForm.notes} onChange={e=>setActForm({...actForm,notes:e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">📅 Follow-up date</label>
                <input className="input" type="date" value={actForm.followUpDate} onChange={e=>setActForm({...actForm,followUpDate:e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">⏰ Follow-up time</label>
                <input className="input" type="time" value={actForm.followUpTime} onChange={e=>setActForm({...actForm,followUpTime:e.target.value})} />
              </div>
            </div>
            <button className="btn btn-primary w-full" onClick={saveActivity} disabled={saving}>{saving?"Saving...":"Log activity"}</button>
            {dealActivities.length > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Past activities</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {dealActivities.map(a=>(
                    <div key={a.id} className="text-xs bg-gray-50 rounded p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">{a.type}</span>
                        <span className="text-gray-400">{timeAgo(a.createdAt)}</span>
                      </div>
                      <p className="text-gray-600 mt-0.5">{a.subject}</p>
                      {a.followUpDate && (
                        <p className={`mt-0.5 ${new Date(a.followUpDate) < new Date() ? "text-red-400" : "text-green-600"}`}>
                          📅 Follow-up: {new Date(a.followUpDate).toLocaleDateString("en-IN")} {a.followUpTime && `at ${a.followUpTime}`}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Archive Modal */}
      {showArchive && (
        <Modal title={`🗂 Archived Deals (${archivedDeals.length})`} onClose={()=>setShowArchive(false)}>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {archivedDeals.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">No archived deals.</p>
            ) : archivedDeals.map(deal => (
              <div key={deal.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{deal.title}</p>
                  <p className="text-xs text-gray-400">{deal.company || "—"} · {deal.stage} · {deal.salesperson}</p>
                </div>
                <button onClick={()=>restoreDeal(deal)} className="text-xs text-green-600 hover:underline font-medium">Restore</button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

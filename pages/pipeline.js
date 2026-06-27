import { useState, useEffect, useRef } from "react";
import { getDeals, addDeal, updateDeal, deleteDeal, addActivity, getActivitiesForDeal, getSalespersons } from "../lib/firebase";
import Modal from "../components/Modal";
import toast from "react-hot-toast";

const STAGES = ["Lead","Qualified","Proposal","Negotiation","Won","Lost"];
const STAGE_BORDER = { Lead:"border-t-gray-400", Qualified:"border-t-blue-400", Proposal:"border-t-purple-400", Negotiation:"border-t-amber-400", Won:"border-t-green-400", Lost:"border-t-red-400" };
const ACT_TYPES = ["Email","Call","Meeting","Note"];
const EMPTY_DEAL = { title:"", company:"", value:"", stage:"Lead", contact:"", salesperson:"Unassigned", notes:"" };
const EMPTY_ACT = { type:"Email", subject:"", notes:"" };

export default function PipelinePage() {
  const [deals, setDeals] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [filterSP, setFilterSP] = useState("All");
  const [showDealModal, setShowDealModal] = useState(false);
  const [editDeal, setEditDeal] = useState(null);
  const [dealForm, setDealForm] = useState(EMPTY_DEAL);
  const [actModal, setActModal] = useState(null); // deal object
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
      setDeals(d); setSalespersons(s);
    } catch { toast.error("Could not load pipeline"); }
    finally { setLoading(false); }
  }

  function openAdd() { setDealForm(EMPTY_DEAL); setEditDeal(null); setShowDealModal(true); }
  function openEdit(deal) { setDealForm({...EMPTY_DEAL,...deal}); setEditDeal(deal); setShowDealModal(true); }

  async function saveDeal() {
    if (!dealForm.title.trim()) return toast.error("Deal title required");
    setSaving(true);
    try {
      if (editDeal) { await updateDeal(editDeal.id, dealForm); toast.success("Deal updated"); }
      else { await addDeal(dealForm); toast.success("Deal added"); }
      setShowDealModal(false); load();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
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
      await addActivity({ ...actForm, dealId: actModal.id, dealTitle: actModal.title, contact: actModal.contact, company: actModal.company });
      toast.success("Activity logged");
      setActForm(EMPTY_ACT);
      const acts = await getActivitiesForDeal(actModal.id);
      setDealActivities(acts);
    } catch { toast.error("Failed to log"); }
    finally { setSaving(false); }
  }

  async function remove(id) {
    if (!confirm("Delete this deal?")) return;
    await deleteDeal(id); toast.success("Deleted");
    setDeals(d => d.filter(x => x.id !== id));
  }

  // Drag & drop
  function onDragStart(deal) { dragDeal.current = deal; }
  async function onDrop(stage) {
    if (!dragDeal.current || dragDeal.current.stage === stage) return;
    await updateDeal(dragDeal.current.id, { stage });
    toast.success(`Moved to ${stage}`);
    dragDeal.current = null;
    load();
  }

  const filtered = filterSP === "All" ? deals : deals.filter(d => d.salesperson === filterSP);
  const totalValue = filtered.filter(d => d.stage !== "Lost").reduce((s, d) => s + (parseFloat(d.value)||0), 0);

  function timeAgo(ts) {
    if (!ts) return "Just now";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = (Date.now()-d)/1000;
    if (diff<60) return "Just now";
    if (diff<3600) return `${Math.floor(diff/60)}m ago`;
    if (diff<86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500">Total: <span className="font-semibold text-gray-700">₹{totalValue.toLocaleString("en-IN")}</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
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
                  {stageDeals.map(deal => (
                    <div key={deal.id} draggable onDragStart={()=>onDragStart(deal)}
                      className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing group">
                      <p className="text-sm font-medium text-gray-900 leading-tight">{deal.title}</p>
                      {deal.company && <p className="text-xs text-gray-400 mt-0.5">{deal.company}</p>}
                      {deal.contact && <p className="text-xs text-gray-400">👤 {deal.contact}</p>}
                      {deal.salesperson && deal.salesperson !== "Unassigned" && <p className="text-xs text-blue-500 mt-0.5">🧑‍💼 {deal.salesperson}</p>}
                      {deal.value && <p className="text-sm font-semibold text-blue-600 mt-2">₹{parseFloat(deal.value).toLocaleString("en-IN")}</p>}
                      <div className="flex gap-1 mt-2 border-t border-gray-50 pt-2">
                        <button onClick={()=>openEdit(deal)} title="Edit deal"
                          className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded py-1 transition-all">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          Edit
                        </button>
                        <button onClick={()=>openActModal(deal)} title="Log activity"
                          className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-green-600 hover:bg-green-50 rounded py-1 transition-all">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                          Activity
                        </button>
                        <button onClick={()=>remove(deal.id)} title="Delete"
                          className="flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded p-1 transition-all">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
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
          <div className="space-y-3">
            {[["Deal title *","title","New Enterprise Contract"],["Company","company","Acme Corp"],["Contact name","contact","Jane Smith"],["Deal value (₹)","value","50000"]].map(([label,field,ph])=>(
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input className="input" placeholder={ph} value={dealForm[field]} onChange={e=>setDealForm({...dealForm,[field]:e.target.value})} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assigned salesperson</label>
              <select className="input" value={dealForm.salesperson} onChange={e=>setDealForm({...dealForm,salesperson:e.target.value})}>
                <option>Unassigned</option>
                {salespersons.map(s=><option key={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
              <select className="input" value={dealForm.stage} onChange={e=>setDealForm({...dealForm,stage:e.target.value})}>
                {STAGES.map(s=><option key={s}>{s}</option>)}
              </select>
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

      {/* Activity Modal from Pipeline */}
      {actModal && (
        <Modal title={`Log activity — ${actModal.title}`} onClose={()=>setActModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <div className="grid grid-cols-4 gap-2">
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
            <button className="btn btn-primary w-full" onClick={saveActivity} disabled={saving}>{saving?"Saving...":"Log activity"}</button>

            {/* Past activities for this deal */}
            {dealActivities.length > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500 mb-2">Past activities on this deal</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {dealActivities.map(a=>(
                    <div key={a.id} className="text-xs bg-gray-50 rounded p-2">
                      <span className="font-medium text-gray-700">{a.type}</span> · {a.subject}
                      <span className="text-gray-400 ml-2">{timeAgo(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );

  function timeAgo(ts) {
    if (!ts) return "Just now";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = (Date.now()-d)/1000;
    if (diff<60) return "Just now";
    if (diff<3600) return `${Math.floor(diff/60)}m ago`;
    if (diff<86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  }
}

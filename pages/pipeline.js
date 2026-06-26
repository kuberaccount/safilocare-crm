import { useState, useEffect } from "react";
import { getDeals, addDeal, updateDeal, deleteDeal } from "../lib/firebase";
import Modal from "../components/Modal";
import toast from "react-hot-toast";

const STAGES = ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
const STAGE_COLORS = {
  Lead: "bg-gray-100 text-gray-600",
  Qualified: "bg-blue-100 text-blue-700",
  Proposal: "bg-purple-100 text-purple-700",
  Negotiation: "bg-amber-100 text-amber-700",
  Won: "bg-green-100 text-green-700",
  Lost: "bg-red-100 text-red-700",
};
const STAGE_BORDER = {
  Lead: "border-t-gray-300", Qualified: "border-t-blue-400", Proposal: "border-t-purple-400",
  Negotiation: "border-t-amber-400", Won: "border-t-green-400", Lost: "border-t-red-400",
};

export default function PipelinePage() {
  const [deals, setDeals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", company: "", value: "", stage: "Lead", contact: "", notes: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setDeals(await getDeals()); }
    catch { toast.error("Could not load deals"); }
    finally { setLoading(false); }
  }

  async function save() {
    if (!form.title.trim()) return toast.error("Deal title is required");
    setSaving(true);
    try {
      await addDeal(form);
      toast.success("Deal added");
      setShowModal(false);
      setForm({ title: "", company: "", value: "", stage: "Lead", contact: "", notes: "" });
      load();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  async function moveStage(deal, direction) {
    const idx = STAGES.indexOf(deal.stage);
    const newStage = STAGES[idx + direction];
    if (!newStage) return;
    await updateDeal(deal.id, { stage: newStage });
    toast.success(`Moved to ${newStage}`);
    load();
  }

  async function remove(id) {
    if (!confirm("Delete this deal?")) return;
    await deleteDeal(id);
    toast.success("Deleted");
    setDeals((d) => d.filter((x) => x.id !== id));
  }

  const totalValue = deals.filter((d) => d.stage !== "Lost").reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-500">Total value: <span className="font-semibold text-gray-700">₹{totalValue.toLocaleString("en-IN")}</span></p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Add deal
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading pipeline...</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4 mt-4">
          {STAGES.map((stage) => {
            const stageDeals = deals.filter((d) => d.stage === stage);
            const stageValue = stageDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
            return (
              <div key={stage} className={`flex-shrink-0 w-56 bg-gray-50 rounded-xl border-t-4 ${STAGE_BORDER[stage]} border border-gray-100`}>
                <div className="px-3 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{stage}</span>
                    <span className="text-xs text-gray-400 bg-white border border-gray-100 rounded-full px-2 py-0.5">{stageDeals.length}</span>
                  </div>
                  {stageValue > 0 && <p className="text-xs text-gray-400 mt-0.5">₹{stageValue.toLocaleString("en-IN")}</p>}
                </div>
                <div className="p-2 space-y-2 min-h-32">
                  {stageDeals.map((deal) => (
                    <div key={deal.id} className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm hover:shadow-md transition-shadow group">
                      <p className="text-sm font-medium text-gray-900 leading-tight">{deal.title}</p>
                      {deal.company && <p className="text-xs text-gray-400 mt-0.5">{deal.company}</p>}
                      {deal.value && <p className="text-sm font-semibold text-blue-600 mt-2">₹{parseFloat(deal.value).toLocaleString("en-IN")}</p>}
                      {deal.contact && <p className="text-xs text-gray-400 mt-1">👤 {deal.contact}</p>}
                      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveStage(deal, -1)} disabled={STAGES.indexOf(deal.stage) === 0} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        <button onClick={() => moveStage(deal, 1)} disabled={STAGES.indexOf(deal.stage) === STAGES.length - 1} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                        </button>
                        <button onClick={() => remove(deal.id)} className="p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 ml-auto">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  {stageDeals.length === 0 && (
                    <p className="text-xs text-gray-300 text-center pt-6">No deals</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title="Add deal" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {[["Deal title *", "title", "New Enterprise Contract"], ["Company", "company", "Acme Corp"], ["Contact name", "contact", "Jane Smith"], ["Deal value (₹)", "value", "50000"]].map(([label, field, placeholder]) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input className="input" placeholder={placeholder} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stage</label>
              <select className="input" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={save} disabled={saving}>{saving ? "Saving..." : "Add deal"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

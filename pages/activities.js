import { useState, useEffect } from "react";
import { getActivities, addActivity, deleteActivity, getSalespersons } from "../lib/firebase";
import Modal from "../components/Modal";
import toast from "react-hot-toast";
import { exportToCSV, fmtDateForExport } from "../lib/export";

const TYPES = ["Email", "Call", "Meeting", "Note"];
const TYPE_ICONS = {
  Email: { icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z", color: "bg-blue-100 text-blue-600" },
  Call:  { icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z", color: "bg-green-100 text-green-600" },
  Meeting: { icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", color: "bg-amber-100 text-amber-600" },
  Note: { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01", color: "bg-purple-100 text-purple-600" },
};

function timeAgo(ts) {
  if (!ts) return "Just now";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ActivitiesPage({ currentUser }) {
  const isAdmin = currentUser?.role === "admin";
  const [activities, setActivities] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [filterSP, setFilterSP] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "Email", subject: "", contact: "", company: "", notes: "", date: todayStr() });

  useEffect(() => { load(); }, []);

  function todayStr() {
    return new Date().toISOString().split("T")[0];
  }

  async function load() {
    setLoading(true);
    try {
      const sp = isAdmin ? null : currentUser?.salesperson;
      const [acts, sps] = await Promise.all([
        getActivities(sp),
        isAdmin ? getSalespersons() : Promise.resolve([]),
      ]);
      setActivities(acts);
      setSalespersons(sps);
    }
    catch { toast.error("Could not load activities"); }
    finally { setLoading(false); }
  }

  async function save() {
    if (!form.subject.trim()) return toast.error("Subject is required");
    setSaving(true);
    try {
      await addActivity(form);
      toast.success("Activity logged");
      setShowModal(false);
      setForm({ type: "Email", subject: "", contact: "", company: "", notes: "", date: todayStr() });
      load();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  async function remove(id) {
    if (!confirm("Delete this activity?")) return;
    await deleteActivity(id);
    toast.success("Deleted");
    setActivities((a) => a.filter((x) => x.id !== id));
  }

  const filtered = activities.filter((a) => {
    const matchSP = filterSP === "All" || a.salesperson === filterSP || a.dealSalesperson === filterSP;
    const matchType = filterType === "All" || a.type === filterType;
    return matchSP && matchType;
  });

  function handleExport() {
    if (filtered.length === 0) return toast.error("No activities to export");
    try {
      exportToCSV(`activities_${todayStr()}.csv`, filtered, [
        { key: "type", label: "Type" },
        { key: "subject", label: "Subject" },
        { key: "contact", label: "Contact" },
        { key: "company", label: "Company" },
        { key: "salesperson", label: "Salesperson", value: (r) => r.salesperson || r.dealSalesperson || "" },
        { key: "date", label: "Activity date", value: (r) => r.date || "" },
        { key: "notes", label: "Notes" },
        { key: "createdAt", label: "Logged at", value: (r) => fmtDateForExport(r.createdAt) },
      ]);
      toast.success("Exported");
    } catch { toast.error("Export failed"); }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Activities</h1>
          <p className="text-sm text-gray-500">{activities.length} logged</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handleExport}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Log activity
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {["All", ...TYPES].map((t) => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filterType === t ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
            {t}
          </button>
        ))}
        {isAdmin && (
          <select className="input w-44 ml-auto" value={filterSP} onChange={(e) => setFilterSP(e.target.value)}>
            <option value="All">All salespersons</option>
            {salespersons.map((s) => <option key={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading activities...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">No activities match your filters.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const t = TYPE_ICONS[a.type] || TYPE_ICONS.Note;
            return (
              <div key={a.id} className="card p-4 flex gap-4 group hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${t.color}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={t.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.subject}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {a.type} {a.contact && `· ${a.contact}`} {a.company && `· ${a.company}`} {isAdmin && (a.salesperson || a.dealSalesperson) && `· ${a.salesperson || a.dealSalesperson}`}
                      </p>
                      {a.date && <p className="text-xs text-gray-400 mt-0.5">📅 {a.date}</p>}
                      {a.notes && <p className="text-xs text-gray-500 mt-1.5 bg-gray-50 rounded p-2">{a.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-300">{timeAgo(a.createdAt)}</span>
                      <button onClick={() => remove(a.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title="Log activity" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <div className="grid grid-cols-4 gap-2">
                {TYPES.map((t) => (
                  <button key={t} onClick={() => setForm({ ...form, type: t })}
                    className={`py-2 rounded-lg text-xs font-medium border transition-all ${form.type === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{t}</button>
                ))}
              </div>
            </div>
            {[["Subject *", "subject", "text", "Follow-up call with Jane"], ["Contact name", "contact", "text", "Jane Smith"], ["Company", "company", "text", "Acme Corp"]].map(([label, field, type, placeholder]) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input className="input" type={type} placeholder={placeholder} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="input resize-none" rows={3} placeholder="What was discussed?" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={save} disabled={saving}>{saving ? "Saving..." : "Log activity"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

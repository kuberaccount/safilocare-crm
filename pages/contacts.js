import { useState, useEffect } from "react";
import { getContacts, addContact, deleteContact } from "../lib/firebase";
import Modal from "../components/Modal";
import toast from "react-hot-toast";

const STATUSES = ["Cold", "Warm", "Hot"];
const STATUS_CLASS = { Hot: "badge-hot", Warm: "badge-warm", Cold: "badge-cold" };

function initials(name) {
  return name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

const AVATAR_COLORS = ["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-green-100 text-green-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", role: "", email: "", phone: "", status: "Cold", notes: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setContacts(await getContacts()); }
    catch { toast.error("Could not load contacts"); }
    finally { setLoading(false); }
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      await addContact(form);
      toast.success("Contact added");
      setShowModal(false);
      setForm({ name: "", company: "", role: "", email: "", phone: "", status: "Cold", notes: "" });
      load();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  async function remove(id) {
    if (!confirm("Delete this contact?")) return;
    await deleteContact(id);
    toast.success("Deleted");
    setContacts((c) => c.filter((x) => x.id !== id));
  }

  const filtered = contacts.filter((c) =>
    [c.name, c.company, c.email, c.role].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500">{contacts.length} total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Add contact
        </button>
      </div>

      <div className="card mb-4">
        <div className="p-4 border-b border-gray-50">
          <input className="input" placeholder="Search by name, company, email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading contacts...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">{search ? "No contacts match your search." : "No contacts yet. Add your first one!"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Name", "Company", "Role", "Email", "Phone", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>{initials(c.name)}</div>
                        <span className="font-medium text-gray-900">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.company || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.role || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone || "—"}</td>
                    <td className="px-4 py-3"><span className={`badge ${STATUS_CLASS[c.status]}`}>{c.status}</span></td>
                    <td className="px-4 py-3">
                      <button onClick={() => remove(c.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="Add contact" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {[["Full name *", "name", "text", "Jane Smith"], ["Company", "company", "text", "Acme Corp"], ["Job title / role", "role", "text", "VP of Sales"], ["Email", "email", "email", "jane@acme.com"], ["Phone", "phone", "tel", "+91 98765 43210"]].map(([label, field, type, placeholder]) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input className="input" type={type} placeholder={placeholder} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lead status</label>
              <div className="flex gap-2">
                {STATUSES.map((s) => (
                  <button key={s} onClick={() => setForm({ ...form, status: s })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${form.status === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="input resize-none" rows={3} placeholder="Any notes about this contact..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save contact"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export const dynamic = "force-dynamic";
import { useState, useEffect } from "react";
import { getContacts, addContact, deleteContact } from "../lib/firebase";
import Modal from "../components/Modal";
import toast from "react-hot-toast";

const STATUSES = ["Cold", "Warm", "Hot"];
const STATUS_CLASS = { Hot: "badge-hot", Warm: "badge-warm", Cold: "badge-cold" };

const SALESPERSONS = [
  "Unassigned",
  "Pankaj ",
  "Shweta",
  "Chandresh",
  
];

function initials(name) {
  return name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

const AVATAR_COLORS = ["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-green-100 text-green-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];

const EMPTY_FORM = { name: "", company: "", role: "", email: "", phone: "", address: "", city: "", state: "", pincode: "", salesperson: "Unassigned", status: "Cold", notes: "" };

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

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
      setForm(EMPTY_FORM);
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

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const filtered = contacts.filter((c) =>
    [c.name, c.company, c.email, c.role, c.city, c.salesperson].some((f) => f?.toLowerCase().includes(search.toLowerCase()))
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
          <input className="input" placeholder="Search by name, company, city, salesperson..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  {["Name", "Company", "City / State", "Email", "Phone", "Salesperson", "Status", ""].map((h) => (
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
                        <div>
                          <p className="font-medium text-gray-900">{c.name}</p>
                          {c.role && <p className="text-xs text-gray-400">{c.role}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.company || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.city && c.state ? `${c.city}, ${c.state}` : c.city || c.state || "—"}
                      {c.pincode && <span className="text-xs text-gray-400 ml-1">- {c.pincode}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{c.phone || "—"}</td>
                    <td className="px-4 py-3">
                      {c.salesperson && c.salesperson !== "Unassigned" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-full">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                          {c.salesperson}
                        </span>
                      ) : <span className="text-gray-400 text-xs">Unassigned</span>}
                    </td>
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

            {/* Basic info */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full name *</label>
              <input className="input" placeholder="Jane Smith" value={form.name} onChange={set("name")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Company</label>
                <input className="input" placeholder="Acme Corp" value={form.company} onChange={set("company")} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Job title / role</label>
                <input className="input" placeholder="VP of Sales" value={form.role} onChange={set("role")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input className="input" type="email" placeholder="jane@acme.com" value={form.email} onChange={set("email")} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input className="input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} />
              </div>
            </div>

            {/* Address */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Address</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Street address</label>
                  <input className="input" placeholder="123, MG Road" value={form.address} onChange={set("address")} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                    <input className="input" placeholder="Mumbai" value={form.city} onChange={set("city")} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                    <input className="input" placeholder="Maharashtra" value={form.state} onChange={set("state")} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Pincode</label>
                    <input className="input" placeholder="400001" value={form.pincode} onChange={set("pincode")} />
                  </div>
                </div>
              </div>
            </div>

            {/* Salesperson */}
            <div className="border-t border-gray-100 pt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Assigned salesperson</label>
              <select className="input" value={form.salesperson} onChange={set("salesperson")}>
                {SALESPERSONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            {/* Status */}
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
              <textarea className="input resize-none" rows={3} placeholder="Any notes about this contact..." value={form.notes} onChange={set("notes")} />
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


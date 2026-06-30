export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { getContacts, addContact, updateContact, getSalespersons, addSalesperson, checkDuplicatePhone, db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from "firebase/firestore";
import Modal from "../components/Modal";
import toast from "react-hot-toast";

const STATUSES = ["Cold", "Warm", "Hot"];
const STATUS_CLASS = { Hot: "badge-hot", Warm: "badge-warm", Cold: "badge-cold" };

function initials(name) {
  return name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-green-100 text-green-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
];

const EMPTY_FORM = {
  name: "", company: "", role: "", email: "", phone: "",
  address: "", city: "", state: "", pincode: "",
  salesperson: "Unassigned", status: "Cold", notes: "",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [archived, setArchived] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [search, setSearch] = useState("");
  const [filterSP, setFilterSP] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [showSPModal, setShowSPModal] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newSPName, setNewSPName] = useState("");
  const [addingSP, setAddingSP] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([getContacts(), getSalespersons()]);
      setContacts(c.filter(x => !x.archived));
      setArchived(c.filter(x => x.archived));
      setSalespersons(s);
    } catch { toast.error("Could not load contacts"); }
    finally { setLoading(false); }
  }

  function openAdd() { setForm(EMPTY_FORM); setEditContact(null); setShowModal(true); }
  function openEdit(c) { setForm({ ...EMPTY_FORM, ...c }); setEditContact(c); setShowModal(true); }

  async function save() {
    if (!form.name.trim()) return toast.error("Name is required");
    if (form.phone.trim()) {
      const isDup = await checkDuplicatePhone(form.phone.trim(), editContact?.id);
      if (isDup) return toast.error("This phone number already exists!");
    }
    setSaving(true);
    try {
      if (editContact) {
        await updateContact(editContact.id, form);
        toast.success("Contact updated ✅");
      } else {
        await addContact(form);
        toast.success("Contact added ✅");
      }
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  async function archiveContact(contact) {
    if (!confirm(`Archive "${contact.name}"? You can restore them later from the Archive.`)) return;
    await updateContact(contact.id, { archived: true, archivedAt: new Date().toISOString() });
    toast.success("Contact archived");
    load();
  }

  async function restoreContact(contact) {
    await updateContact(contact.id, { archived: false, archivedAt: null });
    toast.success("Contact restored ✅");
    load();
  }

  async function handleAddSP() {
    if (!newSPName.trim()) return toast.error("Enter a name");
    if (salespersons.some(s => s.name.toLowerCase() === newSPName.trim().toLowerCase())) {
      return toast.error("Salesperson already exists!");
    }
    setAddingSP(true);
    try {
      await addSalesperson(newSPName.trim());
      toast.success(`${newSPName.trim()} added ✅`);
      setNewSPName("");
      const s = await getSalespersons();
      setSalespersons(s);
    } catch { toast.error("Failed to add"); }
    finally { setAddingSP(false); }
  }

  async function handleRemoveSP(sp) {
    if (!confirm(`Remove "${sp.name}"?`)) return;
    try {
      const { deleteDoc, doc } = await import("firebase/firestore");
      const { db: database } = await import("../lib/firebase");
      await deleteDoc(doc(database, "salespersons", sp.id));
      toast.success(`${sp.name} removed`);
      const s = await getSalespersons();
      setSalespersons(s);
    } catch { toast.error("Failed to remove"); }
  }

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || [c.name, c.company, c.email, c.role, c.city, c.salesperson, c.phone].some(
      (f) => f?.toLowerCase().includes(q)
    );
    const matchSP = filterSP === "All" || c.salesperson === filterSP;
    return matchSearch && matchSP;
  });

  function exportCSV() {
    const headers = ["Name", "Company", "Role", "Email", "Phone", "City", "State", "Pincode", "Salesperson", "Status", "Notes"];
    const rows = filtered.map((c) =>
      [c.name, c.company, c.role, c.email, c.phone, c.city, c.state, c.pincode, c.salesperson, c.status, c.notes]
        .map((v) => `"${(v || "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "safilocare-contacts.csv";
    a.click();
    toast.success("Exported!");
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500">{filtered.length} of {contacts.length} total</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-secondary" onClick={() => setShowArchive(true)}>
            🗂 Archive ({archived.length})
          </button>
          <button className="btn btn-secondary" onClick={() => setShowSPModal(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Salespersons ({salespersons.length})
          </button>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add contact
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input className="input flex-1 min-w-52" placeholder="Search by name, company, city, phone, salesperson..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input w-48" value={filterSP} onChange={(e) => setFilterSP(e.target.value)}>
          <option value="All">All salespersons</option>
          <option value="Unassigned">Unassigned</option>
          {salespersons.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
      </div>

      <div className="card mb-4">
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
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                          {initials(c.name)}
                        </div>
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
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {c.salesperson}
                        </span>
                      ) : <span className="text-gray-400 text-xs">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_CLASS[c.status]}`}>{c.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(c)} className="text-gray-300 hover:text-blue-500 transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => archiveContact(c)} className="text-gray-300 hover:text-amber-500 transition-colors" title="Archive">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Contact Modal */}
      {showModal && (
        <Modal title={editContact ? "Edit contact" : "Add contact"} onClose={() => setShowModal(false)}>
          <div className="space-y-4 max-h-[72vh] overflow-y-auto pr-1">
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
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-600">Assigned salesperson</label>
                <button onClick={() => setShowSPModal(true)} className="text-xs text-blue-600 hover:underline">+ Manage</button>
              </div>
              <select className="input" value={form.salesperson} onChange={set("salesperson")}>
                <option value="Unassigned">Unassigned</option>
                {salespersons.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <div className="flex gap-2">
                {STATUSES.map((s) => (
                  <button key={s} onClick={() => setForm({ ...form, status: s })}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${form.status === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea className="input resize-none" rows={3} placeholder="Any notes about this contact..." value={form.notes} onChange={set("notes")} />
            </div>
            <div className="flex gap-3 pt-2">
              <button className="btn btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={save} disabled={saving}>{saving ? "Saving..." : editContact ? "Update contact" : "Save contact"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Archive Modal */}
      {showArchive && (
        <Modal title={`🗂 Archived Contacts (${archived.length})`} onClose={() => setShowArchive(false)}>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {archived.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">No archived contacts.</p>
            ) : archived.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.company || "—"} · {c.phone || "—"}</p>
                </div>
                <button onClick={() => restoreContact(c)} className="text-xs text-green-600 hover:underline font-medium">Restore</button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Manage Salespersons Modal */}
      {showSPModal && (
        <Modal title="Manage Salespersons" onClose={() => setShowSPModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Add new salesperson</label>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Enter full name" value={newSPName}
                  onChange={(e) => setNewSPName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddSP()} />
                <button className="btn btn-primary" onClick={handleAddSP} disabled={addingSP}>{addingSP ? "Adding..." : "Add"}</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Current salespersons ({salespersons.length})</label>
              {salespersons.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-lg">No salespersons added yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {salespersons.map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                      <span className="text-sm font-medium text-gray-800">{s.name}</span>
                      <button onClick={() => handleRemoveSP(s)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded">Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 bg-amber-50 border border-amber-100 rounded-lg p-3">
              ℹ️ Removing a salesperson won't affect contacts already assigned to them.
            </p>
            <button className="btn btn-secondary w-full" onClick={() => setShowSPModal(false)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

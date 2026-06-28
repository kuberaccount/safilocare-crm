export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { getContacts,
  addContact,
  updateContact,
  deleteContact,
  getSalespersons,
  addSalesperson,
  deleteSalesperson,
  checkDuplicatePhone } from "../lib/firebase";
import { logAction } from "../lib/activitylog";
import Modal from "../components/Modal";
import toast from "react-hot-toast";

const STATUSES = ["Cold", "Warm", "Hot"];
const STATUS_CLASS = { Hot:"badge-hot", Warm:"badge-warm", Cold:"badge-cold" };
const AVATAR_COLORS = ["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-green-100 text-green-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];

function initials(name) { return name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()||"?"; }

const EMPTY_FORM = {
  name:"", company:"", role:"", email:"", phone:"",
  address:"", city:"", state:"", pincode:"",
  salesperson:"Unassigned", status:"Cold", notes:"", archived:false
};

export default function ContactsPage({ currentUser }) {
  const [contacts, setContacts] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [search, setSearch] = useState("");
  const [filterSP, setFilterSP] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showArchived, setShowArchived] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [showSPModal, setShowSPModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newSPName, setNewSPName] = useState("");
  const [addingSP, setAddingSP] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
  setLoading(true);

  try {
    const [c, s] = await Promise.all([
      getContacts(),
      getSalespersons()
    ]);

    setContacts(c);
    setSalespersons(s);
  } catch (e) {
    toast.error("Could not load contacts");
  } finally {
    setLoading(false);
  }
}

  function openAdd() { setForm(EMPTY_FORM); setEditContact(null); setShowModal(true); }
  function openEdit(c) { setForm({...EMPTY_FORM,...c}); setEditContact(c); setShowModal(true); }

  async function save() {
  if (!form.name.trim()) {
    return toast.error("Name is required");
  }

  const phone = (form.phone || "").trim();

  if (phone) {
    const exists = await checkDuplicatePhone(
      phone,
      editContact?.id || null
    );

    if (exists) {
      toast.error("Phone number already added");
      return;
    }
  }

  setSaving(true);

  try {
    if (editContact) {
      await updateContact(editContact.id, form);

      try {
        await logAction(currentUser, "Updated Lead", {
          contactName: form.name,
          company: form.company
        });
      } catch {}

      toast.success("Contact updated ✅");
    } else {
      await addContact(form);

      try {
        await logAction(currentUser, "Added Contact", {
          contactName: form.name,
          company: form.company
        });
      } catch {}

      toast.success("Contact added ✅");
    }

    setShowModal(false);
    setForm(EMPTY_FORM);
    load();

  } catch (e) {
    console.error(e);
    toast.error("Failed to save");
  } finally {
    setSaving(false);
  }
}
  async function archive(contact) {
    try {
      await updateContact(contact.id, { archived: !contact.archived });
      toast.success(contact.archived ? "Contact restored" : "Contact archived");
      load();
    } catch { toast.error("Failed"); }
  }

  async function remove(id, name) {
    if (!confirm("Permanently delete this contact?")) return;
    try {
      await deleteContact(id);
      try { await logAction(currentUser, "Deleted Contact", { contactName: name || id }); } catch {}
      toast.success("Deleted");
      setContacts(c => c.filter(x => x.id !== id));
    } catch { toast.error("Failed to delete"); }
  }

  // Salesperson management
  async function handleAddSP() {
    if (!newSPName.trim()) return toast.error("Enter a name");
    if (salespersons.some(s => s.name.toLowerCase() === newSPName.trim().toLowerCase()))
      return toast.error("Already exists!");
    setAddingSP(true);
    try {
      await addSalesperson(newSPName.trim());
      toast.success(`${newSPName.trim()} added ✅`);
      setNewSPName("");
      const s = await getSalespersons();
      setSalespersons(s);
    } catch(e) { toast.error("Failed: " + e.message); }
    finally { setAddingSP(false); }
  }

  async function handleRemoveSP(sp) {
    if (!confirm(`Remove "${sp.name}"?`)) return;
    try {
      await deleteSalesperson(sp.id);
      toast.success(`${sp.name} removed`);
      const s = await getSalespersons();
      setSalespersons(s);
    } catch(e) { toast.error("Failed: " + e.message); }
  }

  function exportCSV() {
    const headers = ["Name","Company","Role","Email","Phone","City","State","Pincode","Salesperson","Status","Notes","Archived"];
    const rows = filtered.map(c =>
      [c.name,c.company,c.role,c.email,c.phone,c.city,c.state,c.pincode,c.salesperson,c.status,c.notes,c.archived?"Yes":"No"]
        .map(v => `"${(v||"").replace(/"/g,'""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `safilocare-contacts-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast.success("Exported!");
  }

  const set = field => e => setForm(f => ({...f, [field]: e.target.value}));

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || [c.name,c.company,c.email,c.phone,c.city,c.salesperson,c.role].some(f=>f?.toLowerCase().includes(q));
    const matchSP = filterSP === "All" || c.salesperson === filterSP;
    const matchStatus = filterStatus === "All" || c.status === filterStatus;
    const matchArchived = showArchived ? c.archived : !c.archived;
    return matchSearch && matchSP && matchStatus && matchArchived;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500">{filtered.length} of {contacts.filter(c=>!c.archived).length} contacts
            {contacts.filter(c=>c.archived).length > 0 && <span className="ml-2 text-amber-600">· {contacts.filter(c=>c.archived).length} archived</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-secondary" onClick={() => setShowSPModal(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Salespersons ({salespersons.length})
          </button>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Export CSV
          </button>
          <button className="btn btn-primary" onClick={openAdd}
            style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none"}}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add contact
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input className="input flex-1 min-w-52" placeholder="Search by name, company, city, phone..." value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="input w-44" value={filterSP} onChange={e=>setFilterSP(e.target.value)}>
          <option value="All">All salespersons</option>
          <option value="Unassigned">Unassigned</option>
          {salespersons.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select className="input w-32" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="All">All status</option>
          {STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
        <button onClick={()=>setShowArchived(v=>!v)}
          className={`btn ${showArchived ? "btn-primary" : "btn-secondary"}`}
          style={showArchived?{background:"#f59e0b",border:"none",color:"white"}:{}}>
          {showArchived ? "📦 Archived" : "Show archived"}
        </button>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading contacts...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p style={{fontSize:"32px",marginBottom:"8px"}}>👥</p>
            <p className="text-gray-400 text-sm">{search ? "No contacts match your search." : showArchived ? "No archived contacts." : "No contacts yet. Add your first one!"}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Name","Company","City / State","Phone","Salesperson","Status",""].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c,i) => (
                  <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${c.archived?"opacity-50":""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${AVATAR_COLORS[i%AVATAR_COLORS.length]}`}>
                          {initials(c.name)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{c.name}</p>
                          {c.role && <p className="text-xs text-gray-400">{c.role}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.company||"—"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.city&&c.state?`${c.city}, ${c.state}`:c.city||c.state||"—"}
                      {c.pincode&&<span className="text-xs text-gray-400 ml-1">- {c.pincode}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{c.phone||"—"}</td>
                    <td className="px-4 py-3">
                      {c.salesperson&&c.salesperson!=="Unassigned"
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-full">👤 {c.salesperson}</span>
                        : <span className="text-gray-400 text-xs">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_CLASS[c.status]||"badge-cold"}`}>{c.status||"Cold"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 items-center">
                        {/* Edit */}
                        <button onClick={()=>openEdit(c)} title="Edit"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        {/* WhatsApp */}
                        {c.phone && (
                          <a href={`https://wa.me/91${c.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                            title={`WhatsApp ${c.name}`}
                            className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 transition-all">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                          </a>
                        )}
                        {/* Archive / Restore */}
                        <button onClick={()=>archive(c)} title={c.archived?"Restore":"Archive"}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-all">
                          {c.archived
                            ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                            : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
                          }
                        </button>
                        {/* Delete */}
                        <button onClick={()=>remove(c.id, c.name)} title="Delete"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
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

      {/* Add/Edit Contact Modal */}
      {showModal && (
        <Modal title={editContact?"Edit contact":"Add contact"} onClose={()=>setShowModal(false)}>
          <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Full name *</label>
              <input className="input" placeholder="Jane Smith" value={form.name} onChange={set("name")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company</label>
                <input className="input" placeholder="Acme Corp" value={form.company} onChange={set("company")} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Job title / role</label>
                <input className="input" placeholder="Manager" value={form.role} onChange={set("role")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                <input className="input" type="email" placeholder="jane@acme.com" value={form.email} onChange={set("email")} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                <input className="input" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set("phone")} />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Address</p>
              <div className="space-y-2">
                <input className="input" placeholder="Street address" value={form.address} onChange={set("address")} />
                <div className="grid grid-cols-3 gap-2">
                  <input className="input" placeholder="City" value={form.city} onChange={set("city")} />
                  <input className="input" placeholder="State" value={form.state} onChange={set("state")} />
                  <input className="input" placeholder="Pincode" value={form.pincode} onChange={set("pincode")} />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-600">Assigned salesperson</label>
                <button onClick={()=>setShowSPModal(true)} className="text-xs text-indigo-600 hover:underline">+ Manage</button>
              </div>
              <select className="input" value={form.salesperson} onChange={set("salesperson")}>
                <option value="Unassigned">Unassigned</option>
                {salespersons.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Lead status</label>
              <div className="flex gap-2">
                {STATUSES.map(s=>(
                  <button key={s} onClick={()=>setForm(f=>({...f,status:s}))}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${form.status===s?"bg-indigo-600 text-white border-indigo-600":"bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <textarea className="input resize-none" rows={3} placeholder="Any notes..." value={form.notes} onChange={set("notes")} />
            </div>

            <div className="flex gap-3 pt-2">
              <button className="btn btn-secondary flex-1" onClick={()=>setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={save} disabled={saving}
                style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none"}}>
                {saving?"Saving...":editContact?"Update contact":"Save contact"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manage Salespersons Modal */}
      {showSPModal && (
        <Modal title="Manage Salespersons" onClose={()=>setShowSPModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Add new salesperson</label>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Enter full name" value={newSPName}
                  onChange={e=>setNewSPName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAddSP()} />
                <button className="btn btn-primary" onClick={handleAddSP} disabled={addingSP}
                  style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none"}}>
                  {addingSP?"Adding...":"Add"}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">Current ({salespersons.length})</label>
              {salespersons.length===0
                ? <p className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-lg">No salespersons added yet.</p>
                : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {salespersons.map(s=>(
                      <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{s.name}</span>
                        </div>
                        <button onClick={()=>handleRemoveSP(s)}
                          className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-all">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
            <p className="text-xs text-gray-400 bg-amber-50 border border-amber-100 rounded-lg p-3">
              ℹ️ Removing a salesperson won't affect contacts already assigned to them.
            </p>
            <button className="btn btn-secondary w-full" onClick={()=>setShowSPModal(false)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

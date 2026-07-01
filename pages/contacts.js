export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { getContacts, addContact, updateContact, deleteContact, checkDuplicatePhone, getSalespersons, addSalesperson, deleteSalesperson } from "../lib/firebase";
import { logAction } from "../lib/activitylog";
import Modal from "../components/Modal";
import toast from "react-hot-toast";

const STATUSES = ["Cold", "Warm", "Hot"];
const STATUS_CLASS = { Hot:"badge-hot", Warm:"badge-warm", Cold:"badge-cold" };
const AVATAR_COLORS = ["bg-blue-100 text-blue-700","bg-purple-100 text-purple-700","bg-green-100 text-green-700","bg-amber-100 text-amber-700","bg-rose-100 text-rose-700"];

function initials(name) { return name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()||"?"; }
function toUpper(v) { return typeof v === "string" ? v.toUpperCase() : v; }

// ── CSV parser (handles quoted commas) ──────────────────────
function parseCSV(text) {
  const rows = []; let row = []; let field = ""; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i+1];
    if (inQ) { if (c==='"'&&n==='"'){field+='"';i++;} else if(c==='"'){inQ=false;} else field+=c; }
    else {
      if(c==='"') inQ=true;
      else if(c===','){row.push(field);field="";}
      else if(c==='\n'||c==='\r'){
        if(c==='\r'&&n==='\n')i++;
        row.push(field);field="";
        if(row.some(f=>f.trim()))rows.push(row);
        row=[];
      } else field+=c;
    }
  }
  if(field||row.length){row.push(field);if(row.some(f=>f.trim()))rows.push(row);}
  return rows;
}

const HEADER_MAP = {
  name:["name","full name","contact name","contact"],
  company:["company","company name","organisation","organization"],
  role:["role","job title","title","designation"],
  email:["email","email address","e-mail"],
  phone:["phone","phone number","mobile","mobile number","contact number","whatsapp"],
  address:["address","street address","street"],
  city:["city","town"],
  state:["state","province"],
  pincode:["pincode","pin code","zip","zip code","postal code"],
  salesperson:["salesperson","sales person","assigned to","owner"],
  status:["status","lead status"],
  notes:["notes","note","remarks","comments"],
};

function detectColumns(headerRow) {
  const norm = headerRow.map(h=>h.trim().toLowerCase());
  const map = {};
  Object.entries(HEADER_MAP).forEach(([field, variants]) => {
    const idx = norm.findIndex(h=>variants.includes(h));
    if(idx!==-1) map[field]=idx;
  });
  return map;
}

function rowsToContacts(rows, mapping) {
  const [,,...dataRows] = [rows[0], ...rows.slice(1)];
  return rows.slice(1).map(row => {
    const get = f => mapping[f]!==undefined?(row[mapping[f]]||"").trim():"";
    const status = get("status");
    return {
      name: toUpper(get("name")),
      company: toUpper(get("company")),
      role: toUpper(get("role")),
      email: get("email").toLowerCase(),
      phone: get("phone").replace(/[^\d+]/g,""),
      address: toUpper(get("address")),
      city: toUpper(get("city")),
      state: toUpper(get("state")),
      pincode: get("pincode"),
      salesperson: get("salesperson")||"Unassigned",
      status: ["Hot","Warm","Cold"].includes(status)?status:"Cold",
      notes: get("notes"),
      archived: false,
    };
  }).filter(c=>c.name);
}

// ── Pincode → City + State lookup ───────────────────────────
async function fetchPincodeInfo(pincode) {
  if(!/^\d{6}$/.test(pincode)) return null;
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await res.json();
    if(data[0]?.Status==="Success" && data[0]?.PostOffice?.length>0) {
      const po = data[0].PostOffice[0];
      return { city: po.District?.toUpperCase()||"", state: po.State?.toUpperCase()||"" };
    }
  } catch {}
  return null;
}

const EMPTY_FORM = {
  name:"", company:"", role:"", email:"", phone:"",
  address:"", city:"", state:"", pincode:"",
  salesperson:"Unassigned", status:"Cold", notes:"", archived:false
};

export default function ContactsPage({ currentUser }) {
  const isAdmin = currentUser?.role === "admin";
  const [contacts, setContacts] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [search, setSearch] = useState("");
  const [filterSP, setFilterSP] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showArchived, setShowArchived] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [showSPModal, setShowSPModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const [newSPName, setNewSPName] = useState("");
  const [addingSP, setAddingSP] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([getContacts(null), getSalespersons()]);
      setContacts(c); setSalespersons(s);
    } catch { toast.error("Could not load contacts"); }
    finally { setLoading(false); }
  }

  function openAdd() {
    const defaultSP = isAdmin ? "Unassigned" : (currentUser?.salesperson || "Unassigned");
    setForm({...EMPTY_FORM, salesperson: defaultSP});
    setEditContact(null); setShowModal(true);
  }
  function openEdit(c) { setForm({...EMPTY_FORM,...c}); setEditContact(c); setShowModal(true); }

  // Auto-uppercase on change, auto-fetch pincode
  function set(field) {
    return async (e) => {
      const raw = e.target.value;
      const upperFields = ["name","company","role","address","city","state"];
      const val = upperFields.includes(field) ? raw.toUpperCase() : raw;
      setForm(f => ({...f, [field]: val}));

      if(field==="pincode" && /^\d{6}$/.test(raw)) {
        setPincodeLoading(true);
        const info = await fetchPincodeInfo(raw);
        if(info) {
          setForm(f => ({...f, pincode: raw, city: info.city, state: info.state}));
          toast.success(`📍 ${info.city}, ${info.state}`);
        } else {
          toast.error("Pincode not found");
        }
        setPincodeLoading(false);
      }
    };
  }

  async function save() {
    if(!form.name.trim()) return toast.error("Name is required");
    if(form.phone.trim()) {
      const isDup = await checkDuplicatePhone(form.phone.trim(), editContact?.id);
      if(isDup) return toast.error("This phone number already exists!");
    }
    setSaving(true);
    try {
      if(editContact) {
        await updateContact(editContact.id, form);
        try { await logAction(currentUser, "Updated Contact", { contactName: form.name }); } catch {}
        toast.success("Contact updated ✅");
      } else {
        await addContact(form);
        try { await logAction(currentUser, "Added Contact", { contactName: form.name }); } catch {}
        toast.success("Contact added ✅");
      }
      setShowModal(false); setForm(EMPTY_FORM); load();
    } catch(e) { toast.error("Failed to save: " + (e.message||"unknown error")); }
    finally { setSaving(false); }
  }

  async function archive(contact) {
    try {
      await updateContact(contact.id, { archived: !contact.archived });
      toast.success(contact.archived ? "Contact restored" : "Contact archived");
      load();
    } catch { toast.error("Failed"); }
  }

  async function remove(id, name) {
    if(!confirm("Permanently delete this contact?")) return;
    try {
      await deleteContact(id);
      try { await logAction(currentUser, "Deleted Contact", { contactName: name||id }); } catch {}
      toast.success("Deleted");
      setContacts(c => c.filter(x => x.id !== id));
    } catch { toast.error("Failed to delete"); }
  }

  async function handleAddSP() {
    if(!newSPName.trim()) return toast.error("Enter a name");
    if(salespersons.some(s=>s.name.toLowerCase()===newSPName.trim().toLowerCase())) return toast.error("Already exists!");
    setAddingSP(true);
    try {
      await addSalesperson(newSPName.trim());
      toast.success(`${newSPName.trim()} added ✅`);
      setNewSPName("");
      setSalespersons(await getSalespersons());
    } catch(e) { toast.error("Failed: "+e.message); }
    finally { setAddingSP(false); }
  }

  async function handleRemoveSP(sp) {
    if(!confirm(`Remove "${sp.name}"?`)) return;
    try {
      await deleteSalesperson(sp.id);
      toast.success(`${sp.name} removed`);
      setSalespersons(await getSalespersons());
    } catch(e) { toast.error("Failed: "+e.message); }
  }

  function exportCSV() {
    const spName = currentUser?.salesperson||"";
    const exportData = isAdmin ? filtered : filtered.filter(c=>c.salesperson===spName);
    const headers = ["Name","Company","Role","Email","Phone","City","State","Pincode","Salesperson","Status","Notes"];
    const rows = exportData.map(c=>
      [c.name,c.company,c.role,c.email,c.phone,c.city,c.state,c.pincode,c.salesperson,c.status,c.notes]
        .map(v=>`"${(v||"").replace(/"/g,'""')}"`).join(",")
    );
    const today = new Date().toISOString().slice(0,10);
    const csv = [headers.join(","),...rows].join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `contacts-${today}.csv`;
    a.click();
    toast.success("Exported ✅");
  }

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q||[c.name,c.company,c.email,c.phone,c.city,c.salesperson,c.role].some(f=>f?.toLowerCase().includes(q));
    const matchSP = filterSP==="All"||c.salesperson===filterSP;
    const matchStatus = filterStatus==="All"||c.status===filterStatus;
    const matchArchived = showArchived ? c.archived : !c.archived;
    return matchSearch&&matchSP&&matchStatus&&matchArchived;
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500">{filtered.length} of {contacts.filter(c=>!c.archived).length} contacts
            {contacts.filter(c=>c.archived).length>0&&<span className="ml-2 text-amber-600">· {contacts.filter(c=>c.archived).length} archived</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-secondary" onClick={()=>setShowSPModal(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            Salespersons ({salespersons.length})
          </button>
          <button className="btn btn-secondary" onClick={()=>setShowImport(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>
            Import CSV
          </button>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            {isAdmin?"Export All CSV":"Export My CSV"}
          </button>
          <button className="btn btn-primary" onClick={openAdd} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none"}}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add contact
          </button>
        </div>
      </div>

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
        <button onClick={()=>setShowArchived(v=>!v)} className={`btn ${showArchived?"btn-primary":"btn-secondary"}`}
          style={showArchived?{background:"#f59e0b",border:"none",color:"white"}:{}}>
          {showArchived?"📦 Archived":"Show archived"}
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading contacts...</div>
        ) : filtered.length===0 ? (
          <div className="p-12 text-center">
            <p style={{fontSize:"32px",marginBottom:"8px"}}>👥</p>
            <p className="text-gray-400 text-sm">{search?"No contacts match.":showArchived?"No archived contacts.":"No contacts yet."}</p>
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
                {filtered.map((c,i)=>(
                  <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${c.archived?"opacity-50":""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${AVATAR_COLORS[i%AVATAR_COLORS.length]}`}>{initials(c.name)}</div>
                        <div>
                          <p className="font-medium text-gray-900">{c.name}</p>
                          {c.role&&<p className="text-xs text-gray-400">{c.role}</p>}
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
                        ?<span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-full">👤 {c.salesperson}</span>
                        :<span className="text-gray-400 text-xs">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STATUS_CLASS[c.status]||"badge-cold"}`}>{c.status||"Cold"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 items-center">
                        <button onClick={()=>openEdit(c)} title="Edit" className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        {c.phone&&(
                          <a href={`https://wa.me/91${c.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" title={`WhatsApp ${c.name}`} className="p-1.5 rounded-lg text-green-500 hover:bg-green-50 transition-all">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          </a>
                        )}
                        <button onClick={()=>archive(c)} title={c.archived?"Restore":"Archive"} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-all">
                          {c.archived
                            ?<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                            :<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
                          }
                        </button>
                        <button onClick={()=>remove(c.id,c.name)} title="Delete" className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all">
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

      {/* Add/Edit Modal */}
      {showModal&&(
        <Modal title={editContact?"Edit contact":"Add contact"} onClose={()=>setShowModal(false)}>
          <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Full name *</label>
              <input className="input uppercase" placeholder="JANE SMITH" value={form.name} onChange={set("name")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Company</label>
                <input className="input uppercase" placeholder="ACME CORP" value={form.company} onChange={set("company")} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Job title</label>
                <input className="input uppercase" placeholder="MANAGER" value={form.role} onChange={set("role")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                <input className="input" type="email" placeholder="jane@acme.com" value={form.email} onChange={set("email")} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                <input className="input" type="tel" placeholder="9876543210" value={form.phone} onChange={set("phone")} />
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Address</p>
              <input className="input mb-2 uppercase" placeholder="STREET ADDRESS" value={form.address} onChange={set("address")} />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Pincode</label>
                  <div className="relative">
                    <input className="input" placeholder="360001" maxLength={6} value={form.pincode} onChange={set("pincode")} />
                    {pincodeLoading&&<div className="absolute right-2 top-2.5 w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"/>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">City <span className="text-indigo-400">(auto)</span></label>
                  <input className="input uppercase" placeholder="AUTO FROM PIN" value={form.city} onChange={set("city")} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">State <span className="text-indigo-400">(auto)</span></label>
                  <input className="input uppercase" placeholder="AUTO FROM PIN" value={form.state} onChange={set("state")} />
                </div>
              </div>
              <p className="text-xs text-indigo-500 mt-1">💡 Enter pincode first — city & state auto-fill</p>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-600">Assigned salesperson</label>
                <button onClick={()=>setShowSPModal(true)} className="text-xs text-indigo-600 hover:underline">+ Manage</button>
              </div>
              {isAdmin ? (
                <select className="input" value={form.salesperson} onChange={set("salesperson")}>
                  <option value="Unassigned">Unassigned</option>
                  {salespersons.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              ) : (
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                  👤 {currentUser?.salesperson||"Unassigned"} <span className="text-xs text-gray-400">(auto-assigned to you)</span>
                </p>
              )}
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
              <textarea className="input resize-none" rows={2} placeholder="Any notes..." value={form.notes} onChange={set("notes")} />
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
      {showSPModal&&(
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
                ?<p className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-lg">No salespersons yet.</p>
                :(
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {salespersons.map(s=>(
                      <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">{s.name.charAt(0).toUpperCase()}</div>
                          <span className="text-sm font-medium text-gray-800">{s.name}</span>
                        </div>
                        <button onClick={()=>handleRemoveSP(s)} className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
            <p className="text-xs text-gray-400 bg-amber-50 border border-amber-100 rounded-lg p-3">ℹ️ Removing won't affect contacts already assigned.</p>
            <button className="btn btn-secondary w-full" onClick={()=>setShowSPModal(false)}>Done</button>
          </div>
        </Modal>
      )}

      {/* Import Modal */}
      {showImport&&(
        <ImportModal
          currentUser={currentUser}
          isAdmin={isAdmin}
          salespersons={salespersons}
          onClose={()=>setShowImport(false)}
          onDone={()=>{ setShowImport(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Import Modal ─────────────────────────────────────────────
function ImportModal({ currentUser, isAdmin, salespersons, onClose, onDone }) {
  const [step, setStep] = useState("upload"); // upload | preview | importing | done
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [bulkSP, setBulkSP] = useState("__keep__");
  const [progress, setProgress] = useState({ done:0, total:0 });
  const [result, setResult] = useState({ imported:0, skipped:0, skippedNames:[] });
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if(!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = parseCSV(ev.target.result);
        if(parsed.length<2) return toast.error("CSV is empty or has no data rows");
        const mapping = detectColumns(parsed[0]);
        if(mapping.name===undefined) return toast.error("No 'Name' column found. Check CSV headers.");
        let contacts = rowsToContacts(parsed, mapping);
        // Salesperson: force-assign to themselves
        if(!isAdmin) contacts = contacts.map(c=>({...c, salesperson: currentUser?.salesperson||"Unassigned"}));
        setRows(contacts);
        setStep("preview");
      } catch(err) { toast.error("Failed to parse: "+err.message); }
    };
    reader.readAsText(file);
  }

  function applyBulkSP(val) {
    setBulkSP(val);
    if(val!=="__keep__") setRows(rs=>rs.map(r=>({...r,salesperson:val})));
  }

  async function runImport() {
    setStep("importing");
    setProgress({ done:0, total:rows.length });
    let imported=0, skipped=0;
    const skippedNames=[];
    for(const contact of rows) {
      try {
        if(contact.phone) {
          const isDup = await checkDuplicatePhone(contact.phone);
          if(isDup){ skipped++; skippedNames.push(`${contact.name} (duplicate phone)`); setProgress(p=>({...p,done:p.done+1})); continue; }
        }
        await addContact(contact);
        imported++;
      } catch { skipped++; skippedNames.push(`${contact.name} (save error)`); }
      setProgress(p=>({...p,done:p.done+1}));
    }
    try { await logAction(currentUser,"Bulk Imported Contacts",{count:imported,fileName}); } catch {}
    setResult({imported,skipped,skippedNames});
    setStep("done");
  }

  return (
    <Modal title="Import contacts from CSV" onClose={onClose}>
      <div className="space-y-4">
        {step==="upload"&&(
          <>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 transition-colors" onClick={()=>fileRef.current?.click()}>
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>
              <p className="text-sm font-medium text-gray-600 mb-1">Click to upload CSV file</p>
              <p className="text-xs text-gray-400">Name, Company, Phone, Email, City, Pincode, Status…</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </div>
            <div className={`rounded-lg p-3 text-xs ${isAdmin?"bg-blue-50 border border-blue-100 text-blue-700":"bg-amber-50 border border-amber-100 text-amber-700"}`}>
              {isAdmin
                ?"ℹ️ Admin: you can bulk-assign all imported contacts to one salesperson in the next step."
                :`ℹ️ All imported contacts will be assigned to you (${currentUser?.salesperson||"your account"}) automatically.`}
            </div>
            <p className="text-xs text-gray-400">Expected columns (any order): <strong>Name*</strong>, Company, Role, Email, Phone, Address, City, State, Pincode, Status, Notes</p>
          </>
        )}

        {step==="preview"&&(
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">📄 {rows.length} contacts in <span className="font-semibold">{fileName}</span></p>
              <button onClick={()=>setStep("upload")} className="text-xs text-indigo-600 hover:underline">Change file</button>
            </div>

            {isAdmin&&(
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                <label className="block text-xs font-semibold text-indigo-700 mb-1.5">Assign all imported contacts to</label>
                <select className="input" value={bulkSP} onChange={e=>applyBulkSP(e.target.value)}>
                  <option value="__keep__">Keep as in CSV (per-row salesperson)</option>
                  <option value="Unassigned">Unassigned</option>
                  {salespersons.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Preview table */}
            <div className="border border-gray-100 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">#</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Name</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Company</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Phone</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Assigned to</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0,100).map((c,i)=>(
                    <tr key={i} className="border-t border-gray-50">
                      <td className="px-3 py-1.5 text-gray-400">{i+1}</td>
                      <td className="px-3 py-1.5 text-gray-800 font-medium">{c.name}</td>
                      <td className="px-3 py-1.5 text-gray-500">{c.company||"—"}</td>
                      <td className="px-3 py-1.5 text-gray-500">{c.phone||"—"}</td>
                      <td className="px-3 py-1.5 text-purple-600">{c.salesperson}</td>
                      <td className="px-3 py-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${c.status==="Hot"?"bg-red-100 text-red-600":c.status==="Warm"?"bg-amber-100 text-amber-600":"bg-blue-100 text-blue-600"}`}>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length>100&&<p className="text-xs text-gray-400 text-center py-2">...and {rows.length-100} more</p>}
            </div>

            <div className="flex gap-3">
              <button className="btn btn-secondary flex-1" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary flex-1" onClick={runImport}
                style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none"}}>
                Import {rows.length} contacts →
              </button>
            </div>
          </>
        )}

        {step==="importing"&&(
          <div className="text-center py-10">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"/>
            <p className="text-sm text-gray-600 font-medium">Importing {progress.done} of {progress.total}...</p>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mt-3 max-w-xs mx-auto">
              <div className="h-2.5 bg-indigo-500 rounded-full transition-all" style={{width:`${progress.total?(progress.done/progress.total)*100:0}%`}}/>
            </div>
          </div>
        )}

        {step==="done"&&(
          <div className="text-center py-4">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-lg font-bold text-gray-800">{result.imported} contacts imported!</p>
            {result.skipped>0&&(
              <>
                <p className="text-sm text-amber-600 mt-1">{result.skipped} skipped</p>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mt-3 max-h-36 overflow-y-auto text-left">
                  {result.skippedNames.map((n,i)=><p key={i} className="text-xs text-amber-700">· {n}</p>)}
                </div>
              </>
            )}
            <button className="btn btn-primary w-full mt-5" onClick={onDone}
              style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none"}}>
              Done — view contacts
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

import { useState, useEffect } from "react";
import { getAllUsers, approveUser, rejectUser, getSalespersons, addSalesperson, deleteSalesperson, db } from "../lib/firebase";
import { doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast";

const STATUS_BADGE = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700"
};

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingSP, setLoadingSP] = useState(true);
  const [tab, setTab] = useState("users");

  // Salesperson form
  const [newSPName, setNewSPName] = useState("");
  const [newSPEmail, setNewSPEmail] = useState("");
  const [addingSP, setAddingSP] = useState(false);

  // Pre-approve form
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualSP, setManualSP] = useState("Unassigned");
  const [manualRole, setManualRole] = useState("salesperson");
  const [addingManual, setAddingManual] = useState(false);

  // Inline edit
  const [editingUser, setEditingUser] = useState(null);
  const [editSP, setEditSP] = useState("");
  const [editRole, setEditRole] = useState("salesperson");

  // Per-pending-user selectors
  const [pendingSP, setPendingSP] = useState({});
  const [pendingRole, setPendingRole] = useState({});

  useEffect(() => {
    loadSalespersons();
    loadUsers();
  }, []);

  // Load salespersons separately — no admin permission needed
  async function loadSalespersons() {
    setLoadingSP(true);
    try {
      const s = await getSalespersons();
      setSalespersons(s);
    } catch (e) { toast.error("Could not load salespersons: " + e.message); }
    finally { setLoadingSP(false); }
  }

  // Load users — requires admin permission
  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const u = await getAllUsers();
      setUsers(u);
    } catch (e) { toast.error("Could not load users: " + e.message); }
    finally { setLoadingUsers(false); }
  }

  async function approve(uid) {
    try {
      const sp = pendingSP[uid] || "Unassigned";
      const role = pendingRole[uid] || "salesperson";
      await updateDoc(doc(db, "users", uid), { status: "approved", salesperson: sp, role });
      toast.success("User approved ✅");
      loadUsers();
    } catch (e) { toast.error("Failed: " + e.message); }
  }

  async function reject(uid) {
    try {
      await rejectUser(uid);
      toast.success("User rejected");
      loadUsers();
    } catch (e) { toast.error("Failed: " + e.message); }
  }

  async function saveUserEdit(uid) {
    try {
      await updateDoc(doc(db, "users", uid), { salesperson: editSP, role: editRole, status: "approved" });
      toast.success("User updated ✅");
      setEditingUser(null);
      loadUsers();
    } catch (e) { toast.error("Failed: " + e.message); }
  }

  async function addManualUser() {
    if (!manualEmail.trim()) return toast.error("Email is required");
    setAddingManual(true);
    try {
      const emailKey = manualEmail.trim().toLowerCase().replace(/[.@]/g, "_");
      await setDoc(doc(db, "preapproved", emailKey), {
        email: manualEmail.trim().toLowerCase(),
        name: manualName.trim() || "",
        salesperson: manualSP,
        role: manualRole,
        createdAt: serverTimestamp(),
      });
      toast.success(`${manualEmail} pre-approved ✅`);
      setManualEmail(""); setManualName(""); setManualSP("Unassigned"); setManualRole("salesperson");
    } catch (e) { toast.error("Failed: " + e.message); }
    finally { setAddingManual(false); }
  }

  async function handleAddSP() {
    if (!newSPName.trim()) return toast.error("Enter a name");
    if (salespersons.some(s => s.name.toLowerCase() === newSPName.trim().toLowerCase()))
      return toast.error("Already exists!");
    setAddingSP(true);
    try {
      await addSalesperson(newSPName.trim(), newSPEmail.trim());
      toast.success(`${newSPName.trim()} added ✅`);
      setNewSPName(""); setNewSPEmail("");
      loadSalespersons();
    } catch (e) { toast.error("Failed to add: " + e.message); }
    finally { setAddingSP(false); }
  }

  async function handleRemoveSP(sp) {
    if (!confirm(`Remove "${sp.name}"?`)) return;
    try {
      await deleteSalesperson(sp.id);
      toast.success(`${sp.name} removed`);
      loadSalespersons();
    } catch (e) { toast.error("Failed: " + e.message); }
  }

  const pending = users.filter(u => u.status === "pending");

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Admin Panel</h1>
      <p className="text-sm text-gray-500 mb-5">Manage user access and salespersons</p>

      {/* Pending banner */}
      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-amber-800 mb-3">⏳ {pending.length} user(s) waiting for approval</p>
          <div className="space-y-3">
            {pending.map(u => (
              <div key={u.id} className="bg-white rounded-lg border border-amber-100 p-3">
                <div className="flex items-center gap-3 mb-3">
                  {u.photo && <img src={u.photo} className="w-8 h-8 rounded-full" alt="" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <button onClick={() => reject(u.id)} className="text-xs text-red-500 border border-red-200 rounded px-2 py-1 hover:bg-red-50 flex-shrink-0">Reject</button>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <select className="input flex-1 text-xs py-1.5 min-w-28"
                    value={pendingSP[u.id] || "Unassigned"}
                    onChange={e => setPendingSP({ ...pendingSP, [u.id]: e.target.value })}>
                    <option value="Unassigned">Unassigned</option>
                    {salespersons.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                  <select className="input w-36 text-xs py-1.5"
                    value={pendingRole[u.id] || "salesperson"}
                    onChange={e => setPendingRole({ ...pendingRole, [u.id]: e.target.value })}>
                    <option value="salesperson">Salesperson</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button onClick={() => approve(u.id)} className="btn btn-primary text-xs py-1.5 px-4">
                    ✅ Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[["users","👥 Users"],["preapprove","✉️ Pre-approve by Email"],["salespersons","🧑‍💼 Salespersons"]].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${tab===t?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {tab==="users" && (
        <div className="card">
          {loadingUsers ? <div className="p-8 text-center text-gray-400 text-sm">Loading users...</div>
            : users.length===0 ? <div className="p-8 text-center text-gray-400 text-sm">No users yet.</div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">Email</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">Salesperson</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">Role</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{u.name||"—"}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{u.salesperson||"—"}</td>
                        <td className="px-4 py-3 text-xs">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role==="admin"?"bg-purple-100 text-purple-700":"bg-blue-50 text-blue-600"}`}>
                            {u.role||"salesperson"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge ${STATUS_BADGE[u.status]||"bg-gray-100 text-gray-600"}`}>{u.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          {editingUser===u.id ? (
                            <div className="flex gap-1 flex-wrap items-center">
                              <select className="input text-xs py-0.5 w-28" value={editSP} onChange={e=>setEditSP(e.target.value)}>
                                <option value="Unassigned">Unassigned</option>
                                {salespersons.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                              </select>
                              <select className="input text-xs py-0.5 w-24" value={editRole} onChange={e=>setEditRole(e.target.value)}>
                                <option value="salesperson">SP</option>
                                <option value="admin">Admin</option>
                              </select>
                              <button onClick={()=>saveUserEdit(u.id)} className="text-xs text-green-600 hover:underline">Save</button>
                              <button onClick={()=>setEditingUser(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <button onClick={()=>{setEditingUser(u.id);setEditSP(u.salesperson||"Unassigned");setEditRole(u.role||"salesperson");}}
                                className="text-xs text-blue-500 hover:underline">Edit</button>
                              {u.status!=="approved"&&<button onClick={()=>approve(u.id)} className="text-xs text-green-600 hover:underline">Approve</button>}
                              {u.status!=="rejected"&&<button onClick={()=>reject(u.id)} className="text-xs text-red-500 hover:underline">Reject</button>}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* PRE-APPROVE TAB */}
      {tab==="preapprove" && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-gray-800 mb-1">Pre-approve a user by email</p>
          <p className="text-xs text-gray-400 mb-4">Add their Gmail before they sign in. They'll be auto-approved and assigned when they first log in.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gmail address *</label>
              <input className="input" type="email" placeholder="salesperson@gmail.com"
                value={manualEmail} onChange={e=>setManualEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Display name (optional)</label>
              <input className="input" placeholder="Pankaj Shah"
                value={manualName} onChange={e=>setManualName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assign salesperson</label>
              {loadingSP ? (
                <div className="input text-gray-400 text-sm">Loading salespersons...</div>
              ) : (
                <select className="input" value={manualSP} onChange={e=>setManualSP(e.target.value)}>
                  <option value="Unassigned">Unassigned</option>
                  {salespersons.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              )}
              {!loadingSP && salespersons.length===0 && (
                <p className="text-xs text-amber-600 mt-1">⚠️ No salespersons added yet. Go to the Salespersons tab first.</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <div className="flex gap-2">
                {[["salesperson","Salesperson (own leads only)"],["admin","Admin (sees all data)"]].map(([r,l])=>(
                  <button key={r} onClick={()=>setManualRole(r)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${manualRole===r?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-200"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary w-full" onClick={addManualUser} disabled={addingManual}>
              {addingManual?"Adding...":"Pre-approve this user"}
            </button>
          </div>
        </div>
      )}

      {/* SALESPERSONS TAB */}
      {tab==="salespersons" && (
        <div>
          <div className="card p-4 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Add salesperson</p>
            <div className="space-y-2">
              <input className="input" placeholder="Full name *" value={newSPName}
                onChange={e=>setNewSPName(e.target.value)} />
              <input className="input" placeholder="Email (optional — for auto-login matching)" value={newSPEmail}
                onChange={e=>setNewSPEmail(e.target.value)} />
              <button className="btn btn-primary w-full" onClick={handleAddSP} disabled={addingSP}>
                {addingSP?"Adding...":"Add salesperson"}
              </button>
            </div>
          </div>
          <div className="card">
            {loadingSP ? <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
              : salespersons.length===0
              ? <div className="p-8 text-center text-gray-400 text-sm">No salespersons yet.</div>
              : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">#</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">Email</th>
                    <th className="px-4 py-3"></th>
                  </tr></thead>
                  <tbody>
                    {salespersons.map((s,i)=>(
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400 text-xs">{i+1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{s.email||"—"}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={()=>handleRemoveSP(s)} className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
          <p className="text-xs text-gray-400 mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
            💡 Add the salesperson's Gmail so they're auto-matched when they sign in, or use Pre-approve tab to assign them before they log in.
          </p>
        </div>
      )}
    </div>
  );
}

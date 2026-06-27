import { useState, useEffect } from "react";
import { getAllUsers, approveUser, rejectUser, getSalespersons, addSalesperson, deleteSalesperson, db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, doc, updateDoc, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";

const STATUS_BADGE = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700"
};

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("users");
  const [newSP, setNewSP] = useState("");
  const [addingSP, setAddingSP] = useState(false);

  // Manual approve by email
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualSP, setManualSP] = useState("Unassigned");
  const [manualRole, setManualRole] = useState("salesperson");
  const [addingManual, setAddingManual] = useState(false);

  // Edit user salesperson mapping
  const [editingUser, setEditingUser] = useState(null);
  const [editSP, setEditSP] = useState("");
  const [editRole, setEditRole] = useState("salesperson");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([getAllUsers(), getSalespersons()]);
      setUsers(u); setSalespersons(s);
    } catch (e) { toast.error("Could not load: " + e.message); }
    finally { setLoading(false); }
  }

  async function approve(uid, spName = null, role = null) {
    try {
      const updateData = { status: "approved" };
      if (spName) updateData.salesperson = spName;
      if (role) updateData.role = role;
      await updateDoc(doc(db, "users", uid), updateData);
      toast.success("User approved ✅");
      load();
    } catch (e) { toast.error("Failed: " + e.message); }
  }

  async function reject(uid) {
    try {
      await rejectUser(uid);
      toast.success("User rejected");
      load();
    } catch (e) { toast.error("Failed: " + e.message); }
  }

  async function saveUserEdit(uid) {
    try {
      await updateDoc(doc(db, "users", uid), {
        salesperson: editSP,
        role: editRole,
        status: "approved"
      });
      toast.success("User updated ✅");
      setEditingUser(null);
      load();
    } catch (e) { toast.error("Failed: " + e.message); }
  }

  // Manually pre-approve a user by email before they sign in
  async function addManualUser() {
    if (!manualEmail.trim()) return toast.error("Email is required");
    setAddingManual(true);
    try {
      // Store by email as key so when they sign in it gets matched
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
    if (!newSP.trim()) return toast.error("Enter a name");
    if (salespersons.some(s => s.name.toLowerCase() === newSP.trim().toLowerCase()))
      return toast.error("Already exists!");
    setAddingSP(true);
    try {
      await addSalesperson(newSP.trim());
      toast.success(`${newSP.trim()} added`);
      setNewSP("");
      load();
    } catch (e) { toast.error("Failed: " + e.message); }
    finally { setAddingSP(false); }
  }

  async function handleRemoveSP(sp) {
    if (!confirm(`Remove "${sp.name}"?`)) return;
    try {
      await deleteSalesperson(sp.id);
      toast.success(`${sp.name} removed`);
      load();
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
          <div className="space-y-2">
            {pending.map(u => (
              <div key={u.id} className="bg-white rounded-lg border border-amber-100 p-3">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{u.name}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                  <button onClick={() => reject(u.id)} className="text-xs text-red-500 border border-red-200 rounded px-2 py-1 hover:bg-red-50">Reject</button>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <select className="input flex-1 text-xs py-1"
                    onChange={e => setEditSP(e.target.value)} defaultValue="Unassigned">
                    <option value="Unassigned">Unassigned</option>
                    <option value="admin">Admin (sees all)</option>
                    {salespersons.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                  <select className="input w-36 text-xs py-1"
                    onChange={e => setEditRole(e.target.value)} defaultValue="salesperson">
                    <option value="salesperson">Salesperson</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={() => approve(u.id, editSP || "Unassigned", editRole || "salesperson")}
                    className="btn btn-primary text-xs py-1 px-3">
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
        {["users", "preapprove", "salespersons"].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all capitalize ${tab === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
            {t === "preapprove" ? "Pre-approve by Email" : t}
          </button>
        ))}
      </div>

      {/* USERS TAB */}
      {tab === "users" && (
        <div className="card">
          {loading ? <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
          : users.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">No users yet. Share your CRM URL so team members can sign in.</div>
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
                      <td className="px-4 py-3 font-medium text-gray-900">{u.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{u.salesperson || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{u.role || "—"}</td>
                      <td className="px-4 py-3"><span className={`badge ${STATUS_BADGE[u.status] || "bg-gray-100 text-gray-600"}`}>{u.status}</span></td>
                      <td className="px-4 py-3">
                        {editingUser === u.id ? (
                          <div className="flex gap-1 flex-wrap">
                            <select className="input text-xs py-0.5 w-32" value={editSP} onChange={e => setEditSP(e.target.value)}>
                              <option value="Unassigned">Unassigned</option>
                              <option value="admin">Admin</option>
                              {salespersons.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                            <select className="input text-xs py-0.5 w-24" value={editRole} onChange={e => setEditRole(e.target.value)}>
                              <option value="salesperson">SP</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button onClick={() => saveUserEdit(u.id)} className="text-xs text-green-600 hover:underline">Save</button>
                            <button onClick={() => setEditingUser(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditingUser(u.id); setEditSP(u.salesperson || "Unassigned"); setEditRole(u.role || "salesperson"); }}
                              className="text-xs text-blue-500 hover:underline">Edit</button>
                            {u.status !== "approved" && <button onClick={() => approve(u.id)} className="text-xs text-green-600 hover:underline">Approve</button>}
                            {u.status !== "rejected" && <button onClick={() => reject(u.id)} className="text-xs text-red-500 hover:underline">Reject</button>}
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
      {tab === "preapprove" && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-gray-800 mb-1">Pre-approve a user by email</p>
          <p className="text-xs text-gray-400 mb-4">Add their Gmail address before they sign in. When they log in, they'll be auto-approved with the salesperson you assign.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gmail address *</label>
              <input className="input" type="email" placeholder="salesperson@gmail.com"
                value={manualEmail} onChange={e => setManualEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Display name (optional)</label>
              <input className="input" placeholder="Pankaj Shah"
                value={manualName} onChange={e => setManualName(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assign salesperson</label>
              <select className="input" value={manualSP} onChange={e => setManualSP(e.target.value)}>
                <option value="Unassigned">Unassigned</option>
                {salespersons.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <div className="flex gap-2">
                {["salesperson","admin"].map(r => (
                  <button key={r} onClick={() => setManualRole(r)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border capitalize transition-all ${manualRole === r ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"}`}>
                    {r === "admin" ? "Admin (sees all data)" : "Salesperson (own leads only)"}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary w-full" onClick={addManualUser} disabled={addingManual}>
              {addingManual ? "Adding..." : "Pre-approve this user"}
            </button>
          </div>
        </div>
      )}

      {/* SALESPERSONS TAB */}
      {tab === "salespersons" && (
        <div>
          <div className="card p-4 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Add salesperson</p>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Enter full name" value={newSP}
                onChange={e => setNewSP(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddSP()} />
              <button className="btn btn-primary" onClick={handleAddSP} disabled={addingSP}>
                {addingSP ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
          <div className="card">
            {salespersons.length === 0
              ? <div className="p-8 text-center text-gray-400 text-sm">No salespersons yet.</div>
              : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">#</th>
                    <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">Name</th>
                    <th className="px-4 py-3"></th>
                  </tr></thead>
                  <tbody>
                    {salespersons.map((s, i) => (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleRemoveSP(s)} className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </div>
        </div>
      )}
    </div>
  );
}

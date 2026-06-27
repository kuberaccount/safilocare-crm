import { useState, useEffect } from "react";
import { getPendingUsers, getAllUsers, approveUser, rejectUser, getSalespersons, addSalesperson } from "../lib/firebase";
import toast from "react-hot-toast";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [newSP, setNewSP] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("users");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([getAllUsers(), getSalespersons()]);
      setUsers(u); setSalespersons(s);
    } catch { toast.error("Could not load"); }
    finally { setLoading(false); }
  }

  async function approve(uid) {
    await approveUser(uid); toast.success("User approved ✅"); load();
  }
  async function reject(uid) {
    await rejectUser(uid); toast.success("User rejected"); load();
  }
  async function addSP() {
    if (!newSP.trim()) return;
    await addSalesperson(newSP.trim()); toast.success(`${newSP} added`);
    setNewSP(""); load();
  }

  const pending = users.filter(u=>u.status==="pending");
  const approved = users.filter(u=>u.status==="approved");
  const rejected = users.filter(u=>u.status==="rejected");

  const STATUS_BADGE = { pending:"bg-amber-100 text-amber-700", approved:"bg-green-100 text-green-700", rejected:"bg-red-100 text-red-700" };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Admin Panel</h1>
      <p className="text-sm text-gray-500 mb-6">Manage user access and salespersons</p>

      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-amber-800 mb-3">⏳ {pending.length} user(s) waiting for approval</p>
          <div className="space-y-2">
            {pending.map(u=>(
              <div key={u.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-amber-100">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
                <button onClick={()=>approve(u.id)} className="btn btn-primary text-xs py-1 px-3">Approve</button>
                <button onClick={()=>reject(u.id)} className="btn btn-danger text-xs py-1 px-3">Reject</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {["users","salespersons"].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all capitalize ${tab===t?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-200"}`}>{t}</button>
        ))}
      </div>

      {tab==="users" && (
        <div className="card">
          {loading ? <div className="p-8 text-center text-gray-400 text-sm">Loading...</div> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3"></th>
              </tr></thead>
              <tbody>
                {users.map(u=>(
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3"><span className={`badge ${STATUS_BADGE[u.status]}`}>{u.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        {u.status!=="approved" && <button onClick={()=>approve(u.id)} className="text-xs text-green-600 hover:underline">Approve</button>}
                        {u.status!=="rejected" && <button onClick={()=>reject(u.id)} className="text-xs text-red-500 hover:underline">Reject</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab==="salespersons" && (
        <div>
          <div className="card p-4 mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Add salesperson</p>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Enter name" value={newSP} onChange={e=>setNewSP(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&addSP()} />
              <button className="btn btn-primary" onClick={addSP}>Add</button>
            </div>
          </div>
          <div className="card">
            {salespersons.length===0 ? <div className="p-8 text-center text-gray-400 text-sm">No salespersons added yet.</div> : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">#</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 uppercase">Name</th>
                </tr></thead>
                <tbody>
                  {salespersons.map((s,i)=>(
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400">{i+1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
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

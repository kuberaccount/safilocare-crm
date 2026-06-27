import { useState, useEffect } from "react";
import { getDeals, getContacts, getActivities, getSalespersons } from "../lib/firebase";

function fmt(n) { return `₹${(parseFloat(n)||0).toLocaleString("en-IN")}`; }
function pct(a,b) { return b ? Math.round((a/b)*100) : 0; }

const STAGES = ["Lead","Qualified","Proposal","Negotiation","Won","Lost"];
const STAGE_COLOR = { Lead:"bg-gray-400", Qualified:"bg-blue-400", Proposal:"bg-purple-400", Negotiation:"bg-amber-400", Won:"bg-green-500", Lost:"bg-red-400" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function getMonth(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function ReportsPage() {
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [filterSP, setFilterSP] = useState("All");
  const [filterMonth, setFilterMonth] = useState("All");

  useEffect(() => {
    Promise.all([getDeals(), getContacts(), getActivities(), getSalespersons()])
      .then(([d,c,a,s]) => { setDeals(d); setContacts(c); setActivities(a); setSalespersons(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-center text-gray-400 py-20">Loading reports...</div>;

  // Filter helpers
  const spNames = ["All", ...salespersons.map(s=>s.name), "Unassigned"];
  const allMonths = [...new Set(deals.map(d=>getMonth(d.createdAt)).filter(Boolean))].sort().reverse();
  const months = ["All", ...allMonths];

  const filteredDeals = deals.filter(d => {
    const matchSP = filterSP === "All" || d.salesperson === filterSP;
    const matchMonth = filterMonth === "All" || getMonth(d.createdAt) === filterMonth;
    return matchSP && matchMonth;
  });

  // Summary stats
  const totalDeals = filteredDeals.length;
  const wonDeals = filteredDeals.filter(d=>d.stage==="Won");
  const lostDeals = filteredDeals.filter(d=>d.stage==="Lost");
  const activeDeals = filteredDeals.filter(d=>!["Won","Lost"].includes(d.stage));
  const pipelineValue = activeDeals.reduce((s,d)=>s+(parseFloat(d.value)||0),0);
  const wonValue = wonDeals.reduce((s,d)=>s+(parseFloat(d.value)||0),0);
  const winRate = pct(wonDeals.length, totalDeals);

  // Stage funnel
  const stageFunnel = STAGES.map(stage => {
    const stageDeals = filteredDeals.filter(d=>d.stage===stage);
    return { stage, count: stageDeals.length, value: stageDeals.reduce((s,d)=>s+(parseFloat(d.value)||0),0) };
  });
  const maxCount = Math.max(...stageFunnel.map(s=>s.count), 1);

  // Salesperson report
  const spReport = salespersons.map(sp => {
    const spDeals = filteredDeals.filter(d=>d.salesperson===sp.name);
    const spContacts = contacts.filter(c=>c.salesperson===sp.name);
    const spActs = activities.filter(a=>a.salesperson===sp.name || spDeals.some(d=>d.id===a.dealId));
    const won = spDeals.filter(d=>d.stage==="Won");
    const lost = spDeals.filter(d=>d.stage==="Lost");
    return {
      name: sp.name,
      contacts: spContacts.length,
      deals: spDeals.length,
      won: won.length,
      lost: lost.length,
      active: spDeals.filter(d=>!["Won","Lost"].includes(d.stage)).length,
      wonValue: won.reduce((s,d)=>s+(parseFloat(d.value)||0),0),
      pipelineValue: spDeals.filter(d=>!["Won","Lost"].includes(d.stage)).reduce((s,d)=>s+(parseFloat(d.value)||0),0),
      winRate: pct(won.length, spDeals.length),
      activities: spActs.length,
      stageBreakdown: STAGES.map(stage=>({ stage, count: spDeals.filter(d=>d.stage===stage).length })),
    };
  });

  // Won deals table
  const wonTable = filteredDeals
    .filter(d=>d.stage==="Won")
    .sort((a,b)=>(parseFloat(b.value)||0)-(parseFloat(a.value)||0));

  // Overdue follow-ups: deals in active stages with no activity in 7+ days
  const now = Date.now();
  const overdue = activeDeals.filter(deal => {
    const dealActs = activities.filter(a=>a.dealId===deal.id);
    if (dealActs.length === 0) {
      const created = deal.createdAt?.toDate ? deal.createdAt.toDate() : new Date(deal.createdAt||now);
      return (now - created) > 7*24*60*60*1000;
    }
    const last = Math.max(...dealActs.map(a=>{
      const d = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt||now);
      return d.getTime();
    }));
    return (now - last) > 7*24*60*60*1000;
  });

  const TABS = ["overview","funnel","salesperson","won","overdue"];

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-900">Reports</h1>
        <div className="flex gap-2 flex-wrap">
          <select className="input w-44" value={filterSP} onChange={e=>setFilterSP(e.target.value)}>
            {spNames.map(s=><option key={s}>{s}</option>)}
          </select>
          <select className="input w-36" value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}>
            {months.map(m=><option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Overdue banner */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold text-red-700 mb-2">⚠️ {overdue.length} deal(s) with no activity in 7+ days</p>
          <div className="flex flex-wrap gap-2">
            {overdue.map(d=>(
              <span key={d.id} className="text-xs bg-white border border-red-200 text-red-700 px-2 py-1 rounded-lg">
                {d.title} — {d.salesperson||"Unassigned"} ({d.stage})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${tab===t?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
            {t === "won" ? "Won Deals" : t === "funnel" ? "Pipeline Funnel" : t === "salesperson" ? "By Salesperson" : t === "overdue" ? `Overdue (${overdue.length})` : "Overview"}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab==="overview" && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label:"Total deals", value:totalDeals, sub:`${activeDeals.length} active`, color:"blue" },
              { label:"Pipeline value", value:fmt(pipelineValue), sub:`${activeDeals.length} open deals`, color:"purple" },
              { label:"Won value", value:fmt(wonValue), sub:`${wonDeals.length} deals closed`, color:"green" },
              { label:"Win rate", value:`${winRate}%`, sub:`${lostDeals.length} lost`, color:"amber" },
            ].map(s=>(
              <div key={s.label} className="card p-5">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">Contacts summary</p>
              <div className="space-y-2">
                {["Hot","Warm","Cold"].map(s=>{
                  const cnt = contacts.filter(c=>c.status===s).length;
                  const colors = { Hot:"text-red-600 bg-red-50", Warm:"text-amber-600 bg-amber-50", Cold:"text-blue-600 bg-blue-50" };
                  return (
                    <div key={s} className="flex items-center justify-between">
                      <span className={`badge ${colors[s]}`}>{s}</span>
                      <span className="text-sm font-semibold text-gray-900">{cnt} contacts</span>
                    </div>
                  );
                })}
                <div className="border-t border-gray-100 pt-2 flex justify-between">
                  <span className="text-sm text-gray-500">Total</span>
                  <span className="text-sm font-bold text-gray-900">{contacts.length}</span>
                </div>
              </div>
            </div>
            <div className="card p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">Activity summary</p>
              <div className="space-y-2">
                {["Email","Call","Meeting","Note"].map(t=>{
                  const cnt = activities.filter(a=>a.type===t).length;
                  return (
                    <div key={t} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{t}</span>
                      <span className="text-sm font-semibold text-gray-900">{cnt}</span>
                    </div>
                  );
                })}
                <div className="border-t border-gray-100 pt-2 flex justify-between">
                  <span className="text-sm text-gray-500">Total</span>
                  <span className="text-sm font-bold text-gray-900">{activities.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIPELINE FUNNEL */}
      {tab==="funnel" && (
        <div className="card p-6">
          <p className="text-sm font-semibold text-gray-700 mb-5">Pipeline funnel — stage by stage</p>
          <div className="space-y-3">
            {stageFunnel.map(({stage,count,value})=>(
              <div key={stage} className="flex items-center gap-4">
                <div className="w-28 text-sm text-gray-600 text-right flex-shrink-0">{stage}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-8 relative overflow-hidden">
                  <div className={`h-full rounded-full ${STAGE_COLOR[stage]} transition-all duration-500`}
                    style={{width:`${count ? Math.max((count/maxCount)*100,4) : 0}%`}} />
                  <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-gray-700">
                    {count} deal{count!==1?"s":""} {value>0 && `· ${fmt(value)}`}
                  </span>
                </div>
                <div className="w-8 text-sm font-bold text-gray-700 flex-shrink-0">{count}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-center">
            <div><p className="text-xs text-gray-400">Total in funnel</p><p className="text-xl font-bold text-gray-900">{totalDeals}</p></div>
            <div><p className="text-xs text-gray-400">Pipeline value</p><p className="text-xl font-bold text-gray-900">{fmt(pipelineValue)}</p></div>
            <div><p className="text-xs text-gray-400">Win rate</p><p className="text-xl font-bold text-green-600">{winRate}%</p></div>
          </div>
        </div>
      )}

      {/* BY SALESPERSON */}
      {tab==="salesperson" && (
        <div className="space-y-4">
          {spReport.length===0 ? (
            <div className="card p-8 text-center text-gray-400 text-sm">No salespersons found. Add them from the Contacts page.</div>
          ) : spReport.map(sp=>(
            <div key={sp.name} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700">
                    {sp.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{sp.name}</p>
                    <p className="text-xs text-gray-400">{sp.contacts} contacts · {sp.activities} activities</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">{fmt(sp.wonValue)} won</p>
                  <p className="text-xs text-gray-400">Win rate: {sp.winRate}%</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  {label:"Total deals",value:sp.deals,color:"text-gray-700"},
                  {label:"Active",value:sp.active,color:"text-blue-600"},
                  {label:"Won",value:sp.won,color:"text-green-600"},
                  {label:"Lost",value:sp.lost,color:"text-red-500"},
                ].map(s=>(
                  <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Stage breakdown</p>
                <div className="flex gap-2 flex-wrap">
                  {sp.stageBreakdown.filter(s=>s.count>0).map(s=>(
                    <span key={s.stage} className="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-600">
                      {s.stage}: <strong>{s.count}</strong>
                    </span>
                  ))}
                  {sp.stageBreakdown.every(s=>s.count===0) && <span className="text-xs text-gray-300">No deals yet</span>}
                </div>
              </div>
              {sp.pipelineValue > 0 && (
                <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
                  Pipeline value: <span className="font-semibold text-gray-700">{fmt(sp.pipelineValue)}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* WON DEALS */}
      {tab==="won" && (
        <div className="card">
          {wonTable.length===0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No won deals yet. Keep pushing! 💪</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {["Deal","Company","Contact","Salesperson","Value","Month"].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {wonTable.map(d=>(
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{d.title}</td>
                    <td className="px-4 py-3 text-gray-600">{d.company||"—"}</td>
                    <td className="px-4 py-3 text-gray-600">{d.contact||"—"}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full">{d.salesperson||"Unassigned"}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-green-600">{fmt(d.value)}</td>
                    <td className="px-4 py-3 text-gray-400">{getMonth(d.createdAt)||"—"}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-3 font-bold text-green-700">{fmt(wonValue)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* OVERDUE */}
      {tab==="overdue" && (
        <div className="card">
          {overdue.length===0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">✅ No overdue follow-ups! All deals have recent activity.</div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100">
                {["Deal","Company","Stage","Salesperson","Last Activity"].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {overdue.map(d=>{
                  const dealActs = activities.filter(a=>a.dealId===d.id);
                  const lastAct = dealActs.length > 0
                    ? Math.max(...dealActs.map(a=>{ const dt=a.createdAt?.toDate?a.createdAt.toDate():new Date(a.createdAt||0); return dt.getTime(); }))
                    : (d.createdAt?.toDate?d.createdAt.toDate():new Date(d.createdAt||0)).getTime();
                  const daysAgo = Math.floor((now - lastAct) / (24*60*60*1000));
                  return (
                    <tr key={d.id} className="border-b border-gray-50 hover:bg-red-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{d.title}</td>
                      <td className="px-4 py-3 text-gray-600">{d.company||"—"}</td>
                      <td className="px-4 py-3"><span className="badge badge-warm">{d.stage}</span></td>
                      <td className="px-4 py-3 text-gray-600">{d.salesperson||"Unassigned"}</td>
                      <td className="px-4 py-3 text-red-500 font-medium">{daysAgo} days ago</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

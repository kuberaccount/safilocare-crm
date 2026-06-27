import { useState, useEffect } from "react";
import { getDeals, getActivities, getSalespersons } from "../lib/firebase";
import toast from "react-hot-toast";

const STAGES = ["Lead","Qualified","Proposal","Negotiation","Won","Lost"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STAGE_COLOR = {
  Lead:"bg-gray-100 text-gray-600",
  Qualified:"bg-blue-100 text-blue-700",
  Proposal:"bg-purple-100 text-purple-700",
  Negotiation:"bg-amber-100 text-amber-700",
  Won:"bg-green-100 text-green-700",
  Lost:"bg-red-100 text-red-700",
};

export default function ReportsPage() {
  const [deals, setDeals] = useState([]);
  const [activities, setActivities] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pipeline");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSP, setSelectedSP] = useState("All");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [d, a, s] = await Promise.all([getDeals(), getActivities(), getSalespersons()]);
      setDeals(d);
      setActivities(a);
      setSalespersons(s);
    } catch { toast.error("Could not load reports"); }
    finally { setLoading(false); }
  }

  // ── Pipeline Report ──────────────────────────────────────────
  const activeDeals = deals.filter(d => !d.archived);
  const totalPipelineValue = activeDeals.filter(d=>d.stage!=="Lost").reduce((s,d)=>s+(parseFloat(d.value)||0),0);
  const wonValue = activeDeals.filter(d=>d.stage==="Won").reduce((s,d)=>s+(parseFloat(d.value)||0),0);
  const conversionRate = activeDeals.length > 0 ? Math.round((activeDeals.filter(d=>d.stage==="Won").length / activeDeals.length)*100) : 0;

  const stageStats = STAGES.map(stage => {
    const stageDeals = activeDeals.filter(d => d.stage === stage);
    return {
      stage,
      count: stageDeals.length,
      value: stageDeals.reduce((s,d)=>s+(parseFloat(d.value)||0),0),
    };
  });

  // ── Salesperson Monthly Report ───────────────────────────────
  function inMonth(ts) {
    if (!ts) return false;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  }

  const spList = salespersons.map(s => s.name);

  const spReport = (selectedSP === "All" ? spList : [selectedSP]).map(sp => {
    const spDeals = activeDeals.filter(d => d.salesperson === sp);
    const monthDeals = spDeals.filter(d => inMonth(d.createdAt));
    const monthWon = spDeals.filter(d => d.stage === "Won" && inMonth(d.createdAt));
    const monthLost = spDeals.filter(d => d.stage === "Lost" && inMonth(d.createdAt));
    const monthActivities = activities.filter(a => a.salesperson === sp && inMonth(a.createdAt));
    const overdueFollowUps = spDeals.filter(d => d.followUpDate && new Date(d.followUpDate) < new Date() && d.stage !== "Won" && d.stage !== "Lost");

    return {
      name: sp,
      totalDeals: spDeals.length,
      monthDeals: monthDeals.length,
      monthWon: monthWon.length,
      monthLost: monthLost.length,
      monthWonValue: monthWon.reduce((s,d)=>s+(parseFloat(d.value)||0),0),
      monthActivities: monthActivities.length,
      overdueFollowUps: overdueFollowUps.length,
      stageBreakdown: STAGES.map(stage => ({
        stage,
        count: spDeals.filter(d => d.stage === stage).length,
      })),
    };
  });

  // ── Overdue follow-ups across all ───────────────────────────
  const allOverdue = activeDeals.filter(d =>
    d.followUpDate && new Date(d.followUpDate) < new Date() && d.stage !== "Won" && d.stage !== "Lost"
  );

  if (loading) return <div className="p-6 text-center text-gray-400 text-sm py-20">Loading reports...</div>;

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Reports</h1>
      <p className="text-sm text-gray-500 mb-6">Pipeline and salesperson performance insights</p>

      {/* Overdue Alert */}
      {allOverdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-red-700">⚠️ {allOverdue.length} overdue follow-up{allOverdue.length>1?"s":""}</p>
          <div className="mt-2 space-y-1">
            {allOverdue.slice(0,5).map(d=>(
              <p key={d.id} className="text-xs text-red-600">
                · {d.title} ({d.salesperson}) — due {new Date(d.followUpDate).toLocaleDateString("en-IN")}
              </p>
            ))}
            {allOverdue.length > 5 && <p className="text-xs text-red-400">...and {allOverdue.length-5} more</p>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {["pipeline","salesperson"].map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all capitalize ${tab===t?"bg-blue-600 text-white border-blue-600":"bg-white text-gray-600 border-gray-200"}`}>
            {t === "pipeline" ? "📊 Pipeline Report" : "🧑‍💼 Salesperson Report"}
          </button>
        ))}
      </div>

      {/* ── PIPELINE REPORT ── */}
      {tab === "pipeline" && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label:"Total Deals", value: activeDeals.length, color:"text-gray-800" },
              { label:"Pipeline Value", value:`₹${totalPipelineValue.toLocaleString("en-IN")}`, color:"text-blue-700" },
              { label:"Won Value", value:`₹${wonValue.toLocaleString("en-IN")}`, color:"text-green-700" },
              { label:"Conversion Rate", value:`${conversionRate}%`, color:"text-purple-700" },
            ].map(c=>(
              <div key={c.label} className="card p-4">
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Stage funnel */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Stage Breakdown</h2>
            <div className="space-y-3">
              {stageStats.map(({stage,count,value})=>(
                <div key={stage}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STAGE_COLOR[stage]}`}>{stage}</span>
                      <span className="text-sm font-semibold text-gray-700">{count} deal{count!==1?"s":""}</span>
                    </div>
                    <span className="text-sm text-gray-500">₹{value.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{width: activeDeals.length ? `${(count/activeDeals.length)*100}%` : "0%"}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent won deals */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">🏆 Won Deals</h2>
            {activeDeals.filter(d=>d.stage==="Won").length === 0 ? (
              <p className="text-sm text-gray-400">No won deals yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-100">
                  <th className="text-left pb-2 text-xs text-gray-400">Deal</th>
                  <th className="text-left pb-2 text-xs text-gray-400">Salesperson</th>
                  <th className="text-right pb-2 text-xs text-gray-400">Value</th>
                </tr></thead>
                <tbody>
                  {activeDeals.filter(d=>d.stage==="Won").map(d=>(
                    <tr key={d.id} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-gray-800">{d.title}<br/><span className="text-xs text-gray-400 font-normal">{d.company}</span></td>
                      <td className="py-2 text-gray-500">{d.salesperson}</td>
                      <td className="py-2 text-right text-green-600 font-semibold">₹{parseFloat(d.value||0).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── SALESPERSON REPORT ── */}
      {tab === "salesperson" && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select className="input w-36" value={selectedMonth} onChange={e=>setSelectedMonth(Number(e.target.value))}>
              {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
            </select>
            <select className="input w-28" value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))}>
              {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
            </select>
            <select className="input w-44" value={selectedSP} onChange={e=>setSelectedSP(e.target.value)}>
              <option value="All">All salespersons</option>
              {salespersons.map(s=><option key={s.id}>{s.name}</option>)}
            </select>
          </div>

          <p className="text-xs text-gray-400 -mt-2">Showing data for <strong>{MONTHS[selectedMonth]} {selectedYear}</strong></p>

          {spReport.length === 0 ? (
            <p className="text-sm text-gray-400">No salespersons found.</p>
          ) : spReport.map(sp => (
            <div key={sp.name} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-700">
                    {sp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{sp.name}</p>
                    <p className="text-xs text-gray-400">{sp.totalDeals} total deals all time</p>
                  </div>
                </div>
                {sp.overdueFollowUps > 0 && (
                  <span className="text-xs bg-red-100 text-red-600 font-medium px-2 py-1 rounded-full">
                    ⚠️ {sp.overdueFollowUps} overdue
                  </span>
                )}
              </div>

              {/* Month stats */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
                {[
                  { label:"New Leads", value: sp.monthDeals, color:"text-gray-700" },
                  { label:"Won", value: sp.monthWon, color:"text-green-600" },
                  { label:"Lost", value: sp.monthLost, color:"text-red-500" },
                  { label:"Won Value", value:`₹${sp.monthWonValue.toLocaleString("en-IN")}`, color:"text-blue-700" },
                  { label:"Activities", value: sp.monthActivities, color:"text-purple-600" },
                ].map(c=>(
                  <div key={c.label} className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                    <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Stage breakdown */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Current pipeline (all time)</p>
                <div className="flex flex-wrap gap-2">
                  {sp.stageBreakdown.filter(s=>s.count>0).map(s=>(
                    <span key={s.stage} className={`text-xs px-2.5 py-1 rounded-full font-medium ${STAGE_COLOR[s.stage]}`}>
                      {s.stage}: {s.count}
                    </span>
                  ))}
                  {sp.stageBreakdown.every(s=>s.count===0) && <p className="text-xs text-gray-400">No active deals</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

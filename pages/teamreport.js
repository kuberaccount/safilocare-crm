import { useState, useEffect } from "react";
import { getActivityLog } from "../lib/activitylog";
import { getAllUsers, getSalespersons } from "../lib/firebase";

function exportToExcel(logs, summary) {
  // Build activity log sheet data
  const logRows = [
    ["Time", "User", "Salesperson", "Action", "Contact/Deal", "Details"],
    ...logs.map(l => [
      l.timestamp?.toDate ? l.timestamp.toDate().toLocaleString("en-IN") : "—",
      l.userName || "—",
      l.salesperson || "—",
      l.action || "—",
      l.details?.contactName || l.details?.dealTitle || "—",
      [
        l.details?.activityType,
        l.details?.stage ? `Stage: ${l.details.stage}` : null,
        l.details?.followUpDate ? `Follow-up: ${l.details.followUpDate}` : null,
        l.details?.subject ? `"${l.details.subject}"` : null,
      ].filter(Boolean).join(" · ") || "—"
    ])
  ];

  // Build summary sheet data
  const summaryRows = [
    ["Salesperson", "Total Actions", "Contacts Added", "Leads Added", "Lead Updates", "Activities", "Follow-ups", "Stage Moves", "Deals Won", "Last Active"],
    ...summary.map(sp => [
      sp.sp,
      sp.total,
      sp.contacts,
      sp.leads,
      sp.updates,
      sp.activities,
      sp.followups,
      sp.moved,
      sp.won,
      sp.lastActive?.toDate ? sp.lastActive.toDate().toLocaleString("en-IN") : "—"
    ])
  ];

  // Convert to CSV with sheet separator
  function toCSV(rows) {
    return rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  }

  const csvContent = "ACTIVITY LOG\n" + toCSV(logRows) + "\n\nSUMMARY BY PERSON\n" + toCSV(summaryRows);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `safilocare-team-report-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

const ACTION_STYLE = {
  "Added Contact":    { bg:"#dbeafe", color:"#1e40af", icon:"👤" },
  "Added Lead":       { bg:"#ede9fe", color:"#5b21b6", icon:"📋" },
  "Updated Lead":     { bg:"#fef3c7", color:"#92400e", icon:"✏️" },
  "Logged Activity":  { bg:"#dcfce7", color:"#14532d", icon:"📝" },
  "Marked Follow-up": { bg:"#ffedd5", color:"#7c2d12", icon:"📅" },
  "Moved Stage":      { bg:"#f0fdf4", color:"#166534", icon:"➡️" },
  "Won Deal":         { bg:"#dcfce7", color:"#14532d", icon:"🏆" },
  "Deleted Contact":  { bg:"#fee2e2", color:"#7f1d1d", icon:"🗑️" },
  "Deleted Lead":     { bg:"#fee2e2", color:"#7f1d1d", icon:"🗑️" },
};

function timeAgo(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 86400*2) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}

function fullTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

export default function TeamReportPage() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSP, setFilterSP] = useState("All");
  const [filterAction, setFilterAction] = useState("All");
  const [filterDate, setFilterDate] = useState("all"); // all | today | week | month | custom
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tab, setTab] = useState("log"); // log | summary

  useEffect(() => {
    Promise.all([getActivityLog(), getAllUsers(), getSalespersons()])
      .then(([l, u, s]) => { setLogs(l); setUsers(u); setSalespersons(s); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function inDateRange(ts) {
    if (filterDate === "all") return true;
    if (!ts) return false;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    if (filterDate === "today") {
      return d.toDateString() === now.toDateString();
    }
    if (filterDate === "week") {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    if (filterDate === "month") {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (filterDate === "custom") {
      const from = dateFrom ? new Date(dateFrom) : null;
      const to = dateTo ? new Date(dateTo + "T23:59:59") : null;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    }
    return true;
  }

  const filtered = logs.filter(l => {
    const matchSP = filterSP === "All" || l.salesperson === filterSP || l.userName === filterSP;
    const matchAction = filterAction === "All" || l.action === filterAction;
    return matchSP && matchAction && inDateRange(l.timestamp);
  });

  // Summary per salesperson
  const spNames = [...new Set(logs.map(l => l.salesperson).filter(Boolean))].sort();
  const summary = spNames.map(sp => {
    const spLogs = logs.filter(l => l.salesperson === sp && inDateRange(l.timestamp));
    const lastActive = spLogs[0]?.timestamp;
    return {
      sp,
      total: spLogs.length,
      contacts: spLogs.filter(l => l.action === "Added Contact").length,
      leads: spLogs.filter(l => l.action === "Added Lead").length,
      updates: spLogs.filter(l => l.action === "Updated Lead").length,
      activities: spLogs.filter(l => l.action === "Logged Activity").length,
      followups: spLogs.filter(l => l.action === "Marked Follow-up").length,
      moved: spLogs.filter(l => l.action === "Moved Stage").length,
      won: spLogs.filter(l => l.action === "Won Deal").length,
      lastActive,
    };
  }).sort((a, b) => b.total - a.total);

  const allActions = [...new Set(logs.map(l => l.action))].filter(Boolean).sort();

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team Activity Report</h1>
          <p className="text-sm text-gray-500">Full history of what your team did and when</p>
        </div>
        <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
          <button onClick={()=>exportToExcel(filtered, summary)}
            style={{display:"inline-flex",alignItems:"center",gap:"6px",padding:"7px 14px",borderRadius:"8px",border:"1px solid #16a34a",background:"#f0fdf4",color:"#16a34a",fontSize:"13px",fontWeight:600,cursor:"pointer",transition:"all 0.15s"}}
            onMouseOver={e=>{e.currentTarget.style.background="#16a34a";e.currentTarget.style.color="white";}}
            onMouseOut={e=>{e.currentTarget.style.background="#f0fdf4";e.currentTarget.style.color="#16a34a";}}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export Excel
          </button>
          <span style={{fontSize:"11px",background:"#fee2e2",color:"#b91c1c",padding:"4px 10px",borderRadius:"20px",fontWeight:700}}>🔒 Admin only</span>
        </div>
      </div>

      {/* Date filter */}
      <div className="card p-4 mb-4">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[["all","All time"],["today","Today"],["week","This week"],["month","This month"],["custom","Custom"]].map(([v,l])=>(
              <button key={v} onClick={()=>setFilterDate(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filterDate===v?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
                {l}
              </button>
            ))}
          </div>
          {filterDate==="custom" && (
            <div className="flex items-center gap-2">
              <input type="date" className="input w-36" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" className="input w-36" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        {[["log","Activity Log"],["summary","Summary by Person"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab===v?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* ACTIVITY LOG TAB */}
      {tab==="log" && (
        <div>
          {/* Filters */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <select className="input w-48" value={filterSP} onChange={e=>setFilterSP(e.target.value)}>
              <option value="All">All salespersons</option>
              {spNames.map(s=><option key={s}>{s}</option>)}
            </select>
            <select className="input w-48" value={filterAction} onChange={e=>setFilterAction(e.target.value)}>
              <option value="All">All actions</option>
              {allActions.map(a=><option key={a}>{a}</option>)}
            </select>
            <span className="text-xs text-gray-400 self-center">{filtered.length} entries</span>
          </div>

          <div className="card">
            {loading ? <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
            : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <p style={{fontSize:"32px",marginBottom:"8px"}}>📭</p>
                <p className="text-gray-400 text-sm">No activity logged yet. Actions are recorded automatically as your team uses the CRM.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["Time","Who","Action","Details"].map(h=>(
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(log => {
                      const style = ACTION_STYLE[log.action] || { bg:"#f1f5f9", color:"#475569", icon:"•" };
                      return (
                        <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                            <p className="text-gray-600 font-medium">{timeAgo(log.timestamp)}</p>
                            <p className="text-gray-400">{fullTime(log.timestamp)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div style={{width:"28px",height:"28px",borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:700,color:"white",flexShrink:0}}>
                                {(log.userName||"?").charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{log.userName}</p>
                                <p className="text-xs text-gray-400">{log.salesperson}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span style={{fontSize:"12px",fontWeight:600,background:style.bg,color:style.color,padding:"3px 10px",borderRadius:"20px",display:"inline-flex",alignItems:"center",gap:"4px",whiteSpace:"nowrap"}}>
                              {style.icon} {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs">
                            {log.details?.contactName && <span>Contact: <strong>{log.details.contactName}</strong></span>}
                            {log.details?.dealTitle && <span>Deal: <strong>{log.details.dealTitle}</strong></span>}
                            {log.details?.activityType && <span> · {log.details.activityType}</span>}
                            {log.details?.stage && <span> · Stage: <strong>{log.details.stage}</strong></span>}
                            {log.details?.followUpDate && <span> · Follow-up: <strong>{log.details.followUpDate}</strong></span>}
                            {log.details?.subject && <span> · "{log.details.subject}"</span>}
                            {log.details?.note && <span className="text-gray-400"> {log.details.note}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUMMARY TAB */}
      {tab==="summary" && (
        <div className="space-y-4">
          {summary.length === 0 ? (
            <div className="card p-8 text-center text-gray-400 text-sm">No activity data yet.</div>
          ) : summary.map(sp => (
            <div key={sp.sp} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div style={{width:"40px",height:"40px",borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",fontWeight:700,color:"white"}}>
                    {sp.sp.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{sp.sp}</p>
                    <p className="text-xs text-gray-400">Last active: {timeAgo(sp.lastActive)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-indigo-600">{sp.total}</p>
                  <p className="text-xs text-gray-400">total actions</p>
                </div>
              </div>

              <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
                {[
                  {label:"Contacts Added", value:sp.contacts, color:"#dbeafe", text:"#1e40af", icon:"👤"},
                  {label:"Leads Added",    value:sp.leads,    color:"#ede9fe", text:"#5b21b6", icon:"📋"},
                  {label:"Lead Updates",   value:sp.updates,  color:"#fef3c7", text:"#92400e", icon:"✏️"},
                  {label:"Activities",     value:sp.activities,color:"#dcfce7",text:"#14532d", icon:"📝"},
                  {label:"Follow-ups",     value:sp.followups, color:"#ffedd5", text:"#7c2d12", icon:"📅"},
                  {label:"Stage Moves",    value:sp.moved,    color:"#f0fdf4", text:"#166534", icon:"➡️"},
                  {label:"Deals Won",      value:sp.won,      color:"#dcfce7", text:"#14532d", icon:"🏆"},
                ].map(s=>(
                  <div key={s.label} style={{background:s.color,borderRadius:"10px",padding:"10px",textAlign:"center"}}>
                    <p style={{fontSize:"18px",margin:"0 0 2px"}}>{s.icon}</p>
                    <p style={{fontSize:"20px",fontWeight:800,color:s.text,margin:0}}>{s.value}</p>
                    <p style={{fontSize:"10px",color:s.text,opacity:0.8,margin:0,lineHeight:1.2}}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Activity bar */}
              {sp.total > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">Activity breakdown</p>
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                    {[
                      {v:sp.contacts,  c:"#3b82f6"},
                      {v:sp.leads,     c:"#8b5cf6"},
                      {v:sp.updates,   c:"#f59e0b"},
                      {v:sp.activities,c:"#10b981"},
                      {v:sp.followups, c:"#f97316"},
                      {v:sp.moved,     c:"#06b6d4"},
                      {v:sp.won,       c:"#22c55e"},
                    ].filter(x=>x.v>0).map((x,i)=>(
                      <div key={i} style={{flex:x.v,background:x.c,minWidth:"4px"}}/>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

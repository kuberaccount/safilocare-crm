import { useState, useEffect } from "react";
import { getDeals, getContacts, getActivities } from "../lib/firebase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const STAGE_COLORS = { Lead: "#94a3b8", Qualified: "#60a5fa", Proposal: "#a78bfa", Negotiation: "#fbbf24", Won: "#34d399", Lost: "#f87171" };
const STATUS_COLORS = { Hot: "#f87171", Warm: "#fbbf24", Cold: "#60a5fa" };

export default function ReportsPage() {
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDeals(), getContacts(), getActivities()])
      .then(([d, c, a]) => { setDeals(d); setContacts(c); setActivities(a); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-center text-gray-400 text-sm py-20">Loading reports...</div>;

  // Pipeline by stage
  const stageData = ["Lead","Qualified","Proposal","Negotiation","Won","Lost"].map((s) => ({
    name: s,
    deals: deals.filter((d) => d.stage === s).length,
    value: deals.filter((d) => d.stage === s).reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0),
  })).filter((s) => s.deals > 0);

  // Contacts by status
  const statusData = ["Hot","Warm","Cold"].map((s) => ({
    name: s, value: contacts.filter((c) => c.status === s).length,
  })).filter((s) => s.value > 0);

  // Activity breakdown
  const activityData = ["Email","Call","Meeting","Note"].map((t) => ({
    name: t, count: activities.filter((a) => a.type === t).length,
  })).filter((a) => a.count > 0);

  const totalPipeline = deals.filter((d) => d.stage !== "Lost").reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
  const wonValue = deals.filter((d) => d.stage === "Won").reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
  const winRate = deals.length ? Math.round((deals.filter((d) => d.stage === "Won").length / deals.length) * 100) : 0;

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Reports</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total contacts", value: contacts.length, sub: `${contacts.filter(c=>c.status==="Hot").length} hot leads` },
          { label: "Total deals", value: deals.length, sub: `${deals.filter(d=>d.stage==="Won").length} won` },
          { label: "Pipeline value", value: `₹${totalPipeline.toLocaleString("en-IN")}`, sub: "Excluding lost" },
          { label: "Win rate", value: `${winRate}%`, sub: `₹${wonValue.toLocaleString("en-IN")} won` },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline by stage */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Deals by stage</h2>
          {stageData.length === 0 ? <p className="text-sm text-gray-300 py-8 text-center">No deals yet</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="deals" radius={[4, 4, 0, 0]}>
                  {stageData.map((entry) => <Cell key={entry.name} fill={STAGE_COLORS[entry.name]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Contacts by status */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Contacts by status</h2>
          {statusData.length === 0 ? <p className="text-sm text-gray-300 py-8 text-center">No contacts yet</p> : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="60%" height={200}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {statusData.map((entry) => <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[s.name] }} />
                    <span className="text-sm text-gray-600">{s.name}</span>
                    <span className="text-sm font-semibold text-gray-900 ml-auto">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Activity breakdown */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Activity breakdown</h2>
          {activityData.length === 0 ? <p className="text-sm text-gray-300 py-8 text-center">No activities yet</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activityData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={60} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="count" fill="#60a5fa" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pipeline value by stage */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Pipeline value by stage (₹)</h2>
          {stageData.length === 0 ? <p className="text-sm text-gray-300 py-8 text-center">No deals yet</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stageData.filter(s=>s.value>0)} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, "Value"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {stageData.map((entry) => <Cell key={entry.name} fill={STAGE_COLORS[entry.name]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

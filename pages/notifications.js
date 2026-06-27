import { useState, useEffect } from "react";
import { getDeals, getActivities } from "../lib/firebase";
import { exportToCSV } from "../lib/export";
import toast from "react-hot-toast";

const TYPE_COLOR = {
  followup: "bg-blue-50 border-blue-100",
  overdue: "bg-red-50 border-red-100",
  stale: "bg-amber-50 border-amber-100",
  new: "bg-green-50 border-green-100",
};

const FILTERS = ["All", "followup", "overdue", "stale"];
const FILTER_LABEL = { All: "All", followup: "Follow-ups", overdue: "Overdue", stale: "Stale leads" };

export default function NotificationsPage({ currentUser }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    load();
    const interval = setInterval(load, 120000); // Poll every 2 minutes
    return () => clearInterval(interval);
  }, []);

  async function load() {
    if (!currentUser) return;
    setLoading(true);
    const isAdmin = currentUser.role === "admin";
    const spFilter = isAdmin ? null : currentUser.salesperson;

    try {
      const [deals, activities] = await Promise.all([
        getDeals(spFilter),
        getActivities(spFilter),
      ]);

      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const notifs = [];

      // 1. Today's follow-ups from activities
      activities.forEach(a => {
        if (a.followUpDate === todayStr) {
          notifs.push({
            id: `act-${a.id}`,
            type: "followup",
            icon: "📅",
            title: `Follow-up due today`,
            body: `${a.type}: ${a.subject}${a.followUpTime ? ` at ${a.followUpTime}` : ""}`,
            time: a.followUpDate,
            urgent: false,
          });
        }
        // Overdue follow-ups
        if (a.followUpDate && a.followUpDate < todayStr) {
          notifs.push({
            id: `overdue-act-${a.id}`,
            type: "overdue",
            icon: "⚠️",
            title: `Overdue follow-up`,
            body: `${a.type}: ${a.subject} (was ${a.followUpDate})`,
            time: a.followUpDate,
            urgent: true,
          });
        }
      });

      // 2. Today's follow-ups from deals
      deals.filter(d => d.followUpDate === todayStr && !["Won","Lost"].includes(d.stage)).forEach(d => {
        notifs.push({
          id: `deal-fu-${d.id}`,
          type: "followup",
          icon: "📋",
          title: `Deal follow-up today`,
          body: `${d.title}${d.company ? ` — ${d.company}` : ""}`,
          time: d.followUpDate,
          urgent: false,
        });
      });

      // 3. Overdue deal follow-ups
      deals.filter(d => d.followUpDate && d.followUpDate < todayStr && !["Won","Lost"].includes(d.stage)).forEach(d => {
        notifs.push({
          id: `deal-overdue-${d.id}`,
          type: "overdue",
          icon: "🔴",
          title: `Overdue deal follow-up`,
          body: `${d.title} — due ${d.followUpDate}`,
          time: d.followUpDate,
          urgent: true,
        });
      });

      // 4. Leads with no activity in 7+ days (stale)
      const dealActivityMap = {};
      activities.forEach(a => {
        if (!dealActivityMap[a.dealId] || a.createdAt > dealActivityMap[a.dealId]) {
          dealActivityMap[a.dealId] = a.createdAt;
        }
      });
      deals.filter(d => !["Won","Lost"].includes(d.stage)).forEach(d => {
        const lastAct = dealActivityMap[d.id];
        const lastDate = lastAct?.toDate ? lastAct.toDate() : (d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || 0));
        const daysAgo = Math.floor((now - lastDate) / 86400000);
        if (daysAgo >= 7) {
          notifs.push({
            id: `stale-${d.id}`,
            type: "stale",
            icon: "😴",
            title: `No activity for ${daysAgo} days`,
            body: `${d.title}${d.company ? ` — ${d.company}` : ""} (${d.stage})`,
            time: null,
            urgent: daysAgo >= 14,
          });
        }
      });

      // Sort: urgent first, then by time
      notifs.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));

      setNotifications(notifs);
    } catch (e) {
      console.error("Notification load error:", e);
      toast.error("Could not load notifications");
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === "All" ? notifications : notifications.filter(n => n.type === filter);
  const urgentCount = notifications.filter(n => n.urgent).length;

  function handleExport() {
    if (filtered.length === 0) return toast.error("Nothing to export");
    try {
      exportToCSV(`notifications_${new Date().toISOString().split("T")[0]}.csv`, filtered, [
        { key: "type", label: "Type" },
        { key: "title", label: "Title" },
        { key: "body", label: "Detail" },
        { key: "time", label: "Date", value: r => r.time || "" },
        { key: "urgent", label: "Urgent", value: r => r.urgent ? "Yes" : "No" },
      ]);
      toast.success("Exported");
    } catch { toast.error("Export failed"); }
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500">
            {notifications.length} active{urgentCount > 0 && <span className="text-red-500"> · {urgentCount} urgent</span>}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleExport}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Export CSV
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filter === f ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading notifications...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-sm text-gray-500">All caught up!</p>
          <p className="text-xs text-gray-400 mt-1">No pending follow-ups or overdue tasks</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <div key={n.id} className={`rounded-lg border p-4 ${TYPE_COLOR[n.type] || "bg-gray-50 border-gray-100"}`}>
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">{n.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${n.urgent ? "text-red-700" : "text-gray-800"}`}>{n.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>
                  {n.time && <p className="text-xs text-gray-400 mt-1">{n.time}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-6">Auto-refreshes every 2 minutes</p>
    </div>
  );
}

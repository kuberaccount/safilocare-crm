import { useState, useEffect, useRef } from "react";
import { getDeals, getActivities } from "../lib/firebase";

export default function Notifications({ currentUser }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const lastChecked = useRef(localStorage.getItem("notif_checked") || "0");

  useEffect(() => {
    load();
    // Poll every 2 minutes
    const interval = setInterval(load, 120000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function load() {
    if (!currentUser) return;
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
      setUnread(notifs.filter(n => n.urgent || n.type === "followup").length);
    } catch (e) {
      console.error("Notification load error:", e);
    }
  }

  function markRead() {
    lastChecked.current = Date.now().toString();
    localStorage.setItem("notif_checked", lastChecked.current);
    setUnread(0);
    setOpen(false);
  }

  const TYPE_COLOR = {
    followup: "bg-blue-50 border-blue-100",
    overdue: "bg-red-50 border-red-100",
    stale: "bg-amber-50 border-amber-100",
    new: "bg-green-50 border-green-100",
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(!open); }}
        className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            {unread > 0 && (
              <button onClick={markRead} className="text-xs text-blue-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-sm text-gray-500">All caught up!</p>
                <p className="text-xs text-gray-400 mt-1">No pending follow-ups or overdue tasks</p>
              </div>
            ) : (
              <div className="p-2 space-y-1.5">
                {notifications.map(n => (
                  <div key={n.id} className={`rounded-lg border p-3 ${TYPE_COLOR[n.type] || "bg-gray-50 border-gray-100"}`}>
                    <div className="flex items-start gap-2">
                      <span className="text-base flex-shrink-0">{n.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${n.urgent ? "text-red-700" : "text-gray-800"}`}>{n.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5 truncate">{n.body}</p>
                        {n.time && <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-2 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">Auto-refreshes every 2 minutes</p>
          </div>
        </div>
      )}
    </div>
  );
}

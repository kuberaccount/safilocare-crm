import { useState, useEffect } from "react";
import { getDeals, getActivities } from "../lib/firebase";

// Lightweight bell + badge for the sidebar. Computes only a count
// (same urgent/followup rules as the Notifications page) and navigates
// to the full Notifications page on click — no popup.
export default function NotificationBell({ currentUser, onClick }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    load();
    const interval = setInterval(load, 120000); // Poll every 2 minutes
    return () => clearInterval(interval);
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
      let count = 0;

      activities.forEach(a => {
        if (a.followUpDate === todayStr) count++;
        if (a.followUpDate && a.followUpDate < todayStr) count++;
      });

      deals.filter(d => !["Won", "Lost"].includes(d.stage)).forEach(d => {
        if (d.followUpDate === todayStr) count++;
        if (d.followUpDate && d.followUpDate < todayStr) count++;
      });

      const dealActivityMap = {};
      activities.forEach(a => {
        if (!dealActivityMap[a.dealId] || a.createdAt > dealActivityMap[a.dealId]) {
          dealActivityMap[a.dealId] = a.createdAt;
        }
      });
      deals.filter(d => !["Won", "Lost"].includes(d.stage)).forEach(d => {
        const lastAct = dealActivityMap[d.id];
        const lastDate = lastAct?.toDate ? lastAct.toDate() : (d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || 0));
        const daysAgo = Math.floor((now - lastDate) / 86400000);
        if (daysAgo >= 7) count++;
      });

      setUnread(count);
    } catch (e) {
      console.error("Notification bell load error:", e);
    }
  }

  return (
    <button onClick={onClick} title="Notifications"
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
  );
}

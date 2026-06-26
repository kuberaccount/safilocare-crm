import { useState } from "react";
import Layout from "../components/Layout";
import ContactsPage from "./contacts";
import PipelinePage from "./pipeline";
import ActivitiesPage from "./activities";
import ReportsPage from "./reports";

export default function Dashboard({ user }) {
  const [page, setPage] = useState("dashboard");

  const pages = {
    contacts: <ContactsPage />,
    pipeline: <PipelinePage />,
    activities: <ActivitiesPage />,
    reports: <ReportsPage />,
  };

  return (
    <Layout user={user} active={page} onNav={setPage}>
      {page === "dashboard" ? <DashboardHome onNav={setPage} /> : pages[page]}
    </Layout>
  );
}

function StatCard({ label, value, sub, color = "blue", icon }) {
  const colors = { blue: "bg-blue-50 text-blue-600", green: "bg-green-50 text-green-600", amber: "bg-amber-50 text-amber-600", purple: "bg-purple-50 text-purple-600" };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={icon} />
          </svg>
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-green-600 mt-1">{sub}</p>}
    </div>
  );
}

function DashboardHome({ onNav }) {
  const quickActions = [
    { label: "Add contact", page: "contacts", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
    { label: "View pipeline", page: "pipeline", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { label: "Log activity", page: "activities", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { label: "See reports", page: "reports", icon: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Welcome back 👋</h1>
        <p className="text-sm text-gray-500 mt-1">Here's what's happening with your leads today.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total contacts" value="—" sub="Add your first contact" color="blue" icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        <StatCard label="Active deals" value="—" color="amber" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        <StatCard label="Pipeline value" value="—" color="green" icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <StatCard label="Activities logged" value="—" color="purple" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </div>

      <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick actions</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {quickActions.map((a) => (
          <button key={a.page} onClick={() => onNav(a.page)} className="card p-4 text-left hover:shadow-md transition-all group">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={a.icon} />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800">{a.label}</p>
          </button>
        ))}
      </div>

      <div className="mt-8 card p-5 bg-blue-600 text-white border-0">
        <h3 className="font-semibold mb-1">🚀 You're all set!</h3>
        <p className="text-sm text-blue-100">Your CRM is live at crm.safilocare.com. Start by adding your first contacts and deals.</p>
      </div>
    </div>
  );
}

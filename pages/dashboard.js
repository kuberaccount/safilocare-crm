import { useState } from "react";
import Layout from "../components/Layout";
import ContactsPage from "./contacts";
import PipelinePage from "./pipeline";
import ActivitiesPage from "./activities";
import ReportsPage from "./reports";
import AdminPage from "./admin";

export default function Dashboard({ user, userData }) {
  const [page, setPage] = useState("dashboard");
  const isAdmin = userData?.role === "admin";

  const pages = {
    contacts: <ContactsPage currentUser={userData} />,
    pipeline: <PipelinePage currentUser={userData} />,
    activities: <ActivitiesPage currentUser={userData} />,
    reports: <ReportsPage currentUser={userData} />,
    ...(isAdmin ? { admin: <AdminPage /> } : {}),
  };

  return (
    <Layout user={user} userData={userData} active={page} onNav={setPage} isAdmin={isAdmin}>
      {page === "dashboard" ? <DashboardHome onNav={setPage} user={user} userData={userData} /> : pages[page]}
    </Layout>
  );
}

function DashboardHome({ onNav, user, userData }) {
  const isAdmin = userData?.role === "admin";
  const quickActions = [
    { label:"Contacts", page:"contacts", icon:"M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", color:"bg-blue-50 text-blue-600" },
    { label:"Pipeline", page:"pipeline", icon:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", color:"bg-amber-50 text-amber-600" },
    { label:"Activities", page:"activities", icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", color:"bg-green-50 text-green-600" },
    { label:"Reports", page:"reports", icon:"M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z", color:"bg-purple-50 text-purple-600" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Welcome, {user.displayName?.split(" ")[0]} 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isAdmin ? "Admin — full access" : `Salesperson: ${userData?.salesperson || "Unassigned"}`}
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {quickActions.map(a=>(
          <button key={a.page} onClick={()=>onNav(a.page)} className="card p-4 text-left hover:shadow-md transition-all">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${a.color}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={a.icon}/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800">{a.label}</p>
          </button>
        ))}
      </div>
      {isAdmin && (
        <button onClick={()=>onNav("admin")} className="card p-4 w-full text-left hover:shadow-md transition-all flex items-center gap-3 border-blue-100">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">⚙️</div>
          <div>
            <p className="text-sm font-medium text-gray-800">Admin Panel</p>
            <p className="text-xs text-gray-400">Manage users, approvals, salespersons</p>
          </div>
        </button>
      )}
    </div>
  );
}

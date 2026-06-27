import { useState } from "react";
import Layout from "../components/Layout";
import ContactsPage from "./contacts";
import PipelinePage from "./pipeline";
import ActivitiesPage from "./activities";
import ReportsPage from "./reports";
import AdminPage from "./admin";

export default function Dashboard({ user }) {
  const [page, setPage] = useState("dashboard");
  const pages = { contacts:<ContactsPage/>, pipeline:<PipelinePage/>, activities:<ActivitiesPage/>, reports:<ReportsPage/>, admin:<AdminPage/> };
  return (
    <Layout user={user} active={page} onNav={setPage}>
      {page==="dashboard" ? <DashboardHome onNav={setPage} user={user}/> : pages[page]}
    </Layout>
  );
}

function DashboardHome({ onNav, user }) {
  const quickActions = [
    { label:"Add contact", page:"contacts", icon:"M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z", color:"bg-blue-50 text-blue-600" },
    { label:"View pipeline", page:"pipeline", icon:"M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z", color:"bg-amber-50 text-amber-600" },
    { label:"Log activity", page:"activities", icon:"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", color:"bg-green-50 text-green-600" },
    { label:"Admin panel", page:"admin", icon:"M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z", color:"bg-purple-50 text-purple-600" },
  ];
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Welcome, {user.displayName?.split(" ")[0]} 👋</h1>
        <p className="text-sm text-gray-500 mt-1">Here's your Safilocare CRM overview.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {quickActions.map(a=>(
          <button key={a.page} onClick={()=>onNav(a.page)} className="card p-4 text-left hover:shadow-md transition-all group">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${a.color}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={a.icon}/>
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-800">{a.label}</p>
          </button>
        ))}
      </div>
      <div className="card p-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0">
        <h3 className="font-semibold mb-1">✅ All features active</h3>
        <div className="text-sm text-blue-100 mt-2 grid grid-cols-2 gap-1">
          <span>✓ User approval system</span>
          <span>✓ Duplicate phone check</span>
          <span>✓ Export contacts to CSV</span>
          <span>✓ Salesperson-wise filter</span>
          <span>✓ Drag & drop pipeline</span>
          <span>✓ Log activity from pipeline</span>
          <span>✓ Edit deals & contacts</span>
          <span>✓ Firebase (Google) database</span>
        </div>
      </div>
    </div>
  );
}

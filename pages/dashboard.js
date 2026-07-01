import { useState } from "react";
import Layout from "../components/Layout";
import ContactsPage from "./contacts";
import PipelinePage from "./pipeline";
import ActivitiesPage from "./activities";
import ReportsPage from "./reports";
import AdminPage from "./admin";
import TeamReportPage from "./teamreport";

export default function Dashboard({ user, userData }) {
  const [page, setPage] = useState("dashboard");
  const isAdmin = userData?.role === "admin";

  // Guard: don't render until user is available
  if (!user) return null;

  const pages = {
    contacts:   <ContactsPage currentUser={userData} />,
    pipeline:   <PipelinePage currentUser={userData} />,
    activities: <ActivitiesPage currentUser={userData} />,
    reports:    <ReportsPage currentUser={userData} />,
    ...(isAdmin ? { admin: <AdminPage />, teamreport: <TeamReportPage /> } : {}),
  };

  return (
    <Layout user={user} userData={userData} active={page} onNav={setPage} isAdmin={isAdmin}>
      {page === "dashboard"
        ? <DashboardHome onNav={setPage} user={user} userData={userData} isAdmin={isAdmin} />
        : pages[page]}
    </Layout>
  );
}

const QUICK = [
  { label:"Contacts",   page:"contacts",   emoji:"👥", desc:"Manage your B2B leads",      grad:"linear-gradient(135deg,#6366f1,#8b5cf6)" },
  { label:"Pipeline",   page:"pipeline",   emoji:"📊", desc:"Track deals & stages",        grad:"linear-gradient(135deg,#f59e0b,#ef4444)" },
  { label:"Activities", page:"activities", emoji:"📝", desc:"Emails, calls, meetings",     grad:"linear-gradient(135deg,#10b981,#059669)" },
  { label:"Reports",    page:"reports",    emoji:"📈", desc:"Analytics & insights",        grad:"linear-gradient(135deg,#3b82f6,#6366f1)" },
];

function DashboardHome({ onNav, user, userData, isAdmin }) {
  if (!user) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user.displayName?.split(" ")[0] || "Welcome";

  return (
    <div style={{ minHeight:"100%", background:"#f8fafc" }}>

      {/* Hero banner */}
      <div style={{ background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%)", padding:"32px 28px 28px", position:"relative", overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ position:"absolute", top:"-40px", right:"-40px", width:"200px", height:"200px", borderRadius:"50%", background:"rgba(99,102,241,0.15)" }}/>
        <div style={{ position:"absolute", bottom:"-20px", left:"30%", width:"120px", height:"120px", borderRadius:"50%", background:"rgba(139,92,246,0.1)" }}/>
        {/* Left — greeting */}
        <div style={{position:"relative",zIndex:1}}>
          <p style={{ fontSize:"13px", color:"#a5b4fc", margin:"0 0 4px", fontWeight:500 }}>{greeting} 👋</p>
          <h1 style={{ fontSize:"24px", fontWeight:800, color:"white", margin:"0 0 4px" }}>{firstName}</h1>
          <p style={{ fontSize:"13px", color:"#94a3b8", margin:0 }}>
            {isAdmin ? "Admin — full access to all data" : `Salesperson · ${userData?.salesperson || "Unassigned"}`}
          </p>
        </div>
        {/* Right — motivational line. To change it, just edit the text below. */}
        <div style={{position:"relative",zIndex:1,textAlign:"center",flexShrink:0,maxWidth:"320px"}}>
          <p style={{
            margin:10,
            fontSize:"15px",
            fontWeight:700,
            color:"#a5b4fc",
            letterSpacing:"0.08em",
            lineHeight:1.6,
            textTransform:"uppercase",
          }}>
            NO TIMELINE · NO WORK · NO RESULT
          </p>
        </div>
      </div>

      <div style={{ padding:"24px" }}>
        <p style={{ fontSize:"12px", fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 14px" }}>Quick access</p>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:"12px", marginBottom:"20px" }}>
          {QUICK.map(q => (
            <button key={q.page} onClick={() => onNav(q.page)}
              style={{ background:"white", border:"1px solid #e2e8f0", borderRadius:"14px", padding:"16px", textAlign:"left", cursor:"pointer", transition:"all 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}
              onMouseOver={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.1)"; }}
              onMouseOut={e  => { e.currentTarget.style.transform="translateY(0)";   e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.05)"; }}>
              <div style={{ width:"38px", height:"38px", borderRadius:"10px", background:q.grad, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", marginBottom:"10px" }}>
                {q.emoji}
              </div>
              <p style={{ fontSize:"14px", fontWeight:700, color:"#0f172a", margin:"0 0 2px" }}>{q.label}</p>
              <p style={{ fontSize:"12px", color:"#94a3b8", margin:0 }}>{q.desc}</p>
            </button>
          ))}
        </div>

        {isAdmin && (
          <button onClick={() => onNav("admin")}
            style={{ width:"100%", background:"linear-gradient(135deg,#0f172a,#1e1b4b)", border:"none", borderRadius:"14px", padding:"16px 20px", textAlign:"left", cursor:"pointer", display:"flex", alignItems:"center", gap:"14px", transition:"all 0.2s" }}
            onMouseOver={e => e.currentTarget.style.opacity="0.9"}
            onMouseOut={e  => e.currentTarget.style.opacity="1"}>
            <div style={{ width:"38px", height:"38px", borderRadius:"10px", background:"rgba(99,102,241,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 }}>⚙️</div>
            <div>
              <p style={{ fontSize:"14px", fontWeight:700, color:"white", margin:"0 0 2px" }}>Admin Panel</p>
              <p style={{ fontSize:"12px", color:"#94a3b8", margin:0 }}>Approve users, manage salespersons, pre-approve by email</p>
            </div>
            <svg style={{ marginLeft:"auto", flexShrink:0 }} width="16" height="16" fill="none" stroke="#6366f1" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

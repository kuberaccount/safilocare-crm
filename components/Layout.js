import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { useState } from "react";

const NAV_ALL = [
  { key:"dashboard", label:"Dashboard", icon:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg> },
  { key:"contacts", label:"Contacts", icon:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
  { key:"pipeline", label:"Pipeline", icon:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
  { key:"activities", label:"Activities", icon:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg> },
  { key:"reports", label:"Reports", icon:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/></svg> },
  { key:"admin", label:"Admin", adminOnly:true, icon:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
];

const AVATAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6"];
function colorFromName(name) { let h=0; for(let c of (name||"")) h=c.charCodeAt(0)+((h<<5)-h); return AVATAR_COLORS[Math.abs(h)%AVATAR_COLORS.length]; }

export default function Layout({ user, userData, active, onNav, isAdmin, children }) {
  if (!user) return <>{children}</>;
  const NAV = NAV_ALL.filter(n => !n.adminOnly || isAdmin);
  const bg = colorFromName(user.displayName);

  return (
    <div className="flex h-screen overflow-hidden" style={{background:"#f8fafc"}}>

      {/* ── Dark Sidebar ───────────────────────────────── */}
      <aside style={{
        width:"220px", flexShrink:0, display:"flex", flexDirection:"column",
        background:"linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)",
        borderRight:"1px solid rgba(255,255,255,0.06)"
      }}>

        {/* Logo */}
        <div style={{padding:"20px 16px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex", alignItems:"center", gap:"10px"}}>
            <div style={{
              width:"34px", height:"34px", borderRadius:"10px", flexShrink:0,
              background:"linear-gradient(135deg, #6366f1, #8b5cf6)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 4px 12px rgba(99,102,241,0.4)"
            }}>
              <svg width="18" height="18" fill="none" stroke="white" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16"/>
              </svg>
            </div>
            <div>
              <p style={{fontSize:"14px", fontWeight:600, color:"#f1f5f9", margin:0}}>Safilocare</p>
              <p style={{fontSize:"11px", color:"#6366f1", margin:0, fontWeight:500}}>CRM Pro</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{flex:1, padding:"12px 8px", overflowY:"auto"}}>
          <p style={{fontSize:"10px", color:"#475569", fontWeight:600, letterSpacing:"0.08em", padding:"4px 8px 8px", textTransform:"uppercase"}}>Menu</p>
          {NAV.map(n => {
            const isActive = active === n.key;
            return (
              <button key={n.key} onClick={() => onNav(n.key)} className="sidebar-link w-full text-left"
                style={isActive ? {
                  background:"rgba(99,102,241,0.2)",
                  color:"#a5b4fc",
                  borderLeft:"3px solid #6366f1",
                  paddingLeft:"9px",
                  borderRadius:"0 8px 8px 0",
                } : {}}>
                <span style={{opacity: isActive ? 1 : 0.7}}>{n.icon}</span>
                {n.label}
                {n.key === "admin" && <span style={{marginLeft:"auto", fontSize:"10px", background:"rgba(239,68,68,0.2)", color:"#fca5a5", padding:"1px 6px", borderRadius:"20px"}}>⚙</span>}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={{padding:"12px", borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex", alignItems:"center", gap:"8px", padding:"8px", borderRadius:"10px", background:"rgba(255,255,255,0.04)"}}>
            {user.photoURL
              ? <img src={user.photoURL} alt="" style={{width:"30px", height:"30px", borderRadius:"50%", border:"2px solid rgba(99,102,241,0.5)"}}/>
              : <div style={{width:"30px", height:"30px", borderRadius:"50%", background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:700, color:"white", flexShrink:0}}>
                  {user.displayName?.charAt(0)||"?"}
                </div>
            }
            <div style={{flex:1, minWidth:0}}>
              <p style={{fontSize:"12px", fontWeight:500, color:"#e2e8f0", margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{user.displayName||"User"}</p>
              <p style={{fontSize:"10px", color:"#6366f1", margin:0, fontWeight:500}}>{isAdmin?"Admin":userData?.salesperson||"CRM"}</p>
            </div>
            <button onClick={() => signOut(auth)} title="Sign out"
              style={{color:"#475569", background:"none", border:"none", cursor:"pointer", padding:"4px"}}
              onMouseOver={e=>e.currentTarget.style.color="#94a3b8"}
              onMouseOut={e=>e.currentTarget.style.color="#475569"}>
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────── */}
      <main style={{flex:1, overflowY:"auto", overflowX:"hidden"}} className="fade-in">
        {children}
      </main>
    </div>
  );
}

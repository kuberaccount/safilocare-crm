import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { useState, useEffect } from "react";
import { getDeals } from "../lib/firebase";

const NAV_ALL = [
  { key:"dashboard",  label:"Dashboard",  icon:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg> },
  { key:"contacts",   label:"Contacts",   icon:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
  { key:"pipeline",   label:"Pipeline",   icon:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
  { key:"activities", label:"Activities", icon:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg> },
  { key:"reports",    label:"Reports",    icon:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/></svg> },
  { key:"admin", label:"Admin", adminOnly:true, icon:<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
];

const AVATAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6"];
function colorFromName(name) { let h=0; for(let c of (name||"")) h=c.charCodeAt(0)+((h<<5)-h); return AVATAR_COLORS[Math.abs(h)%AVATAR_COLORS.length]; }

function parseFollowUpDate(str) {
  if (!str) return null;
  if (str.includes("-") && str.split("-")[0].length === 2) {
    const [d,m,y] = str.split("-"); return new Date(`${y}-${m}-${d}`);
  }
  return new Date(str);
}

export default function Layout({ user, userData, active, onNav, isAdmin, children }) {
  if (!user) return <>{children}</>;

  const [showBell, setShowBell] = useState(false);
  const [todayDeals, setTodayDeals] = useState([]);
  const [overdueDeals, setOverdueDeals] = useState([]);

  useEffect(() => {
    async function loadReminders() {
      try {
        const sp = userData?.role !== "admin" ? userData?.salesperson : null;
        const deals = await getDeals(sp);
        const today = new Date(new Date().toDateString());
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
        const td = [], od = [];
        deals.filter(d => !["Won","Lost"].includes(d.stage) && d.followUpDate).forEach(d => {
          const fd = parseFollowUpDate(d.followUpDate);
          if (!fd || isNaN(fd)) return;
          if (fd < today) od.push(d);
          else if (fd >= today && fd < tomorrow) td.push(d);
        });
        setTodayDeals(td); setOverdueDeals(od);
      } catch(e) { console.error(e); }
    }
    loadReminders();
  }, []);

  const totalAlerts = todayDeals.length + overdueDeals.length;
  const NAV = NAV_ALL.filter(n => !n.adminOnly || isAdmin);
  const avatarBg = colorFromName(user.displayName);

  return (
    <div className="flex h-screen overflow-hidden" style={{background:"#f8fafc"}}>

      {/* ── Dark Sidebar ─────────────────────────────── */}
      <aside style={{width:"220px",flexShrink:0,display:"flex",flexDirection:"column",background:"linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%)",borderRight:"1px solid rgba(255,255,255,0.06)"}}>

        {/* Logo */}
<div
  style={{
    padding: "18px 16px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.06)"
  }}
>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "10px"
    }}
  >
   <img
      src="/logo.png"
      alt="Logo"
      style={{
        width: "34px",
        height: "34px",
        borderRadius: "10px",
        objectFit: "contain"
      }}
    />

    <div>
      <p
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: "#f1f5f9",
          margin: 0,
          letterSpacing: "-0.01em"
        }}
      >
        Safilo Healthcare
      </p>

      <p
        style={{
          fontSize: "10px",
          color: "#6366f1",
          margin: 0,
          fontWeight: 600,
          letterSpacing: "0.05em"
        }}
      >
        CRM
      </p>
    </div>
  </div>
</div>

        {/* Nav */}
        <nav style={{flex:1,padding:"12px 8px",overflowY:"auto"}}>
          <p style={{fontSize:"10px",color:"#334155",fontWeight:700,letterSpacing:"0.1em",padding:"4px 8px 10px",textTransform:"uppercase"}}>Menu</p>
          {NAV.map(n => {
            const isActive = active === n.key;
            return (
              <button key={n.key} onClick={() => onNav(n.key)}
                className="sidebar-link w-full text-left"
                style={isActive ? {background:"rgba(99,102,241,0.2)",color:"#a5b4fc",borderLeft:"3px solid #6366f1",paddingLeft:"9px",borderRadius:"0 8px 8px 0"} : {}}>
                <span style={{opacity:isActive?1:0.65}}>{n.icon}</span>
                {n.label}
                {n.key==="admin" && <span style={{marginLeft:"auto",fontSize:"10px",background:"rgba(239,68,68,0.2)",color:"#fca5a5",padding:"1px 6px",borderRadius:"20px"}}>⚙</span>}
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div style={{padding:"10px",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 10px",borderRadius:"10px",background:"rgba(255,255,255,0.04)"}}>
            {user.photoURL
              ? <img src={user.photoURL} alt="" style={{width:"30px",height:"30px",borderRadius:"50%",border:"2px solid rgba(99,102,241,0.5)",flexShrink:0}}/>
              : <div style={{width:"30px",height:"30px",borderRadius:"50%",background:avatarBg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:700,color:"white",flexShrink:0}}>
                  {user.displayName?.charAt(0)||"?"}
                </div>
            }
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:"12px",fontWeight:600,color:"#e2e8f0",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.displayName||"User"}</p>
              <p style={{fontSize:"10px",color:"#6366f1",margin:0,fontWeight:600}}>{isAdmin?"Admin":userData?.salesperson||"CRM"}</p>
            </div>
            <button onClick={() => signOut(auth)} title="Sign out"
              style={{color:"#475569",background:"none",border:"none",cursor:"pointer",padding:"4px",flexShrink:0}}
              onMouseOver={e=>e.currentTarget.style.color="#94a3b8"} onMouseOut={e=>e.currentTarget.style.color="#475569"}>
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Top bar with bell */}
        <div style={{height:"48px",background:"white",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"flex-end",padding:"0 20px",gap:"12px",flexShrink:0}}>

          {/* Bell button */}
          <div style={{position:"relative"}}>
            <button onClick={()=>setShowBell(v=>!v)}
              style={{width:"36px",height:"36px",borderRadius:"10px",border:"1px solid #e2e8f0",background:showBell?"#eef2ff":"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:totalAlerts>0?"#6366f1":"#94a3b8",transition:"all 0.15s"}}
              title="Follow-up reminders">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              {totalAlerts > 0 && (
                <span style={{position:"absolute",top:"-4px",right:"-4px",width:"18px",height:"18px",borderRadius:"50%",background:"#ef4444",color:"white",fontSize:"10px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid white"}}>
                  {totalAlerts > 9 ? "9+" : totalAlerts}
                </span>
              )}
            </button>

            {/* Bell dropdown */}
            {showBell && (
              <div style={{position:"absolute",right:0,top:"44px",width:"320px",background:"white",borderRadius:"14px",border:"1px solid #e2e8f0",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",zIndex:100,overflow:"hidden"}}>
                <div style={{padding:"14px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <p style={{fontSize:"13px",fontWeight:700,color:"#0f172a",margin:0}}>Follow-up Reminders</p>
                  <span style={{fontSize:"11px",color:"#94a3b8"}}>{totalAlerts} alert{totalAlerts!==1?"s":""}</span>
                </div>

                <div style={{maxHeight:"340px",overflowY:"auto"}}>
                  {todayDeals.length > 0 && (
                    <div>
                      <p style={{fontSize:"10px",fontWeight:700,color:"#059669",textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px 16px 4px",margin:0,background:"#f0fdf4"}}>📅 Today</p>
                      {todayDeals.map(d=>(
                        <div key={d.id} style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc",cursor:"pointer"}}
                          onClick={()=>{onNav("pipeline");setShowBell(false);}}>
                          <p style={{fontSize:"13px",fontWeight:600,color:"#0f172a",margin:"0 0 2px"}}>{d.title}</p>
                          <p style={{fontSize:"11px",color:"#64748b",margin:0}}>{d.contact||""} · {d.salesperson||"Unassigned"}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {overdueDeals.length > 0 && (
                    <div>
                      <p style={{fontSize:"10px",fontWeight:700,color:"#dc2626",textTransform:"uppercase",letterSpacing:"0.08em",padding:"10px 16px 4px",margin:0,background:"#fef2f2"}}>⚠️ Overdue</p>
                      {overdueDeals.map(d=>(
                        <div key={d.id} style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc",cursor:"pointer"}}
                          onClick={()=>{onNav("pipeline");setShowBell(false);}}>
                          <p style={{fontSize:"13px",fontWeight:600,color:"#0f172a",margin:"0 0 2px"}}>{d.title}</p>
                          <p style={{fontSize:"11px",color:"#94a3b8",margin:0}}>{d.contact||""} · {d.salesperson||"Unassigned"} · <span style={{color:"#dc2626",fontWeight:600}}>Overdue</span></p>
                        </div>
                      ))}
                    </div>
                  )}

                  {totalAlerts === 0 && (
                    <div style={{padding:"30px 16px",textAlign:"center"}}>
                      <p style={{fontSize:"24px",margin:"0 0 8px"}}>✅</p>
                      <p style={{fontSize:"13px",color:"#94a3b8",margin:0}}>No follow-ups due today!</p>
                    </div>
                  )}
                </div>

                <div style={{padding:"10px 16px",borderTop:"1px solid #f1f5f9",background:"#f8fafc"}}>
                  <p style={{fontSize:"11px",color:"#94a3b8",margin:0,textAlign:"center"}}>Click any item to go to Pipeline</p>
                </div>
              </div>
            )}
          </div>

          {/* Current page label */}
          <p style={{fontSize:"13px",color:"#94a3b8",margin:0,textTransform:"capitalize"}}>{active}</p>
        </div>

        <main style={{flex:1,overflowY:"auto",overflowX:"hidden"}} className="fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}

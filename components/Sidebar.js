// components/Sidebar.js
import Link from "next/link";
import { useRouter } from "next/router";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { useAuth } from "../pages/_app";

const NavItem = ({ href, label, icon }) => {
  const router = useRouter();
  const active = router.pathname === href;
  return (
    <Link href={href} className={`nav-item${active ? " active" : ""}`}>
      {icon}
      {label}
    </Link>
  );
};

export default function Sidebar() {
  const user = useAuth();
  const initials = user?.displayName
    ? user.displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        SafiloCareCRM
      </div>

      <div className="nav-section">
        <div className="nav-label">Menu</div>
        <NavItem href="/" label="Dashboard" icon={<IconDashboard />} />
        <NavItem href="/contacts" label="Contacts" icon={<IconUsers />} />
        <NavItem href="/pipeline" label="Pipeline" icon={<IconPipeline />} />
        <NavItem href="/activities" label="Activities" icon={<IconActivity />} />
        <NavItem href="/reports" label="Reports" icon={<IconChart />} />
      </div>

      <div className="sidebar-footer">
        <div className="user-pill">
          <div className="avatar">
            {user?.photoURL
              ? <img src={user.photoURL} alt="" />
              : initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.displayName || "User"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.email}
            </div>
          </div>
        </div>
        <button
          onClick={() => signOut(auth)}
          className="btn"
          style={{ width: "100%", marginTop: 6, justifyContent: "center", fontSize: 12 }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}

// Inline SVG icons
const IconDashboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IconPipeline = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="7" width="5" height="14" rx="1"/><rect x="17" y="11" width="5" height="10" rx="1"/>
  </svg>
);
const IconActivity = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);
const IconChart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);

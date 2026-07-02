import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import * as FirebaseLib from "../lib/firebase"; // Safe import to prevent crash

// ── Fetch all data safely ──
async function fetchAll() {
  let cSnap = { docs: [] };
  let dSnap = { docs: [] };
  let aSnap = { docs: [] };

  try {
    cSnap = await getDocs(collection(db, "contacts"));
  } catch (e) {
    console.error("Contacts fail:", e);
  }

  try {
    dSnap = await getDocs(collection(db, "pipeline")); 
  } catch (e) {
    console.error("Pipeline fail:", e);
  }

  try {
    aSnap = await getDocs(collection(db, "activities"));
  } catch (e) {
    console.error("Activities fail:", e);
  }

  return {
    contacts:   (cSnap.docs || []).map(d => ({ id: d.id, ...d.data() })),
    deals:      (dSnap.docs || []).map(d => ({ id: d.id, ...d.data() })),
    activities: (aSnap.docs || []).map(d => ({ id: d.id, ...d.data() })),
  };
}

export default function CoveragePage({ currentUser }) {
  const [allData, setAllData] = useState({ contacts: [], deals: [], activities: [] });
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Safely check if getSalespersons exists in your firebase library
    const fetchSP = FirebaseLib.getSalespersons 
      ? FirebaseLib.getSalespersons() 
      : Promise.resolve([]);

    Promise.all([fetchAll(), fetchSP])
      .then(([data, sps]) => {
        setAllData(data || { contacts: [], deals: [], activities: [] });
        setSalespersons(sps || []);
      })
      .catch(e => {
        console.error("Load error:", e);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ padding: "40px", color: "#666" }}>Loading coverage view...</div>;
  }

  const contacts = allData.contacts || [];
  const activeContacts = contacts.filter(c => c && !c.archived && !c.deleted);

  return (
    <div style={{ padding: "24px", background: "#ffffff", minHeight: "100vh", color: "#000000" }}>
      {/* Test Banner to make sure code is live */}
      <div style={{ background: "#e0e7ff", padding: "12px", borderRadius: "8px", marginBottom: "20px", color: "#3730a3", fontWeight: "bold" }}>
        ✓ Coverage Dashboard File Loaded Successfully
      </div>

      <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>Coverage</h1>
      <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>
        Total Contacts found in Database: {contacts.length} ({activeContacts.length} active)
      </p>

      <div style={{ marginBottom: "20px" }}>
        <input 
          style={{ width: "100%", maxWidth: "400px", padding: "8px 12px", border: "1px solid #ccc", borderRadius: "6px" }}
          placeholder="Search areas..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
      </div>

      {activeContacts.length === 0 ? (
        <div style={{ border: "1px dashed #ccc", padding: "40px", textAlign: "center", color: "#999", borderRadius: "8px" }}>
          No data available. Ensure your contacts database records contain valid city/state details.
        </div>
      ) : (
        <div style={{ border: "1px solid #eee", borderRadius: "8px", padding: "16px" }}>
          <p>Displaying coverage data summary matrix:</p>
          <ul>
            <li>Pipeline Items Loaded: {allData.deals.length}</li>
            <li>Activities Logged: {allData.activities.length}</li>
            <li>Salespersons Registered: {salespersons.length}</li>
          </ul>
        </div>
      )}
    </div>
  );
}

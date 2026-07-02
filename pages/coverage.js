import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function Coverage() {
  const [contacts, setContacts] = useState([]);
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Fetch the data directly from Firebase
  useEffect(() => {
    async function loadData() {
      try {
        const contactsSnapshot = await getDocs(collection(db, "contacts"));
        const pipelineSnapshot = await getDocs(collection(db, "pipeline"));

        const loadedContacts = contactsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const loadedPipeline = pipelineSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setContacts(loadedContacts);
        setPipeline(loadedPipeline);
      } catch (error) {
        console.error("Error loading coverage data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "40px", fontFamily: "sans-serif", color: "#666", textAlign: "center" }}>
        <div style={{ fontSize: "18px", fontWeight: "600" }}>Loading coverage mapping...</div>
      </div>
    );
  }

  // 2. Filter out deleted or archived items to keep numbers accurate
  const activeContacts = contacts.filter(c => c && !c.archived && !c.deleted);

  // 3. Group everything by Location (State + City + Pincode)
  const locationMap = {};

  activeContacts.forEach(contact => {
    const state = (contact.state || "Unknown State").trim().toUpperCase();
    const city = (contact.city || "Unknown City").trim().toUpperCase();
    const pincode = (contact.pincode || "—").trim();
    const key = `${state}|${city}|${pincode}`;

    if (!locationMap[key]) {
      locationMap[key] = {
        state,
        city,
        pincode,
        contactCount: 0,
        salespersons: new Set(),
        customerList: []
      };
    }

    locationMap[key].contactCount += 1;
    if (contact.salesperson && contact.salesperson !== "Unassigned") {
      locationMap[key].salespersons.add(contact.salesperson);
    }
    locationMap[key].customerList.push(contact);
  });

  // Convert the map object into a clean array list
  const allLocations = Object.values(locationMap);

  // 4. Apply the Search Filtering
  const cleanQuery = searchQuery.trim().toLowerCase();
  const filteredLocations = allLocations.filter(loc => {
    return (
      loc.city.toLowerCase().includes(cleanQuery) ||
      loc.pincode.toLowerCase().includes(cleanQuery) ||
      loc.state.toLowerCase().includes(cleanQuery)
    );
  });

  return (
    <div style={{ padding: "30px", fontFamily: "sans-serif", backgroundColor: "#f9fafb", minHeight: "100vh", color: "#111827" }}>
      
      {/* Page Title */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "700", margin: "0 0 6px 0", color: "#111827" }}>Lead Assignment & Coverage</h1>
        <p style={{ margin: 0, fontSize: "14px", color: "#4b5563" }}>
          Search by city or pincode to check existing team coverage before assigning new leads.
        </p>
      </div>

      {/* Metrics Counter Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600", textTransform: "uppercase" }}>Total CRM Contacts</div>
          <div style={{ fontSize: "22px", fontWeight: "700", marginTop: "4px", color: "#312e81" }}>{activeContacts.length}</div>
        </div>
        <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600", textTransform: "uppercase" }}>Unique Areas Covered</div>
          <div style={{ fontSize: "22px", fontWeight: "700", marginTop: "4px", color: "#065f46" }}>{allLocations.length}</div>
        </div>
      </div>

      {/* Search Field Box */}
      <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "20px", border: "1px solid #e5e7eb" }}>
        <input
          style={{
            width: "100%",
            padding: "12px 16px",
            fontSize: "14px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            boxSizing: "border-box",
            outline: "none"
          }}
          placeholder="Type Pincode or City name here (e.g., 395003 or SURAT)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Main Breakdown Table Card */}
      <div style={{ backgroundColor: "#fff", borderRadius: "10px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden", border: "1px solid #e5e7eb" }}>
        {filteredLocations.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
            No matching region data found. Try searching another city or pincode.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", textAlign: "left" }}>
            <thead>
              <tr style={{ backgroundColor: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "12px 16px", color: "#374151", fontWeight: "600" }}>City</th>
                <th style={{ padding: "12px 16px", color: "#374151", fontWeight: "600" }}>State</th>
                <th style={{ padding: "12px 16px", color: "#374151", fontWeight: "600" }}>Pincode</th>
                <th style={{ padding: "12px 16px", color: "#374151", fontWeight: "600" }}>Active Contacts</th>
                <th style={{ padding: "12px 16px", color: "#374151", fontWeight: "600" }}>Assigned Salesperson(s)</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocations.map((loc, idx) => {
                const spList = Array.from(loc.salespersons);
                return (
                  <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "14px 16px", fontWeight: "600", color: "#111827" }}>{loc.city}</td>
                    <td style={{ padding: "14px 16px", color: "#4b5563" }}>{loc.state}</td>
                    <td style={{ padding: "14px 16px", fontFamily: "monospace", color: "#111827", fontWeight: "600" }}>{loc.pincode}</td>
                    <td style={{ padding: "14px 16px", color: "#111827", fontWeight: "700" }}>
                      <span style={{ backgroundColor: "#e0e7ff", color: "#3730a3", padding: "2px 8px", borderRadius: "12px", fontSize: "12px" }}>
                        {loc.contactCount} contacts
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      {spList.length > 0 ? (
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {spList.map((sp, sIdx) => (
                            <span key={sIdx} style={{ backgroundColor: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", padding: "2px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "500" }}>
                              👤 {sp}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#9ca3af", fontStyle: "italic", fontSize: "13px" }}>No salesperson assigned</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

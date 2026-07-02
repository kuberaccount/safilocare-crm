import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  getContacts,
  getDeals,
  getActivities,
  getSalespersons,
} from "../lib/firebase";

export default function CoveragePage() {
  const [allData, setAllData] = useState({
    contacts: [],
    deals: [],
    activities: [],
  });
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ LOAD DATA (SAFE)
  useEffect(() => {
    async function loadData() {
      try {
        const [contacts, deals, activities, sps] = await Promise.all([
          getContacts("admin"),
          getDeals("admin"),
          getActivities("admin"),
          getSalespersons(),
        ]);

        console.log("🔥 LOADED:", {
          contacts: contacts.length,
          deals: deals.length,
          activities: activities.length,
        });

        setAllData({ contacts, deals, activities });
        setSalespersons(sps);
      } catch (e) {
        console.error("🔥 ERROR:", e);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // ✅ LOADING UI
  if (loading) {
    return <div style={{ padding: 20 }}>⏳ Loading coverage...</div>;
  }

  // ❌ NO DATA UI (IMPORTANT)
  if (!allData.contacts.length) {
    return (
      <div style={{ padding: 20 }}>
        ❌ No contacts found <br />
        👉 Add contacts in CRM first
      </div>
    );
  }

  const { contacts } = allData;

  // ✅ SAFE DATA
  const activeContacts = contacts.filter(
    (c) => c && !c.deleted && (c.name || c.phone)
  );

  // ✅ GROUP BY CITY
  const cityMap = {};

  activeContacts.forEach((c) => {
    const city = (c.city || "UNKNOWN").toUpperCase();
    const state = (c.state || "UNKNOWN").toUpperCase();

    const key = `${state}-${city}`;

    if (!cityMap[key]) {
      cityMap[key] = {
        state,
        city,
        count: 0,
      };
    }

    cityMap[key].count += 1;
  });

  const cities = Object.values(cityMap);

  return (
    <div style={{ padding: 20 }}>
      <h2>📍 Coverage</h2>

      <p style={{ marginBottom: 20 }}>
        Total Contacts: {activeContacts.length}
      </p>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            <th style={th}>State</th>
            <th style={th}>City</th>
            <th style={th}>Contacts</th>
          </tr>
        </thead>

        <tbody>
          {cities.map((c, i) => (
            <tr key={i}>
              <td style={td}>{c.state}</td>
              <td style={td}>{c.city}</td>
              <td style={td}>{c.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ✅ STYLES
const th = {
  border: "1px solid #ddd",
  padding: "8px",
  background: "#f5f5f5",
};

const td = {
  border: "1px solid #ddd",
  padding: "8px",
};

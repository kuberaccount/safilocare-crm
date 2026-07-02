import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  getContacts,
  getDeals,
  getActivities,
  getSalespersons,
} from "../lib/firebase";

export default function CoveragePage() {
  console.log("✅ COVERAGE PAGE LOADED");

  const [allData, setAllData] = useState({
    contacts: [],
    deals: [],
    activities: [],
  });

  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔥 LOAD DATA
  useEffect(() => {
    async function loadData() {
      console.log("🚀 START LOADING");

      try {
        const contacts = await getContacts("admin");
        console.log("📇 contacts:", contacts);

        const deals = await getDeals("admin");
        console.log("💰 deals:", deals);

        const activities = await getActivities("admin");
        console.log("📞 activities:", activities);

        const sps = await getSalespersons();
        console.log("👨‍💼 salespersons:", sps);

        setAllData({ contacts, deals, activities });
        setSalespersons(sps);

      } catch (e) {
        console.error("🔥 ERROR LOADING:", e);
        toast.error("Failed to load coverage data");
      }

      setLoading(false);
    }

    loadData();
  }, []);

  // ⏳ LOADING SCREEN
  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        ⏳ Loading Coverage Page...
      </div>
    );
  }

  // ❌ NO DATA
  if (!allData.contacts || allData.contacts.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        ❌ No contacts found <br />
        👉 Please add contacts first
      </div>
    );
  }

  const contacts = allData.contacts;

  // ✅ FILTER SAFE
  const activeContacts = contacts.filter(
    (c) => c && !c.deleted && (c.name || c.phone)
  );

  // ✅ GROUP BY STATE + CITY
  const cityMap = {};

  activeContacts.forEach((c) => {
    const state = (c.state || "UNKNOWN").toUpperCase();
    const city = (c.city || "UNKNOWN").toUpperCase();

    const key = `${state}-${city}`;

    if (!cityMap[key]) {
      cityMap[key] = {
        state,
        city,
        count: 0,
      };
    }

    cityMap[key].count++;
  });

  const cities = Object.values(cityMap);

  // ✅ UI ALWAYS SHOWS
  return (
    <div style={{ padding: 20 }}>
      <h2>📍 Coverage Page</h2>

      <p>👥 Total Contacts: {activeContacts.length}</p>

      <hr />

      {cities.length === 0 ? (
        <p>⚠️ No city data found</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 10,
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
      )}
    </div>
  );
}

// ✅ STYLES
const th = {
  border: "1px solid #ccc",
  padding: "8px",
  background: "#f0f0f0",
};

const td = {
  border: "1px solid #ccc",
  padding: "8px",
};

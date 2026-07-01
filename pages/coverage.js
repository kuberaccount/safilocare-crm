import React, { useEffect, useState } from "react";
import { getContacts } from "./contact";

const Coverage = ({ currentUser, isAdmin }) => {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [cityFilter, setCityFilter] = useState("All");
  const [salesFilter, setSalesFilter] = useState("All");

  // 🔹 Load Data
  useEffect(() => {
    if (!currentUser) return;

    const load = async () => {
      const data = await getContacts();

      const normalized = data.map((c) => ({
        id: c.id || c._id,
        ...(c.data || c),
      }));

      setContacts(normalized);
    };

    load();
  }, [currentUser]);

  // 🔹 Filtering
  useEffect(() => {
    let result = [...contacts];

    if (!isAdmin) {
      result = result.filter(
        (c) => c.salesperson === currentUser?.salesperson
      );
    }

    if (cityFilter !== "All") {
      result = result.filter((c) => c.city === cityFilter);
    }

    if (isAdmin && salesFilter !== "All") {
      result = result.filter((c) => c.salesperson === salesFilter);
    }

    setFilteredContacts(result);
  }, [contacts, cityFilter, salesFilter, currentUser, isAdmin]);

  // 🔹 KPIs
  const total = contacts.length;
  const assigned = contacts.filter(
    (c) => c.salesperson && c.salesperson !== "Unassigned"
  ).length;
  const unassigned = total - assigned;

  const cities = ["All", ...new Set(contacts.map((c) => c.city).filter(Boolean))];
  const salespersons = [
    "All",
    ...new Set(contacts.map((c) => c.salesperson).filter(Boolean)),
  ];

  return (
    <div style={styles.container}>

      {/* 🔥 SIDEBAR */}
      <div style={styles.sidebar}>
        <h2 style={{ color: "#fff" }}>CRM</h2>
        <p style={styles.menu}>Dashboard</p>
        <p style={styles.menuActive}>Coverage</p>
        <p style={styles.menu}>Contacts</p>
      </div>

      {/* 🔥 MAIN */}
      <div style={styles.main}>

        {/* 🔝 HEADER */}
        <div style={styles.header}>
          <h2>Coverage Dashboard</h2>
          <div>
            👤 {currentUser?.name || "User"}
          </div>
        </div>

        {/* 📊 KPI CARDS */}
        <div style={styles.cards}>
          <div style={styles.card}>
            <p>Total</p>
            <h2>{total}</h2>
          </div>
          <div style={styles.card}>
            <p>Assigned</p>
            <h2>{assigned}</h2>
          </div>
          <div style={styles.card}>
            <p>Unassigned</p>
            <h2>{unassigned}</h2>
          </div>
        </div>

        {/* 🔍 FILTER BAR */}
        <div style={styles.filters}>
          <select onChange={(e) => setCityFilter(e.target.value)}>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          {isAdmin && (
            <select onChange={(e) => setSalesFilter(e.target.value)}>
              {salespersons.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
        </div>

        {/* 📋 TABLE */}
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>City</th>
                <th>Salesperson</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((c, i) => (
                <tr key={i}>
                  <td>{c.name}</td>
                  <td>{c.mobile}</td>
                  <td>{c.city || "-"}</td>
                  <td>{c.salesperson || "Unassigned"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredContacts.length === 0 && (
            <p style={{ padding: 20 }}>No data found</p>
          )}
        </div>

      </div>
    </div>
  );
};

// 🎨 STYLES (CRM LOOK)
const styles = {
  container: {
    display: "flex",
    fontFamily: "Arial",
    height: "100vh",
  },
  sidebar: {
    width: "220px",
    background: "#1e293b",
    padding: "20px",
  },
  menu: {
    color: "#cbd5e1",
    marginTop: "20px",
    cursor: "pointer",
  },
  menuActive: {
    color: "#fff",
    marginTop: "20px",
    fontWeight: "bold",
  },
  main: {
    flex: 1,
    background: "#f1f5f9",
    padding: "20px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "20px",
  },
  cards: {
    display: "flex",
    gap: "20px",
    marginBottom: "20px",
  },
  card: {
    background: "#fff",
    padding: "20px",
    borderRadius: "10px",
    boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
    flex: 1,
  },
  filters: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
  },
  tableContainer: {
    background: "#fff",
    borderRadius: "10px",
    padding: "10px",
    boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
};

export default Coverage;

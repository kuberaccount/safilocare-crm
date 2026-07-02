import { useEffect, useState } from "react";
import { getCoverageReport, getSalespersons } from "../lib/firebase"; // ✅ FINAL PATH

export default function Coverage() {
  const [data, setData] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [filters, setFilters] = useState({
    city: "",
    state: "",
    pincode: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const res = await getCoverageReport(filters);
    const sp = await getSalespersons();
    setData(res);
    setSalespersons(sp);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Coverage Intelligence</h2>

      <input
        placeholder="City"
        onChange={(e) => setFilters({ ...filters, city: e.target.value })}
      />
      <input
        placeholder="State"
        onChange={(e) => setFilters({ ...filters, state: e.target.value })}
      />
      <input
        placeholder="Pincode"
        onChange={(e) => setFilters({ ...filters, pincode: e.target.value })}
      />

      <button onClick={loadData}>Search</button>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>City</th>
            <th>State</th>
            <th>Pincode</th>
            <th>Contacts</th>
            <th>Salespersons</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <td>{row.city}</td>
              <td>{row.state}</td>
              <td>{row.pincode}</td>
              <td>{row.count}</td>
              <td>{row.salespersons.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

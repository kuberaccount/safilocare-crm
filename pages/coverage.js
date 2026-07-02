import { useEffect, useState } from "react";
import { getCoverageReport, getSalespersons } from "../firebase";

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

  const handleAssign = async (item, salesperson) => {
    alert(`Assign new lead to ${salesperson} for ${item.city || item.pincode}`);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Coverage Intelligence</h2>

      <div style={{ marginBottom: 20 }}>
        <input
          placeholder="City"
          value={filters.city}
          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
        />
        <input
          placeholder="State"
          value={filters.state}
          onChange={(e) => setFilters({ ...filters, state: e.target.value })}
        />
        <input
          placeholder="Pincode"
          value={filters.pincode}
          onChange={(e) => setFilters({ ...filters, pincode: e.target.value })}
        />
        <button onClick={loadData}>Search</button>
      </div>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>City</th>
            <th>State</th>
            <th>Pincode</th>
            <th>Total Contacts</th>
            <th>Salespersons</th>
            <th>Assign Lead</th>
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
              <td>
                {row.salespersons.map((sp, idx) => (
                  <button key={idx} onClick={() => handleAssign(row, sp)}>
                    {sp}
                  </button>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

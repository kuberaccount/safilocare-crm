import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

// ── Fetch all data safely avoiding missing function exports ──
async function fetchAll() {
  let cSnap = { docs: [] };
  let pSnap = { docs: [] };
  let sSnap = { docs: [] };

  try {
    cSnap = await getDocs(collection(db, "contacts"));
  } catch (e) {
    console.error("Firebase 'contacts' collection error:", e);
  }

  try {
    pSnap = await getDocs(collection(db, "pipeline")); 
  } catch (e) {
    console.error("Firebase 'pipeline' collection error:", e);
  }

  try {
    sSnap = await getDocs(collection(db, "salespersons")); 
  } catch (e) {
    console.error("Firebase 'salespersons' collection error:", e);
  }

  return {
    contacts: (cSnap.docs || []).map(d => ({ id: d.id, ...d.data() })),
    pipeline: (pSnap.docs || []).map(d => ({ id: d.id, ...d.data() })),
    salespersons: (sSnap.docs || []).map(d => ({ id: d.id, ...d.data() })),
  };
}

export default function CoveragePage() {
  const [allData, setAllData] = useState({ contacts: [], pipeline: [], salespersons: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSP, setFilterSP] = useState("All");

  useEffect(() => {
    fetchAll()
      .then((data) => {
        setAllData(data);
      })
      .catch((e) => {
        console.error("Coverage data load error:", e);
        toast.error("Could not load coverage data");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-32 text-gray-400 font-sans">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
          <p className="text-sm">Loading coverage metrics...</p>
        </div>
      </div>
    );
  }

  const contacts = allData.contacts || [];
  const pipeline = allData.pipeline || [];
  const salespersons = allData.salespersons || [];

  // Filter out deleted or archived records
  const activeContacts = contacts.filter(c => c && !c.archived && !c.deleted);

  // Group contacts dynamically by location metrics
  const areaMap = {};
  activeContacts.forEach(c => {
    const state = (c.state || "Unknown State").trim().toUpperCase();
    const city = (c.city || "Unknown City").trim().toUpperCase();
    const pincode = (c.pincode || "—").trim();
    const key = `${state}|${city}|${pincode}`;

    if (!areaMap[key]) {
      areaMap[key] = { state, city, pincode, contacts: [], owners: new Set() };
    }
    areaMap[key].contacts.push(c);
    if (c.salesperson && c.salesperson !== "Unassigned") {
      areaMap[key].owners.add(c.salesperson);
    }
  });

  // Structure grouped items into lists
  let allAreas = Object.values(areaMap).map(area => {
    const ownersArray = Array.from(area.owners);
    const hasFilterSP = filterSP !== "All" && ownersArray.includes(filterSP);
    
    // Check associated pipeline status numbers for these contacts
    const contactNames = area.contacts.map(c => (c.name || "").toLowerCase().trim());
    const areaPipeline = pipeline.filter(p => p && p.contact && contactNames.includes(p.contact.toLowerCase().trim()));
    const activeCount = areaPipeline.filter(p => !["Won", "Lost"].includes(p.stage)).length;
    const wonCount = areaPipeline.filter(p => p.stage === "Won").length;

    return {
      ...area,
      contactCount: area.contacts.length,
      activeCount,
      wonCount,
      owners: ownersArray,
      hasFilterSP
    };
  }).sort((a, b) => b.contactCount - a.contactCount);

  // Bring selected salesperson areas to top if filtered
  if (filterSP !== "All") {
    allAreas = [...allAreas].sort((a, b) => (b.hasFilterSP ? 1 : 0) - (a.hasFilterSP ? 1 : 0));
  }

  // Filter list by input search query text
  const query = search.trim().toLowerCase();
  const matchedAreas = query
    ? allAreas.filter(a => 
        a.city.toLowerCase().includes(query) || 
        a.state.toLowerCase().includes(query) || 
        a.pincode.toLowerCase().includes(query)
      )
    : allAreas;

  return (
    <div className="p-6 max-w-6xl mx-auto font-sans text-gray-900">
      
      {/* Dynamic Header Titles */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Safilo Regional Coverage</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search pincodes or cities to find active coverage allocations and safely assign new incoming leads.
        </p>
      </div>

      {/* Control Widgets Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[250px]">
          <input 
            className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search city name, state, or pincode (e.g. SURAT or 395003)..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <select 
            className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={filterSP} 
            onChange={(e) => setFilterSP(e.target.value)}
          >
            <option value="All">All Salespersons</option>
            {salespersons.map(s => <option key={s.id} value={s.name || s.id}>{s.name || "Unnamed Team Member"}</option>)}
          </select>
        </div>
      </div>

      {/* Numerical Indicators Rows */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Active Customers</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{activeContacts.length}</p>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Unique Territories Tracked</p>
          <p className="text-2xl font-bold text-indigo-700 mt-1">{allAreas.length}</p>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Filtered Results</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{matchedAreas.length} territories</p>
        </div>
      </div>

      {/* Main Analysis Data Matrix Grid Layout Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {matchedAreas.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-3xl mb-2">📍</p>
            <p className="text-sm font-medium">No region tracking records matched your description filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-3">City Name</th>
                  <th className="px-6 py-3">State</th>
                  <th className="px-6 py-3">Pincode</th>
                  <th className="px-6 py-3 text-center">Contacts Count</th>
                  <th className="px-6 py-3 text-center">Active Pipeline Items</th>
                  <th className="px-6 py-3 text-center">Deals Won</th>
                  <th className="px-6 py-3">Covering Salesperson(s)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matchedAreas.map((area, index) => (
                  <tr key={index} className={`hover:bg-gray-50/80 transition-colors ${area.hasFilterSP ? "bg-indigo-50/30 font-medium" : ""}`}>
                    <td className="px-6 py-4 font-semibold text-gray-900">{area.city}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs">{area.state}</td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold tracking-wide text-indigo-600">{area.pincode}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-800">{area.contactCount}</td>
                    <td className="px-6 py-4 text-center font-semibold text-amber-600">{area.activeCount}</td>
                    <td className="px-6 py-4 text-center font-bold text-emerald-600">{area.wonCount}</td>
                    <td className="px-6 py-4">
                      {area.owners.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {area.owners.map((owner, oIdx) => (
                            <span key={oIdx} className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-xs font-medium">
                              👤 {owner}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-300 italic text-xs">Unassigned Region Territory</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

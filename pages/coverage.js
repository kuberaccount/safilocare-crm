import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

// ── Fetch all data safely ──
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
  const [expandedKey, setExpandedKey] = useState(null);

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

  // ── Excel CSV Export Handler Function (Detailed Party List Wise) ──
  const handleExportExcel = (dataToExport) => {
    if (!dataToExport || dataToExport.length === 0) {
      toast.error("No territory data available to export");
      return;
    }

    // 1. Define detailed headers for individual parties (Split Name & Company)
    const headings = [
      "Contact Name",
      "Company Name",
      "Phone Number",
      "Email Address",
      "City",
      "State",
      "Pincode",
      "Assigned Salesperson",
      "Segment Tag"
    ];
    
    // 2. Loop through each territory and compile its nested contact records
    const rows = [];
    dataToExport.forEach(area => {
      area.contacts.forEach(contact => {
        // Sanitize string text values to prevent syntax commas from breaking Excel formatting
        const contactName = `"${(contact.name || "Unnamed Contact").replace(/"/g, '""')}"`;
        const companyName = `"${(contact.company || "—").replace(/"/g, '""')}"`;
        const phone = `"${(contact.phone || "—").replace(/"/g, '""')}"`;
        const email = `"${(contact.email || "—").replace(/"/g, '""')}"`;
        const city = `"${(area.city || "").replace(/"/g, '""')}"`;
        const state = `"${(area.state || "").replace(/"/g, '""')}"`;
        const pincode = `"${(area.pincode || "").replace(/"/g, '""')}"`;
        const assignedSP = `"${(contact.salesperson || "Unassigned").replace(/"/g, '""')}"`;
        const tag = `"${(contact.type || "Lead").replace(/"/g, '""')}"`;

        rows.push([contactName, companyName, phone, email, city, state, pincode, assignedSP, tag].join(","));
      });
    });

    const csvLines = [headings.join(","), ...rows].join("\n");

    // 3. Create a background temporary file downloader trigger
    const blob = new Blob([csvLines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    
    downloadLink.setAttribute("href", url);
    downloadLink.setAttribute("download", `Safilocare_Party_List_Coverage_${new Date().toISOString().split('T')[0]}.csv`);
    downloadLink.style.visibility = "hidden";
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    toast.success(`Exported ${rows.length} party records safely!`);
  };

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

  const activeContacts = contacts.filter(c => c && !c.archived && !c.deleted);

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

  let allAreas = Object.values(areaMap).map(area => {
    const ownersArray = Array.from(area.owners);
    const hasFilterSP = filterSP !== "All" && ownersArray.includes(filterSP);
    
    const contactNames = area.contacts.map(c => (c.name || "").toLowerCase().trim());
    const areaPipeline = pipeline.filter(p => p && p.contact && contactNames.includes(p.contact.toLowerCase().trim()));
    const activeCount = areaPipeline.filter(p => !["Won", "Lost"].includes(p.stage)).length;
    const wonCount = areaPipeline.filter(p => p.stage === "Won").length;

    return {
      ...area,
      key: `${area.state}|${area.city}|${area.pincode}`,
      contactCount: area.contacts.length,
      activeCount,
      wonCount,
      owners: ownersArray,
      hasFilterSP
    };
  }).sort((a, b) => b.contactCount - a.contactCount);

  if (filterSP !== "All") {
    allAreas = [...allAreas].sort((a, b) => (b.hasFilterSP ? 1 : 0) - (a.hasFilterSP ? 1 : 0));
  }

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
      
      {/* Header Layout Banner */}
      <div className="mb-6 flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Safilo Regional Coverage</h1>
          <p className="text-sm text-gray-500 mt-1">
            Search pincodes or cities to find active coverage allocations. Click on any row to view specific leads.
          </p>
        </div>
        
        {/* Detailed Party Export Button */}
        <button 
          onClick={() => handleExportExcel(matchedAreas)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-all shadow-sm duration-200 hover:-translate-y-0.5 active:translate-y-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Export filtered to Excel
        </button>
      </div>

      {/* Filter Toolbar Area */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[250px]">
          <input 
            className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search city name, state, or pincode (e.g. SURAT)..." 
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

      {/* Analytics Dashboard Metric Blocks */}
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

      {/* Main Database Sheet Matrix */}
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
                  <th className="px-6 py-3 text-center">Active Pipelines</th>
                  <th className="px-6 py-3 text-center">Deals Won</th>
                  <th className="px-6 py-3">Covering Salesperson(s)</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matchedAreas.map((area, index) => {
                  const isExpanded = expandedKey === area.key;
                  return (
                    <React.Fragment key={index}>
                      {/* Parent Row Toggle Element */}
                      <tr 
                        onClick={() => setExpandedKey(isExpanded ? null : area.key)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${area.hasFilterSP ? "bg-indigo-50/20" : ""} ${isExpanded ? "bg-slate-50 font-medium" : ""}`}
                      >
                        <td className="px-6 py-4 font-semibold text-gray-900 flex items-center gap-2">
                          <span className={`text-xs text-gray-400 transform transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}>▶</span>
                          {area.city}
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-xs">{area.state}</td>
                        <td className="px-6 py-4 font-mono text-xs font-semibold tracking-wide text-indigo-600">{area.pincode}</td>
                        <td className="px-6 py-4 text-center font-bold text-slate-800">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs">
                            {area.contactCount}
                          </span>
                        </td>
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
                            <span className="text-gray-300 italic text-xs">Unassigned Region</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button className="text-xs text-indigo-600 hover:text-indigo-900 font-semibold underline">
                            {isExpanded ? "Hide Details" : "View Leads"}
                          </button>
                        </td>
                      </tr>

                      {/* Dropdown Drawer Section - Party List Details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan="8" className="px-8 py-4 border-l-4 border-indigo-500 bg-indigo-50/5">
                            <div className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                                🏢 Parties & Leads Registered in {area.city} ({area.pincode})
                              </p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs text-gray-600 divide-y divide-gray-200">
                                  <thead>
                                    <tr className="text-gray-400 font-medium bg-slate-50">
                                      <th className="p-2 pl-3">Contact Name</th>
                                      <th className="p-2">Company Name</th>
                                      <th className="p-2">Phone No.</th>
                                      <th className="p-2">Email Address</th>
                                      <th className="p-2">Assigned Handler</th>
                                      <th className="p-2 pr-3 text-right">Segment Tag</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {area.contacts.map((contact, cIdx) => (
                                      <tr key={cIdx} className="hover:bg-slate-50/50">
                                        <td className="p-2 pl-3 font-semibold text-gray-800">{contact.name || "Unnamed Contact"}</td>
                                        <td className="p-2 text-gray-500 font-medium">{contact.company || "—"}</td>
                                        <td className="p-2 font-mono text-gray-500">{contact.phone || "—"}</td>
                                        <td className="p-2 text-gray-500">{contact.email || "—"}</td>
                                        <td className="p-2">
                                          <span className="text-gray-700 font-medium">
                                            {contact.salesperson || "Unassigned"}
                                          </span>
                                        </td>
                                        <td className="p-2 pr-3 text-right">
                                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium text-[11px]">
                                            {contact.type || "Lead"}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

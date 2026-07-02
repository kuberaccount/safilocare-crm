import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { getSalespersons } from "../lib/firebase";

// ── Fetch all data with safety fallbacks to prevent a blank screen ──
async function fetchAll() {
  let cSnap, dSnap, aSnap;

  try {
    cSnap = await getDocs(collection(db, "contacts"));
  } catch (e) {
    console.error("Firebase 'contacts' collection error:", e);
    cSnap = { docs: [] }; // Fallback to empty if it fails
  }

  try {
    dSnap = await getDocs(collection(db, "deals"));
  } catch (e) {
    console.error("Firebase 'deals' collection error:", e);
    dSnap = { docs: [] }; // Fallback to empty if it fails
  }

  try {
    aSnap = await getDocs(collection(db, "activities"));
  } catch (e) {
    console.error("Firebase 'activities' collection error:", e);
    aSnap = { docs: [] }; // Fallback to empty if it fails
  }

  return {
    contacts:   (cSnap.docs || []).map(d => ({ id: d.id, ...d.data() })),
    deals:      (dSnap.docs || []).map(d => ({ id: d.id, ...d.data() })),
    activities: (aSnap.docs || []).map(d => ({ id: d.id, ...d.data() })),
  };
}

const REFERENCE_READY_MIN = 2;

function exportCSV(rows, filterSP) {
  if (rows.length === 0) return toast.error("Nothing to export");
  const csvRows = [
    ["State","City","Pincode","Contacts","Active leads","Won","References","Covered by"],
    ...rows.map(r => [
      r.state, r.city, r.pincode, r.contactCount,
      r.activeCount, r.wonCount, r.referenceCount,
      r.owners.join("; ")
    ])
  ];
  const csv = csvRows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const label = filterSP && filterSP !== "All" ? filterSP.toLowerCase().replace(/\s+/g,"-") : "all";
  a.download = `coverage-${label}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  toast.success("Exported ✅");
}

export default function CoveragePage({ currentUser }) {
  const [allData, setAllData] = useState({ contacts: [], deals: [], activities: [] });
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filterSP, setFilterSP] = useState("All");
  const [expandedKey, setExpandedKey] = useState(null);

  useEffect(() => {
    Promise.all([fetchAll(), getSalespersons ? getSalespersons() : Promise.resolve([])])
      .then(([data, sps]) => {
        setAllData(data);
        setSalespersons(sps || []);
      })
      .catch(e => {
        console.error("Coverage load error:", e);
        setError(e.message || "Unknown error");
        toast.error("Could not load coverage data");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-6 flex items-center justify-center py-32 text-gray-400">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
        <p className="text-sm">Loading coverage data...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="p-6 max-w-lg mx-auto mt-10">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-2xl mb-2">⚠️</p>
        <p className="text-sm font-semibold text-red-700 mb-1">Could not load coverage data</p>
        <p className="text-xs text-red-500">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 btn btn-secondary text-sm">Retry</button>
      </div>
    </div>
  );

  const { contacts = [], deals = [], activities = [] } = allData;

  // Exclude archived and soft-deleted contacts
  const activeContacts = contacts.filter(c => c && !c.archived && !c.deleted);

  if (activeContacts.length === 0) return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Coverage</h1>
      <div className="card p-10 text-center text-gray-400">
        <p className="text-3xl mb-3">📍</p>
        <p className="text-sm font-medium">No contacts with location data yet</p>
        <p className="text-xs mt-1">Add city, state or pincode when creating contacts to see coverage here.</p>
      </div>
    </div>
  );

  // Build deal lookup by contact name
  const dealsByContactName = {};
  deals.forEach(d => {
    if (!d) return;
    const key = (d.contact || "").trim().toLowerCase();
    if (!key) return;
    if (!dealsByContactName[key]) dealsByContactName[key] = [];
    dealsByContactName[key].push(d);
  });

  // Build activity lookup by dealId
  const actsByDealId = {};
  activities.forEach(a => {
    if (!a || !a.dealId) return;
    if (!actsByDealId[a.dealId]) actsByDealId[a.dealId] = [];
    actsByDealId[a.dealId].push(a);
  });

  // Enrich each contact with deal + activity stats
  const enriched = activeContacts.map(c => {
    const key = (c.name || "").trim().toLowerCase();
    const cDeals = dealsByContactName[key] || [];
    const cActs = cDeals.flatMap(d => actsByDealId[d.id] || []);
    return {
      ...c,
      isCredibleReference: cActs.length > 0,
      activeDealCount: cDeals.filter(d => !["Won","Lost"].includes(d.stage)).length,
      wonDealCount:    cDeals.filter(d => d.stage === "Won").length,
    };
  });

  // Group by state + city + pincode
  const areaMap = {};
  enriched.forEach(c => {
    const state   = (c.state   || "").trim().toUpperCase() || "UNKNOWN STATE";
    const city    = (c.city    || "").trim().toUpperCase() || "UNKNOWN CITY";
    const pincode = (c.pincode || "").trim()               || "—";
    const key = `${state}|${city}|${pincode}`;
    if (!areaMap[key]) areaMap[key] = { state, city, pincode, contacts: [] };
    areaMap[key].contacts.push(c);
  });

  let allAreas = Object.values(areaMap).map(area => {
    const refs   = area.contacts.filter(c => c.isCredibleReference);
    const owners = [...new Set(area.contacts.map(c => c.salesperson).filter(s => s && s !== "Unassigned"))];
    const hasFilterSP = filterSP !== "All" && area.contacts.some(c => c.salesperson === filterSP);
    return {
      ...area,
      contactCount:   area.contacts.length,
      referenceCount: refs.length,
      activeCount:    area.contacts.reduce((s,c) => s + c.activeDealCount, 0),
      wonCount:       area.contacts.reduce((s,c) => s + c.wonDealCount,    0),
      owners,
      hasFilterSP,
      referenceReady: refs.length >= REFERENCE_READY_MIN,
    };
  }).sort((a,b) => b.contactCount - a.contactCount);

  // Float SP-filtered areas to top
  if (filterSP !== "All") {
    allAreas = [...allAreas].sort((a,b) => (b.hasFilterSP?1:0) - (a.hasFilterSP?1:0));
  }

  // Search filter
  const q = search.trim().toLowerCase();
  const matchedAreas = q
    ? allAreas.filter(a =>
        a.city.toLowerCase().includes(q) ||
        a.state.toLowerCase().includes(q) ||
        a.pincode.toLowerCase().includes(q)
      )
    : allAreas;

  // City-level rollup (shown when searching)
  const cityRollup = q
    ? [...new Set(matchedAreas.map(a => `${a.state}|${a.city}`))].map(ck => {
        const [state, city] = ck.split("|");
        const cityAreas = allAreas.filter(a => a.state === state && a.city === city);
        return {
          state, city,
          contactCount:   cityAreas.reduce((s,a) => s+a.contactCount,   0),
          referenceCount: cityAreas.reduce((s,a) => s+a.referenceCount, 0),
          activeCount:    cityAreas.reduce((s,a) => s+a.activeCount,     0),
          wonCount:       cityAreas.reduce((s,a) => s+a.wonCount,        0),
          owners:         [...new Set(cityAreas.flatMap(a => a.owners))],
          pincodeCount:   cityAreas.length,
        };
      })
    : [];

  const referenceReadyAreas = allAreas
    .filter(a => a.referenceReady)
    .sort((a,b) => b.referenceCount - a.referenceCount);

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Coverage</h1>
          <p className="text-sm text-gray-500">
            {activeContacts.length} contacts · {allAreas.length} areas · search pincode, city or state to find references near a new lead
          </p>
        </div>
        <button onClick={() => exportCSV(matchedAreas, filterSP)} className="btn btn-secondary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export CSV
        </button>
      </div>

      {/* Search + SP filter */}
      <div className="card p-4 mb-4">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-52">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input className="input pl-9" placeholder="Search pincode, city or state — e.g. 395003 or SURAT"
              value={search} onChange={e => { setSearch(e.target.value); setExpandedKey(null); }} />
          </div>
          <select className="input w-48" value={filterSP} onChange={e => { setFilterSP(e.target.value); setExpandedKey(null); }}>
            <option value="All">All salespersons</option>
            {salespersons.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Use this to check if existing customers are near a new lead before a visit.
          {filterSP !== "All" && " This salesperson's areas are highlighted and sorted to the top."}
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label:"Total contacts", value: activeContacts.length, color:"text-gray-800" },
          { label:"Areas covered",  value: allAreas.length,       color:"text-indigo-700" },
          { label:"Reference-ready",value: referenceReadyAreas.length, color:"text-green-700" },
          { label:"Active leads",   value: allAreas.reduce((s,a)=>s+a.activeCount,0), color:"text-blue-700" },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* City rollup (search only) */}
      {q && cityRollup.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">City overview</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {cityRollup.map(c => (
              <div key={`${c.state}|${c.city}`} className="card p-4">
                <p className="text-sm font-semibold text-gray-900">{c.city}</p>
                <p className="text-xs text-gray-400 mb-2">{c.state} · {c.pincodeCount} pincode{c.pincodeCount!==1?"s":""}</p>
                <div className="grid grid-cols-2 gap-1 text-xs mb-2">
                  <div><span className="text-gray-400">Contacts </span><span className="font-semibold">{c.contactCount}</span></div>
                  <div><span className="text-gray-400">Refs </span><span className="font-semibold">{c.referenceCount}</span></div>
                  <div><span className="text-gray-400">Active </span><span className="font-semibold text-blue-600">{c.activeCount}</span></div>
                  <div><span className="text-gray-400">Won </span><span className="font-semibold text-green-600">{c.wonCount}</span></div>
                </div>
                {c.owners.length > 0 && (
                  <p className="text-xs text-gray-400">By: <span className="font-medium text-gray-700">{c.owners.join(", ")}</span></p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pincode table */}
      <div className="card">
        {matchedAreas.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">
            <p className="text-2xl mb-2">📍</p>
            {q ? "No contacts match that search." : "No location data found."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["City","State","Pincode","Contacts","Active","Won","References","Covered by",""].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matchedAreas.map(area => {
                  const key = `${area.state}|${area.city}|${area.pincode}`;
                  const expanded = expandedKey === key;
                  return (
                    <React.Fragment key={key}>
                      <tr
                        className={`border-b border-gray-50 cursor-pointer transition-colors ${area.hasFilterSP ? "bg-indigo-50/50 hover:bg-indigo-50" : "hover:bg-gray-50"}`}
                        onClick={() => setExpandedKey(expanded ? null : key)}>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {area.city}
                          {area.hasFilterSP && <span className="ml-1.5 text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">★</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{area.state}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{area.pincode}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{area.contactCount}</td>
                        <td className="px-4 py-3 text-blue-600">{area.activeCount}</td>
                        <td className="px-4 py-3 text-green-600 font-medium">{area.wonCount}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${area.referenceReady ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {area.referenceCount}{area.referenceReady ? " ✓" : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {area.owners.length > 0
                            ? <>{area.owners.slice(0,2).join(", ")}{area.owners.length>2&&` +${area.owners.length-2}`}</>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <svg className={`w-4 h-4 text-gray-300 transition-transform ${expanded?"rotate-90":""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                          </svg>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={9} className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <div className="space-y-1.5">
                              {area.contacts
                                .slice()
                                .sort((a,b) => filterSP!=="All"
                                  ? (b.salesperson===filterSP?1:0)-(a.salesperson===filterSP?1:0)
                                  : 0)
                                .map(c => {
                                  const isMine = filterSP !== "All" && c.salesperson === filterSP;
                                  return (
                                    <div key={c.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs border ${isMine ? "bg-indigo-50 border-indigo-200" : "bg-white border-gray-100"}`}>
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                          {(c.name||"?").charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                          <span className="font-medium text-gray-800">{c.name}</span>
                                          {c.company && <span className="text-gray-400"> · {c.company}</span>}
                                          {c.phone && <span className="text-gray-400"> · {c.phone}</span>}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                        {c.salesperson && c.salesperson !== "Unassigned" && (
                                          <span className={`px-2 py-0.5 rounded-full font-medium ${isMine ? "bg-indigo-100 text-indigo-700" : "bg-purple-50 text-purple-700"}`}>
                                            👤 {c.salesperson}
                                          </span>
                                        )}
                                        {c.wonDealCount > 0 && <span className="text-green-600 font-semibold">Won ✓</span>}
                                        {c.isCredibleReference
                                          ? <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">Reference ✓</span>
                                          : <span className="bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">No activity yet</span>}
                                      </div>
                                    </div>
                                  );
                                })}
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

      {/* Reference-ready pills */}
      {referenceReadyAreas.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            📍 Reference-ready areas
            <span className="text-xs font-normal text-gray-400 ml-1">— {REFERENCE_READY_MIN}+ contacts with activity</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {referenceReadyAreas.slice(0,30).map(a => (
              <button key={`${a.state}|${a.city}|${a.pincode}`}
                onClick={() => { setSearch(a.pincode !== "—" ? a.pincode : a.city); setExpandedKey(null); }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all hover:shadow-sm
                  ${a.hasFilterSP ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-green-50 text-green-700 border-green-100"}`}>
                {a.city} {a.pincode !== "—" && `(${a.pincode})`} — {a.referenceCount} contacts
                {a.owners.length > 0 && ` · ${a.owners[0]}${a.owners.length>1?` +${a.owners.length-1}`:""}`}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Click to search that area.</p>
        </div>
      )}
    </div>
  );
}

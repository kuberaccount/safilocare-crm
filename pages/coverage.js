import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getDeals, getContacts, getActivities, getSalespersons } from "../lib/firebase";

const STALE_DAYS = 30;
const REFERENCE_READY_MIN = 2;

export default function CoveragePage({ currentUser }) {
  const [deals, setDeals] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedArea, setExpandedArea] = useState(null);

  useEffect(() => {
    // Unfiltered on purpose — every salesperson needs to see every other
    // salesperson's contacts/leads here, that's the whole point of this page.
    Promise.all([getDeals(null), getContacts(null), getActivities(null), getSalespersons()])
      .then(([d,c,a,s]) => { setDeals(d); setContacts(c); setActivities(a); })
      .catch((e) => { console.error(e); toast.error("Could not load coverage data"); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-center text-gray-400 py-20">Loading coverage...</div>;

  const now = Date.now();

  // Match deals/activities to a contact by name (same approach as the rest
  // of the app, since deals store the contact's display name).
  const dealsByContactName = {};
  deals.forEach(d => {
    const key = (d.contact || "").trim().toLowerCase();
    if (!key) return;
    (dealsByContactName[key] = dealsByContactName[key] || []).push(d);
  });

  function activitiesForContact(contactName) {
    const key = (contactName || "").trim().toLowerCase();
    const contactDeals = dealsByContactName[key] || [];
    const dealIds = new Set(contactDeals.map(d => d.id));
    return activities.filter(a =>
      (a.dealId && dealIds.has(a.dealId)) ||
      (a.contact || "").trim().toLowerCase() === key
    );
  }

  function lastActivityDateFor(acts) {
    if (acts.length === 0) return null;
    const times = acts.map(a => {
      const d = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      return d.getTime();
    });
    return new Date(Math.max(...times));
  }

  const enrichedContacts = contacts.filter(c => !c.archived).map(c => {
    const cDeals = dealsByContactName[(c.name||"").trim().toLowerCase()] || [];
    const cActs = activitiesForContact(c.name);
    return {
      ...c,
      deals: cDeals,
      isCredibleReference: cActs.length > 0,
      lastActivity: lastActivityDateFor(cActs),
      activeDealCount: cDeals.filter(d => !["Won","Lost"].includes(d.stage)).length,
      wonDealCount: cDeals.filter(d => d.stage === "Won").length,
    };
  });

  const areaMap = {};
  enrichedContacts.forEach(c => {
    const state = (c.state || "Unknown state").trim();
    const city = (c.city || "Unknown city").trim();
    const pincode = (c.pincode || "—").trim();
    const key = `${state}|${city}|${pincode}`;
    if (!areaMap[key]) areaMap[key] = { state, city, pincode, contacts: [] };
    areaMap[key].contacts.push(c);
  });

  const allAreas = Object.values(areaMap).map(area => {
    const referenceContacts = area.contacts.filter(c => c.isCredibleReference);
    const activeCount = area.contacts.reduce((s,c)=>s+c.activeDealCount,0);
    const wonCount = area.contacts.reduce((s,c)=>s+c.wonDealCount,0);
    const owners = [...new Set(area.contacts.map(c => c.salesperson).filter(s => s && s !== "Unassigned"))];
    const lastActivityDate = area.contacts.reduce((latest, c) => {
      if (!c.lastActivity) return latest;
      if (!latest || c.lastActivity > latest) return c.lastActivity;
      return latest;
    }, null);
    const daysSinceActivity = lastActivityDate ? Math.floor((now - lastActivityDate.getTime())/(24*60*60*1000)) : null;
    return {
      ...area,
      contactCount: area.contacts.length,
      referenceCount: referenceContacts.length,
      activeCount,
      wonCount,
      owners,
      lastActivityDate,
      daysSinceActivity,
      referenceReady: referenceContacts.length >= REFERENCE_READY_MIN,
      isStale: daysSinceActivity !== null && daysSinceActivity >= STALE_DAYS,
    };
  }).sort((a,b) => b.contactCount - a.contactCount);

  const query = search.trim().toLowerCase();
  const matchedAreas = query
    ? allAreas.filter(a =>
        a.city.toLowerCase().includes(query) ||
        a.state.toLowerCase().includes(query) ||
        a.pincode.toLowerCase().includes(query)
      )
    : allAreas;

  const matchedCities = query
    ? [...new Set(matchedAreas.map(a => `${a.state}|${a.city}`))].map(key => {
        const [state, city] = key.split("|");
        const cityAreas = allAreas.filter(a => a.state === state && a.city === city);
        return {
          state, city,
          contactCount: cityAreas.reduce((s,a)=>s+a.contactCount,0),
          referenceCount: cityAreas.reduce((s,a)=>s+a.referenceCount,0),
          activeCount: cityAreas.reduce((s,a)=>s+a.activeCount,0),
          wonCount: cityAreas.reduce((s,a)=>s+a.wonCount,0),
          owners: [...new Set(cityAreas.flatMap(a => a.owners))],
          pincodeCount: cityAreas.length,
        };
      })
    : [];

  const referenceReadyAreas = allAreas.filter(a => a.referenceReady)
    .sort((a,b) => b.referenceCount - a.referenceCount);

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">Coverage</h1>
        <p className="text-sm text-gray-500">Find existing customers near a new lead, and who to ask for a reference.</p>
      </div>

      {/* Search */}
      <div className="card p-4 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input className="input pl-9" placeholder="Search pincode, city, or state — e.g. 395003 or Surat"
            value={search} onChange={e=>{setSearch(e.target.value); setExpandedArea(null);}} />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Shared across the whole team — everyone can see everyone's contacts here so you know who to ask for a reference. "Reference-ready" means {REFERENCE_READY_MIN}+ contacts in the area have at least one logged activity.
        </p>
      </div>

      {/* City-level rollup when searching */}
      {query && matchedCities.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">City overview</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {matchedCities.map(c => (
              <div key={`${c.state}|${c.city}`} className="card p-4">
                <p className="text-sm font-semibold text-gray-900">{c.city}</p>
                <p className="text-xs text-gray-400 mb-2">{c.state} · {c.pincodeCount} pincode{c.pincodeCount!==1?"s":""}</p>
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div><span className="text-gray-400">Contacts</span> <span className="font-semibold text-gray-800">{c.contactCount}</span></div>
                  <div><span className="text-gray-400">References</span> <span className="font-semibold text-gray-800">{c.referenceCount}</span></div>
                  <div><span className="text-gray-400">Active leads</span> <span className="font-semibold text-blue-600">{c.activeCount}</span></div>
                  <div><span className="text-gray-400">Won</span> <span className="font-semibold text-green-600">{c.wonCount}</span></div>
                </div>
                {c.owners.length > 0 && (
                  <p className="text-xs text-gray-400">Covered by: <span className="text-gray-600 font-medium">{c.owners.join(", ")}</span></p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pincode-level table */}
      <div className="card">
        {matchedAreas.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            {query ? "No contacts found matching that search." : "No contacts with location data yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["City","State","Pincode","Contacts","References","Active leads","Won","Covered by",""].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matchedAreas.map(area => {
                  const key = `${area.state}|${area.city}|${area.pincode}`;
                  const expanded = expandedArea === key;
                  return (
                    <React.Fragment key={key}>
                      <tr className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={()=>setExpandedArea(expanded?null:key)}>
                        <td className="px-4 py-3 font-medium text-gray-900">{area.city}</td>
                        <td className="px-4 py-3 text-gray-500">{area.state}</td>
                        <td className="px-4 py-3 text-gray-500">{area.pincode}</td>
                        <td className="px-4 py-3 text-gray-700">{area.contactCount}</td>
                        <td className="px-4 py-3">
                          <span className={`badge ${area.referenceReady ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}`}>
                            {area.referenceCount}{area.referenceReady && " ✓"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-blue-600">{area.activeCount}</td>
                        <td className="px-4 py-3 text-green-600 font-medium">{area.wonCount}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {area.owners.length > 0
                            ? <span className="text-xs">{area.owners.slice(0,2).join(", ")}{area.owners.length > 2 && ` +${area.owners.length-2}`}</span>
                            : <span className="text-xs text-gray-300">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          <svg className={`w-4 h-4 transition-transform ${expanded?"rotate-90":""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                          </svg>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-gray-50">
                          <td colSpan={9} className="px-4 py-3 bg-gray-50">
                            <div className="space-y-1.5">
                              {area.contacts.map(c => (
                                <div key={c.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-xs border border-gray-100">
                                  <div>
                                    <span className="font-medium text-gray-800">{c.name}</span>
                                    {c.company && <span className="text-gray-400"> · {c.company}</span>}
                                    {c.phone && <span className="text-gray-400"> · {c.phone}</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {c.salesperson && c.salesperson !== "Unassigned" && (
                                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">👤 {c.salesperson}</span>
                                    )}
                                    {c.wonDealCount > 0 && <span className="text-green-600 font-medium">Won customer</span>}
                                    {c.isCredibleReference
                                      ? <span className="badge bg-green-50 text-green-700">Reference ✓</span>
                                      : <span className="badge bg-gray-50 text-gray-400">No activity</span>}
                                  </div>
                                </div>
                              ))}
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

      {/* Reference-ready areas */}
      <div className="mt-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">📍 Reference-ready areas <span className="text-xs font-normal text-gray-400">({referenceReadyAreas.length})</span></p>
        {referenceReadyAreas.length === 0 ? (
          <div className="card p-6 text-center text-gray-400 text-sm">No areas have reached {REFERENCE_READY_MIN}+ credible references yet.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {referenceReadyAreas.slice(0,30).map(a => (
              <span key={`${a.state}|${a.city}|${a.pincode}`} className="text-xs bg-green-50 text-green-700 border border-green-100 px-3 py-1.5 rounded-full font-medium">
                {a.city} ({a.pincode}) — {a.referenceCount} contacts{a.owners.length > 0 && ` · ${a.owners[0]}${a.owners.length>1?` +${a.owners.length-1}`:""}`}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, serverTimestamp, where, getDoc, setDoc, query
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRPu4s5hD3K1andQ2Tf3CSvaLnIoZh4SI",
  authDomain: "safilocare-crm.firebaseapp.com",
  projectId: "safilocare-crm",
  storageBucket: "safilocare-crm.firebasestorage.app",
  messagingSenderId: "970517789943",
  appId: "1:970517789943:web:c43423461a507abb1ce7f2",
  measurementId: "G-D271FFWPTJ",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export { deleteDoc, doc, collection, addDoc, serverTimestamp, getDocs, updateDoc, setDoc };

// ─── User approval ──────────────────────────────────────────
export async function requestAccess(user) {
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const emailKey = user.email.toLowerCase().replace(/[.@]/g, "_");
      const preSnap = await getDoc(doc(db, "preapproved", emailKey));
      const preData = preSnap.exists() ? preSnap.data() : null;
      await setDoc(ref, {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        photo: user.photoURL,
        status: preData ? "approved" : "pending",
        salesperson: preData?.salesperson || "Unassigned",
        role: preData?.role || "salesperson",
        requestedAt: serverTimestamp(),
      });
    }
    return (await getDoc(ref)).data();
  } catch (e) {
    console.error("requestAccess error:", e);
    return { status: "pending" };
  }
}

export async function getUserStatus(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

export async function getAllUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error("getAllUsers error:", e); return []; }
}

export async function getPendingUsers() {
  try {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.status === "pending");
  } catch { return []; }
}

export async function approveUser(uid) {
  return updateDoc(doc(db, "users", uid), { status: "approved" });
}

export async function rejectUser(uid) {
  return updateDoc(doc(db, "users", uid), { status: "rejected" });
}

// ─── Contacts ───────────────────────────────────────────────
// Filter/sort in JS — avoids Firestore composite index errors
export async function getContacts(salesperson = null) {
  try {
    const snap = await getDocs(collection(db, "contacts"));
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(c => !c.deleted); // ← exclude soft-deleted (recycle bin)
    if (salesperson && salesperson !== "admin") {
      results = results.filter(c => c.salesperson === salesperson);
    }
    return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (e) { console.error("getContacts error:", e); return []; }
}

export async function checkDuplicatePhone(phone, excludeId = null) {
  try {
    if (!phone || phone.length < 5) return false;
    const snap = await getDocs(collection(db, "contacts"));
    return snap.docs.filter(d =>
      d.id !== excludeId &&
      d.data().phone === phone &&
      !d.data().deleted  // don't block on soft-deleted contacts
    ).length > 0;
  } catch { return false; }
}

export async function addContact(data) {
  return addDoc(collection(db, "contacts"), { ...data, createdAt: serverTimestamp() });
}

export async function updateContact(id, data) {
  return updateDoc(doc(db, "contacts", id), data);
}

export async function deleteContact(id) {
  return deleteDoc(doc(db, "contacts", id));
}

// ── Soft Delete (Recycle Bin) ────────────────────────────────
// Marks contact deleted=true — stays in Firestore, hidden from normal view
export async function softDeleteContact(id, deletedByName = "") {
  return updateDoc(doc(db, "contacts", id), {
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: deletedByName,
  });
}

// Restores contact from recycle bin
export async function restoreContact(id) {
  return updateDoc(doc(db, "contacts", id), {
    deleted: false,
    deletedAt: null,
    deletedBy: null,
    archived: false,
  });
}

// Permanently removes from Firestore — cannot be undone
export async function permanentDeleteContact(id) {
  return deleteDoc(doc(db, "contacts", id));
}

// Returns all soft-deleted contacts
export async function getDeletedContacts(salespersonFilter = null) {
  try {
    const snap = await getDocs(collection(db, "contacts"));
    let results = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(c => c.deleted === true);
    if (salespersonFilter) {
      results = results.filter(c => c.salesperson === salespersonFilter);
    }
    return results.sort((a, b) => (b.deletedAt?.seconds || 0) - (a.deletedAt?.seconds || 0));
  } catch (e) { console.error("getDeletedContacts error:", e); return []; }
}

// ─── Deals ──────────────────────────────────────────────────
export async function getDeals(salesperson = null) {
  try {
    const snap = await getDocs(collection(db, "deals"));
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (salesperson && salesperson !== "admin") {
      results = results.filter(d => d.salesperson === salesperson);
    }
    return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (e) { console.error("getDeals error:", e); return []; }
}

export async function addDeal(data) {
  return addDoc(collection(db, "deals"), { ...data, createdAt: serverTimestamp() });
}

export async function updateDeal(id, data) {
  return updateDoc(doc(db, "deals", id), data);
}

export async function deleteDeal(id) {
  return deleteDoc(doc(db, "deals", id));
}

// ─── Activities ─────────────────────────────────────────────
export async function getActivities(salesperson = null) {
  try {
    const snap = await getDocs(collection(db, "activities"));
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (salesperson && salesperson !== "admin") {
      results = results.filter(a => a.salesperson === salesperson || a.dealSalesperson === salesperson);
    }
    return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (e) { console.error("getActivities error:", e); return []; }
}

export async function getActivitiesForDeal(dealId) {
  try {
    const snap = await getDocs(collection(db, "activities"));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.dealId === dealId)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (e) { console.error(e); return []; }
}

export async function addActivity(data) {
  return addDoc(collection(db, "activities"), { ...data, createdAt: serverTimestamp() });
}

export async function updateActivity(id, data) {
  return updateDoc(doc(db, "activities", id), data);
}

export async function deleteActivity(id) {
  return deleteDoc(doc(db, "activities", id));
}

// ─── Salespersons ────────────────────────────────────────────
export async function getSalespersons() {
  try {
    const snap = await getDocs(collection(db, "salespersons"));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } catch (e) { console.error("getSalespersons error:", e); return []; }
}

export async function addSalesperson(name, email = "") {
  return addDoc(collection(db, "salespersons"), { name, email, createdAt: serverTimestamp() });
}

export async function deleteSalesperson(id) {
  return deleteDoc(doc(db, "salespersons", id));
}

// ─── Coverage ────────────────────────────────────────────────
// Coverage tracks which geographic areas (city/state/pincode)
// each salesperson is responsible for — used by coverage.js page
export async function getCoverageAreas(salespersonFilter = null) {
  try {
    const snap = await getDocs(collection(db, "coverage"));
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (salespersonFilter) {
      results = results.filter(c => c.salesperson === salespersonFilter);
    }
    return results.sort((a, b) => (a.salesperson || "").localeCompare(b.salesperson || ""));
  } catch (e) { console.error("getCoverageAreas error:", e); return []; }
}

export async function addCoverageArea(data) {
  // data: { salesperson, city, state, pincode, notes }
  return addDoc(collection(db, "coverage"), { ...data, createdAt: serverTimestamp() });
}

export async function updateCoverageArea(id, data) {
  return updateDoc(doc(db, "coverage", id), data);
}

export async function deleteCoverageArea(id) {
  return deleteDoc(doc(db, "coverage", id));
}

// ─── Team Report helpers ─────────────────────────────────────
// Used by the Team Report page to get aggregate stats per salesperson
export async function getTeamStats() {
  try {
    const [contacts, deals, activities, salespersons] = await Promise.all([
      getDocs(collection(db, "contacts")),
      getDocs(collection(db, "deals")),
      getDocs(collection(db, "activities")),
      getDocs(collection(db, "salespersons")),
    ]);

    const spNames = salespersons.docs.map(d => d.data().name);
    const allContacts = contacts.docs.map(d => d.data()).filter(c => !c.deleted);
    const allDeals = deals.docs.map(d => d.data());
    const allActivities = activities.docs.map(d => d.data());

    return spNames.map(name => {
      const spContacts = allContacts.filter(c => c.salesperson === name);
      const spDeals = allDeals.filter(d => d.salesperson === name);
      const spActs = allActivities.filter(a => a.salesperson === name);
      const wonDeals = spDeals.filter(d => d.stage === "Won");
      const now = new Date();
      const overdueFollowUps = spDeals.filter(d =>
        d.followUpDate && d.followUpDate < now.toISOString().split("T")[0] &&
        !["Won","Lost"].includes(d.stage)
      );
      return {
        name,
        totalContacts: spContacts.length,
        totalDeals: spDeals.filter(d => !["Won","Lost"].includes(d.stage)).length,
        wonDeals: wonDeals.length,
        wonValue: wonDeals.reduce((s, d) => s + (parseFloat(d.value) || 0), 0),
        totalActivities: spActs.length,
        overdueFollowUps: overdueFollowUps.length,
        hotLeads: spContacts.filter(c => c.status === "Hot").length,
      };
    });
  } catch (e) { console.error("getTeamStats error:", e); return []; }
}

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
// NOTE: No Firestore where()+orderBy() combos here on purpose.
// We fetch the full collection (small dataset, fine for a team CRM)
// and filter/sort in JavaScript. This avoids needing Firestore
// composite indexes, which were causing "could not load" errors
// for salesperson logins (FirebaseError: query requires an index).
export async function getContacts(salesperson = null) {
  try {
    const snap = await getDocs(collection(db, "contacts"));
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (salesperson && salesperson !== "admin") {
      results = results.filter(c => c.salesperson === salesperson);
    }
    return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (e) {
    console.error("getContacts error:", e);
    return [];
  }
}

export async function checkDuplicatePhone(phone, excludeId = null) {
  try {
    if (!phone || phone.length < 5) return false;
    const snap = await getDocs(collection(db, "contacts"));
    return snap.docs.filter(d => d.id !== excludeId && d.data().phone === phone).length > 0;
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

// ─── Deals ──────────────────────────────────────────────────
// Same fix as Contacts above — filter/sort in JS, not in the query.
export async function getDeals(salesperson = null) {
  try {
    const snap = await getDocs(collection(db, "deals"));
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (salesperson && salesperson !== "admin") {
      results = results.filter(d => d.salesperson === salesperson);
    }
    return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (e) {
    console.error("getDeals error:", e);
    return [];
  }
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
// Same fix — filter/sort in JS, not in the query.
export async function getActivities(salesperson = null) {
  try {
    const snap = await getDocs(collection(db, "activities"));
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (salesperson && salesperson !== "admin") {
      results = results.filter(a => a.salesperson === salesperson || a.dealSalesperson === salesperson);
    }
    return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (e) {
    console.error("getActivities error:", e);
    return [];
  }
}

export async function getActivitiesForDeal(dealId) {
  try {
    const snap = await getDocs(collection(db, "activities"));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.dealId === dealId)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  } catch (e) {
    console.error(e);
    return [];
  }
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
  } catch (e) {
    console.error("getSalespersons error:", e);
    return [];
  }
}

export async function addSalesperson(name) {
  return addDoc(collection(db, "salespersons"), { name, createdAt: serverTimestamp() });
}
// ─── ADDITIONS TO lib/firebase.js ────────────────────────────────────────────
// Add these functions to the bottom of your existing firebase.js file.
// They add soft-delete (recycle bin) support for contacts, deals, and activities.
// Also import { serverTimestamp } at the top if not already present (it is).

import { serverTimestamp, where, query, collection, getDocs, updateDoc, deleteDoc, doc, addDoc, orderBy } from "firebase/firestore";
import { db } from "./firebase"; // adjust path if needed when merging

// ─── Soft delete helpers ─────────────────────────────────────────────────────
// Instead of permanently deleting, we mark deleted:true + deletedAt timestamp.
// All existing getContacts/getDeals/getActivities queries already filter by
// salesperson using `where` clauses — soft-deleted docs won't appear there
// because we add `where("deleted","!=",true)` to each main query below.

// ── Contacts ──────────────────────────────────────────────────────────────────
export async function softDeleteContact(id, deletedBy = "") {
  return updateDoc(doc(db, "contacts", id), {
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedBy,
  });
}
export async function restoreContact(id) {
  return updateDoc(doc(db, "contacts", id), {
    deleted: false,
    deletedAt: null,
    deletedBy: null,
  });
}
export async function permanentDeleteContact(id) {
  return deleteDoc(doc(db, "contacts", id));
}
export async function getDeletedContacts(salespersonFilter = null) {
  let q = salespersonFilter
    ? query(collection(db, "contacts"), where("deleted","==",true), where("salesperson","==",salespersonFilter), orderBy("deletedAt","desc"))
    : query(collection(db, "contacts"), where("deleted","==",true), orderBy("deletedAt","desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Deals ─────────────────────────────────────────────────────────────────────
export async function softDeleteDeal(id, deletedBy = "") {
  return updateDoc(doc(db, "deals", id), {
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedBy,
  });
}
export async function restoreDeal(id) {
  return updateDoc(doc(db, "deals", id), {
    deleted: false,
    deletedAt: null,
    deletedBy: null,
  });
}
export async function permanentDeleteDeal(id) {
  return deleteDoc(doc(db, "deals", id));
}
export async function getDeletedDeals(salespersonFilter = null) {
  let q = salespersonFilter
    ? query(collection(db, "deals"), where("deleted","==",true), where("salesperson","==",salespersonFilter), orderBy("deletedAt","desc"))
    : query(collection(db, "deals"), where("deleted","==",true), orderBy("deletedAt","desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Activities ────────────────────────────────────────────────────────────────
export async function softDeleteActivity(id, deletedBy = "") {
  return updateDoc(doc(db, "activities", id), {
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedBy,
  });
}
export async function restoreActivity(id) {
  return updateDoc(doc(db, "activities", id), {
    deleted: false,
    deletedAt: null,
    deletedBy: null,
  });
}
export async function permanentDeleteActivity(id) {
  return deleteDoc(doc(db, "activities", id));
}
export async function getDeletedActivities(salespersonFilter = null) {
  let q = salespersonFilter
    ? query(collection(db, "activities"), where("deleted","==",true), where("salesperson","==",salespersonFilter), orderBy("deletedAt","desc"))
    : query(collection(db, "activities"), where("deleted","==",true), orderBy("deletedAt","desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── IMPORTANT: Update your existing getContacts / getDeals / getActivities ──
// Add where("deleted","!=",true) to each query so soft-deleted docs don't show.
// Example for getContacts — do the same for getDeals and getActivities:
//
// export async function getContacts(salespersonFilter = null) {
//   let q = salespersonFilter
//     ? query(collection(db, "contacts"),
//         where("salesperson","==",salespersonFilter),
//         where("deleted","!=",true),         // ← ADD THIS
//         orderBy("deleted"),                  // ← Firestore requires orderBy when using !=
//         orderBy("createdAt","desc"))
//     : query(collection(db, "contacts"),
//         where("deleted","!=",true),         // ← ADD THIS
//         orderBy("deleted"),
//         orderBy("createdAt","desc"));
//   const snap = await getDocs(q);
//   return snap.docs.map(d => ({ id: d.id, ...d.data() }));
// }
//
// NOTE: The != operator requires a Firestore composite index.
// When you first run this, Firestore will show a console error with a direct
// link to create the index — just click it and wait ~1 minute.
// You need one index per collection: contacts, deals, activities.
export async function deleteSalesperson(id) {
  return deleteDoc(doc(db, "salespersons", id));
}


Please give me full updated code .

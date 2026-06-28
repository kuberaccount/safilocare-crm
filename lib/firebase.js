import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, query, orderBy, serverTimestamp, where, getDoc, setDoc
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
export { deleteDoc, doc };

// ─── User approval ───────────────────────────────────────────
export async function requestAccess(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // Check if pre-approved
    const emailKey = user.email.toLowerCase().replace(/[.@]/g, "_");
    const preSnap = await getDoc(doc(db, "preapproved", emailKey));
    const preData = preSnap.exists() ? preSnap.data() : null;
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      name: user.displayName,
      photo: user.photoURL,
      status: preData ? "approved" : "pending",
      salesperson: preData?.salesperson || "",
      role: preData?.role || "salesperson",
      requestedAt: serverTimestamp(),
    });
  }
  return (await getDoc(ref)).data();
}
export async function getUserStatus(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}
export async function getPendingUsers() {
  const q = query(collection(db, "users"), where("status", "==", "pending"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function approveUser(uid, salesperson = "", role = "salesperson") {
  return updateDoc(doc(db, "users", uid), { status: "approved", salesperson, role });
}
export async function rejectUser(uid) {
  return updateDoc(doc(db, "users", uid), { status: "rejected" });
}

// ─── Contacts ────────────────────────────────────────────────
export async function getContacts(salespersonFilter = null) {
  let q = salespersonFilter
    ? query(collection(db, "contacts"), where("salesperson", "==", salespersonFilter), orderBy("createdAt", "desc"))
    : query(collection(db, "contacts"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function checkDuplicatePhone(phone, excludeId = null) {
  const normalizedPhone = phone.replace(/\D/g, "");

  const snap = await getDocs(
    collection(db, "contacts")
  );

  return snap.docs.some(d => {
    if (d.id === excludeId) return false;

    const existingPhone =
      (d.data().phone || "").replace(/\D/g, "");

    return existingPhone === normalizedPhone;
  });
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

// ─── Deals ───────────────────────────────────────────────────
export async function getDeals(salespersonFilter = null) {
  let q = salespersonFilter
    ? query(collection(db, "deals"), where("salesperson", "==", salespersonFilter), orderBy("createdAt", "desc"))
    : query(collection(db, "deals"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

// ─── Activities ──────────────────────────────────────────────
export async function getActivities(salespersonFilter = null) {
  let q = salespersonFilter
    ? query(collection(db, "activities"), where("salesperson", "==", salespersonFilter), orderBy("createdAt", "desc"))
    : query(collection(db, "activities"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getActivitiesForDeal(dealId) {
  const q = query(collection(db, "activities"), where("dealId", "==", dealId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

// ─── Salespersons ─────────────────────────────────────────────
export async function getSalespersons() {
  const snap = await getDocs(collection(db, "salespersons"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function addSalesperson(name, email = "") {
  return addDoc(collection(db, "salespersons"), { name, email, createdAt: serverTimestamp() });
}
export async function deleteSalesperson(id) {
  return deleteDoc(doc(db, "salespersons", id));
}

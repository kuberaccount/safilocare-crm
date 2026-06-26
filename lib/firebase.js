// lib/firebase.js
// STEP 1: Replace the values below with YOUR Firebase project values.
// Go to: https://console.firebase.google.com
// → Create project → Add web app → Copy the config object here.

import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
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

export async function getContacts() {
  const q = query(collection(db, "contacts"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

export async function getDeals() {
  const q = query(collection(db, "deals"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

export async function getActivities() {
  const q = query(collection(db, "activities"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function addActivity(data) {
  return addDoc(collection(db, "activities"), { ...data, createdAt: serverTimestamp() });
}
export async function deleteActivity(id) {
  return deleteDoc(doc(db, "activities", id));
}

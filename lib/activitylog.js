import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

// We log every important action to an "activitylog" collection
export async function logAction(userData, action, details = {}) {
  try {
    await addDoc(collection(db, "activitylog"), {
      uid: userData?.uid || "",
      userName: userData?.name || userData?.displayName || "Unknown",
      salesperson: userData?.salesperson || "Unassigned",
      role: userData?.role || "salesperson",
      action, // e.g. "Added Contact", "Added Lead", "Updated Lead", "Logged Activity", "Marked Follow-up"
      details, // e.g. { contactName, dealTitle, activityType }
      timestamp: serverTimestamp(),
    });
  } catch (e) { console.error("logAction error:", e); }
}

export async function getActivityLog() {
  try {
    const snap = await getDocs(collection(db, "activitylog"));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  } catch (e) { console.error(e); return []; }
}

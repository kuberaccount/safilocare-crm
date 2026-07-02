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
  serverTimestamp,
  getDoc
} from "firebase/firestore";

// 🔧 Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCRPu4s5hD3K1andQ2Tf3CSvaLnIoZh4SI",
  authDomain: "safilocare-crm.firebaseapp.com",
  projectId: "safilocare-crm",
  storageBucket: "safilocare-crm.firebasestorage.app",
  messagingSenderId: "970517789943",
  appId: "1:970517789943:web:c43423461a507abb1ce7f2",
  measurementId: "G-D271FFWPTJ",
};

// 🔧 Init
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// ─────────────────────────────────────────
// 👤 USER SYSTEM
// ─────────────────────────────────────────

export async function requestAccess(user) {
  try {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await addDoc(collection(db, "users"), {
        uid: user.uid,
        email: user.email,
        name: user.displayName,
        status: "pending",
        role: "salesperson",
        salesperson: "Unassigned",
        createdAt: serverTimestamp(),
      });
    }

    return (await getDoc(ref)).data();
  } catch (e) {
    console.error(e);
    return { status: "pending" };
  }
}

// ─────────────────────────────────────────
// 📇 CONTACTS
// ─────────────────────────────────────────

export async function getContacts(salesperson = null) {
  try {
    const snap = await getDocs(collection(db, "contacts"));

    let data = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    // ❗ Remove deleted contacts
    data = data.filter(c => !c.deleted);

    // ❗ Filter salesperson
    if (salesperson && salesperson !== "admin") {
      data = data.filter(c => c.salesperson === salesperson);
    }

    // ❗ IMPORTANT: fallback city/state
    data = data.map(c => ({
      ...c,
      city: c.city || "Unknown",
      state: c.state || "Unknown"
    }));

    return data.sort((a, b) =>
      (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );

  } catch (e) {
    console.error("getContacts error:", e);
    return [];
  }
}

export async function addContact(data) {
  return addDoc(collection(db, "contacts"), {
    ...data,
    city: data.city || "Unknown",
    state: data.state || "Unknown",
    deleted: false,
    createdAt: serverTimestamp()
  });
}

export async function updateContact(id, data) {
  return updateDoc(doc(db, "contacts", id), data);
}

export async function deleteContact(id) {
  return updateDoc(doc(db, "contacts", id), {
    deleted: true,
    deletedAt: serverTimestamp()
  });
}

// ─────────────────────────────────────────
// 💰 DEALS
// ─────────────────────────────────────────

export async function getDeals(salesperson = null) {
  try {
    const snap = await getDocs(collection(db, "deals"));

    let data = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    data = data.filter(d => !d.deleted);

    if (salesperson && salesperson !== "admin") {
      data = data.filter(d => d.salesperson === salesperson);
    }

    return data.sort((a, b) =>
      (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );

  } catch (e) {
    console.error("getDeals error:", e);
    return [];
  }
}

export async function addDeal(data) {
  return addDoc(collection(db, "deals"), {
    ...data,
    deleted: false,
    createdAt: serverTimestamp()
  });
}

export async function updateDeal(id, data) {
  return updateDoc(doc(db, "deals", id), data);
}

export async function deleteDeal(id) {
  return updateDoc(doc(db, "deals", id), {
    deleted: true,
    deletedAt: serverTimestamp()
  });
}

// ─────────────────────────────────────────
// 📞 ACTIVITIES
// ─────────────────────────────────────────

export async function getActivities(salesperson = null) {
  try {
    const snap = await getDocs(collection(db, "activities"));

    let data = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    data = data.filter(a => !a.deleted);

    if (salesperson && salesperson !== "admin") {
      data = data.filter(
        a => a.salesperson === salesperson || a.dealSalesperson === salesperson
      );
    }

    return data.sort((a, b) =>
      (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );

  } catch (e) {
    console.error("getActivities error:", e);
    return [];
  }
}

export async function addActivity(data) {
  return addDoc(collection(db, "activities"), {
    ...data,
    deleted: false,
    createdAt: serverTimestamp()
  });
}

// ─────────────────────────────────────────
// 👨‍💼 SALESPERSONS
// ─────────────────────────────────────────

export async function getSalespersons() {
  try {
    const snap = await getDocs(collection(db, "salespersons"));

    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function addSalesperson(name) {
  return addDoc(collection(db, "salespersons"), {
    name,
    createdAt: serverTimestamp()
  });
}

export async function deleteSalesperson(id) {
  return deleteDoc(doc(db, "salespersons", id));
}

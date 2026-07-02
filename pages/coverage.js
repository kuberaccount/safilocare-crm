
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

export default function Coverage() {
  const [coverageList, setCoverageList] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const coverageRef = collection(db, "coverage");

  const fetchCoverage = async () => {
    try {
      const data = await getDocs(coverageRef);
      const list = data.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCoverageList(list);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCoverage();
  }, []);

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      await addDoc(coverageRef, {
        name,
        createdAt: serverTimestamp(),
      });
      setName("");
      fetchCoverage();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "coverage", id));
      fetchCoverage();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (id) => {
    const newName = prompt("Enter new name");
    if (!newName) return;
    try {
      await updateDoc(doc(db, "coverage", id), {
        name: newName,
      });
      fetchCoverage();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Coverage</h2>

      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Enter coverage name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={handleAdd}>Add</button>
      </div>

      <ul>
        {coverageList.map((item) => (
          <li key={item.id} style={{ marginBottom: 10 }}>
            {item.name}
            <button onClick={() => handleUpdate(item.id)}>Edit</button>
            <button onClick={() => handleDelete(item.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

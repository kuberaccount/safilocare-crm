import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase"; // FIXED PATH

export default function Coverage() {
  const [coverageList, setCoverageList] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const coverageRef = collection(db, "coverage");

  const fetchCoverage = async () => {
    const data = await getDocs(coverageRef);
    setCoverageList(
      data.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchCoverage();
  }, []);

  const handleAdd = async () => {
    if (!name.trim()) return;
    await addDoc(coverageRef, {
      name,
      createdAt: serverTimestamp(),
    });
    setName("");
    fetchCoverage();
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, "coverage", id));
    fetchCoverage();
  };

  const handleUpdate = async (id) => {
    const newName = prompt("Enter new name");
    if (!newName) return;
    await updateDoc(doc(db, "coverage", id), {
      name: newName,
    });
    fetchCoverage();
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Coverage</h2>

      <div style={{ marginBottom: 20 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter coverage name"
        />
        <button onClick={handleAdd}>Add</button>
      </div>

      <ul>
        {coverageList.map((item) => (
          <li key={item.id}>
            {item.name}
            <button onClick={() => handleUpdate(item.id)}>Edit</button>
            <button onClick={() => handleDelete(item.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

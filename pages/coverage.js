import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getCoverageAreas, addCoverageArea, updateCoverageArea, deleteCoverageArea, getSalespersons } from "../lib/firebase";

export default function CoveragePage() {
  const [areas, setAreas] = useState([]);
  const [salespersons, setSalespersons] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    id: null,
    salesperson: "",
    city: "",
    state: "",
    pincode: "",
    notes: ""
  });

  async function loadData() {
    try {
      setLoading(true);
      const [areaData, spData] = await Promise.all([
        getCoverageAreas(),
        getSalespersons()
      ]);
      setAreas(areaData);
      setSalespersons(spData);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load coverage");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setForm({
      id: null,
      salesperson: "",
      city: "",
      state: "",
      pincode: "",
      notes: ""
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.salesperson || !form.city) {
      return toast.error("Salesperson & City required");
    }

    try {
      if (form.id) {
        await updateCoverageArea(form.id, form);
        toast.success("Updated");
      } else {
        await addCoverageArea(form);
        toast.success("Added");
      }
      resetForm();
      loadData();
    } catch (e) {
      console.error(e);
      toast.error("Error saving");
    }
  }

  async function handleEdit(a) {
    setForm(a);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this area?")) return;
    try {
      await deleteCoverageArea(id);
      toast.success("Deleted");
      loadData();
    } catch (e) {
      toast.error("Error deleting");
    }
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-400">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-bold mb-4">Coverage</h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-4 mb-6 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <select
            className="input"
            value={form.salesperson}
            onChange={(e) => setForm({ ...form, salesperson: e.target.value })}
          >
            <option value="">Select Salesperson</option>
            {salespersons.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>

          <input
            className="input"
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />

          <input
            className="input"
            placeholder="State"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
          />

          <input
            className="input"
            placeholder="Pincode"
            value={form.pincode}
            onChange={(e) => setForm({ ...form, pincode: e.target.value })}
          />

          <input
            className="input"
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary">
            {form.id ? "Update" : "Add"}
          </button>
          {form.id && (
            <button
              type="button"
              onClick={resetForm}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Table */}
      <div className="card overflow-x-auto">
        {areas.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            No coverage data
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {["Salesperson","City","State","Pincode","Notes",""].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{a.salesperson}</td>
                  <td className="px-4 py-2">{a.city}</td>
                  <td className="px-4 py-2">{a.state}</td>
                  <td className="px-4 py-2">{a.pincode}</td>
                  <td className="px-4 py-2">{a.notes}</td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(a)}
                      className="text-blue-600 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-red-600 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

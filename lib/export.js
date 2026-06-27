// Simple CSV export helper — no dependencies.
// Usage: exportToCSV("activities.csv", rows, [{ key:"type", label:"Type" }, ...])

function csvEscape(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(filename, rows, columns) {
  if (!rows || rows.length === 0) {
    throw new Error("No data to export");
  }

  const header = columns.map(c => csvEscape(c.label)).join(",");
  const lines = rows.map(row =>
    columns.map(c => csvEscape(typeof c.value === "function" ? c.value(row) : row[c.key])).join(",")
  );

  const csvContent = [header, ...lines].join("\n");
  // Prepend BOM so Excel opens UTF-8 (₹ etc.) correctly
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Formats a Firestore Timestamp / Date / string into a plain readable string for CSV
export function fmtDateForExport(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

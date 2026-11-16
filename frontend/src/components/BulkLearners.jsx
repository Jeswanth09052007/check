import { useState } from "react";
import { api, csv, download } from "../services/api";
import { Modal, Notice, Table } from "./Common";

export default function BulkLearners({ onClose, onImported }) {
  const [source, setSource] = useState("file");
  const [file, setFile] = useState(null);
  const [link, setLink] = useState("");
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (rows.length) {
        const imported = await api("/users/bulk-learners", "POST", { rows });
        setResult(imported);
        onImported(imported.count);
      } else {
        const data = new FormData();
        if (source === "file") {
          if (!file || file.size > 5 * 1024 * 1024) throw Error("Choose a CSV or PDF of 5 MB or less.");
          data.append("file", file);
        } else {
          data.append("sheetUrl", link.trim());
        }
        setRows(await api("/users/bulk-learners/preview", "POST", data));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return <Modal title="Bulk add learners" onClose={() => { if (!busy) onClose(); }}>
    {result ? <>
      <p className="mb-16" role="status">{result.count} learner account(s) created. Download the generated passwords before closing and share each password privately with its learner.</p>
      <button className="btn btn-primary" onClick={() => download("indai-learner-credentials.csv", result.csv)}>
        Download learner credentials
      </button>
    </> : <form onSubmit={submit}>
      {rows.length ? <>
        <p className="mb-16" role="status">Review {rows.length} learner account(s) before creating them.</p>
        <Table heads={["First Name", "Last Name", "Email", "Institution", "Student ID"]}
          rows={rows.map(row => [row.firstName, row.lastName, row.email, row.institution || "—", row.studentId || "—"])} />
        <button className="btn btn-secondary mt-16" type="button" disabled={busy} onClick={() => { setRows([]); setError(""); }}>
          Choose a different source
        </button>{" "}
      </> : <>
        <label className="form-label" htmlFor="learner-import-source">Source</label>
        <select id="learner-import-source" className="form-select mb-16" value={source}
          disabled={busy} onChange={e => { setSource(e.target.value); setFile(null); setError(""); }}>
          <option value="file">Upload CSV or PDF</option>
          <option value="sheet">Google Sheets link</option>
        </select>
        {source === "sheet" ? <>
          <label className="form-label" htmlFor="learner-import-sheet">Google Sheets link</label>
          <input id="learner-import-sheet" className="form-input mb-16" type="url" maxLength={2048} required
            value={link} disabled={busy} onChange={e => setLink(e.target.value)} />
          <p className="mb-16">Use a sheet that allows access by link. For a private sheet, download the current tab as CSV and upload it here.</p>
        </> : <>
          <label className="form-label" htmlFor="learner-import-file">Learner list file</label>
          <input id="learner-import-file" className="mb-16" type="file" accept=".csv,.pdf" required
            disabled={busy} onChange={e => setFile(e.target.files[0] || null)} />
        </>}
        <p className="mb-16">Use the headers First Name, Last Name and Email. Institution and Student ID are optional and must appear together. Import up to 500 learners at a time.</p>
        <details className="mb-16">
          <summary>See the PDF list format</summary>
          <pre>{"First Name | Last Name | Email\nAsha | Kumar | asha@gmail.com"}</pre>
          <p>Use selectable text and put one learner on each line.</p>
        </details>
        <button type="button" className="btn btn-secondary mb-16" onClick={() => download("indai-learner-template.csv", csv([
          ["First Name", "Last Name", "Email", "Institution", "Student ID"],
        ]))}>Download CSV template</button>{" "}
      </>}
      <Notice error={error} />
      <button className="btn btn-primary mt-16" disabled={busy}>
        {busy ? "Working…" : rows.length ? "Create learner accounts" : "Preview learners"}
      </button>
    </form>}
  </Modal>;
}

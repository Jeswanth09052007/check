import { useState } from "react";
import { useResource } from "../hooks/useResource";
import { Card, Notice, Table } from "./Common";

const labels = {
  route: "API route", statusCode: "HTTP status", requestId: "Request ID",
  actorRole: "Role", adminTeam: "Admin division", sessionId: "Session ID",
  assignmentId: "Assignment ID", learnerId: "Learner ID", instructorId: "Instructor ID",
  creatorId: "Organizer ID", targetUserId: "Account ID", remark: "Remark",
};
const formatDate = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Kolkata",
});

export default function AuditLog() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useResource(
    `/superuser/audit-logs?page=${page}&search=${encodeURIComponent(search)}`, { events: [], total: 0 }, page === 1 ? 5000 : 60000,
  );
  const pages = Math.max(1, Math.ceil(data.total / 50));
  return <Card title="Audit Log" subtitle="Platform changes, workflow decisions and failed API actions. Times are shown in IST.">
    <form className="mb-16" onSubmit={event => {
      event.preventDefault();
      setPage(1);
      setSearch(query.trim());
    }}>
      <label htmlFor="audit-search" className="form-label">Search activity</label>
      <input id="audit-search" className="form-input mb-16" maxLength={150} value={query}
        onChange={event => setQuery(event.target.value)} placeholder="Action, actor, record ID or remark" />
      <button className="btn btn-primary btn-sm">Search</button>{" "}
      <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>Refresh</button>
    </form>
    <Notice error={error} />
    {loading ? <p role="status">Loading activity…</p> :
      <Table heads={["Time (IST)", "Actor", "Action", "Details"]} rows={data.events.map(event => [
        Number.isFinite(Date.parse(event.createdAt)) ? formatDate.format(new Date(event.createdAt)) : "—",
        <>{event.actorName || event.actorId}{event.actorRole && <div className="card-subtitle">{event.actorRole}</div>}</>,
        event.action.replaceAll("_", " "),
        <div style={{ overflowWrap: "anywhere" }}>
          {Object.entries(event.details || {}).filter(([key]) => !["durationMs", "succeeded"].includes(key)).map(([key, value]) =>
            <div key={key}><strong>{labels[key] || key}</strong> {typeof value === "object" ? JSON.stringify(value) : String(value)}</div>,
          )}
        </div>,
      ])} />}
    <div className="mt-16">
      <button className="btn btn-secondary btn-sm" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
      {" "}<span>Page {page} of {pages} · {data.total} events</span>{" "}
      <button className="btn btn-secondary btn-sm" disabled={loading || page >= pages} onClick={() => setPage(page + 1)}>Next</button>
    </div>
  </Card>;
}

import { useState } from "react";
import BulkLearners from "./BulkLearners";
import { api, money } from "../services/api";
import { useResource } from "../hooks/useResource";
import { Card, Editor, Modal, Table, Empty, Notice } from "./Common";
const names = [
  { name: "firstName", label: "First name", minLength: 3 },
  { name: "lastName", label: "Last name", minLength: 3 },
  { name: "email", type: "email" },
];
export function UserManager({
  user,
  kind,
  search = "",
  roleFilter = "",
  statusFilter = "",
  openSignal = 0,
  notify,
}) {
  const users = useResource(
      user.adminTeam === "PAYMENT_ADMIN" ? null : "/users",
    ),
    [edit, setEdit] = useState(null),
    [deleting, setDeleting] = useState(null),
    [bulk, setBulk] = useState(false),
    [seen, setSeen] = useState(openSignal),
    [error, setError] = useState("");
  if (openSignal !== seen) {
    setSeen(openSignal);
    setEdit({});
  }
  const items = users.data.filter(
    (u) =>
      (!kind || u.role === kind) &&
      (!roleFilter || roleFilter === "all" || (u.role === roleFilter || u.adminTeam === roleFilter)) &&
      (!statusFilter || statusFilter === "all" || u.status === statusFilter) &&
      `${u.firstName} ${u.lastName} ${u.email}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const options = users.data
    .filter((u) => u.role === "instructor")
    .map((u) => ({ value: u.id, label: u.firstName + " " + u.lastName }));
  async function run(fn) {
    try {
      await fn();
      users.reload();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <Notice error={users.error || error} />
      {(!kind || kind === "learner") && (user.role === "superuser" || user.adminTeam === "USER_ADMIN") && (
        <button className="btn btn-secondary mb-16" onClick={() => setBulk(true)}>Bulk add learners</button>
      )}
      {bulk && <BulkLearners onClose={() => setBulk(false)} onImported={count => {
        users.reload();
        notify(`${count} learner account(s) created.`);
      }} />}
      <Table
        heads={["Name / Status", "Role", "Email", "Actions"]}
        rows={items.map((u) => [
          <>
            <strong>
              {u.firstName} {u.lastName}
            </strong>
            <br />
            <span className="badge badge-blue">{u.status}</span>
          </>,
          u.adminTeam || u.role,
          u.email,
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setEdit(u)}
            >
              Edit
            </button>
            {u.role === "provider" && !u.providerVerified && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  run(() =>
                    api("/users/" + u.id, "PATCH", { providerVerified: true }),
                  )
                }
              >
                Verify
              </button>
            )}
            {u.role !== "superuser" && (user.role === "superuser" || (user.adminTeam === "USER_ADMIN" && u.role !== "admin")) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setDeleting(u)}
              >
                Delete
              </button>
            )}
          </div>,
        ])}
      />
      {deleting && (
        <Modal title="Delete account" onClose={() => setDeleting(null)}>
          <p className="mb-16">The deletion reason will be emailed to <strong>{deleting.email}</strong>.</p>
          <Editor
            fields={[{ name: "reason", label: "Reason for deletion", type: "textarea", maxLength: 1000 }]}
            submit="Email reason and delete account"
            onSubmit={async (values) => {
              await api("/users/" + deleting.id, "DELETE", values);
              setDeleting(null);
              users.reload();
              notify("Deletion notice emailed and account removed.");
            }}
          />
        </Modal>
      )}
      {edit && (
        <Modal
          title={edit.id ? "Edit Account" : "Create Account"}
          onClose={() => setEdit(null)}
        >
          <AccountForm user={user} edit={edit} kind={kind} instructors={options}
            onSubmit={async (values) => {
              let b = Object.fromEntries(
                Object.entries(values).filter(
                  ([k, v]) => v !== "" && v !== undefined,
                ),
              );
              const allowed = edit.id
                ? [
                    "firstName",
                    "lastName",
                    "email",
                    "status",
                    "institution",
                    "instructorId",
                    "adminTeam",
                    "organization", "expertise", "yearsExp", "studentId",
                  ]
                : [
                    "firstName",
                    "lastName",
                    "email",
                    "role",
                    "password",
                    "status",
                    "institution",
                    "studentId",
                    "organization",
                    "expertise",
                    "yearsExp",
                    "adminTeam",
                    "instructorId",
                  ];
              b = Object.fromEntries(
                Object.entries(b).filter(([k]) => allowed.includes(k)),
              );
              await api(
                "/users" + (edit.id ? "/" + edit.id : ""),
                edit.id ? "PATCH" : "POST",
                b,
              );
              setEdit(null);
              users.reload();
              notify(b.instructorId && b.instructorId !== edit.instructorId ? "Account saved. Instructor acceptance is required before mapping." : "Account saved.");
            }}
          />
        </Modal>
      )}
    </>
  );
}
const remarkField = { name: "remark", label: "Rejection remark", type: "textarea", maxLength: 1000 };
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const dateInIndia = (timestamp = Date.now()) => new Date(timestamp + IST_OFFSET_MS).toISOString().slice(0, 10);
const assignedLearners = (users, instructorId) => users
  .filter(u => u.role === "learner" && u.status === "active" && u.instructorId === instructorId)
  .map(u => u.id);
const activeInstructors = users => users.filter(u => u.role === "instructor" && u.status === "active")
  .map(u => ({ value: u.id, label: u.firstName + " " + u.lastName }));
const instructorOptions = (users, currentId) => {
  const options = activeInstructors(users);
  const current = users.find(u => u.id === currentId);
  if (currentId && !options.some(o => o.value === currentId)) {
    options.push({ value: currentId, label: current ? current.firstName + " " + current.lastName : currentId });
  }
  return options;
};
function RejectionForm({ title, onClose, onSubmit }) {
  return <Modal title={title} onClose={onClose}>
    <Editor fields={[remarkField]} onSubmit={onSubmit} submit="Confirm rejection" />
  </Modal>;
}
export function Approvals({ notify }) {
  const r = useResource("/superuser/pending-approvals");
  const [reject, setReject] = useState(null);
  return (
    <>
      <Notice error={r.error} />
      {r.data.map((u) => (
        <Card
          key={u.id}
          title={`${u.firstName} ${u.lastName}`}
          subtitle={u.email + " · " + (u.adminTeam || u.role)}
        >
          <button
            className="btn btn-green"
            onClick={async () => {
              try {
                await api(
                  "/superuser/approvals/" + u.id + "/approve",
                  "POST",
                  {},
                );
                r.reload();
                notify("Approved.");
              } catch (e) {
                notify(e.message);
              }
            }}
          >
            Approve
          </button>{" "}
          <button className="btn btn-secondary" onClick={() => setReject(u)}>
            Reject
          </button>
        </Card>
      ))}
      {!r.data.length && <Empty>No pending approvals.</Empty>}
      {reject && <RejectionForm title="Reject account request" onClose={() => setReject(null)}
        onSubmit={async values => {
          await api("/superuser/approvals/" + reject.id + "/reject", "POST", values);
          setReject(null);
          r.reload();
          notify("Account request rejected.");
        }} />}
    </>
  );
}
export function Assignments({ user, openSignal = 0, notify }) {
  const r = useResource(
      user.role === "learner"
        ? "/assignments/learner/" + user.id
        : "/assignments",
    ),
    u = useResource(
      ["admin", "superuser", "instructor"].includes(user.role)
        ? "/users"
        : null,
    ),
    courses = useResource(
      user.role === "provider" ? "/courses/provider/" + user.id : null,
    ),
    [edit, setEdit] = useState(null),
    [seen, setSeen] = useState(openSignal),
    [submit, setSubmit] = useState(null),
    [reject, setReject] = useState(null);
  if (openSignal !== seen) {
    setSeen(openSignal);
    setEdit({});
  }
  return (
    <>
      <Notice error={r.error} />
      {r.data
        .filter((a) => user.role === "provider" ? a.providerId === user.id : user.role === "instructor" ? a.instructorId === user.id : true)
        .map((a) => {
          const ownSubmission = a.submissions?.find(s => s.learnerId === user.id);
          const completed = a.completedIds?.includes(user.id);
          return (
          <Card
            key={a.id}
            title={a.title}
            subtitle={`${a.dueDate} · ${a.skillPoints} skill points · ${a.status}`}
          >
            <p>{a.description}</p>
            {user.role === "learner" ? (
              <div>
                {completed ? <p>Approved</p> : ownSubmission?.status === "rejected" ? (
                  <p>Rejected. Remark: {ownSubmission.remark}</p>
                ) : ownSubmission ? <p>Awaiting review</p> : null}
                {!completed && (!ownSubmission || ownSubmission.status === "rejected") && (
                  <button className="btn btn-primary btn-sm" onClick={() => setSubmit(a)}>
                    {ownSubmission ? "Resubmit work" : "Submit work"}
                  </button>
                )}
              </div>
            ) : (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEdit(a)}
                >
                  Edit
                </button>{" "}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    if (confirm("Delete assignment?"))
                      try {
                        await api("/assignments/" + a.id, "DELETE");
                        r.reload();
                      } catch (e) {
                        notify(e.message);
                      }
                  }}
                >
                  Delete
                </button>
                {(a.submissions || []).map((s) => {
                  const reviewed = a.completedIds?.includes(s.learnerId) ? "approved" : s.status || "pending";
                  return <div key={s.learnerId} className="mt-16">
                    <p style={{ whiteSpace: "pre-wrap" }}>{s.learnerId}: {s.submissionText || s.text}</p>
                    {reviewed === "pending" ? <>
                      <button className="btn btn-green btn-sm" onClick={async () => {
                        try {
                          await api(`/assignments/${a.id}/approve/${s.learnerId}`, "POST", {});
                          notify("Completion approved.");
                          r.reload();
                        } catch (e) {
                          notify(e.message);
                        }
                      }}>Approve completion</button>{" "}
                      <button className="btn btn-secondary btn-sm" onClick={() => setReject({ assignment: a, submission: s })}>
                        Reject submission
                      </button>
                    </> : <p>{reviewed === "approved" ? "Approved" : `Rejected. Remark: ${s.remark}`}</p>}
                  </div>;
                })}
              </>
            )}
          </Card>
        ); })}
      {!r.data.length && <Empty />}
      {edit && (
        <Modal title="Assignment" onClose={() => setEdit(null)}>
          <Editor
            fields={[
              { name: "title", label: "Title", minLength: 3, maxLength: 200 },
              { name: "description", label: "Description", type: "textarea", minLength: 3, maxLength: 10000 },
              { name: "dueDate", label: "Due date (IST)", type: "date", min: !edit.id ? dateInIndia() : undefined, max: dateInIndia(Date.now() + 365 * DAY_MS) },
              { name: "skillPoints", label: "Skill points", type: "number", min: 1, max: 200, step: 1 },
              { name: "difficulty", options: ["Easy", "Medium", "Hard"] },
              ...(user.role === "provider" || edit.providerId
                ? [
                    {
                      name: "courseId",
                      options: user.role === "provider" ? courses.data.map(c => ({ value: c.id, label: c.title })) : [{ value: edit.courseId, label: edit.courseId }],
                    },
                  ]
                : user.role !== "instructor"
                  ? [
                      {
                        name: "instructorId",
                        options: instructorOptions(u.data, edit.instructorId),
                      },
                    ]
                  : []),
            ]}
            initial={{ skillPoints: 50, difficulty: "Medium", ...edit }}
            onSubmit={async (v) => {
              const instructorId = user.role === "instructor" ? user.id : v.instructorId;
              if ((!edit.id || edit.instructorId !== instructorId) && !edit.providerId && user.role !== "provider" && (u.loading || u.error)) {
                throw Error("Wait for the learner roster to load before saving.");
              }
              const b = {
                title: v.title,
                description: v.description,
                dueDate: v.dueDate,
                skillPoints: Number(v.skillPoints),
                difficulty: v.difficulty,
                ...(user.role === "provider" || edit.providerId
                  ? { providerId: edit.providerId || user.id, courseId: v.courseId }
                  : {
                      instructorId,
                      ...(!edit.id || edit.instructorId !== instructorId
                        ? { studentIds: assignedLearners(u.data, instructorId) } : {}),
                    }),
              };
              await api(
                "/assignments" + (edit.id ? "/" + edit.id : ""),
                edit.id ? "PATCH" : "POST",
                b,
              );
              setEdit(null);
              r.reload();
              notify("Assignment saved.");
            }}
          />
        </Modal>
      )}
      {reject && <RejectionForm title="Reject assignment submission" onClose={() => setReject(null)}
        onSubmit={async values => {
          await api(`/assignments/${reject.assignment.id}/reject/${reject.submission.learnerId}`, "POST", values);
          setReject(null);
          r.reload();
          notify("Submission rejected and learner notified.");
        }} />}
      {submit && (
        <Modal title={submit.title} onClose={() => setSubmit(null)}>
          <Editor
            fields={[
              {
                name: "submissionText",
                label: "Your solution",
                type: "textarea",
                maxLength: 20000,
              },
            ]}
            onSubmit={async (v) => {
              await api("/assignments/" + submit.id + "/submit", "POST", {
                learnerId: user.id,
                ...v,
              });
              setSubmit(null);
              r.reload();
              notify("Submitted for review.");
            }}
          />
        </Modal>
      )}
    </>
  );
}
export function Sessions({ user, openSignal = 0, notify }) {
  const isInstructor = user.role === "instructor";
  const isAdmin = ["admin", "superuser"].includes(user.role);
  const r = useResource(
    user.role === "learner" ? "/sessions/learner/" + user.id : "/sessions", [], 5000,
  );
  const u = useResource(isAdmin || isInstructor ? "/users" : null);
  const [edit, setEdit] = useState(null);
  const [seen, setSeen] = useState(openSignal);
  const [reject, setReject] = useState(null);
  const [accepting, setAccepting] = useState("");
  if (openSignal !== seen) {
    setSeen(openSignal);
    setEdit({});
  }
  async function decide(session, decision, values = {}) {
    await api(`/sessions/${session.id}/${decision}`, "POST", { ...values, expectedRevision: session.approvalRevision });
    r.reload();
    notify(decision === "accept" ? "Session accepted. The organizer was notified." : "Session rejected. The organizer was notified.");
  }
  return <>
    <Notice error={r.error || u.error} />
    {r.data.map(s => {
      const pending = s.approvalStatus === "pending";
      const canEdit = isAdmin || (isInstructor && !s.approvalStatus);
      const status = pending ? "Awaiting instructor approval" : s.approvalStatus === "accepted" && s.status === "scheduled" ? "Accepted" : s.status;
      const instructor = u.data.find(person => person.id === s.instructorId);
      return <Card key={s.id} title={s.title} subtitle={`${s.date} ${s.time} IST · ${status}`}>
        <p>{s.description}</p>
        {isAdmin && instructor && <p>Instructor: {instructor.firstName} {instructor.lastName}</p>}
        {s.approvalRemark && <p>Rejection remark: {s.approvalRemark}</p>}
        {isInstructor && pending && <>
          <button className="btn btn-green btn-sm" disabled={Boolean(accepting)} onClick={async () => {
            setAccepting(s.id);
            try {
              await decide(s, "accept");
            } catch (error) {
              notify(error.message);
            } finally {
              setAccepting("");
            }
          }}>Accept session</button>{" "}
          <button className="btn btn-secondary btn-sm" disabled={Boolean(accepting)} onClick={() => setReject(s)}>
            Reject session
          </button>
        </>}
        {canEdit && <>
          <button className="btn btn-secondary btn-sm" onClick={() => setEdit(s)}>Edit</button>{" "}
          <button className="btn btn-secondary btn-sm" onClick={async () => {
            if (!confirm("Delete session?")) return;
            try {
              await api("/sessions/" + s.id, "DELETE");
              r.reload();
              notify("Session removed.");
            } catch (error) {
              notify(error.message);
            }
          }}>Delete</button>
        </>}
      </Card>;
    })}
    {!r.loading && !r.data.length && <Empty>No sessions yet.</Empty>}
    {reject && <RejectionForm title="Reject session" onClose={() => setReject(null)} onSubmit={async values => {
      await decide(reject, "reject", values);
      setReject(null);
    }} />}
    {edit && <Modal title={edit.id ? "Edit Session" : "Schedule Session"} onClose={() => setEdit(null)}>
      <p className="card-subtitle mb-16">Enter the date and time in IST. New sessions and schedule changes must start at least one hour ahead.</p>
      <Editor fields={[
        { name: "title", label: "Title", minLength: 3, maxLength: 200 },
        { name: "description", label: "Description", type: "textarea", required: false, minLength: 3, maxLength: 10000 },
        { name: "date", label: "Date (IST)", type: "date", min: !edit.id ? dateInIndia(Math.ceil((Date.now() + 3600000) / 60000) * 60000) : undefined, max: dateInIndia(Date.now() + 365 * DAY_MS) },
        { name: "time", label: "Start time (IST)", type: "time" },
        { name: "duration", label: "Duration (minutes)", type: "number", min: 15, max: 480, step: 1 },
        ...(!isInstructor ? [{ name: "instructorId", label: "Instructor", options: instructorOptions(u.data, edit.instructorId) }] : []),
      ]} initial={{ duration: 60, ...edit }} onSubmit={async values => {
        const instructorId = isInstructor ? user.id : values.instructorId;
        const changed = !edit.id || values.date !== edit.date || values.time !== edit.time ||
          instructorId !== edit.instructorId || (edit.duration !== undefined && values.duration !== edit.duration);
        if ((!edit.id || instructorId !== edit.instructorId) && (u.loading || u.error)) {
          throw Error("Wait for the learner roster to load before saving.");
        }
        const startsAt = Date.parse(`${values.date}T${values.time}:00+05:30`);
        if (changed && (!Number.isFinite(startsAt) || startsAt < Date.now() + 3600000)) {
          throw Error("Session must start at least one hour from now (IST).");
        }
        const result = await api("/sessions" + (edit.id ? "/" + edit.id : ""), edit.id ? "PATCH" : "POST", {
          title: values.title, description: values.description ?? "",
          date: values.date, time: values.time, duration: values.duration, instructorId,
          ...(!edit.id || instructorId !== edit.instructorId ? { studentIds: assignedLearners(u.data, instructorId) } : {}),
        });
        setEdit(null);
        r.reload();
        notify(result.approvalStatus === "pending" ? "Session saved and awaiting instructor approval." : "Session saved.");
      }} />
    </Modal>}
  </>;
}
export function Configuration() {
  const r = useResource("/admin/config", {});
  return (
    <>
      <Notice error={r.error} />
      {!r.loading && (
        <Editor
          key={JSON.stringify(r.data)}
          fields={[
            { name: "platformName", label: "Platform name", minLength: 2 },
            {
              name: "maxDailyTrades",
              label: "Max daily trades",
              type: "number",
              step: 1,
              min: 1,
            },
            {
              name: "defaultTradingLimit",
              label: "Default trading limit",
              type: "number",
              step: 1,
              min: 1,
            },
            {
              name: "cooldown",
              label: "Cooldown (seconds)",
              type: "number",
              step: 1,
              min: 0,
            },
          ]}
          initial={{ cooldown: 0, ...r.data }}
          onSubmit={async (v) => {
            await api(
              "/admin/config",
              "PATCH",
              Object.fromEntries(
                [
                  "platformName",
                  "maxDailyTrades",
                  "defaultTradingLimit",
                  "cooldown",
                ]
                  .filter((k) => v[k] !== undefined)
                  .map((k) => [k, v[k]]),
              ),
            );
            r.reload();
          }}
        />
      )}
    </>
  );
}

function AccountForm({user,edit,kind,instructors,onSubmit}){
 const [actor,setActor]=useState(edit.role||kind||"");
 const fields=[...names,...(!edit.id?[{name:"password",type:"password",minLength:8}]:[]),{name:"status",options:["active","pending","suspended"]}];
 if(actor==="learner")fields.push({name:"institution",label:"Institution",required:false},{name:"studentId",label:"Student ID",required:false},{name:"instructorId",label:"Request instructor (acceptance required)",options:instructors,required:false});
 if(actor==="instructor")fields.push({name:"institution",label:"Institution"},{name:"expertise",label:"Specialization"},{name:"yearsExp",label:"Years experience",options:["0-1","1-3","3-5","5+"]});
 if(actor==="provider")fields.push({name:"organization",label:"Organization"});
 if(actor==="admin")fields.push({name:"adminTeam",label:"Admin division",options:[{value:"USER_ADMIN",label:"User Admin"},{value:"PAYMENT_ADMIN",label:"Payment Admin"}]});
 return <><label className="form-label" htmlFor="account-actor">Actor</label><select id="account-actor" className="form-select mb-16" value={actor} disabled={!!edit.id} onChange={e=>setActor(e.target.value)}><option value="">Choose actor first</option>{(edit.role==='superuser'?['superuser']:user.role==='superuser'?['learner','instructor','provider','admin']:['learner','instructor','provider']).map(v=><option key={v} value={v}>{{learner:'Learner',instructor:'Instructor',provider:'Course Provider',admin:'Admin',superuser:'Super Admin'}[v]}</option>)}</select>
 {actor&&<Editor key={actor} fields={fields} initial={{status:"active",...edit}} onSubmit={v=>onSubmit({...v,...(!edit.id?{role:actor}:{})})}/>}
 </>;
}

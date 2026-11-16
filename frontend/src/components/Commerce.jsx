import { useState } from "react";
import { api, money } from "../services/api";
import { checkout } from "../services/payments";
import { useResource } from "../hooks/useResource";
import { Card, Stats, Editor, Modal, Table, Notice } from "./Common";
function InstructorGuidance({ notify }) {
  const guidance = useResource("/admin/learner-guidance", {}, 5000);
  const [instructorId, setInstructorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { eligible, instructor, latestRequest, pending, instructors = [] } = guidance.data;
  async function request(event) {
    event.preventDefault();
    if (!instructorId || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/admin/learner-guidance/" + encodeURIComponent(instructorId), "POST", {});
      setInstructorId("");
      guidance.reload();
      notify("Instructor request sent.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <Card title="Instructor guidance">
    <Notice error={error || guidance.error} />
    {guidance.loading && <p role="status">Loading instructor options…</p>}
    {instructor && <p>Assigned instructor <strong>{instructor.name}</strong></p>}
    {pending && <p role="status">Instructor request pending{latestRequest?.instructorName && " · " + latestRequest.instructorName}</p>}
    {latestRequest?.status === "REJECTED" && !pending && <p>{latestRequest.instructorName} declined your request.</p>}
    {!guidance.loading && eligible === false && <p>Upgrade to Pro to request an instructor.</p>}
    {eligible && !pending && (instructors.length ? <form onSubmit={request}>
      <label className="form-label" htmlFor="guidance-instructor">Choose an instructor</label>
      <select id="guidance-instructor" className="form-select" value={instructorId}
        onChange={event => setInstructorId(event.target.value)} disabled={busy} required>
        <option value="">Select instructor</option>
        {instructors.filter(item => item.id !== instructor?.id).map(item =>
          <option key={item.id} value={item.id}>{item.name}{item.expertise && " · " + item.expertise}</option>)}
      </select>
      <button type="submit" className="btn btn-primary mt-16" disabled={!instructorId || busy}>Request guidance</button>
    </form> : <p>No instructors are currently available.</p>)}
  </Card>;
}

export function CourseCoordination({ user, notify }) {
  const resource = useResource("/admin/course-coordination", {}, 5000);
  const [selections, setSelections] = useState({});
  const [busy, setBusy] = useState(false);
  if (user.role === "learner") {
    if (resource.data.eligible !== true) return null;
    return <Card title="Course coordinator">
      <Notice error={resource.error} />
      <p>{resource.data.coordinator?.name || "Awaiting coordinator assignment"}</p>
    </Card>;
  }
  const { learners = [], instructors = [] } = resource.data;
  if (user.role === "instructor" && !learners.length) return null;

  async function assign(event, learnerId) {
    event.preventDefault();
    const choice = selections[learnerId];
    if (busy || !choice) return;
    setBusy(true);
    try {
      await api("/admin/course-coordination/" + encodeURIComponent(learnerId) + "/" +
        encodeURIComponent(choice), "POST", {});
      setSelections(current => ({ ...current, [learnerId]: undefined }));
      resource.reload();
      notify("Course coordinator assigned.");
    } catch (error) {
      notify(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <Card title="Course coordination">
    <Notice error={resource.error} />
    {resource.loading ? <p role="status">Loading…</p> : !learners.length && <p>No active Plus learners.</p>}
    {user.role === "instructor" ? <ul>{learners.map(learner => <li key={learner.id}>{learner.name}</li>)}</ul> :
      learners.map(learner => <form key={learner.id} className="mb-16" onSubmit={event => assign(event, learner.id)}>
        <label className="form-label" htmlFor={"coordinator-" + learner.id}>{learner.name}</label>
        <select id={"coordinator-" + learner.id} className="form-select"
          value={selections[learner.id] ?? learner.coordinatorId ?? ""}
          onChange={event => setSelections({ ...selections, [learner.id]: event.target.value })}>
          <option value="">Select coordinator</option>
          {instructors.map(instructor => <option key={instructor.id} value={instructor.id}>{instructor.name}</option>)}
        </select>
        <button type="submit" className="btn btn-secondary mt-16" disabled={busy || !selections[learner.id]}>Assign coordinator</button>
      </form>)}
  </Card>;
}

export function Subscription({ user, notify, onUser }) {
  const plans = useResource("/commercial/plans"),
    sub = useResource("/commercial/subscriptions/user/" + user.id, {});
  return (
    <>
      <Card title="Your Subscription" subtitle="Basic, Pro, and Plus access">
        <Notice error={sub.error} />
        <GatewayStatus />
        <span className="badge badge-blue">{sub.data.tier === "PLUS" ? "Plus" : sub.data.tier === "PRO" ? "Pro" : "Basic"}</span>
        <p>{sub.data.plan?.name || "Basic paper trading plan"}</p>
      </Card>
      <InstructorGuidance notify={notify} />
      <CourseCoordination user={user} notify={notify} />
      <div className="grid-3">
        {plans.data
          .filter((p) => p.audience === "B2C")
          .map((p) => (
            <Card
              key={p.id}
              title={p.name}
              subtitle={p.available === false ? "Checkout unavailable" : money(p.price) + " · " + p.billing}
            >
              <ul>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {p.available !== false && p.price > 0 && !(sub.data.tier === "PLUS" && p.code === "PRO") && (
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      await checkout({ user, planId: p.id });
                      sub.reload();
                      onUser?.(await api("/auth/me"));
                      notify("Payment verified. Your subscription is active.");
                    } catch (e) {
                      notify(e.message);
                    }
                  }}
                >
                  Pay with Razorpay
                </button>
              )}
            </Card>
          ))}
      </div>
    </>
  );
}
export function Revenue({ user, notify }) {
  const r = useResource("/commercial/revenue/summary", {}),
    orgs = useResource("/commercial/organizations"),
    pending = useResource("/commercial/courses/pending-review"),
    users = useResource(user.role === "superuser" ? "/users" : null),
    [review, setReview] = useState(null),
    [payOrg, setPayOrg] = useState(null);
  return (
    <>
      <Notice error={r.error} />
      <GatewayStatus />
      <div className="stat-grid">
        <Stats
          items={[
            [
              "B2C Pro",
              money(r.data.b2cProRevenue),
              "Verified subscriptions",
              "green",
            ],
            [
              "B2B Institutions",
              money(r.data.b2bInstitutionRevenue),
              "Institution licenses",
              "purple",
            ],
            [
              "Provider settlements",
              money(r.data.providerPayouts),
              "Internal settlements",
              "orange",
            ],
            [
              "Instructor settlements",
              money(r.data.instructorPayouts),
              "Compensation",
            ],
          ]}
        />
      </div>
      <div className="grid-2">
        <Card
          title="Course Pricing & Approval Queue"
          subtitle="Counter-offer or sanction provider production quotes"
        >
          <Notice error={pending.error} />
          {pending.data.map((c) => (
            <div
              className="flex-between"
              style={{ padding: "14px 0" }}
              key={c.id}
            >
              <div>
                <strong>{c.title}</strong>
                <p>
                  {money(c.quotedPrice)} · {c.reviewStatus}
                </p>
              </div>
              <button
                className="btn btn-purple btn-sm"
                onClick={() => setReview(c)}
              >
                Review
              </button>
            </div>
          ))}
        </Card>
        <Card
          title="Institution Billing"
          subtitle="Activate institution licenses with verified Razorpay payments"
        >
          {orgs.data.map((o) => (
            <div
              className="flex-between"
              style={{ padding: "14px 0" }}
              key={o.id}
            >
              <div>
                <strong>{o.name}</strong>
                <p>
                  {o.licenseStatus} · {money(o.annualPrice)}
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPayOrg(o)}
              >
                {o.licenseStatus === "ACTIVE" ? "Renew" : "Activate"}
              </button>
            </div>
          ))}
        </Card>
      </div>
      <Card title="Recent Payment Ledger">
        <Table
          heads={["Type", "Amount", "Gateway", "Status", "Reason"]}
          rows={(r.data.transactions || []).map((t) => [
            t.type,
            money(t.amount),
            t.gateway,
            t.status,
            t.reason || "—",
          ])}
        />
      </Card>
      <InstructorPay notify={notify} />
      <ProviderPay notify={notify} onPayment={r.reload} />
      {review && (
        <Modal title="Commercial Course Review" onClose={() => setReview(null)}>
          <p>
            {review.title} · Quote: {money(review.quotedPrice)}
          </p>
          <Editor
            fields={[
              {
                name: "offeredPrice",
                label: "Counter-offer (₹)",
                type: "number",
                min: 0,
              },
              { name: "message", label: "Negotiation note", type: "textarea" },
            ]}
            initial={{ offeredPrice: review.adminOffer ?? review.quotedPrice }}
            submit="Send Counter-offer"
            onSubmit={async (b) => {
              await api(
                "/commercial/courses/" + review.id + "/counter-offer",
                "POST",
                b,
              );
              setReview(null);
              pending.reload();
            }}
          />
          <button
            className="btn btn-green"
            style={{ marginTop: 16 }}
            onClick={async () => {
              try {
                await api(
                  "/commercial/courses/" + review.id + "/approve",
                  "POST",
                  {
                    sanctionedAmount: Number(
                      review.acceptedPrice ?? review.quotedPrice ?? 0,
                    ),
                  },
                );
                setReview(null);
                pending.reload();
                r.reload();
                notify("Course sanctioned and published.");
              } catch (e) {
                notify(e.message);
              }
            }}
          >
            Sanction & Publish
          </button>
        </Modal>
      )}
      {payOrg && (
        <Modal title={payOrg.name + " License"} onClose={() => setPayOrg(null)}>
          <Editor
            fields={[
              {
                name: "amount",
                label: "Annual license amount (₹)",
                type: "number",
                min: 1,
              },
            ]}
            initial={{ amount: payOrg.annualPrice }}
            submit="Pay with Razorpay"
            onSubmit={async (b) => {
              await checkout({ user, organization: payOrg, amount: b.amount });
              setPayOrg(null);
              orgs.reload();
              r.reload();
              notify("Institution license payment verified.");
            }}
          />
        </Modal>
      )}
    </>
  );
}
function InstructorPay({ notify }) {
  const r = useResource("/commercial/compensation/instructors"),
    [edit, setEdit] = useState(null);
  return (
    <Card
      title="Instructor Compensation"
      subtitle="Monthly per-student rates and skill growth bonuses"
    >
      <Notice error={r.error} />
      <Table
        heads={["Instructor", "Monthly rate", "Action"]}
        rows={r.data.map((i) => [
          i.firstName + " " + i.lastName,
          money(i.instructorMonthlyRate),
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setEdit(i)}
          >
            Manage
          </button>,
        ])}
      />
      {edit && (
        <Modal title="Instructor Compensation" onClose={() => setEdit(null)}>
          <Editor
            fields={[
              {
                name: "perStudentMonthlyRate",
                label: "Monthly rate per student",
                type: "number",
                min: 0,
              },
            ]}
            initial={{ perStudentMonthlyRate: edit.instructorMonthlyRate }}
            onSubmit={async (b) => {
              await api(
                "/commercial/instructors/" + edit.id + "/rate",
                "PATCH",
                b,
              );
              notify("Rate updated.");
              r.reload();
            }}
          />
          <Editor
            fields={[
              {
                name: "amount",
                label: "Performance bonus",
                type: "number",
                min: 1,
              },
              { name: "reason" },
            ]}
            onSubmit={async (b) => {
              await api(
                "/commercial/instructors/" + edit.id + "/bonus",
                "POST",
                b,
              );
              notify("Bonus recorded.");
            }}
          />
          <button
            className="btn btn-green"
            style={{ marginTop: 16 }}
            onClick={async () => {
              try {
                await api(
                  "/commercial/instructors/" + edit.id + "/pay-month",
                  "POST",
                  {},
                );
                notify("Monthly settlement recorded.");
              } catch (e) {
                notify(e.message);
              }
            }}
          >
            Settle current month
          </button>
        </Modal>
      )}
    </Card>
  );
}
function ProviderPay({ notify, onPayment }) {
  const providers = useResource("/commercial/compensation/providers");
  const [payment, setPayment] = useState(null);

  return <Card title="Course Provider Payments" subtitle="Record a completed provider settlement and its reason">
    <Notice error={providers.error} />
    <Table heads={["Course provider", "Email", "Action"]} rows={providers.data.map(provider => [
      `${provider.firstName} ${provider.lastName}`,
      provider.email,
      <button className="btn btn-secondary btn-sm" onClick={() => setPayment({ provider, requestId: crypto.randomUUID() })}>
        Record payment
      </button>,
    ])} />
    {payment && <Modal title="Record provider payment" onClose={() => setPayment(null)}>
      <p className="mb-16">{payment.provider.firstName} {payment.provider.lastName} · {payment.provider.email}</p>
      <p className="mb-16">Use this form after settling the payment. It records the amount and reason and notifies the provider.</p>
      <Editor
        fields={[
          { name: "amount", label: "Amount (₹)", type: "number", min: 0.01, max: 100000000, step: "0.01" },
          { name: "reason", label: "Payment reason", type: "textarea", maxLength: 1000 },
        ]}
        submit="Record provider payment"
        onSubmit={async values => {
          await api("/commercial/providers/" + payment.provider.id + "/payouts", "POST", {
            ...values, requestId: payment.requestId,
          });
          setPayment(null);
          onPayment();
          notify("Provider payment recorded.");
        }}
      />
    </Modal>}
  </Card>;
}

export function Earnings({ user }) {
  const isProvider = user.role === "provider";
  const r = useResource(
    "/commercial/" +
      (isProvider ? "providers" : "instructors") +
      "/" +
      user.id +
      "/earnings",
    {},
  );
  return (
    <>
      <Notice error={r.error} />
      <div className="stat-grid">
        <Stats
          items={
            isProvider
              ? [
                  [
                    "Total Earnings",
                    money(r.data.totalEarned),
                    "Course payments and other settlements",
                    "green",
                  ],
                  ["Pending", money(r.data.pendingAmount), "Awaiting review"],
                ]
              : [
                  [
                    "Monthly Earnings",
                    money(r.data.totalMonthlyEarning),
                    "Base plus bonuses",
                    "green",
                  ],
                  [
                    "Active Students",
                    r.data.activeStudents || 0,
                    "Assigned learners",
                  ],
                  [
                    "Performance Bonus",
                    money(r.data.performanceBonus),
                    "Skill growth rewards",
                    "orange",
                  ],
                ]
          }
        />
      </div>
      <Card title="Payment History">
        <Table
          heads={["Type", "Amount", "Status", "Date", ...(isProvider ? ["Reason"] : [])]}
          rows={(r.data.payouts || r.data.transactions || []).map((t) => [
            t.type,
            money(t.amount),
            t.status,
            (t.createdAt || t.paidAt || "").slice(0, 10),
            ...(isProvider ? [t.reason || (t.courseId ? "Course approval" : "—")] : []),
          ])}
        />
      </Card>
    </>
  );
}

function GatewayStatus() {
  const r = useResource("/payments/razorpay/config", {});
  return (
    <div style={{ marginBottom: 16 }}>
      <Notice error={r.error} />
      {!r.loading && (
        <>
          <span
            className={
              "badge " + (r.data.configured ? "badge-green" : "badge-orange")
            }
          >
            {r.data.configured
              ? "Razorpay " + r.data.mode + " checkout configured"
              : "Razorpay API keys needed"}
          </span>
          {r.data.paymentLink && (
            <p style={{ marginTop: 10 }}>
              <a
                className="btn btn-secondary btn-sm"
                href={r.data.paymentLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open your Razorpay payment page ↗
              </a>
            </p>
          )}
          {r.data.paymentLink && (
            <p className="card-subtitle">
              The hosted payment page opens separately. A payment made there
              needs separate confirmation; only verified in-app checkout
              activates access automatically.
            </p>
          )}
        </>
      )}
    </div>
  );
}

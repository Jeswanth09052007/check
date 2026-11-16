import { useState } from "react";
import OtpForm from "../components/OtpForm";
import LoginLayout from "../layouts/Login";
import RegisterLayout from "../layouts/Register";
import { api, setToken } from "../services/api";
import { useResource } from "../hooks/useResource";
import { Modal } from "../components/Common";
const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;
const passwordHelp = "Use at least 8 characters with uppercase, lowercase, a number, and one of !@#$%^&*.";
const emailRule = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordErrors(form) {
  const password = form["reg-pw"] || "";
  const confirmation = form["reg-pw2"] || "";
  const missing = [
    [password.length >= 8, "at least 8 characters"],
    [/[A-Z]/.test(password), "an uppercase letter"],
    [/[a-z]/.test(password), "a lowercase letter"],
    [/\d/.test(password), "a number"],
    [/[!@#$%^&*]/.test(password), "one special character (!@#$%^&*)"],
  ].filter(([valid]) => !valid).map(([, label]) => label);
  return {
    password: passwordRule.test(password) ? "" : missing.length ? "Password needs " + missing.join(", ") + "." : passwordHelp,
    confirmation: !confirmation ? "Confirm your password." : password !== confirmation ? "Passwords do not match." : "",
  };
}

function registrationError(form, step) {
  const field = key => (form[key] || "").trim();
  if (step === 2) {
    if (!["reg-first", "reg-last"].every(key => /^[A-Za-z ]{3,}$/.test(field(key)))) {
      return "Enter a first and last name with at least 3 letters or spaces each.";
    }
    if (!/^[a-zA-Z0-9._%+-]+@(gmail\.com|(?:[a-zA-Z0-9-]+\.)+in)$/i.test(field("reg-email"))) {
      return "Use a Gmail address or an email ending in .in.";
    }
    if (!/^[6-9]\d{9}$/.test(field("reg-phone"))) return "Enter a valid 10-digit Indian mobile number.";
    const dob = field("reg-dob");
    const date = new Date(dob + "T00:00:00Z");
    if (!dob || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dob) {
      return "Enter a valid date of birth.";
    }
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    const age = Number(today.slice(0, 4)) - Number(dob.slice(0, 4)) - Number(today.slice(5) < dob.slice(5));
    if (age < 10) return "You must be at least 10 years old.";
  }
  if (step === 3) {
    if (form.role === "learner" && Boolean(field("reg-institution")) !== Boolean(field("reg-studentid"))) {
      return "Provide your institution and student ID together.";
    }
    if (form.role === "instructor" && (field("reg-inst-org").length < 3 || field("reg-expertise").length < 3 || !field("reg-exp"))) {
      return "Enter your institution and specialization, and select your experience.";
    }
    if (form.role === "provider" && field("reg-org").length < 3) return "Enter your organization name.";
    if (form.role === "admin" && !field("reg-auth-code")) return "Enter your admin authorization code.";
  }
  if (step === 4) {
    const { password, confirmation } = passwordErrors(form);
    return password || confirmation;
  }
  return "";
}

export function rolePath(user) {
  return (
    "/" +
    (user.role === "admin"
      ? user.adminTeam === "PAYMENT_ADMIN"
        ? "payment-admin"
        : "user-admin"
      : user.role) +
    "-dashboard"
  );
}
export function LoginPage() {
  const config = useResource("/public/config", { demoMode: true });
  const [form, setForm] = useState({
      email: localStorage.getItem("indai_remember_email") || "",
      remember: !!localStorage.getItem("indai_remember_email"),
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [info, setInfo] = useState(""),
    [challenge,setChallenge]=useState(null),
    [reset,setReset]=useState(null);
  function finishSignIn(result) {
    setToken(result.accessToken);
    if (form.remember)
      localStorage.setItem("indai_remember_email", form.email);
    else localStorage.removeItem("indai_remember_email");
    location.assign(rolePath(result.user));
  }

  async function signIn(useOtp) {
    if (busy) return;
    if (!emailRule.test(form.email.trim()) || !form.password) {
      setError("Enter a valid email and your password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api(useOtp ? "/auth/login" : "/auth/login/password", "POST", {
        email: form.email.trim(),
        password: form.password,
      });
      if (useOtp) setChallenge(result);
      else finishSignIn(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function verifyLogin(otp) {
    setBusy(true);
    try {
      const result = await api("/auth/verify-otp", "POST", {challengeId:challenge.challengeId,otp});
      finishSignIn(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function action(code) {
    if (code === "doLogin()") return signIn(true);
    if (code === "doPasswordLogin()") return signIn(false);
    if (code === "togglePw()") return setShowPassword((v) => !v);
    if (code.startsWith("fillDemo")) {
      const values = [...code.matchAll(/'([^']*)'/g)].map((m) => m[1]);
      setForm({ ...form, email: values[1], password: values[2] });
      setError("");
      return;
    }
    if (code.includes("Forgot"))
      {setError("");setReset({email:form.email});}
    else if (code.includes("Terms"))
      setInfo(
        "IndAI provides educational paper trading with virtual money. No live exchange orders are placed.",
      );
    else if (code.includes("Privacy"))
      setInfo(
        "Account and institution data are stored by your IndAI deployment. Contact the platform administrator for access or deletion requests.",
      );
  }
  return (
    <>
      <LoginLayout
        demoEnabled={config.data.demoMode}
        form={form}
        onField={(k, v) => {
          setForm({ ...form, [k]: v });
          setError("");
        }}
        onAction={action}
        busy={busy}
        error={error}
        showPassword={showPassword}
      />
      {challenge && <Modal title="Enter OTP to sign in" onClose={()=>{setChallenge(null);setError('');}}>
        {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
        <OtpForm challenge={challenge} busy={busy} onSubmit={verifyLogin} onResend={async()=>{setError('');setChallenge(await api('/auth/resend-otp','POST',{challengeId:challenge.challengeId}));}} />
        <p>Request expires after five minutes. Close this window and sign in again to restart.</p>
      </Modal>}
      {reset && <Modal title="Forgot password" onClose={()=>{setReset(null);setError('');}}>
        {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
        {!reset.challengeId ? <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await api('/auth/forgot-password','POST',{email:reset.email.trim()});setReset({...reset,...r});}catch(e){setError(e.message);}finally{setBusy(false);}}}>
          <label className="form-label" htmlFor="reset-email">Registered email</label>
          <input id="reset-email" className="form-input" type="email" required value={reset.email||''} onChange={e=>setReset({...reset,email:e.target.value})}/>
          <button className="btn btn-primary mt-16" disabled={busy}>Enter OTP</button>
        </form> : <>
          <label className="form-label" htmlFor="reset-password">New password</label>
          <p className="card-subtitle">{passwordHelp}</p>
          <input id="reset-password" className="form-input" type="password" value={reset.password||''} onChange={e=>setReset({...reset,password:e.target.value})}/>
          <label className="form-label" htmlFor="reset-confirm">Confirm password</label>
          <input id="reset-confirm" className="form-input" type="password" value={reset.confirmPassword||''} onChange={e=>setReset({...reset,confirmPassword:e.target.value})}/>
          <OtpForm challenge={reset} onResend={async()=>{const r=await api('/auth/resend-otp','POST',{challengeId:reset.challengeId});setReset({...reset,...r});}} label="Reset password" busy={busy} onSubmit={async otp=>{if(!passwordRule.test(reset.password||''))throw Error(passwordHelp);if(reset.password!==reset.confirmPassword)throw Error('Passwords must match.');setBusy(true);try{await api('/auth/reset-password','POST',{challengeId:reset.challengeId,otp,password:reset.password,confirmPassword:reset.confirmPassword});setReset(null);setInfo('Password reset. Sign in using your new password.');}finally{setBusy(false);}}}/>
        </>}
      </Modal>}
      {info && (
        <Modal title="IndAI" onClose={() => setInfo("")}>
          <p role="status">{info}</p>
        </Modal>
      )}
    </>
  );
}
export function RegisterPage() {
  const [form, setForm] = useState({
      role: "learner",
      "reg-admin-team": "USER_ADMIN",
      "reg-content-type": "Mixed",
      "reg-texp": "beginner",
      "reg-risk": "moderate",
    }),
    [step, setStep] = useState(1),
    [securityChecked, setSecurityChecked] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [created, setCreated] = useState(null),
    [show, setShow] = useState(false),
    [info, setInfo] = useState(""),
    [challenge,setChallenge]=useState(null);
  async function submit() {
    if (busy) return;
    setError("");
    for (const phase of [2, 3, 4]) {
      const message = registrationError(form, phase);
      if (message) {
        setStep(phase);
        if (phase === 4) setSecurityChecked(true);
        setError(phase === 4 ? "" : message);
        return;
      }
    }
    if (!form["reg-terms"] || !form["reg-understand"]) {
      setError("Accept the terms and paper trading acknowledgement.");
      return;
    }
    setBusy(true);
    try {
      const b = {
        role: form.role,
        firstName: form["reg-first"].trim(),
        lastName: form["reg-last"].trim(),
        email: form["reg-email"].trim(),
        phone: form["reg-phone"].trim(),
        dateOfBirth: form["reg-dob"],
        password: form["reg-pw"],
        confirmPassword: form["reg-pw2"],
      };
      const put = (key, id) => {
        if (form[id]?.trim()) b[key] = form[id].trim();
      };
      if (form.role === "learner") {
        for (const [k, id] of Object.entries({
          institution: "reg-institution",
          studentId: "reg-studentid",
          grade: "reg-grade",
          major: "reg-major",
          tradingExperience: "reg-texp",
          riskTolerance: "reg-risk",
          goals: "reg-goals",
        }))
          put(k, id);
      }
      if (form.role === "instructor") {
        put("institution", "reg-inst-org");
        put("expertise", "reg-expertise");
        put("yearsExp", "reg-exp");
      }
      if (form.role === "provider") {
        put("organization", "reg-org");
        put("website", "reg-website");
        put("contentType", "reg-content-type");
      }
      if (form.role === "admin") {
        put("institution", "reg-admin-inst");
        put("adminTeam", "reg-admin-team");
        put("authCode", "reg-auth-code");
      }
      const result = await api("/auth/register", "POST", b);
      setChallenge(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function verifyRegistration(otp) {
    setBusy(true);
    try {
      const result=await api('/auth/verify-otp','POST',{challengeId:challenge.challengeId,otp});
      if(result.accessToken)setToken(result.accessToken);
      setCreated(result);setChallenge(null);setStep(6);
    } catch(e){throw e;}
    finally {setBusy(false);}
  }
  function next() {
    const message = registrationError(form, step);
    if (step === 4) setSecurityChecked(true);
    setError(step === 4 ? "" : message);
    if (message) return;
    setStep((s) => Math.min(5, s + 1));
  }
  const security = passwordErrors(form);
  const slots = {
    "err-reg-pw": securityChecked ? security.password : "",
    "err-reg-pw2": securityChecked || form["reg-pw2"] ? security.confirmation : "",
    eye1: show ? "Hide" : "Show",
    eye2: show ? "Hide" : "Show",
    "step-label": `Step ${Math.min(step, 5)} of 5`,
    "step-pct": `${Math.min(step, 5) * 20}%`,
    "step6-title": created?.pendingApproval
      ? "Registration submitted"
      : "Account created",
    "step6-sub": created?.pendingApproval
      ? `A ${created.reviewerRole || "Super Admin"} will review your application before you can sign in.`
      : "You can sign in and start learning.",
    "step6-details": <p>{created?.user?.email}</p>,
    "step6-btn": (
      <a className="btn btn-primary" href="/login">
        Go to Sign In
      </a>
    ),
    "step-bar-fill": (
      <span style={{ display: "block", width: Math.min(step, 5) * 20 + "%" }} />
    ),
  };
  return (
    <>
      <RegisterLayout
        form={form}
        step={step}
        showPassword={show}
        busy={busy}
        slots={slots}
        onField={(k, v) => setForm({ ...form, [k]: v })}
        onAction={(code) => {
          if (code === "nextStep()") next();
          else if (code === "prevStep()") {
            setError("");
            setStep((s) => Math.max(1, s - 1));
          }
          else if (code === "submitRegistration()") submit();
          else if (code.startsWith("selectRole"))
            setForm({ ...form, role: code.match(/'([^']+)'/)[1] });
          else if (code.includes("toggleRegPw")) setShow(!show);
          else if (code.includes("showTerms"))
            setInfo(
              "IndAI is an educational paper trading platform. All orders use virtual money. Account access and learning content are subject to platform rules.",
            );
          else if (code.includes("showPrivacy"))
            setInfo(
              "Account information is stored on the IndAI server. Configured payment and mail services receive the details needed for those actions. Contact your administrator for access/deletion requests.",
            );
        }}
      />
      {challenge&&<Modal title="Verify registration OTP" onClose={()=>setChallenge(null)}><OtpForm challenge={challenge} busy={busy} onSubmit={verifyRegistration} onResend={async()=>setChallenge(await api('/auth/resend-otp','POST',{challengeId:challenge.challengeId}))}/></Modal>}
      {info && (
        <Modal title="IndAI" onClose={() => setInfo("")}>
          <p role="status">{info}</p>
        </Modal>
      )}
      {error && (
        <div
          className="toast error"
          role="alert"
          style={{
            display: "block",
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: "#fff",
            padding: 20,
            color: "#b91c1c",
            maxWidth: 500,
          }}
        >
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {busy && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "#ffffffdd",
            display: "grid",
            placeItems: "center",
          }}
        >
          Creating your account…
        </div>
      )}
    </>
  );
}

> This ZIP includes your supplied private `back-end/.env`, including Razorpay, Upstox, JWT and Formspree settings. Setup preserves this file. First run: `npm run setup`, `npm run build`, then `npm start`. Open http://localhost:3000. Credentials have been configured; live payment and market-provider validity have not been re-tested.

# IndAI update — 27 October 2026

## What changed

- The existing **Forgot password?** link now opens a password-reset form: registered email → new password and confirmation → six-digit OTP → sign in with the new password.
- Both sign-in options validate the email and password. **Sign In with Password** creates a session immediately for active accounts. **Continue to OTP** creates a session after verification. Registration still requires OTP before creating the account. Pending instructor/provider/admin accounts still require Super Admin approval.
- The supplied Formspree generation engine now sends a random six-digit OTP to the **owner inbox connected to form `maeeoaow`**, regardless of the account email entered. Verification requires the **exact emailed code**; arbitrary six-digit values no longer work. This owner-inbox test setup does not verify ownership of the entered account email.
- Passwords are checked only by the existing account system, never included in Formspree payloads. Messages use `test_email` as an account identifier and omit the special recipient-routing `email` field.
- Codes expire after five minutes, allow up to five incorrect attempts, and are single-use. Resend waits 30 seconds and invalidates the previous challenge after successful delivery. The engine limits sends to ten per hour per account/purpose; the API also rate-limits by network address. Codes and challenges remain in memory and must be requested again after a server restart. Email delivery failures do not unlock access.
- The login/register pages, dashboard layouts, and existing CSS are retained. OTP and resend controls use the existing IndAI modal, inputs, and button styles. No standalone demo UI is imported.
- Admin assignment sends a request and notification to the instructor. The learner's current mapping stays unchanged until that instructor accepts. Declining leaves the existing mapping unchanged. Upon acceptance the learner receives the instructor's name in a notification. Reassignment updates both instructors' rosters.
- Instructors can request removal of their own students. The student stays in the class until User Admin/Super Admin approves. Approval removes the mapping and notifies both instructor and student. Rejection retains the mapping and notifies the instructor.
- Active unmapped learners generate red, persistent admin inbox alerts and a red dashboard summary. Pending assignment alone does not clear the alert; instructor acceptance does. These alerts cannot be marked read or dismissed while the student remains unmapped.
- Mapping requests, completed decisions, roster changes and notifications are saved with the existing server data. Duplicate pending requests and unauthorized decisions are rejected.

## Where to use it

Open **Class mapping & approvals** on the User Admin, Super Admin or Instructor dashboard. It is also available in the notification inbox. Admins choose an instructor and click **Request assignment**; instructors see **Accept student / Decline**. Instructors select **Request removal**; admins see **Approve removal / Reject removal**. The existing admin account-edit instructor field also submits an approval request.

Inbox and mapping panels refresh automatically across signed-in browser sessions (typically within five seconds while visible). Local changes refresh immediately. Existing mapped students keep their assignments.

## Run locally

Use Node.js 20.19+ or 22.12+ and open a terminal in `IndAI_React`:

```sh
npm run setup
npm run build
npm start
```

Open `http://localhost:3000`. For development use `npm run dev` after setup.

The default OTP setup is already configured for `maeeoaow`. To make it explicit, add this to `back-end/.env`:

```dotenv
FORMSPREE_FORM_ID=maeeoaow
```

The form must remain activated, have available quota, and accept server-side submissions without an interactive CAPTCHA. Check the owner inbox and spam folder. `DEMO_MODE=true` only enables the existing demonstration accounts; the OTP option in normal app runs requires the exact mailed code. No additional React/Formspree package is required: the backend sends messages using Node fetch.

`npm run setup` retains an existing `back-end/.env`; otherwise it creates one from the included example. Keep using your own analytics, payment, SMTP and JWT settings.

## Keep existing data when updating

Before replacing an older working folder, stop the running server and back it up. Keep its `back-end/.env`, `back-end/persistent-data`, and upload directories. If `DATA_DIR` is configured, continue using that same directory; it contains `platform.json` and uploads. Copy these into the equivalent locations in this updated project before starting. Do not replace existing saved state with a fresh demonstration state. No reset or database wipe is needed. Old state files load normally and gain the new mapping-request collection when next saved.

## Validation

```sh
npm test
npx playwright install chromium
npm run test:browser
```

New coverage: `tests/mapping-otp.test.mjs` and `tests/browser-mapping-otp.cjs`. Existing login/registration test helpers have been updated for OTP.

The exact-code engine and API tests use mocked Formspree delivery, so running tests does not send emails. Existing unrelated regression tests opt into a permissive OTP path that is accepted **only when NODE_ENV=test and OTP_DELIVERY_MODE=demo**; this mode cannot enable permissive verification in normal development or production. The OTP flow uses Formspree.

Additional coverage: `tests/otp-engine.test.mjs`, `tests/formspree-auth.test.mjs`, and `tests/browser-formspree.cjs`. These check code matching, expiry, retry limits, resend invalidation, safe payloads, registration/reset integration, delivery failure, and the existing login UI with exact-code verification. Live inbox delivery was not re-tested during integration; the same endpoint and payload pattern as the supplied working demo are used.

Verification results: 54 passing automated tests, successful frontend/backend builds, browser exact-code login/reset checks with mocked email delivery, and browser mapping/removal regression checks.

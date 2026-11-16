
# IndAI — React Platform (workflow repair, v3.2)

IndAI is a React frontend with a NestJS backend for educational stock trading, courses, quizzes, assignments, institution accounts and Razorpay subscriptions. The original project's page layouts, portal navigation, CSS, role colours and branding are retained. The trading screen has been replaced with the requested simpler stock interface. Repaired forms and content panels use the existing design styles; this is not a claim of pixel-for-pixel visual equivalence across every screen.

All application screens are React components. `frontend/index.html` is the Vite mounting document. There are no legacy screens embedded in iframes, injected HTML dashboards, or evaluated JavaScript action strings. JSX event handlers update React state and call authenticated APIs.

## Start here — Windows, macOS or Linux

Install **Node.js 24 LTS**. Extract the ZIP fully. Open a terminal in **IndAI_React**, where this README and the root `package.json` are located:

```bash
npm run setup
npm run dev
```

Open **http://localhost:5173**. Keep the terminal running. The backend uses port 3000. First installation requires internet access. `START_WINDOWS.bat` and `start_mac_linux.sh` provide the same setup/development flow.

`npm run setup` installs the locked dependencies and generates `back-end/.env` with random authentication secrets. This private ZIP includes the original `back-end/.env` exactly as supplied. Setup keeps it in place. Keep this archive private and use the credential-free package for submissions or public repositories.

Do not run `npm install` from the old `front-end` HTML folder. This project's React folder is named **frontend**. Do not open `index.html` directly with a file browser.

## Build and run the full application on one port

```bash
npm run build
npm start
```

Open **http://localhost:3000**. The backend serves the React build, APIs and authorized lesson links. Login, registration and dashboard URLs use clean React routes without `.html`; old `/pages/login.html` links and `.html` dashboard URLs redirect to their clean equivalents. Direct dashboard refreshes remain supported. API documentation: **http://localhost:3000/api/docs**.

For separate development terminals after setup:

```bash
# Terminal 1, from IndAI_React
npm --prefix back-end run start:dev
```

```bash
# Terminal 2, from IndAI_React
npm --prefix frontend run dev
```

## Evaluation accounts (DEMO_MODE=true)

| Portal | Email | Password |
|---|---|---|
| Super Admin | superadmin@indai.com | Admin@1234 |
| User Admin | admin@indai.com | Admin@1234 |
| Payment Admin | paymentadmin@indai.com | Pay@1234 |
| Instructor | instructor@indai.com | Inst@1234 |
| Course Provider | provider@indai.com | Prov@1234 |
| Learner | learner@indai.com | Learn@1234 |

Login uses **email and password only**. The authenticated role determines the destination. Registration can request an account type; staff registrations need approval. A new empty production deployment with `DEMO_MODE=false` uses the bootstrap admin environment settings instead of these demo accounts.

## Working workflows

- **Profiles:** the profile button on each portal opens editable personal information and a password change form. Password changes require signing in again.
- **Courses:** Provider creates a draft, adds/edits/removes modules, uploads videos/PDFs, creates quizzes and assignments, submits for commercial review, and accepts a counter-offer when available. Payment Admin sanctions/publishes the course. Drafts do not appear as available learner courses.
- **Learning:** Learner enrolls in a published course, opens uploaded lessons, completes individual modules and takes quizzes. Completion records and quiz attempts persist. Completion rewards are awarded once. Provider analytics use saved enrollments/completions rather than fixed placeholders.
- **Challenges:** The instructor or provider creates assignments. Assigned or enrolled learners submit work, and the owning reviewer can approve it or reject it with a required remark. Rejected learners receive an in-app notification and can resubmit. Approval awards skill points once. Provider course assignments also reach later enrollees.
- **Sessions:** Super Admin → Sessions → Add Session sends an approval request to the selected instructor. The instructor can accept it or reject it with a required remark under Assignments & Sessions. Both the organizer and instructor receive in-app notifications. Learners see an assigned session in Learning after acceptance. Instructors can still schedule their own sessions. Dates and start times use IST. A new or rescheduled session must start at least one hour ahead and within 365 days.
- **Audit log:** Super Admin → Audit Log shows searchable, paginated records of platform changes and failed mutation requests, including session decisions, assignment rejection remarks and paper order outcomes. General API entries contain request metadata. Read-only browsing and routine data polling are outside the audit log.
- **Institution accounts:** User Admin creates an institution, emails a private intake link through SMTP, receives a form/CSV roster, validates it, imports accounts atomically, and exports generated credentials. A separate action emails newly generated replacement credentials. If SMTP is missing, the UI reports it and provides the intake link; it does not pretend an email was sent.
- **Stock trading:** search NSE/BSE equities (or demo stocks without Upstox), view price history, place virtual market/limit/stop buys or sells, cancel pending orders, add a watchlist symbol and inspect holdings/history. Trading and Portfolio use the same account. No algo/bot/backtest navigation is exposed, and the scheduler does not execute bots.
- **Payments:** Razorpay checkout creates an order on the server. Access is activated only after matching signature/captured-payment verification or a valid signed capture webhook. Internal provider/instructor ledger entries do not transfer money to bank accounts.

Mutations refresh related React resources. Separate signed-in browser sessions refresh on focus or at the normal polling interval (typically 15 seconds); this is not instantaneous WebSocket synchronization.

## Video and PDF uploads

Provider → Videos / Materials → select a course → choose or drop a file → enter a title → Upload. Videos support MP4/WebM/MOV/MKV/AVI containers up to 500 MB; PDFs up to 25 MB. **MP4 encoded as H.264/AAC or WebM** are recommended for browser playback; an arbitrary AVI/MKV codec cannot be guaranteed to play in a browser.

The uploaded module appears immediately. Learners access it after course publication and enrollment, with the required Pro/institution access. Local media paths need a temporary signed URL; bare upload paths are rejected. Reopen the course if a media link expires. The ZIP includes a small generated WebM test fixture used to verify actual playback. File uploads and account state must be stored on a persistent disk when deployed.

## Configure external services privately

IndAI sends OTPs to the user through the same SMTP settings used for institution email. In local demo mode, seeded accounts and reserved `.test` addresses receive OTPs in `back-end/persistent-data/demo-otp-inbox.jsonl` (or the configured `DATA_DIR`). The inbox is a local file and is disabled in production. A fresh local demo store includes 30 mock instructors, 4 mock admins and 240 mock learners. Their email addresses use `instructor1@indai.test`, `admin1@indai.test` and `learner1@indai.test` numbering and their shared demo password is `IndaiDemo@2026`. Choose an active account such as `learner2@indai.test` to sign in. The SMTP sender address must be accepted by your mail server.

Edit **back-end/.env** after setup (or use host environment variables):

```dotenv
UPSTOX_ANALYTICS_TOKEN=your_private_analytics_token
RAZORPAY_KEY_ID=your_test_key_id
RAZORPAY_KEY_SECRET=your_private_test_secret
RAZORPAY_WEBHOOK_SECRET=your_dashboard_webhook_secret
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_private_smtp_password
SMTP_FROM=IndAI <your_sender_address>
```

Register **https://YOUR-DOMAIN/api/payments/razorpay/webhook** in Razorpay with the same webhook secret and `payment.captured` event. Configure payment capture in the dashboard. Test cancelled, failed and captured checkouts before replacing test keys with live keys.

Upstox analytics supplies **read-only market data**. Orders in this application use virtual funds and do not execute on the exchange. When the exchange is closed, quotes may be marked as previous-session replay. Historical chart ranges show historical daily candles. Missing/expired credentials are reported rather than silently labelled as live data.

The provided credentials were checked with authenticated read-only Upstox instrument-search and Razorpay order-list requests (HTTP 200). No payment was charged, and no live broker order was placed. Payment signatures/webhooks and SMTP delivery were tested with local fixtures/sinks; final hosted checkout, webhook delivery and real email delivery need verification in your deployment.

## Tests

```bash
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

Tests use temporary stores and demo accounts. Browser checks exercise all role dashboards, registration, profile saving, course creation/publication/enrollment, video playback, PDF uploads and media authorization, quiz attempts, lesson completion and virtual trading/portfolio synchronization. See **VALIDATION_REPORT.md** for the completed run and limits.

## Project layout

| Path | Purpose |
|---|---|
| frontend/src/layouts/ | React versions of the original portal/page structures |
| frontend/src/pages/ | Authentication and dashboard composition |
| frontend/src/components/ | Reusable forms, dialogs, learning, management, trading and commerce |
| frontend/src/hooks/useResource.js | Fetching, cleanup, polling and mutation refresh |
| frontend/src/services/ | Authenticated API and Razorpay checkout |
| back-end/src/ | NestJS authentication, RBAC, validated business APIs and persistence |
| back-end/algo/ | Existing market-data and isolated virtual account engine; manual trading uses these APIs |
| back-end/data/stocks/ | Original sample market datasets |
| tests/ | API, payment, CSV, SMTP, market and browser regression checks |

## Submission and deployment

Read **EVALUATION_GUIDE.md**, **REACT_CONCEPT_MAP.md**, **INDIVIDUAL_CONTRIBUTION.md** and **GIT_SUBMISSION.md**. Each student must fill their actual contribution, repository URL and commit IDs; no contribution or commit history is invented by this package.

Read **DEPLOYMENT.md** before hosting. This version uses local JSON persistence and supports one running backend process with a persistent disk. It is not an independently audited, high-availability commercial service. Production work still includes HTTPS/domain configuration, backups, monitoring, real provider acceptance tests, and a transactional database before multiple backend replicas. Rotate credentials that have been shared in chat before a public launch.


## v3.2 — fourteen requested updates

See **14_REQUESTS_CHECKLIST.md** for the numbered changes and tests. Portfolio Growth now records total marked value (cash + holdings), not cash spent. The visible portfolio/graph and admin reports refresh every five seconds. Flat values remain flat when quotes do not change; no fake historical prices are generated. Existing accounts build marked-value history after this update.

**PDF quiz:** Provider → Quizzes → Create Quiz → Quiz format: Upload PDF question paper → choose course/title → upload PDF → Save quiz. Enrolled learners open the paper and submit written answers. Provider uses Review submissions to enter a score out of 100 and feedback. MCQs remain automatically scored; PDF written answers require manual review. A paper with submissions cannot be replaced; create another quiz.

**Notifications:** Instructor → Overview → Send Notification opens selected-student checkboxes or All assigned active students. Messages appear in the students' in-app notification lists. This action does not send email.

**Intake:** Manage intake automatically loads the request list. Refresh institute submissions retrieves rosters returned through the invitation link. Empty/error/loading states are explicit; direct CSV upload remains available.

**Actors:** Super Admin Add User begins with an actor selector, then displays the relevant fields. All Users includes admin/division filters. Super Admin Sessions remains separate from Assignments.

**Theme:** One shared ThemeToggle renders the same bottom-left button across every page and portal. The preference survives reload/navigation.

Back up and retain your private `back-end/.env`, configured `DATA_DIR` and uploaded media when updating an existing installation. If you used the default local settings, your saved state is in `back-end/persistent-data` and your uploaded media is in `back-end/uploads`. Existing scheduled sessions retain their state. This ZIP includes the original private configuration, source and compiled builds. To keep existing accounts and activity, reuse your saved data folder.

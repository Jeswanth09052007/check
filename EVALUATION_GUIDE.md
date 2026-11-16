# React evaluation guide — five students

## Group demonstration (about 8–10 minutes)

1. Sign in with only email/password and explain role-based routing.
2. Provider creates a course and uploads a short WebM/MP4 lesson and a PDF. Create a quiz using the controlled question form.
3. Payment Admin publishes the submitted course. Learner enrolls, opens the video/PDF, completes lessons and takes the quiz. Show provider completion/attempt data.
4. Instructor creates an assignment/session; Learner submits; creator approves and awards points.
5. Learner buys a small virtual position, sells one share, cancels a pending limit order, and returns to Portfolio. Explain that the same backend account supplies both screens.
6. User Admin previews a CSV roster and shows the intake link and credentials workflow. Demonstrate actual email only with configured SMTP and an address you control.
7. Show one real Git commit per student's actual work and the files they understand.

Do not claim live exchange execution. Razorpay test checkout and real mail delivery require configured services. A test ledger entry is not a bank transfer.

## Suggested responsibility split

This is a study/contribution plan, not a claim that any named student authored these files. Each person should make and commit their own meaningful work and fill INDIVIDUAL_CONTRIBUTION.md.

| Student | Focus | Files to explain | Small live task |
|---|---|---|---|
| 1 | Login and registration | pages/AuthPages.jsx, layouts/Login.jsx, services/api.js | Add an email validation message |
| 2 | Forms, modal and dashboard composition | components/Common.jsx, pages/Dashboard.jsx | Add an optional profile field or change a stat label |
| 3 | Courses, uploads and quizzes | components/Learning.jsx | Add a quiz question/option, change required title length |
| 4 | Institutions and staff workflows | components/Institutes.jsx, components/Management.jsx | Add a roster preview column or filter |
| 5 | Trading and payments | components/TradingWorkspace.jsx, services/payments.js, components/Commerce.jsx | Disable an invalid order quantity or add an order-history column |

All frontend paths above start with `frontend/src/`. Be able to explain the API request and relevant backend authorization for your feature.

## React concepts to explain

**Components and props:** Dashboard composes role layouts and passes `user`, `notify`, resource data and callback props. Card wraps content using `children`. Editor receives field definitions and an `onSubmit` callback. Props flow down; callbacks communicate upward.

**State and events:** `useState` owns input values, selected tabs, modal visibility, the pending file and quiz answers. `onChange`, `onClick`, `onSubmit` and `onDrop` update state or perform API actions. A state setter schedules a render; directly mutating state does not.

**Controlled forms:** the JSX input `value` comes from React state and `onChange` updates that state. Quiz radio buttons use `checked`. The file picker uses browser File objects; React stores the selected File without trying to control the file-input value.

**Effects:** `useResource` fetches when its path/version changes, reloads after mutations, polls while visible, and refreshes on focus. Cleanup cancels timers/listeners and prevents results from an obsolete request updating the current component. Modal effects manage focus, Escape and scroll locking.

**Lists and conditions:** course/module lists use `.map()` with stable IDs. Learner enrollment controls, creator controls, locked content and pending-order cancellation are conditionally rendered according to data and role. Backend permissions still enforce ownership; hiding a button alone is insufficient.

**React root:** `main.jsx` calls `createRoot`. Vite's `index.html` supplies the mounting element, not independent application screens. ErrorBoundary is a React class because React error boundaries use that pattern; the trading workspace and other feature panels are functional components with hooks.

## Typical viva questions

- Why keep portfolio data in the backend? To persist it and share the same account across Trading/Portfolio, while keeping each user's positions isolated.
- Why does a file upload use FormData? It transmits binary file bytes with fields; fetch sets its multipart boundary.
- Why reload after upload? The new lesson must appear in all subscribed React panels without manually refreshing the page.
- What is the difference between a file URL and a module record? The record links a lesson to its course/order/title; storage contains the media bytes. Learner access checks issue temporary signed media links.
- Why require course publication? Draft content remains under provider review until Payment Admin publishes it.
- Why not show actor selection at login? The server authenticates credentials and supplies the account's actual role.
- Why verify Razorpay on the server? Client checkout output cannot itself authorize subscription access. The backend validates the signature and captured order/amount.
- What is the difference between an analytics token and an order API? Analytics reads market data; this application records virtual paper orders locally.
- Why are keys not committed? Browser bundles and repository history are public to their readers; credentials belong in private server environment variables.
- Why `key` in a map? It identifies each item across renders so React can preserve the right component state.

## Individual submission

Each student submits the full ZIP, README and their own completed contribution file. Include the real repository URL and actual commit hashes. Run the setup and demonstration once from a fresh extraction before evaluation. Do not fabricate commits or describe suggested responsibilities as completed work.


## v3.2 live demos

- Demo MCQ and PDF quiz formats. Explain automatic answer-key scoring versus manual written-answer grading.
- Show why a share purchase reduces cash but does not reduce total portfolio value by the whole purchase amount.
- Send to selected students and All assigned students; explain backend authorization.
- Create an actor in one session and show updated Payment Admin counts/activity in another.
- Explain AccountForm conditional fields and the sole ThemeToggle component's effects.

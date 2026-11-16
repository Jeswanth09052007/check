# React concept map

| Requirement | Implementation | Demonstration |
|---|---|---|
| Components | Dashboard, Courses, Modules, QuizEditor, TradingWorkspace, Editor, Modal | Open a role dashboard and show composed JSX |
| Props and communication | `user`, `notify`, `onUser`, `onSubmit`, `children` | Save a profile; callback updates the parent |
| State management | useState in all feature components | Change buy/sell side, open a dialog, answer a quiz |
| Event handling | onClick/onSubmit/onChange/onDrop | Upload a file or place a virtual order |
| Controlled forms | Common.jsx Editor; Learning.jsx QuizEditor | Edit title, course dropdown and quiz answer radio |
| File input | Uploads stores File from `files[0]`; FormData transmits it | Select/drop video, then upload to a course |
| useEffect and cleanup | hooks/useResource.js; Common.jsx Modal | Fetch on tab/path changes; remove timers/listeners on unmount |
| Lists and keys | Course, module, stock and order maps | Explain `key={record.id}` |
| Conditional rendering | Enrollment, creator controls, pending-order actions | Compare Provider and Learner views |
| Backend synchronization | services/api.js dispatches mutation refresh; useResource subscribes | Newly uploaded lesson appears without reloading |
| Authentication | AuthPages.jsx; services/api.js | Email/password routes to stored role |

Paths in the table are under frontend/src unless otherwise stated. Backend code remains NestJS/TypeScript; React is the frontend framework.


## v3.2 examples

- NotificationComposer: controlled recipient checkbox arrays, computed eligibility and onSent callback.
- ThemeToggle: one shared control, useState preference, useEffect persistence/storage-listener cleanup.
- PortfolioChart: history/current props and a controlled period selector render recorded valuations.
- QuizEditor: controlled format conditionally shows MCQ fields or PDF upload/instructions.
- AccountForm: actor state conditionally selects relevant fields; switching actors remounts its Editor.
- PlatformReports: the polling resource supplies actual report data for maps, tables and stat cards.

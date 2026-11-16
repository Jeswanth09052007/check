# Repair validation report — v3.2

Validated 17 October 2026 with Node.js v24.19.0, npm and headless Chromium 141. This report describes the checks actually run; it is not a guarantee of defect-free software or a production security certification.

## Completed results

| Check | Result |
|---|---|
| Frontend production build | PASS |
| Backend TypeScript build | PASS |
| Fresh ZIP extraction → npm run setup → npm run build | PASS; random private authentication secrets generated |
| Automated API/unit tests | **36 passed, 0 failed** |
| Browser smoke across Learner, Instructor, Provider, User Admin, Payment Admin, Super Admin | PASS; no console errors or failed API requests during the smoke route run |
| Registration wizard and automatic credential-based routing | PASS |
| All six profile dialogs: open/edit/save/close | PASS |
| Provider course creation | PASS through controlled form |
| Provider video upload | PASS with generated WebM fixture; actual browser playback tested |
| Provider PDF upload | PASS; stored file returned HTTP 200 through a signed link |
| Unauthenticated bare local upload path | Rejected with HTTP 403 |
| Provider upload updates lesson list without page refresh | PASS |
| Payment Admin course publication → Learner enrollment | PASS through UI |
| Learner opens uploaded video/PDF | PASS; video playback verified |
| Completion of both uploaded modules | PASS; stored enrollment reached 100% |
| Quiz creation → learner submission → provider attempt record | PASS |
| Provider challenge created before learner enrollment | PASS; appears after later enrollment |
| Provider approves learner submission | PASS; reward awarded once on repeated approval |
| Virtual buy/sell/limit cancellation → Portfolio | PASS |
| Account isolation and restart persistence | PASS |
| Configured order value/daily count/cooldown policies | PASS |
| CSV parsing, validation, atomic import and duplicate rejection | PASS |
| SMTP intake/credentials flow | PASS using a local SMTP sink; generated password authenticated |
| Razorpay signature, capture, amount matching and duplicate-webhook handling | PASS using fixtures/mocks |
| Upstox live/replay switching and expired credential errors | PASS with mocked service responses |
| Homepage contact, FAQ, reveal sections and mobile navigation | PASS |
| Upstox authenticated instrument search | HTTP 200 using supplied private configuration; read-only |
| Razorpay authenticated order-list read | HTTP 200 using supplied private configuration; read-only |

Run `npm run build`, `npm test`, then `npx playwright install chromium` and `npm run test:browser` to reproduce local tests. Browser tests use temporary stores. Some existing engine tests exercise retained backend research helpers; no algo, bot or backtest panels are exposed in the frontend.

## Root causes and repairs

- The shared Modal lacked the original `modal-box` class; dialogs missed their normal background/padding. It now uses the original visual class, a portal, focus handling, Escape and scroll cleanup.
- Success/error toasts inherited `display:none` from the original stylesheet. React notifications now explicitly display and contain a separate text element.
- Independent React resources did not refresh after mutations. Related panels now invalidate after saves/uploads and refresh on focus/polling.
- Uploads did not refresh mounted module lists. The controlled upload form now handles a selected course, file/drop validation, title/description, insertion position, busy/errors and refreshed lesson lists.
- The old trading migration exposed algo/backtest/bot screens. A functional React stock workspace replaces them; manual orders share the Portfolio account. Watchlist Trade opens the selected symbol. Autonomous bot execution is disabled in the scheduler.
- Provider challenges captured only the learners enrolled at creation, and provider approval was forbidden. Assignment visibility now follows current course enrollment and owners can approve their submissions.
- Quiz attempts were not persisted, answer indices were incompletely validated, and draft/private quizzes leaked into learner lists. Saved attempts and access-aware visibility now keep creator and learner results consistent.
- Completion was an arbitrary “+20%” button. Learners now mark specific modules complete, and completion rewards are idempotent.
- Course approval could duplicate internal payouts when repeated. An approved publication is now idempotent.
- Local uploaded media was previously available by a bare URL. Authorized module access now issues temporary signed links.

## Visual comparison

The original `main.css`, `components.css`, `dashboard.css`, `pages.css` and `superuser.css` were compared byte-for-byte and are unchanged. Portal JSX retains the original branding, role navigation and styling. The trading screen is intentionally redesigned as requested. Functional course/forms/upload panels have been repaired and adjusted inside the same design system. There is no comprehensive pixel-diff assertion for every original screen, viewport or state; “zero UI change” is not claimed beyond the preserved files/layout basis.

## External and production limits

No real payment was charged, no live broker order was submitted, and no email was sent to an external institute during testing. Read-only credential checks do not replace a completed checkout/capture test or verification of hosted webhook/SMTP delivery. Rotate shared credentials before launch; configure them privately in the host environment or generated `.env`.

Video container acceptance does not guarantee codec support. WebM was verified in Chromium; MP4/H.264/AAC is recommended alongside WebM. Test actual customer files/devices.

The backend uses single-process JSON persistence with local media storage. Use a persistent disk, HTTPS, backups and monitoring. Test the final deployment/domain, then perform an independent security/load review before commercial rollout; use a transactional database for multiple replicas. Temporary media links can be shared until expiry and are not DRM. The original compatibility APIs remain in the backend; the frontend's manual trading uses the isolated paper account engine.


## v3.2 regression expansion

The full API/unit suite passes 36 tests. `round2.test.mjs` covers valuation history, recipient authorization, PDF quiz submission/grading and admin aggregates. `valuation.test.mjs` changes prices with unchanged cash and proves the correct change in net worth plus saved historical values.

`browser-round2.cjs` verifies selected/all-student sending, centered instructor sections, admin filtering, creation of all four actor types with conditional fields, cross-role admin count refresh, real activity, returned intake CSV retrieval, automatic video-editor scrolling, PDF quiz creation/submission/grading, graph/portfolio equality, and one consistently positioned persisted theme control across all six portals. The existing browser suites also pass.

Visual QA inspected instructor Analysis, populated Payment Admin reports and the dark Learner Portfolio. Ticker contrast and primary-action text are corrected in dark mode. Admin daily activity buckets use IST. No screenshot files are included as deliverables.

The final rebuild and targeted six API/unit checks plus the fourteen-request browser suite passed again after the final report/timezone adjustment. See 14_REQUESTS_CHECKLIST.md for behavior and limits.

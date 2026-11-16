# Deployment guide

## Single Node server

Use Node 24, a long-running process and a persistent disk. Deploy frontend and backend together to one domain. `npm run build` prepares both; `npm start` serves the full application. Set the platform's start command to `npm start` at the project root, or `node dist/main.js` with working directory `back-end`. Keep `back-end/algo`, datasets, runtime dependencies, and `frontend/dist` in the deployed tree.

Set these environment variables on the host (environment variables override `.env`):

| Setting | Production value |
|---|---|
| NODE_ENV | production |
| PUBLIC_URL | https://your-domain.example, without trailing slash |
| PORT | Provided by your hosting service, otherwise 3000 |
| COOKIE_SECURE | true |
| JWT_SECRET | Independently generated random secret, at least 32 characters |
| JWT_REFRESH_SECRET | Different independently generated secret, at least 32 characters |
| ADMIN_REGISTRATION_CODE | Private random code used for admin registration requests |
| DEMO_MODE | false |
| BOOTSTRAP_ADMIN_EMAIL | Your administrator email on first empty-disk launch |
| BOOTSTRAP_ADMIN_PASSWORD | A strong unique password of at least 12 characters |
| DATA_DIR | Absolute persistent disk directory, e.g. /var/lib/indai |
| UPSTOX_ANALYTICS_TOKEN | Your current analytics token |
| RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET | Matched test keys first, then matched live keys |
| RAZORPAY_WEBHOOK_SECRET | Secret configured on the Razorpay webhook |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM | Your mail provider settings |

Generate a secret locally with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Generate separate values for both JWT secrets.

On a fresh empty disk with DEMO_MODE=false, only the bootstrap Super Admin is created; demo accounts/content are not installed. **Changing DEMO_MODE on a database already populated in development does not remove those accounts.** Use a fresh production data directory, or explicitly disable/remove evaluation accounts before launch. Demo buttons are hidden when demo mode is false.

Keep platform.json private and back it up with research/ and uploads/. This version intentionally fails rather than silently resetting corrupt saved data. Restore a valid backup if it cannot be read. Use one instance only. For horizontal scaling, migrate persistence and refresh sessions to a transactional database and media to protected object storage.

## Docker

```bash
docker build -t indai-react .
docker run --name indai -p 3000:3000 --env-file production.env -v indai-data:/app/back-end/persistent-data indai-react
```

Create `production.env` privately with the values above. Do not commit it. For the Docker image, retain `DATA_DIR=/app/back-end/persistent-data`. The process runs as the non-root node user; ensure any host bind mount is writable by it. Put an HTTPS reverse proxy in front of the container. Match PUBLIC_URL to the public HTTPS domain.

## First deployment smoke check

1. Open the homepage, login and a dashboard directly by URL, then refresh each route.
2. Confirm the public demo buttons are hidden. Sign in as your bootstrap Super Admin and create the operational admin accounts.
3. Register a learner and verify the refresh cookie is HttpOnly/Secure on HTTPS. Confirm User Admin and Payment Admin route separately.
4. Restart the server and confirm a newly created account and paper trade remain.
5. Configure Razorpay test keys. Buy a test Pro subscription and an institution license. Confirm a cancelled/failed checkout grants no access. Check signed captured webhook delivery and duplicate retries. Test capture behavior before switching to live keys.
6. Configure SMTP. Email an intake link to an address you control, submit a roster, preview/import, export credentials, then test the explicit replacement-credential email. Confirm the emailed password signs in and old exported passwords no longer do after regeneration.
7. Configure Upstox. Run connection testing, search a real equity, check live prices during an open session, then check the replay label/date/clock outside market hours. Expired tokens must produce an error. Check your account's data rights for any public-facing market-data use.
8. Upload a sample PDF/video, open it from a second device using the public domain, restart, and verify it remains available.
9. Back up state and media, and practice restoring to a fresh test instance.

Use Razorpay's own dashboard for account/KYC, capture settings, payment methods and live-key activation. SMTP delivery also depends on provider/domain configuration. These are deployment-side checks, not something a ZIP can validate without your accounts.

## Current production boundaries

This package supports a self-hosted single-process prototype/evaluation deployment. It does not include a managed database, cross-instance locks, a durable email queue, full observability or a completed independent security audit. Uploaded media needs a temporary signed URL issued through authorized course access. Such URLs can be shared until they expire; they are not DRM. Reopen the course to renew an expired link. Internal instructor/provider settlement entries do not move money to bank accounts.


## Repair-version operational notes

- No private `.env` is included. `npm run setup` generates it for local evaluation. Use hosting environment variables for production.
- `/uploads/...` without a valid temporary signature returns 403. Learners obtain links through published, enrolled courses with their institution/Pro access checked. Uploaded documents are not listed as public static content.
- The trading UI contains only manual stock operations. Bot execution is disabled in the running scheduler. API paths retain the existing `/api/algo` prefix for compatibility with persisted paper accounts.
- Account state, media and paper accounts must share the same configured persistent `DATA_DIR`. Without it, legacy local upload and JSON defaults differ; back up both `back-end/uploads` and `back-end/persistent-data` during local evaluation.
- Authenticated read-only Upstox and Razorpay checks returned HTTP 200 during repair. Real checkout capture, hosted webhooks, production TLS, SMTP deliverability and browser/device video compatibility still require acceptance testing on the final domain.

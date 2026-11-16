# Run this ZIP

1. Install Node.js 24 LTS.
2. Extract the ZIP completely.
3. Open a terminal inside `IndAI_React` (the folder containing the root `package.json`).
4. Run `npm run setup` and then `npm run dev`.
5. Open http://localhost:5173.

For Course Provider: `provider@indai.com` / `Prov@1234`.
For Learner: `learner@indai.com` / `Learn@1234`.
Other demo roles and all workflows are documented in README.md.

On the sign-in page, choose **Sign In with Password** to sign in directly with an active account. **Continue to OTP** still sends a code to the registered email address through SMTP (or the local demo inbox for seeded users). Account registration and password reset continue to use OTP.

Setup keeps an existing `back-end/.env`. If it is absent, setup creates one from the example. Account deletion sends the reason to the account email before removing the account. To enable delivery, configure SMTP in `back-end/.env` and restart the backend.

## Bulk imports and provider payments

- In User Management, choose **Bulk add learners**. Use a link-accessible Google Sheet, a CSV exported from a private sheet, or a text-based PDF. Use First Name, Last Name and Email headers. Institution and Student ID are optional as a pair. Review the preview before creating accounts, then download the generated credentials and share them individually.
- In the quiz editor, keep the Multiple choice questions format and upload a DOC, DOCX or text-based PDF. Start each question with a number, list the options on separate lines as `A. ...` and `B. ...`, and finish with `Answer: A` or the appropriate option letter. Review the imported questions and save the quiz.
- In the payment dashboard, use **Course Provider Payments** to record a completed settlement with an amount and reason. The provider sees both in Earnings and receives an in-app notification.

For a build on one port: `npm run build`, then `npm start`, then http://localhost:3000.

## Super Admin

The Super Admin dashboard includes **Overview** for platform reports, **All Users** for account management and bulk learner import, and **Institutions** for institute intake. **Payments & Revenue** includes provider settlements, instructor rates and payouts, course pricing and approvals, institution billing, and the payment ledger. Class mapping and removal approvals are available from **Class mapping & approvals**.

## Learner holdings

In **Portfolio → Holdings**, select **Buy** or **Sell** on a stock row and enter the number of shares to place a paper market order. The confirmation shows the current quote, estimated value, available balance, and shares held.

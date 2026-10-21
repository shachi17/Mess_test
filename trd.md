MessMate — Technical Requirements Document (TRD)
Program: WEBSTER 2026 — CodeSangam
Team: Power Ups
Team ID: 311
Team members: Shachi Tiwari; Shreya Verma
Version: 1.0
Date: 21 October 2026
Status: Technical plan; implementation status must be verified against the current repository.
This TRD translates the MessMate product requirements and submitted WEBSTER proposal into a practical technical design. It is not a claim that every described feature is already implemented. Preserve and reuse the existing working HTML/CSS/JavaScript prototype wherever practical; do not rebuild working functionality without first checking the repository and Git history.

1. Purpose and scope
MessMate is a web-based college mess management system for meal registration, QR pass verification, confirmed attendance, auditability, and food-demand estimation.

This document defines the proposed architecture, technology choices, data model, API contracts, security rules, reliability requirements, and testing approach for the MVP.
1.1 MVP technical goals
- Support Student, Mess Worker, and Admin roles.
- Enforce meal cutoffs on the server.
- Generate unique, meal-specific QR passes containing opaque identifiers only.
- Validate passes on the backend and record attendance only after worker confirmation.
- Prevent duplicate redemption, including concurrent scans and safe retries.
- Persist users, schedules, registrations, passes, attendance, and audit events in PostgreSQL.
- Provide authorised admin counts and planned-versus-served comparisons.
- Keep the interface responsive and reuse the existing prototype where possible.
1.2 Out of scope for the initial implementation
- Native mobile apps.
- Payments or billing.
- Predictive AI/ML models; begin with transparent counts and simple demand estimates.
- Microservices or complex infrastructure before there is a measured need.
- Claims of high availability or horizontal scaling without appropriate deployment and testing.
2. Required technology stack
Layer / concern	Required technology	Responsibility
Frontend	React.js	Student, Worker, and Admin UI; client-side interaction and display
Backend	Node.js + Express.js	REST API, business rules, authentication, authorization, validation
Database	PostgreSQL	Persistent source of truth and transactional integrity
QR generation	Node.js qrcode package	Render QR codes for opaque pass identifiers
QR scanning	html5-qrcode	Browser camera scanning in Worker portal
Authentication	Maintained JWT library for Node.js	Sign and verify access tokens
Password storage	Dedicated password-hashing library/algorithm	Store password hashes, never plaintext passwords
Request validation	Zod	Validate API request payloads and parameters
Frontend tooling	Existing Vite setup, if already configured	Local React development and build
API testing	REST Client extension or equivalent	Exercise API endpoints during development
Version control	Git and GitHub	Track changes and preserve working versions


Database constraint: use PostgreSQL as required by the submitted proposal. Do not substitute SQLite or in-memory arrays for persistent application data. In-memory data may be used only for a temporary API smoke test.
3. Architecture
MessMate follows a three-tier architecture:
┌───────────────────────────────────────────────┐
│ Client tier — React.js                        │
│ Student portal | Worker portal | Admin portal │
│ QR display | Camera-based QR scanner          │
└───────────────────────┬───────────────────────┘
                        │ HTTPS / JSON REST API
┌───────────────────────▼───────────────────────┐
│ Application tier — Node.js + Express.js       │
│ Authentication and role authorization         │
│ Zod validation and business rules             │
│ Cutoff/pass validation and redemption logic   │
│ Reporting and audit-event creation            │
└───────────────────────┬───────────────────────┘
                        │ SQL via connection pool
┌───────────────────────▼───────────────────────┐
│ Data tier — PostgreSQL                        │
│ Users, schedules, registrations, passes,       │
│ attendance/redemptions, audit events           │
└───────────────────────────────────────────────┘
3.1 Client tier
- Keep the existing interface and working interactions where possible.
- React components should separate shared layout, portal-specific views, forms, status messages, and dashboard summaries.
- Client-side validation improves usability but is not a security boundary.
- Do not place database credentials, JWT signing secrets, or privileged business rules in frontend code.
- Camera scanning requires browser/device support and camera permission; production deployments generally need HTTPS.
3.2 Application tier
Express is responsible for:
- Parsing JSON request bodies.
- Authentication and role-based authorization.
- Zod validation of incoming data.
- Server-side cutoff and pass-validity checks.
- Creating/retrieving passes for eligible registrations.
- Atomic pass redemption and attendance recording.
- Audit logging and authorised reporting.
- Consistent error responses and safe server-side logging.
3.3 Data tier
PostgreSQL is the authoritative source for persistent records. Use foreign keys, unique constraints, indexes, transactions, and a connection pool. The application must not rely on browser localStorage or process memory as the authoritative store.
4. Repository and implementation approach
The project has had a working plain HTML/CSS/JavaScript prototype and a React/Vite setup has been started. Before further changes:
1. Check git status and recent commits.
2. Preserve the original prototype files and any known-good commit.
3. Compare existing Student, Worker, and Admin flows with the React UI.
4. Reuse and port working behaviour incrementally; do not recreate the entire frontend by default.
5. Keep the frontend and backend in separate folders if that matches the current repository layout.
6. Make small commits after a working milestone and test after each change.
Suggested layout (adapt to the actual repository rather than forcing a restructure):
MessMate/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/          # or portal views
│   │   ├── services/       # API client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── .env.example
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── db/
│   │   ├── validators/
│   │   └── app.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── database/
│   └── migrations/
├── .gitignore
└── README.md
This is a suggested target structure, not a requirement to move files immediately. Preserve current filenames until a deliberate, tested refactor is needed.
5. Environment and configuration
Use environment variables for environment-specific values. Keep actual secrets in a local .env file that is excluded from Git. Commit only .env.example with placeholder values.

Backend configuration should include, as applicable:
PORT=3000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=15m
NODE_ENV=development
- These values are examples/placeholders, not usable credentials.
- Never commit real database passwords or JWT secrets.
- Use separate credentials and configuration for development and production.
- Restrict database permissions to what the application needs.
- Configure CORS for the known frontend origin during local development; do not use an unrestricted production policy.
- The Vite development server and Express API typically run in separate terminals during local development.
6. Data model
The following is a conceptual schema. Final SQL migrations must define exact types, nullability, deletion rules, indexes, and constraints before the feature is considered complete.
6.1 users
Column	Purpose
id	Primary key
display_name	User's display name
login_identifier	Unique login identifier, such as approved email or username
password_hash	Password hash only; never plaintext
role	student, worker, or admin
is_active	Whether the account can sign in
created_at, updated_at	Timestamps


Constraints: unique login identifier; valid role; required password hash.
6.2 meal_schedules
Column	Purpose
id	Primary key
meal_type	Breakfast, lunch, dinner, or configured meal type
service_date	Date the meal is served
cutoff_at	Deadline for registration changes
valid_from, valid_until	Pass validity window
planned_quantity	Planned meal quantity, if configured
created_at, updated_at	Timestamps


Store and compare times consistently. Define the deployment timezone and cutoff policy explicitly; do not trust a browser clock to enforce cutoff rules.
6.3 registrations
Column	Purpose
id	Primary key
student_id	Foreign key to users.id
meal_schedule_id	Foreign key to meal_schedules.id
opted_in	Current registration choice
registered_at, updated_at	Timestamps


Constraint: one registration per student per meal schedule, enforced by a unique constraint on (student_id, meal_schedule_id). Registration changes must be rejected by the backend after the cutoff.
6.4 passes
Column	Purpose
id	Internal primary key
public_id	Cryptographically unpredictable opaque identifier included in QR payload
registration_id	Foreign key to the eligible registration
valid_from, valid_until	Pass validity window
status	For example active or redeemed
redeemed_at	Nullable redemption timestamp
redeemed_by	Worker user ID, nullable until redeemed
created_at	Creation timestamp


Constraints: unique public_id; unique pass per eligible registration as appropriate; foreign keys. Do not encode names, student numbers, passwords, or other sensitive information in the QR payload.
6.5 attendance / redemptions
Column	Purpose
id	Primary key
pass_id	Foreign key to passes.id
meal_schedule_id	Foreign key to the schedule
student_id	Foreign key to the student
worker_id	Worker who confirmed service
confirmed_at	Confirmation timestamp
operation_id	Stable idempotency/operation identifier where used


Constraints: unique successful attendance per pass. The final schema may combine pass redemption and attendance if it preserves the required auditability and integrity.
6.6 audit_events
Column	Purpose
id	Primary key
actor_user_id	User who initiated the event, nullable for selected system events
event_type	Registration, scan result, redemption, rejection, authorised correction, etc.
related_pass_id	Related pass, if applicable
related_schedule_id	Related meal schedule, if applicable
outcome	Success/rejection category
reason_code	Safe machine-readable reason where relevant
created_at	Event timestamp
metadata	Limited, non-sensitive structured metadata where needed


Do not log passwords, raw JWTs, database credentials, or unnecessary personal data.
7. API design
All API routes should return JSON and use appropriate HTTP status codes. Route names below are proposed contracts; they should be aligned with the existing backend before implementation rather than copied over blindly.
7.1 Authentication
Method	Endpoint	Access	Purpose
POST	/api/auth/login	Public	Authenticate and issue an access token
GET	/api/auth/me	Authenticated	Return the current user's safe profile and role
POST	/api/auth/logout	Authenticated / implementation-dependent	Clear client auth state and perform revocation if supported


The account-provisioning approach (pre-created accounts, admin-created accounts, or another approved option) must be decided before implementing registration/login flows. Do not expose public admin account creation.
7.2 Student and meal registration
Method	Endpoint	Access	Purpose
GET	/api/meals	Authenticated	List configured meal schedules
GET	/api/registrations/me	Student	List the student's registrations
PUT	/api/meals/:mealScheduleId/registration	Student	Create or update opt-in/opt-out before cutoff
GET	/api/passes/me?mealScheduleId=...	Student	Retrieve eligible pass details for a meal


The backend derives the student identity from the authenticated principal. It must not trust a client-supplied student ID to authorise access to another student's data.
7.3 Worker verification and redemption
Method	Endpoint	Access	Purpose
POST	/api/passes/validate	Worker	Validate a scanned opaque pass ID without consuming it
POST	/api/passes/:passId/confirm	Worker	Confirm meal service and atomically redeem the pass


The validation response should clearly distinguish valid-and-awaiting-confirmation, invalid, expired, ineligible, wrong-meal, and already-redeemed states. Do not reveal sensitive student data to the worker beyond what is operationally necessary.

The confirmation request should carry a stable operation/idempotency identifier, or use an equivalent design, so retries after uncertain network outcomes do not create a second attendance record.
7.4 Admin reporting
Method	Endpoint	Access	Purpose
GET	/api/admin/summary	Admin	Summary totals for registrations and confirmed attendance
GET	/api/admin/meals/:mealScheduleId/stats	Admin	Planned, registered, and served counts for a meal
GET	/api/admin/audit-events	Admin	Filtered audit event review
POST / PATCH	Admin correction route, if approved	Admin with explicit permission	Record an authorised correction with an audit event


Apply pagination and query limits to report/audit endpoints. Define the allowed correction workflow before exposing it.
7.5 Common response/error conventions
Use consistent error bodies, for example:
{
  "success": false,
  "error": {
    "code": "PASS_ALREADY_REDEEMED",
    "message": "This meal pass has already been used."
  }
}
Possible status codes:
- 200 successful read or update.
- 201 newly created resource.
- 400 malformed request or validation error.
- 401 missing or invalid authentication.
- 403 authenticated user lacks permission.
- 404 resource not found or intentionally not disclosed.
- 409 conflicting state, such as already redeemed.
- 422 semantically invalid request, if used consistently.
- 429 rate limit exceeded.
- 500 unexpected server error, with details kept out of the public response.
8. Critical business logic
8.1 Meal registration and cutoff
1. Authenticate the student and derive their identity from the token.
2. Validate request fields with Zod.
3. Load the meal schedule from PostgreSQL.
4. Compare the current server-side time with cutoff_at using the configured timezone policy.
5. If the cutoff has passed, reject the change.
6. Otherwise insert or update the registration in a transaction as needed.
7. Create or make available the unique pass only for an eligible opted-in registration.
8. Return the persisted result.
8.2 QR pass generation
- Generate an unpredictable opaque identifier using a cryptographically secure source.
- Encode only the identifier (and only minimal non-sensitive versioning information if needed) in the QR.
- Store the identifier and its schedule/registration association in PostgreSQL.
- Do not treat possession of a QR code alone as sufficient proof of permission; the backend must validate state and eligibility.
- Pass validity must be checked on the server on every validation/redemption attempt.
8.3 Scan and confirm must be separate
A successful scan is a validation result, not attendance. The worker must explicitly confirm that the meal was served. Refreshing the page, rescanning, or navigating away before confirmation must not consume the pass.
8.4 Atomic redemption and concurrency
Redemption is the most important integrity boundary. The backend should perform the following in one PostgreSQL transaction:
1. Validate authenticated worker role and request shape.
2. Lock or conditionally update the pass row so only one request can transition it from active to redeemed.
3. Recheck schedule, validity, eligibility, and current redemption status inside the transaction.
4. If the conditional state transition affects zero rows, return the appropriate rejected/conflict result.
5. Insert exactly one attendance/redemption record.
6. Append the corresponding audit event.
7. Commit the transaction.
Use a unique database constraint as a final safeguard against duplicate attendance. If any step fails, roll back the transaction. Never perform pass update, attendance insert, and audit insert as unrelated unprotected operations.
8.5 Safe retries / idempotency
- Generate or accept a stable operation identifier for a confirmation attempt.
- Store enough information to recognise a retry of a previously committed operation.
- If the client loses its connection after commit and retries, return the existing result rather than creating another attendance record.
- Repeated attempts must not bypass the unique pass-redemption invariant.
- Do not tell the client that redemption failed solely because a response was lost; it should be able to query/retry safely.
9. Security requirements
- Hash passwords using a dedicated password-hashing library; never store plaintext passwords.
- Use a maintained JWT library and verify signature, expiry, and expected claims.
- Use short-lived access tokens and decide deliberately how tokens are stored, cleared, and revoked. Do not put secrets in frontend source.
- Apply role-based authorization on the server for every protected route.
- Validate body, path, and query parameters with Zod.
- Use parameterised SQL queries; do not build SQL by concatenating user input.
- Keep database credentials and JWT signing secrets in environment configuration, excluded from version control.
- Use least-privilege database credentials.
- Restrict CORS to expected origins in production.
- Add sensible request-size limits and rate limits to sensitive endpoints.
- Return safe public errors; do not expose stack traces, SQL details, tokens, or secrets.
- Avoid logging unnecessary personal information.
- Ensure QR content contains opaque identifiers only.
- Use HTTPS in deployed environments, especially for authentication and camera-based scanning.
- Treat client-side validation and hidden UI elements as usability features, not access control.
10. Frontend requirements
- Preserve useful existing styles, labels, portal flows, and logic where possible.
- Keep API calls in a small service/helper layer instead of scattering fetch calls across components.
- Represent loading, success, validation error, server error, and empty states explicitly.
- Prevent double submission in the UI for usability, while still enforcing correctness on the backend.
- Student view: schedule, opt-in/out status, cutoff feedback, eligible QR pass and validity.
- Worker view: scanner, scan result, meal information, explicit confirmation, and clear rejection messages.
- Admin view: registration totals, confirmed attendance, planned-versus-served comparisons, and audit events.
- Ensure keyboard navigation, readable contrast, labels, and responsive layout.
- Do not display mock/demo data as if it were persisted production data.
11. Error handling and observability
- Centralize Express error handling.
- Use stable error codes for expected conditions such as cutoff passed, invalid pass, expired pass, wrong meal, ineligible registration, and already redeemed.
- Log unexpected errors server-side with request correlation information where practical.
- Audit meaningful security and business events.
- Do not log credentials, raw tokens, or unnecessary sensitive payloads.
- Add a simple health endpoint such as GET /health that reports application status without exposing secrets.
- Distinguish an application health check from proof that every dependency and feature works.
12. Testing strategy
12.1 Unit tests
- Zod schemas reject malformed registration and pass-confirmation payloads.
- Cutoff logic accepts changes before cutoff and rejects them after cutoff.
- Role checks reject users who do not have the required role.
- Pass-status mapping produces clear results for active, expired, and redeemed passes.
12.2 API integration tests
- Login returns a valid token for a valid account and rejects invalid credentials.
- Student cannot read or change another student's registration by changing request IDs.
- Student cannot call worker or admin endpoints.
- Worker cannot call admin reporting/correction endpoints.
- Registration persists in PostgreSQL and survives backend restart.
- Invalid, expired, wrong-meal, and ineligible passes are rejected.
- Scanning a pass does not create attendance before confirmation.
- Confirmation creates exactly one redemption, attendance record, and audit event.
- A duplicate confirmation does not create duplicate attendance.
- A retry after an uncertain response returns the existing outcome safely.
- Two simultaneous confirmation attempts produce exactly one successful redemption.
- Admin totals match persisted registrations and attendance records.
12.3 End-to-end/manual checks
- Student: sign in → choose meal → opt in → see pass → opt out before cutoff if allowed.
- Worker: sign in → scan valid pass → review result → confirm → scan again and receive already-used result.
- Admin: sign in → review summary and meal-level statistics.
- Camera permission denied or unavailable: show a helpful message.
- Test on desktop and a mobile-sized viewport.
- Verify all important flows against the running React frontend and Express API, not only by opening individual HTML files directly.
12.4 Definition of done for a feature
A feature is done only when:
1. The implementation exists.
2. It uses the required backend/database path where applicable.
3. Success and failure cases have been tested.
4. Its behaviour matches the PRD and this TRD.
5. No credentials or secrets were committed.
6. The change is saved in Git with a clear commit message.
13. Development order
Implement in small, reversible steps; test each step before moving on.
1. Preserve and inspect: check the existing prototype, current React files, backend files, and Git history. Do not delete or replace working code without a backup and a reason.
2. Connect the current React UI to Express: verify one real request end-to-end. Keep existing UI functionality intact.
3. Set up PostgreSQL: configure connection pooling, migrations, tables, constraints, and seed/test data.
4. Move registrations to PostgreSQL: remove reliance on in-memory arrays for persistent data and verify restart persistence.
5. Add authentication and roles: password hashing, JWT verification, and protected routes.
6. Implement cutoff enforcement and registration rules: server-side and database-backed.
7. Generate QR passes: unique opaque identifiers and correct validity windows.
8. Implement worker scan and validation: use html5-qrcode; scanning does not redeem.
9. Implement confirmation, atomic redemption, and idempotent retries: test duplicate and concurrent requests.
10. Build admin reporting and audit views: use database-backed counts.
11. Run regression, security, and responsive checks: verify earlier flows still work.
12. Deploy only after local end-to-end tests pass: configure HTTPS, secrets, database access, and backups appropriate to the hosting environment.
14. Deployment and operations
Deployment details depend on the hosting provider selected by the team. Before release:
- Configure production environment variables and keep secrets outside source control.
- Use HTTPS for the web app and API.
- Ensure the PostgreSQL instance is persistent and not publicly open to unrestricted access.
- Run schema migrations deliberately.
- Configure backups and test restoration where the host supports it.
- Configure process restart and health checks where supported.
- Review logs for sensitive information.
- Confirm that the selected deployment supports camera access and any required cross-origin configuration.
- Do not claim high availability, autoscaling, or tested recovery unless those capabilities have actually been configured and tested.
15. Risks and mitigations
Risk	Mitigation
Existing frontend gets rebuilt unnecessarily	Preserve original files and Git history; inspect before refactoring; make small reversible changes.
API uses temporary in-memory storage	Move persistent records to PostgreSQL before claiming the feature is complete.
Duplicate attendance from simultaneous scans	Use PostgreSQL transactions, conditional state transition/locking, and unique constraints.
Browser/client rules are bypassed	Enforce authentication, roles, cutoffs, and pass validity on the backend.
Retry after a lost response duplicates attendance	Use idempotent confirmation and a unique attendance invariant.
Camera access fails	Explain permission requirements, test supported devices, and provide clear error feedback.
Secrets are committed	Use .env, .gitignore, and a placeholder .env.example.
Scope is too large for available time	Prioritise reliable end-to-end flows and failure cases; avoid premature infrastructure complexity.


16. Open technical decisions
Resolve these before finalising implementation details:
- How will accounts be provisioned initially?
- What timezone and exact cutoff semantics apply to meal schedules?
- What validity windows apply to each meal?
- What student information, if any, may a worker see after scanning?
- Which admin corrections are allowed and who is authorised to perform them?
- What deployment provider and PostgreSQL hosting will be used?
- What token storage/revocation approach is appropriate for the chosen deployment?
- What camera fallback, if any, is acceptable for devices without compatible camera access?
17. Relationship to the PRD
The PRD defines what MessMate should do and how success is judged. This TRD defines how the system should be structured and the technical safeguards required to meet those product requirements. If implementation choices conflict with the submitted WEBSTER stack or critical product guarantees, resolve the conflict before coding rather than silently changing the stack or weakening the requirements.
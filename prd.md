# PRODUCT REQUIREMENTS DOCUMENT
## MessMate
### Smart College Mess Management System

| Program | WEBSTER 2026 — CodeSangam |
| --- | --- |
| Team | Power Ups |
| Team ID | 311 |
| Team members | Shachi Tiwari; Shreya Verma |
| Document version | 1.0 |
| Date | 21 October 2026 |
| Status | Working PRD — implementation status must be verified against the current repository |

**Purpose:** Establish a single, clear source of truth for the product before further development.

---

### 1. Product overview
MessMate is a web-based college mess management platform intended to improve meal planning, meal-pass verification, attendance tracking, and food-demand estimation. Students register for scheduled meals before a defined cutoff. Eligible students receive unique, meal-specific QR passes. Mess workers scan and validate passes, then confirm that a meal was served. Administrators review registrations, attendance, and planned-versus-served meal counts.

### 2. Problem statement
College mess operations can struggle to estimate meal demand, confirm eligibility quickly, prevent duplicate check-ins, and maintain reliable attendance records. Manual or browser-only validation can produce inconsistent counts and make food preparation less accurate. MessMate aims to provide a centralised, auditable workflow with server-side validation and reliable database operations.

### 3. Product goals
* Let students opt in or out of a scheduled meal before its cutoff.
* Issue a unique QR pass for each eligible student and meal, with a defined validity window.
* Give mess workers a simple scan → validate → confirm workflow.
* Prevent duplicate redemption, including simultaneous scans and retries after network interruptions.
* Show administrators registration totals, served-meal counts, and planned-versus-served comparisons.
* Use attendance and registration data to support better food preparation estimates.
* Preserve the existing working prototype and reuse its useful UI/logic instead of rebuilding working features without a reason.

### 4. Users and roles
| Role | Main needs | Permissions (planned) |
| --- | --- | --- |
| **Student** | View meal schedule; opt in/out; view eligible pass and its status. | Manage own meal registrations and view own passes. |
| **Mess worker** | Scan QR; see clear valid/invalid/expired/already-used results; confirm meal served. | Validate passes and record confirmed meal service; no admin reporting access. |
| **Administrator** | Monitor registrations, attendance, demand, and audit events. | Access authorised aggregate reports and permitted corrections. |

### 5. Scope

#### 5.1 MVP — Must-have
* Role-based authentication for Student, Mess Worker, and Admin.
* Meal schedule and meal-specific cutoff handling.
* Student opt-in/opt-out with server-side validation of cutoff rules.
* Unique, opaque pass identifier per eligible student and meal; QR must not expose sensitive student information.
* Browser-based QR scanning using a compatible device camera.
* Server-side checks for pass authenticity, meal, validity window, eligibility, and redemption status.
* Separate scan/validation from final worker confirmation; scanning alone must not consume a pass.
* Retry-safe, atomic redemption so a refresh or uncertain network result does not create duplicate attendance.
* Attendance counts updated only after successful confirmation.
* Admin dashboard for registrations, attendance, and planned-versus-served counts.
* Audit trail for successful redemptions, rejected attempts, and authorised corrections.
* Responsive layout for mobile, tablet, and desktop.

### 6. Core user journeys

#### 6.1 Student meal registration
1. Student signs in and opens the meal schedule.
2. Student selects a meal and opts in or opts out before the published cutoff.
3. Backend authenticates the student, validates the request and cutoff, and persists the registration.
4. For an eligible opted-in registration, the system creates or retrieves the unique pass for that student and meal.
5. Student sees the QR pass, meal details, validity window, and current status.

#### 6.2 Worker meal verification
1. Worker signs in and opens the QR scanner.
2. Worker scans the QR; the client sends the opaque pass identifier to the backend.
3. Backend checks pass authenticity, meal, time window, eligibility, and prior redemption.
4. For a valid pass, the worker sees a clear result and explicitly confirms that the meal was served.
5. The backend performs one atomic transaction to record redemption, attendance, and the audit event.
6. Invalid, expired, or already-redeemed passes are rejected with a clear explanation. If the request outcome is uncertain, retry returns the existing result rather than recording a second meal.

#### 6.3 Admin monitoring
1. Admin signs in to the protected dashboard.
2. Dashboard shows registrations, confirmed attendance, and planned-versus-served counts by meal and relevant time period.
3. Admin can review audit events and perform only explicitly authorised corrections.

### 7. Functional requirements
| ID | Requirement | Acceptance-level description |
| --- | --- | --- |
| FR-01 | Authentication | Users must authenticate before using protected features. Passwords must be hashed, never stored as plaintext. |
| FR-02 | Role authorisation | The backend must enforce role permissions on every protected API route; hiding a UI control is not sufficient. |
| FR-03 | Meal schedule | Users can view configured meal times, cutoff times, and validity windows. |
| FR-04 | Registration cutoff | The server is the authority for cutoff enforcement; client time alone must not decide eligibility. |
| FR-05 | Unique pass | Each eligible student/meal registration has a unique, opaque pass identifier and defined validity. |
| FR-06 | QR generation | Generate a QR representation of the opaque identifier using the Node.js qrcode package. |
| FR-07 | QR scanning | Use html5-qrcode in the worker portal, with permission/error handling for unsupported or denied cameras. |
| FR-08 | Validation | The server validates authenticity, eligibility, meal, validity window, and redemption status. |
| FR-09 | Confirmation | A scan must not mark a meal as served until the worker confirms service. |
| FR-10 | Duplicate prevention | Only one successful redemption may exist per pass, even when requests arrive concurrently. |
| FR-11 | Safe retry | Repeated requests after uncertain outcomes must not create duplicate attendance records. |
| FR-12 | Attendance | Attendance and meal counts update only after successful redemption. |
| FR-13 | Admin reports | Admin can view registration and attendance counts and compare planned meals with served meals. |
| FR-14 | Audit logs | Record relevant successful scans, rejected attempts, and authorised corrections without unnecessarily logging sensitive data. |
| FR-15 | Validation/errors | Validate API payloads with Zod and return consistent, understandable error responses. |
| FR-16 | Responsive UI | Core journeys must be usable on common desktop and mobile-sized screens. |

### 8. Non-functional requirements
* **Security:** Authentication, role-based authorisation, password hashing, input validation, secrets in environment configuration, and least-privilege access.
* **Integrity:** PostgreSQL transactions and constraints are the source of truth for pass redemption and attendance.
* **Reliability:** Scan, confirmation, and retry behaviour must be tested for refreshes, duplicate requests, and uncertain network outcomes.
* **Privacy:** QR payloads contain opaque identifiers, not names, registration numbers, or other sensitive student details.
* **Usability:** Statuses must be unambiguous (valid and awaiting confirmation, confirmed/served, invalid, expired, or already redeemed).
* **Compatibility:** Responsive interface; QR camera use depends on browser/device support and may require HTTPS outside localhost.
* **Maintainability:** Modular React components, Express routes/middleware, and clearly separated database operations.
* **Observability:** Meaningful server-side errors and audit events without leaking credentials or sensitive data.

### 9. Required technology stack
| Layer / concern | Required choice |
| --- | --- |
| Frontend | React.js |
| Backend/API | Node.js + Express.js (REST API) |
| Database | PostgreSQL — persistent storage; no SQLite substitution |
| QR generation | Node.js qrcode package |
| QR scanning | html5-qrcode |
| Authentication | Maintained JWT library for Node.js; password-hashing algorithm/library |
| Request validation | Zod |
| Architecture | Three-tier: React client → Express application/API → PostgreSQL data layer |

### 10. Data model — conceptual
Final schema should be designed before implementing redemption logic. At minimum, plan for these entities:
* **Users:** id, display name, login identifier, password hash, role, status, created/updated timestamps.
* **Meals or meal schedules:** id, meal type, service date, start/end or validity window, cutoff time, planned quantity/status.
* **Registrations:** id, student/user id, meal schedule id, opt-in status, registration timestamp; enforce one registration per student and scheduled meal.
* **Passes:** id or opaque public identifier, registration id, validity window, redemption status and timestamps; enforce uniqueness.
* **Attendance/redemptions:** id, pass id, worker id, confirmation timestamp and relevant meal schedule; enforce one successful redemption per pass.
* **Audit events:** event type, actor, related record identifiers, timestamp, outcome/reason, and safe metadata.

*Note: This is a conceptual model, not a final SQL schema. The implementation should use foreign keys, appropriate unique constraints, indexes, and transactions.*

### 11. Architecture and critical engineering rules
* React owns presentation and client-side interaction; it must not be trusted to enforce security rules.
* Express is responsible for authentication, role checks, cutoff validation, pass validation, and business rules.
* PostgreSQL is the authoritative source for persistent registrations, pass state, attendance, and audit history.
* Redemption must be atomic: update pass status, create attendance, and append audit event in one transaction.
* Use a conditional update or row-level locking and a unique database constraint to stop concurrent duplicate redemption.
* Use an idempotency key or equivalent stable operation identifier for safe retries after uncertain outcomes.
* Keep database credentials and JWT signing secrets out of frontend code and source control.
* Do not mark a feature complete in the UI or documentation until its end-to-end behaviour has been implemented and tested.

### 12. Acceptance criteria / definition of done
* Student can opt in and out before cutoff; after cutoff, the server rejects changes and the UI explains why.
* An eligible student receives a meal-specific QR pass; a different meal/date does not accidentally reuse an invalid pass.
* A worker can scan a valid pass and see the expected meal and status before confirming service.
* Scanning without confirmation does not consume the pass.
* After confirmation, the pass is redeemed and attendance increases exactly once.
* A second scan is rejected as already redeemed and does not increase attendance again.
* Expired, malformed, ineligible, or wrong-meal passes are rejected server-side.
* Refreshing or retrying after a simulated interruption does not create duplicate attendance.
* Two concurrent redemption attempts result in exactly one successful redemption.
* Admin counts match persisted registrations and successful attendance records.
* Audit records exist for relevant success and rejection outcomes.
* Protected endpoints reject unauthenticated users and users with the wrong role.
* The app has been tested at desktop and mobile viewport sizes, with relevant error states checked.

### 13. Implementation status and next-step guidance
This PRD describes intended product behaviour from the WEBSTER submission and the current project discussion. It does not certify that any requirement is already implemented.
1. **First:** Preserve and test the existing prototype; do not discard or rewrite working files without a verified reason.
2. **Second:** Inspect the current Git state and compare the old prototype with the React version; decide what can be reused.
3. **Third:** Connect the React UI to the existing Express API and verify real requests end to end.
4. **Fourth:** Configure PostgreSQL and migrate registrations from temporary in-memory storage to persistent database tables.
5. **Fifth:** Implement authentication/roles, cutoff enforcement, QR generation/scanning, and transactional confirmation in small, testable steps.

### 14. Risks and mitigations
| Risk | Mitigation |
| --- | --- |
| Rebuilding working UI unnecessarily | Keep the original files and Git history; make small, reversible changes and verify each step. |
| In-memory API data disappears | Use PostgreSQL for persistent application records before treating the workflow as complete. |
| Duplicate attendance under concurrency | Use transactions, conditional updates/locks, and database uniqueness constraints. |
| Client-side checks can be bypassed | Enforce all important rules in Express and PostgreSQL. |
| Camera access fails on a device/browser | Provide permission guidance, test compatible devices, and consider a controlled manual fallback only if allowed by the product scope. |
| JWT/secret leakage | Keep secrets in environment variables, exclude .env from Git, and use short-lived tokens with deliberate storage/revocation decisions. |
| Scope too large for the team/time | Prioritise a reliable end-to-end happy path, then failure cases; avoid premature deployment complexity. |

### 15. Success metrics
* Duplicate redemption attempts never produce more than one successful attendance record per pass.
* The system can explain why an invalid or expired pass was rejected.
* Meal registration and attendance counts reconcile with the underlying database records.
* A worker can complete the scan-and-confirm journey with clear feedback and without accidental pass consumption.
* Administrators can compare planned meals and confirmed meals served for a selected meal schedule.

### 16. Open decisions to settle during implementation
* How will users be provisioned initially (pre-created accounts, admin-created accounts, or another WEBSTER-approved approach)?
* What exact timezone and cutoff rule will be used for meal schedules?
* What are the pass validity windows for breakfast, lunch, and dinner?
* Which admin corrections are allowed, who can perform them, and how are they audited?
* What deployment target will be used, and does it support HTTPS, persistent PostgreSQL, secrets, backups, and camera access?

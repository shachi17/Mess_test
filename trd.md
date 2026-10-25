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



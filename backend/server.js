require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const { DATABASE_URL, JWT_SECRET } = process.env;
// DEMO_MODE=true skips cutoff and meal-window checks so you can demo at any hour.
const ENFORCE_CUTOFF = process.env.ENFORCE_CUTOFF !== "false"; // on unless set to "false"
const DEMO_MODE = process.env.DEMO_MODE === "true";

if (!DATABASE_URL || !JWT_SECRET) {
  throw new Error("DATABASE_URL and JWT_SECRET are required in backend/.env");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

app.use(express.json({ limit: "10kb" }));
const origins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors(origins.length ? { origin: origins } : {}));
let readyPromise;
const ensureReady = () => (readyPromise ||= initializeDatabase());
app.use((req, res, next) => {
  ensureReady()
    .then(() => next())
    .catch((error) => {
      console.error("DB init failed:", error);
      res.status(500).json({ success: false, message: "Server error." });
    });
});
/* ---------- Meal timings (Asia/Kolkata), minutes after midnight ---------- */
const MEALS = {
  Breakfast: { start: 7 * 60 + 30, end: 9 * 60 + 30 },
  Lunch: { start: 12 * 60, end: 14 * 60 + 15 },
  Dinner: { start: 19 * 60 + 30, end: 21 * 60 },
};
const CUTOFF_MINUTES = 60; // registration/cancellation closes 1 hour before start

function fmt(min) {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;
}

function nowIST() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")),
  };
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function cutoffPassed(meal, mealDate) {
  if (!ENFORCE_CUTOFF) return false;
  const now = nowIST();
  if (mealDate < now.date) return true;
  if (mealDate > now.date) return false;
  return now.minutes >= MEALS[meal].start - CUTOFF_MINUTES;
}
/* ---------- Database ---------- */
const FIELDS = `
  id,
  student_name AS "studentName",
  registration_number AS "registrationNumber",
  meal,
  to_char(meal_date, 'YYYY-MM-DD') AS "mealDate",
  pass_id AS "passId",
  opted_in AS "optedIn",
  status,
  created_at AS "createdAt",
  served_at AS "servedAt",
  served_by AS "servedBy"
`;

async function seedUser(username, name, role, password) {
  if (!password) {
    console.warn(`Skipping seed for ${username}: password env var missing.`);
    return;
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (username, name, role, password_hash)
     VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING`,
    [username, name, role, hash]
  );
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'worker', 'admin')),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id SERIAL PRIMARY KEY,
      student_name TEXT NOT NULL,
      registration_number TEXT,
      meal TEXT NOT NULL,
      pass_id TEXT UNIQUE NOT NULL,
      opted_in BOOLEAN NOT NULL DEFAULT TRUE,
      status TEXT NOT NULL DEFAULT 'registered'
        CHECK (status IN ('registered', 'served')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      served_at TIMESTAMPTZ
    )
  `);
  await pool.query(
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_number TEXT`
  );
  await pool.query(
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS meal_date DATE NOT NULL DEFAULT CURRENT_DATE`
  );
  await pool.query(
    `ALTER TABLE registrations ADD COLUMN IF NOT EXISTS served_by TEXT`
  );

  // Deactivate legacy duplicates so the unique index below can be created.
  await pool.query(`
    UPDATE registrations SET opted_in = FALSE
    WHERE opted_in AND id NOT IN (
      SELECT MAX(id) FROM registrations WHERE opted_in
      GROUP BY registration_number, meal, meal_date
    )
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_reg
    ON registrations (registration_number, meal, meal_date)
    WHERE opted_in = TRUE
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_reg_date ON registrations (meal_date)`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      actor TEXT,
      action TEXT NOT NULL,
      pass_id TEXT,
      result TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await seedUser("ADMIN", "Mess Admin", "admin", process.env.ADMIN_PASSWORD);
  await seedUser("WORKER", "Mess Worker", "worker", process.env.WORKER_PASSWORD);
  await seedDemo(); 
}

async function audit(actor, action, passId, result) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (actor, action, pass_id, result)
       VALUES ($1, $2, $3, $4)`,
      [actor || null, action, passId || null, result || null]
    );
  } catch (error) {
    console.error("Audit write failed:", error.message);
  }
}

/* ---------- Helpers & middleware ---------- */
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((error) => {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error." });
  });

function makeSession(user) {
  const token = jwt.sign(
    { sub: user.id, role: user.role, username: user.username, name: user.name },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
  return {
    success: true,
    token,
    user: { username: user.username, name: user.name, role: user.role },
  };
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: "Please sign in." });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: "Session expired. Please sign in again." });
  }
}

const requireRole =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : res.status(403).json({ success: false, message: "You do not have access to this action." });

const normalizePass = (value) => String(value || "").trim().toUpperCase();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Try again in a few minutes." },
});

// Returns null if the pass can be redeemed now, otherwise { status, message }.
function evaluatePass(row) {
  if (!row) return { status: 404, message: "Invalid pass. No such registration." };
  if (!row.optedIn) return { status: 410, message: "This registration was cancelled." };
  if (row.status === "served") {
    return { status: 409, message: "This pass has already been redeemed." };
  }
  if (!DEMO_MODE) {
    const now = nowIST();
    const window = MEALS[row.meal];
    if (row.mealDate !== now.date) {
      return { status: 422, message: `This pass is for ${row.mealDate}, not today.` };
    }
    if (now.minutes < window.start) {
      return { status: 422, message: `${row.meal} has not started yet (starts ${fmt(window.start)}).` };
    }
    if (now.minutes > window.end) {
      return { status: 422, message: `Pass expired. ${row.meal} ended at ${fmt(window.end)}.` };
    }
  }
  return null;
}

async function fetchPass(passId) {
  const result = await pool.query(
    `SELECT ${FIELDS} FROM registrations WHERE pass_id = $1`,
    [passId]
  );
  return result.rows[0] || null;
}

/* ---------- Public routes ---------- */
app.get("/", (req, res) => res.json({ message: "MessMate backend is running!", status: "success" }));
app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/api/config", (req, res) => {
  const now = nowIST();
  const passed = {};
  const meals = Object.entries(MEALS).map(([name, w]) => {
    passed[name] = cutoffPassed(name, now.date);
    return {
      name,
      start: fmt(w.start),
      end: fmt(w.end),
      cutoff: fmt(w.start - CUTOFF_MINUTES),
    };
  });
  res.json({
    meals,
    cutoffPassed: passed,
    demoMode: DEMO_MODE,
    today: now.date,
    tomorrow: addDays(now.date, 1),
    enforceCutoff: ENFORCE_CUTOFF,
  });
});

/* ---------- Auth ---------- */
app.post(
  "/api/auth/signup",
  authLimiter,
  wrap(async (req, res) => {
    const { name, registrationNumber, password } = req.body || {};
    const username = String(registrationNumber || "").trim().toUpperCase();
    const displayName = String(name || "").trim();

    if (
      displayName.length < 2 ||
      displayName.length > 60 ||
      !/^[A-Z0-9/-]{4,20}$/.test(username) ||
      typeof password !== "string" ||
      password.length < 6 ||
      password.length > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter your name, a valid registration number and a password of 6+ characters.",
      });
    }

    try {
      const hash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO users (username, name, role, password_hash)
         VALUES ($1, $2, 'student', $3) RETURNING id, username, name, role`,
        [username, displayName, hash]
      );
      await audit(username, "SIGNUP", null, "ok");
      res.status(201).json(makeSession(result.rows[0]));
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "This registration number already has an account. Sign in instead.",
        });
      }
      throw error;
    }
  })
);

app.post(
  "/api/auth/login",
  authLimiter,
  wrap(async (req, res) => {
    const username = String(req.body?.username || "").trim().toUpperCase();
    const password = String(req.body?.password || "");

    const result = await pool.query(
      `SELECT id, username, name, role, password_hash FROM users WHERE username = $1`,
      [username]
    );
    const user = result.rows[0];
    const valid = user && (await bcrypt.compare(password, user.password_hash));

    if (!valid) {
      await audit(username, "LOGIN_FAILED", null, "bad credentials");
      return res.status(401).json({ success: false, message: "Wrong ID or password." });
    }

    res.json(makeSession(user));
  })
);

/* ---------- Student ---------- */
const student = [requireAuth, requireRole("student")];

app.get(
  "/api/my/registrations",
  ...student,
  wrap(async (req, res) => {
    const result = await pool.query(
      `SELECT ${FIELDS} FROM registrations
       WHERE registration_number = $1 AND opted_in = TRUE AND meal_date >= $2
       ORDER BY meal_date, id`,
      [req.user.username, nowIST().date]
    );
    res.json(result.rows);
  })
);

app.post(
  "/api/my/registrations",
  ...student,
  wrap(async (req, res) => {
    const { meal, date } = req.body || {};
    const today = nowIST().date;

    if (!MEALS[meal]) {
      return res.status(400).json({ success: false, message: "Unknown meal." });
    }
    if (date !== today && date !== addDays(today, 1)) {
      return res.status(400).json({ success: false, message: "You can register for today or tomorrow only." });
    }
    if (cutoffPassed(meal, date)) {
      return res.status(403).json({
        success: false,
        message: `Registration for ${meal} closed at ${fmt(MEALS[meal].start - CUTOFF_MINUTES)}.`,
      });
    }

    const passId = "MM-" + crypto.randomBytes(5).toString("hex").toUpperCase();

    try {
      const result = await pool.query(
        `INSERT INTO registrations
           (student_name, registration_number, meal, meal_date, pass_id, opted_in)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING ${FIELDS}`,
        [req.user.name, req.user.username, meal, date, passId]
      );
      await audit(req.user.username, "REGISTER", passId, `${meal} ${date}`);
      res.status(201).json({ success: true, registration: result.rows[0] });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ success: false, message: `You are already registered for ${meal}.` });
      }
      throw error;
    }
  })
);

app.delete(
  "/api/my/registrations/:passId",
  ...student,
  wrap(async (req, res) => {
    const row = await fetchPass(normalizePass(req.params.passId));

    if (!row || row.registrationNumber !== req.user.username || !row.optedIn) {
      return res.status(404).json({ success: false, message: "Registration not found." });
    }
    if (row.status === "served") {
      return res.status(409).json({ success: false, message: "This meal was already served." });
    }
    if (cutoffPassed(row.meal, row.mealDate)) {
      return res.status(403).json({
        success: false,
        message: `Cancellation for ${row.meal} closed at ${fmt(MEALS[row.meal].start - CUTOFF_MINUTES)}.`,
      });
    }

    const result = await pool.query(
      `UPDATE registrations SET opted_in = FALSE
       WHERE pass_id = $1 AND opted_in = TRUE AND status = 'registered'
       RETURNING id`,
      [row.passId]
    );
    if (!result.rows.length) {
      return res.status(409).json({ success: false, message: "Could not cancel. It may already be served." });
    }
    await audit(req.user.username, "CANCEL", row.passId, `${row.meal} ${row.mealDate}`);
    res.json({ success: true, message: "Registration cancelled." });
  })
);

/* ---------- Worker ---------- */
const worker = [requireAuth, requireRole("worker", "admin")];

// Verify a scanned pass (does NOT consume it).
app.get(
  "/api/passes/:passId",
  ...worker,
  wrap(async (req, res) => {
    const passId = normalizePass(req.params.passId);
    const row = await fetchPass(passId);
    const problem = evaluatePass(row);

    if (problem) {
      await audit(req.user.username, "SCAN_REJECTED", passId, problem.message);
      return res.status(problem.status).json({ success: false, message: problem.message });
    }

    await audit(req.user.username, "SCAN_OK", passId, `${row.meal} ${row.studentName}`);
    res.json({ success: true, registration: row });
  })
);

// Confirm the meal was served. Atomic, and safe to retry.
app.patch(
  "/api/passes/:passId/serve",
  ...worker,
  wrap(async (req, res) => {
    const passId = normalizePass(req.params.passId);
    const row = await fetchPass(passId);

    // Retry after a dropped response: same worker, just confirmed -> same result.
    if (
      row &&
      row.optedIn &&
      row.status === "served" &&
      row.servedBy === req.user.username &&
      Date.now() - new Date(row.servedAt).getTime() < 2 * 60 * 1000
    ) {
      return res.json({ success: true, idempotent: true, registration: row });
    }

    const problem = evaluatePass(row);
    if (problem) {
      await audit(req.user.username, "SERVE_REJECTED", passId, problem.message);
      return res.status(problem.status).json({ success: false, message: problem.message });
    }

    const result = await pool.query(
      `UPDATE registrations
       SET status = 'served', served_at = NOW(), served_by = $2
       WHERE pass_id = $1 AND opted_in = TRUE AND status = 'registered'
       RETURNING ${FIELDS}`,
      [passId, req.user.username]
    );

    if (!result.rows.length) {
      // Another worker redeemed it between our check and our update.
      await audit(req.user.username, "SERVE_REJECTED", passId, "lost race: already redeemed");
      return res.status(409).json({ success: false, message: "This pass has already been redeemed." });
    }

    await audit(req.user.username, "SERVE_OK", passId, `${row.meal} ${row.studentName}`);
    res.json({ success: true, message: "Meal served.", registration: result.rows[0] });
  })
);

/* ---------- Admin ---------- */
const admin = [requireAuth, requireRole("admin")];

app.get(
  "/api/admin/stats",
  ...admin,
  wrap(async (req, res) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "")
      ? req.query.date
      : nowIST().date;

    const [current, history] = await Promise.all([
      pool.query(
        `SELECT meal,
                COUNT(*) FILTER (WHERE opted_in)::int AS planned,
                COUNT(*) FILTER (WHERE opted_in AND status = 'served')::int AS served
         FROM registrations WHERE meal_date = $1 GROUP BY meal`,
        [date]
      ),
      pool.query(
        `SELECT meal,
                COUNT(*) FILTER (WHERE status = 'served')::float / COUNT(*) AS rate,
                COUNT(*)::int AS samples
         FROM registrations WHERE opted_in AND meal_date < $1 GROUP BY meal`,
        [date]
      ),
    ]);

    const meals = Object.keys(MEALS).map((meal) => {
      const cur = current.rows.find((r) => r.meal === meal) || { planned: 0, served: 0 };
      const hist = history.rows.find((r) => r.meal === meal);
      const basedOnHistory = Boolean(hist && hist.samples >= 5);
      const rate = basedOnHistory ? hist.rate : 0.9; // default assumption: 90% show up
      return {
        meal,
        planned: cur.planned,
        served: cur.served,
        pending: cur.planned - cur.served,
        showUpRate: Math.round(rate * 100),
        basedOnHistory,
        suggestedPrep: Math.ceil(cur.planned * rate),
      };
    });

    res.json({ date, meals });
  })
);

app.get(
  "/api/admin/registrations",
  ...admin,
  wrap(async (req, res) => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "")
      ? req.query.date
      : nowIST().date;
    const result = await pool.query(
      `SELECT ${FIELDS} FROM registrations
       WHERE meal_date = $1 AND opted_in = TRUE
       ORDER BY id DESC LIMIT 300`,
      [date]
    );
    res.json(result.rows);
  })
);

app.get(
  "/api/admin/audit",
  ...admin,
  wrap(async (req, res) => {
    const result = await pool.query(
      `SELECT id, actor, action, pass_id AS "passId", result, created_at AS "createdAt"
       FROM audit_logs ORDER BY id DESC LIMIT 30`
    );
    res.json(result.rows);
  })
);

if (require.main === module) {
  ensureReady().then(() => {
    app.listen(PORT, () => {
      console.log(`MessMate backend running on port ${PORT}${DEMO_MODE ? " (DEMO_MODE)" : ""}`);
    });
  });
}

module.exports = app;

  const DEMO_STUDENTS = [
  ["20250001", "Aarav Sharma"], ["20250002", "Ananya Singh"],
  ["20250003", "Rohan Gupta"], ["20250004", "Priya Verma"],
  ["20250005", "Kabir Mehta"], ["20250006", "Shachi Tiwari"],
  ["20250007", "Vikram Yadav"], ["20250008", "Neha Mishra"],
  ["20250009", "Arjun Pandey"], ["20250010", "Sana Khan"],
];

async function seedDemo() {
  const pw = process.env.DEMO_PASSWORD;
  if (process.env.SEED_DEMO !== "true" || !pw) return;

  for (const [id, name] of DEMO_STUDENTS) await seedUser(id, name, "student", pw);
  for (let i = 1; i <= 5; i++) await seedUser(`WORKER${i}`, `Mess Worker ${i}`, "worker", pw);

  // Past 3 days of history, only once.
  const done = await pool.query(
    `SELECT 1 FROM registrations WHERE registration_number = $1 AND meal_date < CURRENT_DATE LIMIT 1`,
    [DEMO_STUDENTS[0][0]]
  );
  if (done.rows.length) return;

  const today = nowIST().date;
  for (let d = 1; d <= 3; d++) {
    const date = addDays(today, -d);
    for (const meal of Object.keys(MEALS)) {
      for (const [i, [id, name]] of DEMO_STUDENTS.entries()) {
        if ((i + d + meal.length) % 4 === 0) continue;               // some skip registering
        const served = (i * 7 + d * 3 + meal.length) % 10 !== 0;      // ~90% turn up
        await pool.query(
          `INSERT INTO registrations
             (student_name, registration_number, meal, meal_date, pass_id, opted_in, status, served_at, served_by)
           VALUES ($1,$2,$3,$4,$5,TRUE,$6, $7, $8)
           ON CONFLICT DO NOTHING`,
          [
            name, id, meal, date,
            "MM-" + crypto.randomBytes(5).toString("hex").toUpperCase(),
            served ? "served" : "registered",
            served ? new Date(Date.now() - d * 86400000) : null,
            served ? "WORKER1" : null,
          ]
        );
      }
    }
  }
}


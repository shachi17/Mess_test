
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing from backend/.env");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(express.json());
app.use(cors());

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registrations (
      id SERIAL PRIMARY KEY,
      student_name TEXT NOT NULL,
      meal TEXT NOT NULL,
      pass_id TEXT UNIQUE NOT NULL,
      opted_in BOOLEAN NOT NULL DEFAULT TRUE,
      status TEXT NOT NULL DEFAULT 'registered'
        CHECK (status IN ('registered', 'served')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      served_at TIMESTAMPTZ
    )
  `);
}

app.get("/", (req, res) => {
  res.json({
    message: "MessMate backend is running!",
    status: "success",
  });
});

app.post("/api/registrations", async (req, res) => {
  try {
    const { studentName, meal, passId, optedIn } = req.body;

    if (
      typeof studentName !== "string" || !studentName.trim() ||
      typeof meal !== "string" || !meal.trim() ||
      typeof passId !== "string" || !passId.trim() ||
      optedIn !== true
    ) {
      return res.status(400).json({
        success: false,
        message: "Student name, meal, passId and optedIn: true are required.",
      });
    }

    const result = await pool.query(
      `INSERT INTO registrations
        (student_name, meal, pass_id, opted_in)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, student_name AS "studentName",
         meal, pass_id AS "passId", opted_in AS "optedIn",
         status, created_at AS "createdAt", served_at AS "servedAt"`,
      [studentName.trim(), meal.trim(), passId.trim().toUpperCase()]
    );

    res.status(201).json({
      success: true,
      message: "Meal registration saved!",
      registration: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This pass ID already exists.",
      });
    }
    console.error(error);
    res.status(500).json({ success: false, message: "Database error." });
  }
});

app.get("/api/registrations", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, student_name AS "studentName",
        meal, pass_id AS "passId", opted_in AS "optedIn",
        status, created_at AS "createdAt", served_at AS "servedAt"
      FROM registrations
      ORDER BY id DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load registrations." });
  }
});

app.get("/api/registrations/:passId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, student_name AS "studentName",
        meal, pass_id AS "passId", opted_in AS "optedIn",
        status, created_at AS "createdAt", served_at AS "servedAt"
       FROM registrations
       WHERE pass_id = $1 AND opted_in = TRUE`,
      [req.params.passId.toUpperCase()]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "No active registration found for this pass.",
      });
    }

    res.json({ success: true, registration: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Verification failed." });
  }
});

app.patch("/api/registrations/:passId/serve", async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE registrations
       SET status = 'served', served_at = NOW()
       WHERE pass_id = $1
         AND opted_in = TRUE
         AND status = 'registered'
       RETURNING id, student_name AS "studentName",
         meal, pass_id AS "passId", opted_in AS "optedIn",
         status, created_at AS "createdAt", served_at AS "servedAt"`,
      [req.params.passId.toUpperCase()]
    );

    if (!result.rows.length) {
      const existing = await pool.query(
        `SELECT status, opted_in FROM registrations WHERE pass_id = $1`,
        [req.params.passId.toUpperCase()]
      );

      const message = !existing.rows.length || !existing.rows[0].opted_in
        ? "No active registration found for this pass."
        : "This pass has already been redeemed.";

      return res.status(existing.rows.length && existing.rows[0].opted_in ? 409 : 404)
        .json({ success: false, message });
    }

    res.json({
      success: true,
      message: "Meal served successfully!",
      registration: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not confirm meal." });
  }
});

app.delete("/api/registrations/:passId", async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE registrations SET opted_in = FALSE
       WHERE pass_id = $1 AND opted_in = TRUE AND status = 'registered'
       RETURNING id`,
      [req.params.passId.toUpperCase()]
    );

    if (!result.rows.length) {
      return res.status(409).json({
        success: false,
        message: "Registration not found, already cancelled, or already served.",
      });
    }

    res.json({ success: true, message: "Registration cancelled." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Cancellation failed." });
  }
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`MessMate backend running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });

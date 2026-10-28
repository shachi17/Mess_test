
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

  // Safely update existing databases without deleting records.
  await pool.query(`
    ALTER TABLE registrations
    ADD COLUMN IF NOT EXISTS registration_number TEXT
  `);
}

const registrationFields = `
  id,
  student_name AS "studentName",
  registration_number AS "registrationNumber",
  meal,
  pass_id AS "passId",
  opted_in AS "optedIn",
  status,
  created_at AS "createdAt",
  served_at AS "servedAt"
`;

app.get("/", (req, res) => {
  res.json({
    message: "MessMate backend is running!",
    status: "success",
  });
});

// Register a student for a meal.
app.post("/api/registrations", async (req, res) => {
  try {
    const { studentName, registrationNumber, meal, passId, optedIn } =
      req.body;

    if (
      typeof studentName !== "string" ||
      !studentName.trim() ||
      typeof registrationNumber !== "string" ||
      !registrationNumber.trim() ||
      typeof meal !== "string" ||
      !meal.trim() ||
      typeof passId !== "string" ||
      !passId.trim() ||
      optedIn !== true
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, registration number, meal and pass ID are required.",
      });
    }

    const result = await pool.query(
      `INSERT INTO registrations
        (student_name, registration_number, meal, pass_id, opted_in)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING ${registrationFields}`,
      [
        studentName.trim(),
        registrationNumber.trim().toUpperCase(),
        meal.trim(),
        passId.trim().toUpperCase(),
      ]
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
        message: "This pass ID already exists. Please retry.",
      });
    }

    console.error(error);
    res.status(500).json({
      success: false,
      message: "Database error.",
    });
  }
});

// Load records for the dashboard and student portal.
app.get("/api/registrations", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ${registrationFields}
      FROM registrations
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Could not load registrations.",
    });
  }
});

// Find active meal registrations for a college registration number.
app.get(
  "/api/registrations/by-registration/:registrationNumber",
  async (req, res) => {
    try {
      const registrationNumber =
        req.params.registrationNumber.trim().toUpperCase();

      const result = await pool.query(
        `SELECT ${registrationFields}
         FROM registrations
         WHERE UPPER(registration_number) = $1
           AND opted_in = TRUE
         ORDER BY id DESC`,
        [registrationNumber]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          message: "No active meal registrations found.",
        });
      }

      res.json({
        success: true,
        registrations: result.rows,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Registration lookup failed.",
      });
    }
  }
);

// Verify a particular QR pass.
app.get("/api/registrations/:passId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${registrationFields}
       FROM registrations
       WHERE pass_id = $1 AND opted_in = TRUE`,
      [req.params.passId.trim().toUpperCase()]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "No active registration found for this pass.",
      });
    }

    res.json({
      success: true,
      registration: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Verification failed.",
    });
  }
});

// Mark a meal served only once, after worker confirmation.
app.patch("/api/registrations/:passId/serve", async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE registrations
       SET status = 'served', served_at = NOW()
       WHERE pass_id = $1
         AND opted_in = TRUE
         AND status = 'registered'
       RETURNING ${registrationFields}`,
      [req.params.passId.trim().toUpperCase()]
    );

    if (!result.rows.length) {
      const existing = await pool.query(
        `SELECT status, opted_in
         FROM registrations WHERE pass_id = $1`,
        [req.params.passId.trim().toUpperCase()]
      );

      if (!existing.rows.length || !existing.rows[0].opted_in) {
        return res.status(404).json({
          success: false,
          message: "No active registration found for this pass.",
        });
      }

      return res.status(409).json({
        success: false,
        message: "This pass has already been redeemed.",
      });
    }

    res.json({
      success: true,
      message: "Meal served successfully!",
      registration: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Could not confirm meal.",
    });
  }
});

// Cancel an unserved registration.
app.delete("/api/registrations/:passId", async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE registrations
       SET opted_in = FALSE
       WHERE pass_id = $1
         AND opted_in = TRUE
         AND status = 'registered'
       RETURNING id`,
      [req.params.passId.trim().toUpperCase()]
    );

    if (!result.rows.length) {
      return res.status(409).json({
        success: false,
        message:
          "Registration not found, already cancelled, or already served.",
      });
    }

    res.json({
      success: true,
      message: "Registration cancelled.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Cancellation failed.",
    });
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

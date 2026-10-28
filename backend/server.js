
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Temporary storage. PostgreSQL will replace this.
const registrations = [];

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.json({
    message: "MessMate backend is running!",
    status: "success",
  });
});

// Create a registration
app.post("/api/registrations", (req, res) => {
  const { studentName, meal, passId, optedIn } = req.body;

  if (
    typeof studentName !== "string" ||
    !studentName.trim() ||
    typeof meal !== "string" ||
    !meal.trim() ||
    typeof passId !== "string" ||
    !passId.trim() ||
    optedIn !== true
  ) {
    return res.status(400).json({
      success: false,
      message: "Student name, meal, passId and optedIn: true are required.",
    });
  }

  if (registrations.some((r) => r.passId === passId)) {
    return res.status(409).json({
      success: false,
      message: "This pass ID already exists.",
    });
  }

  const registration = {
    id: registrations.length + 1,
    studentName: studentName.trim(),
    meal: meal.trim(),
    passId: passId.trim().toUpperCase(),
    optedIn: true,
    status: "registered",
    createdAt: new Date().toISOString(),
    servedAt: null,
  };

  registrations.push(registration);

  return res.status(201).json({
    success: true,
    message: "Meal registration saved!",
    registration,
  });
});

// Get all registrations (for the Admin view)
app.get("/api/registrations", (req, res) => {
  res.json(registrations);
});

// Find a pass (for the Worker view)
app.get("/api/registrations/:passId", (req, res) => {
  const passId = req.params.passId.toUpperCase();
  const registration = registrations.find(
    (r) => r.passId === passId && r.optedIn
  );

  if (!registration) {
    return res.status(404).json({
      success: false,
      message: "No active registration found for this pass.",
    });
  }

  res.json({ success: true, registration });
});

// Confirm a meal has been served
app.patch("/api/registrations/:passId/serve", (req, res) => {
  const passId = req.params.passId.toUpperCase();
  const registration = registrations.find(
    (r) => r.passId === passId && r.optedIn
  );

  if (!registration) {
    return res.status(404).json({
      success: false,
      message: "No active registration found for this pass.",
    });
  }

  if (registration.status === "served") {
    return res.status(409).json({
      success: false,
      message: "This pass has already been redeemed.",
    });
  }

  registration.status = "served";
  registration.servedAt = new Date().toISOString();

  res.json({
    success: true,
    message: "Meal served successfully!",
    registration,
  });
});

// Cancel a registration, only before it is served
app.delete("/api/registrations/:passId", (req, res) => {
  const passId = req.params.passId.toUpperCase();
  const index = registrations.findIndex(
    (r) => r.passId === passId
  );

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: "Registration not found.",
    });
  }

  if (registrations[index].status === "served") {
    return res.status(409).json({
      success: false,
      message: "A served meal cannot be cancelled.",
    });
  }

  registrations.splice(index, 1);

  res.json({
    success: true,
    message: "Registration cancelled.",
  });
});

app.listen(PORT, () => {
  console.log(`MessMate backend running on port ${PORT}`);
});

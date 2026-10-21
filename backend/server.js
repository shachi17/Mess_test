
const express = require("express");

const app = express();
const PORT = 3000;
const registrations = [];
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "MessMate backend is running!",
    status: "success"
  });
});


app.post("/api/registrations", (req, res) => {
  const { studentName, meal, optedIn } = req.body;

  if (
    !studentName ||
    !meal ||
    typeof optedIn !== "boolean"
  ) {
    return res.status(400).json({
      success: false,
      message: "Student name, meal, and optedIn are required."
    });
  }

  const registration = {
    id: registrations.length + 1,
    studentName,
    meal,
    optedIn
  };

  registrations.push(registration);

  res.status(201).json({
    success: true,
    message: "Meal registration saved!",
    registration
  });
});

app.get("/api/registrations", (req, res) => {
  res.json(registrations);
});


app.listen(PORT, () => {
  console.log(`MessMate server running at http://localhost:${PORT}`);
});

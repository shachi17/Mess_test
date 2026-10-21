
const STORAGE_KEY = "messmate-demo-v1";

const meals = ["Breakfast", "Lunch", "Dinner"];

let records = loadRecords();
let selectedPassId = null;
let toastTimer;

function loadRecords() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function makePassId() {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return "MM-" + part;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// Switch between the three demo portals.
document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.remove("active");
    });

    button.classList.add("active");

    document.querySelectorAll(".page").forEach((page) => {
      page.classList.add("hidden");
    });

    document.getElementById(button.dataset.page).classList.remove("hidden");

    selectedPassId = null;
    document.getElementById("serve-btn").classList.add("hidden");
    document.getElementById("verification-result").textContent =
      "Waiting for a pass ID…";
    document.getElementById("verification-result").className = "result";
  });
});

// Register or cancel a meal.
document.querySelectorAll(".register-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const meal = button.dataset.meal;

    const existing = records.find(
      (record) => record.meal === meal
    );

    if (existing) {
      if (existing.status === "served") {
        showToast("This meal is already marked as served.");
        return;
      }

      records = records.filter((record) => record.meal !== meal);
      showToast(meal + " registration cancelled.");
    } else {
      records.push({
        meal,
        passId: makePassId(),
        status: "registered",
        createdAt: new Date().toISOString()
      });

      showToast(meal + " registered successfully!");
    }

    saveRecords();
    render();
  });
});

// Show the student's passes.
function renderPasses() {
  const container = document.getElementById("my-passes");
  container.replaceChildren();

  const registeredMeals = records.filter(
    (record) => meals.includes(record.meal)
  );

  if (registeredMeals.length === 0) {
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = "No meal passes yet. Register above!";
    container.appendChild(message);
    return;
  }

  registeredMeals.forEach((record) => {
    const item = document.createElement("div");
    item.className = "pass-item";

    const info = document.createElement("div");

    const mealName = document.createElement("p");
    mealName.textContent = record.meal;
    mealName.style.fontWeight = "700";

    const passId = document.createElement("p");
    passId.className = "pass-id";
    passId.textContent = record.passId;

    info.append(mealName, passId);

    const status = document.createElement("span");
    status.className = "pass-status";
    status.textContent =
      record.status === "served" ? "Meal served" : "Registered";

    item.append(info, status);
    container.appendChild(item);
  });
}

// Check the pass ID entered by the worker.
document.getElementById("verify-btn").addEventListener("click", () => {
  const input = document.getElementById("pass-input");
  const result = document.getElementById("verification-result");
  const serveButton = document.getElementById("serve-btn");

  const passId = input.value.trim().toUpperCase();

  selectedPassId = null;
  serveButton.classList.add("hidden");
  result.className = "result";

  if (!passId) {
    result.textContent = "Please enter a pass ID.";
    result.classList.add("bad");
    return;
  }

  const record = records.find((item) => item.passId === passId);

  if (!record) {
    result.textContent = "Invalid pass. No matching registration found.";
    result.classList.add("bad");
    return;
  }

  if (record.status === "served") {
    result.textContent = "This pass has already been redeemed.";
    result.classList.add("bad");
    return;
  }

  selectedPassId = passId;
  result.textContent =
    "Valid demo pass for " + record.meal +
    ". Confirm only after serving the meal.";
  result.classList.add("good");

  serveButton.classList.remove("hidden");
});

// Record the meal only after worker confirmation.
document.getElementById("serve-btn").addEventListener("click", () => {
  if (!selectedPassId) return;

  const record = records.find(
    (item) => item.passId === selectedPassId
  );

  if (!record || record.status === "served") {
    showToast("Pass is no longer available.");
    selectedPassId = null;
    document.getElementById("serve-btn").classList.add("hidden");
    render();
    return;
  }

  record.status = "served";
  record.servedAt = new Date().toISOString();

  saveRecords();
  render();

  document.getElementById("verification-result").textContent =
    "Meal confirmed! Attendance has been recorded in this demo.";
  document.getElementById("verification-result").className = "result good";

  document.getElementById("serve-btn").classList.add("hidden");
  selectedPassId = null;

  showToast("Meal served successfully.");
});

// Update the admin dashboard.
function renderAdmin() {
  document.getElementById("registered-count").textContent =
    records.length;

  document.getElementById("served-count").textContent =
    records.filter((record) => record.status === "served").length;

  document.getElementById("pending-count").textContent =
    records.filter((record) => record.status === "registered").length;

  const table = document.getElementById("records-table");
  table.replaceChildren();

  if (records.length === 0) {
    const row = table.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 3;
    cell.textContent = "No registrations yet.";
    return;
  }

  records.forEach((record) => {
    const row = table.insertRow();
    row.insertCell().textContent = record.meal;
    row.insertCell().textContent = record.passId;
    row.insertCell().textContent =
      record.status === "served" ? "Served" : "Registered";
  });
}

function render() {
  renderPasses();
  renderAdmin();

  meals.forEach((meal) => {
    const button = document.querySelector(
      '.register-btn[data-meal="' + meal + '"]'
    );

    const record = records.find((item) => item.meal === meal);

    button.textContent = record
      ? record.status === "served" ? "Served" : "Cancel"
      : "Register";

    button.classList.toggle("registered", Boolean(record));
    button.disabled = record?.status === "served";
  });
}

render();

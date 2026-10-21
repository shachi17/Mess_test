
import { useEffect, useState } from "react";
import "../style.css";

const STORAGE_KEY = "messmate-demo-v1";
const meals = ["Breakfast", "Lunch", "Dinner"];

function loadRecords() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function makePassId() {
  const part = Math.random().toString(36).slice(2, 8).toUpperCase();
  return "MM-" + part;
}

function App() {
  const [records, setRecords] = useState(loadRecords);
  const [activePage, setActivePage] = useState("student");
  const [studentName, setStudentName] = useState("");
  const [passInput, setPassInput] = useState("");
  const [selectedPassId, setSelectedPassId] = useState(null);
  const [verificationMessage, setVerificationMessage] =
    useState("Waiting for a pass ID…");
  const [verificationType, setVerificationType] = useState("");
  const [toast, setToast] = useState("");

  // Save demo records in this browser.
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  // Automatically hide toast messages.
  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  function showToast(message) {
    setToast(message);
  }

  function switchPage(page) {
    setActivePage(page);
    setSelectedPassId(null);
    setVerificationMessage("Waiting for a pass ID…");
    setVerificationType("");
  }

  function handleMeal(meal) {
    if (!studentName.trim()) {
  showToast("Please enter your name first.");
  return;
}
    const existing = records.find((record) => record.meal === meal);

    if (existing) {
      if (existing.status === "served") {
        showToast("This meal is already marked as served.");
        return;
      }

      setRecords((current) =>
        current.filter((record) => record.meal !== meal)
      );
      showToast(meal + " registration cancelled.");
    }  else {
  const newRecord = {
    meal,
    passId: makePassId(),
    status: "registered",
    createdAt: new Date().toISOString(),
  };

  setRecords((current) => [...current, newRecord]);
  showToast(meal + " registered successfully!");

  fetch("http://localhost:3000/api/registrations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      studentName: studentName.trim(),
      meal,
      optedIn: true,
    }),
  })
    .then(async (response) => {
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed.");
      }

      showToast(meal + " saved to backend!");
    })
    .catch((error) => {
      console.error("Backend registration error:", error);
      showToast("Backend save failed. Check connection.");
    });
}
  }

  function verifyPass() {
    const passId = passInput.trim().toUpperCase();

    setSelectedPassId(null);
    setVerificationType("");

    if (!passId) {
      setVerificationMessage("Please enter a pass ID.");
      setVerificationType("bad");
      return;
    }

    const record = records.find((item) => item.passId === passId);

    if (!record) {
      setVerificationMessage(
        "Invalid pass. No matching registration found."
      );
      setVerificationType("bad");
      return;
    }

    if (record.status === "served") {
      setVerificationMessage("This pass has already been redeemed.");
      setVerificationType("bad");
      return;
    }

    setSelectedPassId(passId);
    setVerificationMessage(
      "Valid demo pass for " +
        record.meal +
        ". Confirm only after serving the meal."
    );
    setVerificationType("good");
  }

  function confirmMealServed() {
    if (!selectedPassId) return;

    const record = records.find(
      (item) => item.passId === selectedPassId
    );

    if (!record || record.status === "served") {
      showToast("Pass is no longer available.");
      setSelectedPassId(null);
      setVerificationMessage("This pass is no longer available.");
      setVerificationType("bad");
      return;
    }

    setRecords((current) =>
      current.map((item) =>
        item.passId === selectedPassId
          ? {
              ...item,
              status: "served",
              servedAt: new Date().toISOString(),
            }
          : item
      )
    );

    setVerificationMessage(
      "Meal confirmed! Attendance has been recorded in this demo."
    );
    setVerificationType("good");
    setSelectedPassId(null);
    showToast("Meal served successfully.");
  }

  const servedCount = records.filter(
    (record) => record.status === "served"
  ).length;

  const pendingCount = records.filter(
    (record) => record.status === "registered"
  ).length;

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-icon">M</span>
          <span>
            MessMate
            <small>SMART MESS MANAGEMENT</small>
          </span>
        </a>
        <span className="demo-label">DAY 1 PROTOTYPE</span>
      </header>

      <main className="container">
        <section className="hero">
          <p className="eyebrow">YOUR CAMPUS. YOUR MEALS.</p>
          <h1>
            Good food starts
            <br />
            with a <span>better system.</span>
          </h1>
          <p>
            Register for meals, verify passes and help your mess plan smarter.
          </p>
        </section>

        <nav className="tabs" aria-label="MessMate pages">
          {[
            ["student", "Student"],
            ["worker", "Mess Worker"],
            ["admin", "Admin"],
          ].map(([page, label]) => (
            <button
              key={page}
              className={`tab ${activePage === page ? "active" : ""}`}
              onClick={() => switchPage(page)}
            >
              {label}
            </button>
          ))}
        </nav>

        {activePage === "student" && (
          <section id="student" className="page">
            <div className="section-heading">
              <div>
                <p className="eyebrow">STUDENT PORTAL</p>
                <h2>Today's meals</h2>
              </div>
              <span className="status">Demo mode</span>
            </div>
            
            <div className="student-name-field">
            <label htmlFor="studentName">Your full name</label>
            <input
           id="studentName"
          type="text"
           placeholder="Enter your full name"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
      />
      </div>

            
            {[
              {
                name: "Breakfast",
                icon: "☀",
                time: "8:00 AM – 9:30 AM",
                menu: "Poha · Fruit · Tea",
              },
              {
                name: "Lunch",
                icon: "◉",
                time: "12:30 PM – 2:00 PM",
                menu: "Roti · Dal · Rice · Sabzi",
              },
              {
                name: "Dinner",
                icon: "☾",
                time: "7:30 PM – 9:00 PM",
                menu: "Roti · Paneer · Rice",
              },
            ].map((meal) => {
              const record = records.find(
                (item) => item.meal === meal.name
              );

              return (
                <div className="meal-card" key={meal.name}>
                  <div className="meal-icon">{meal.icon}</div>
                  <div className="meal-info">
                    <h3>{meal.name}</h3>
                    <p>{meal.time}</p>
                    <span className="meal-menu">{meal.menu}</span>
                  </div>
                  <button
                    className={`register-btn ${
                      record ? "registered" : ""
                    }`}
                    onClick={() => handleMeal(meal.name)}
                    disabled={record?.status === "served"}
                  >
                    {record
                      ? record.status === "served"
                        ? "Served"
                        : "Cancel"
                      : "Register"}
                  </button>
                </div>
              );
            })}

            <div className="panel">
              <h3>Your meal passes</h3>
              <p className="muted">
                Register for a meal to generate its demo pass.
              </p>
              <div id="my-passes" className="pass-list">
                {records.length === 0 ? (
                  <p className="muted">
                    No meal passes yet. Register above!
                  </p>
                ) : (
                  records
                    .filter((record) => meals.includes(record.meal))
                    .map((record) => (
                      <div className="pass-item" key={record.passId}>
                        <div>
                          <p style={{ fontWeight: 700 }}>{record.meal}</p>
                          <p className="pass-id">{record.passId}</p>
                        </div>
                        <span className="pass-status">
                          {record.status === "served"
                            ? "Meal served"
                            : "Registered"}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </section>
        )}

        {activePage === "worker" && (
          <section id="worker" className="page">
            <div className="section-heading">
              <div>
                <p className="eyebrow">WORKER PORTAL</p>
                <h2>Verify a meal pass</h2>
              </div>
            </div>

            <div className="panel">
              <p>Enter a student's pass ID to test the verification flow.</p>
              <label htmlFor="pass-input">Pass ID</label>
              <input
                id="pass-input"
                placeholder="Example: MM-A1B2C3"
                value={passInput}
                onChange={(event) => setPassInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") verifyPass();
                }}
              />
              <button className="primary-btn" onClick={verifyPass}>
                Verify pass
              </button>

              <div
                id="verification-result"
                className={`result ${verificationType}`}
                aria-live="polite"
              >
                {verificationMessage}
              </div>

              {selectedPassId && (
                <button
                  id="serve-btn"
                  className="primary-btn"
                  style={{ marginTop: 12, width: "100%" }}
                  onClick={confirmMealServed}
                >
                  Confirm meal served
                </button>
              )}
            </div>

            <p className="notice">
              Demo only: real QR scanning, server-side validation and worker
              login are not implemented yet.
            </p>
          </section>
        )}

        {activePage === "admin" && (
          <section id="admin" className="page">
            <div className="section-heading">
              <div>
                <p className="eyebrow">ADMIN PORTAL</p>
                <h2>Mess overview</h2>
              </div>
            </div>

            <div className="stats">
              <div className="stat-card">
                <p>Registrations</p>
                <strong>{records.length}</strong>
              </div>
              <div className="stat-card">
                <p>Meals served</p>
                <strong>{servedCount}</strong>
              </div>
              <div className="stat-card">
                <p>Not yet served</p>
                <strong>{pendingCount}</strong>
              </div>
            </div>

            <div className="panel">
              <h3>Meal registration records</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Meal</th>
                      <th>Pass ID</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody id="records-table">
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan="3">No registrations yet.</td>
                      </tr>
                    ) : (
                      records.map((record) => (
                        <tr key={record.passId}>
                          <td>{record.meal}</td>
                          <td>{record.passId}</td>
                          <td>
                            {record.status === "served"
                              ? "Served"
                              : "Registered"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <footer>
          <p>MessMate · Smarter meals, less waste.</p>
          <p>Student project prototype · Sample data only</p>
        </footer>
      </main>

      <div
        id="toast"
        className={`toast ${toast ? "show" : ""}`}
        role="status"
      >
        {toast}
      </div>
    </>
  );
}

export default App;

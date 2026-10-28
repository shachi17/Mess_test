
import { useEffect, useState } from "react";
import "../style.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const STORAGE_KEY = "messmate-demo-v1";
const meals = ["Breakfast", "Lunch", "Dinner"];

function makePassId() {
  return "MM-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function App() {
  const [records, setRecords] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  });
  const [activePage, setActivePage] = useState("student");
  const [studentName, setStudentName] = useState("");
  const [passInput, setPassInput] = useState("");
  const [selectedPassId, setSelectedPassId] = useState(null);
  const [verificationMessage, setVerificationMessage] = useState("Waiting for a pass ID…");
  const [verificationType, setVerificationType] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  function showToast(message) {
    setToast(message);
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  async function loadRecords() {
    try {
      const response = await fetch(`${API_URL}/api/registrations`);
      if (!response.ok) throw new Error("Could not load registrations");
      const data = await response.json();
      setRecords(data);
    } catch (error) {
      console.error(error);
      showToast("Could not load backend records.");
    }
  }

  useEffect(() => {
    loadRecords();
  }, []);

  function switchPage(page) {
    setActivePage(page);
    setSelectedPassId(null);
    setVerificationMessage("Waiting for a pass ID…");
    setVerificationType("");
    loadRecords();
  }

  async function handleMeal(meal) {
    if (busy) return;
    if (!studentName.trim()) {
      showToast("Please enter your name first.");
      return;
    }

    const existing = records.find(
      (record) => record.meal === meal && record.optedIn
    );

    setBusy(true);
    try {
      if (existing) {
        if (existing.status === "served") {
          showToast("This meal is already served.");
          return;
        }

        const response = await fetch(
          `${API_URL}/api/registrations/${encodeURIComponent(existing.passId)}`,
          { method: "DELETE" }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Cancellation failed");

        await loadRecords();
        showToast(`${meal} registration cancelled.`);
      } else {
        const passId = makePassId();
        const response = await fetch(`${API_URL}/api/registrations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentName: studentName.trim(),
            meal,
            passId,
            optedIn: true,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Registration failed");

        await loadRecords();
        showToast(`${meal} registered! Pass: ${passId}`);
      }
    } catch (error) {
      console.error(error);
      showToast(error.message || "Backend request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyPass() {
    const passId = passInput.trim().toUpperCase();
    setSelectedPassId(null);
    setVerificationType("");

    if (!passId) {
      setVerificationMessage("Please enter a pass ID.");
      setVerificationType("bad");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/registrations/${encodeURIComponent(passId)}`
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Invalid pass");
      if (data.registration.status === "served") {
        throw new Error("This pass has already been redeemed.");
      }

      setSelectedPassId(passId);
      setVerificationMessage(
        `Valid pass for ${data.registration.studentName} — ${data.registration.meal}. Confirm only after serving.`
      );
      setVerificationType("good");
    } catch (error) {
      setVerificationMessage(error.message || "Verification failed.");
      setVerificationType("bad");
    }
  }

  async function confirmMealServed() {
    if (!selectedPassId) return;

    try {
      const response = await fetch(
        `${API_URL}/api/registrations/${encodeURIComponent(selectedPassId)}/serve`,
        { method: "PATCH" }
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Confirmation failed");

      setVerificationMessage("Meal confirmed! Attendance recorded.");
      setVerificationType("good");
      setSelectedPassId(null);
      await loadRecords();
      showToast("Meal served successfully.");
    } catch (error) {
      setVerificationMessage(error.message || "Could not confirm meal.");
      setVerificationType("bad");
      setSelectedPassId(null);
    }
  }

  const servedCount = records.filter((r) => r.status === "served").length;
  const pendingCount = records.filter(
    (r) => r.optedIn && r.status === "registered"
  ).length;

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-icon">M</span>
          <span>MessMate<small>SMART MESS MANAGEMENT</small></span>
        </a>
        <span className="demo-label">DAY 1 PROTOTYPE</span>
      </header>

      <main className="container">
        <section className="hero">
          <p className="eyebrow">YOUR CAMPUS. YOUR MEALS.</p>
          <h1>Good food starts<br />with a <span>better system.</span></h1>
          <p>Register for meals, verify passes and help your mess plan smarter.</p>
        </section>

        <nav className="tabs" aria-label="MessMate pages">
          {[["student", "Student"], ["worker", "Mess Worker"], ["admin", "Admin"]].map(([page, label]) => (
            <button key={page} className={`tab ${activePage === page ? "active" : ""}`} onClick={() => switchPage(page)}>
              {label}
            </button>
          ))}
        </nav>

        {activePage === "student" && (
          <section id="student" className="page">
            <div className="section-heading">
              <div><p className="eyebrow">STUDENT PORTAL</p><h2>Today's meals</h2></div>
              <span className="status">Demo mode</span>
            </div>

            <div className="student-name-field">
              <label htmlFor="studentName">Your full name</label>
              <input id="studentName" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Enter your full name" />
            </div>

            {[
              { name: "Breakfast", icon: "☀", time: "8:00 AM – 9:30 AM", menu: "Poha · Fruit · Tea" },
              { name: "Lunch", icon: "◉", time: "12:30 PM – 2:00 PM", menu: "Roti · Dal · Rice · Sabzi" },
              { name: "Dinner", icon: "☾", time: "7:30 PM – 9:00 PM", menu: "Roti · Paneer · Rice" },
            ].map((meal) => {
              const record = records.find((r) => r.meal === meal.name && r.optedIn);
              return (
                <div className="meal-card" key={meal.name}>
                  <div className="meal-icon">{meal.icon}</div>
                  <div className="meal-info">
                    <h3>{meal.name}</h3><p>{meal.time}</p><span className="meal-menu">{meal.menu}</span>
                  </div>
                  <button className={`register-btn ${record ? "registered" : ""}`} disabled={busy || record?.status === "served"} onClick={() => handleMeal(meal.name)}>
                    {record ? (record.status === "served" ? "Served" : "Cancel") : "Register"}
                  </button>
                </div>
              );
            })}

            <div className="panel">
              <h3>Your meal passes</h3>
              <p className="muted">Register for a meal to generate its demo pass.</p>
              <div id="my-passes" className="pass-list">
                {records.filter((r) => r.optedIn).length === 0 ? (
                  <p className="muted">No meal passes yet. Register above!</p>
                ) : records.filter((r) => r.optedIn).map((r) => (
                  <div className="pass-item" key={r.passId}>
                    <div><p style={{ fontWeight: 700 }}>{r.meal}</p><p className="pass-id">{r.passId}</p></div>
                    <span className="pass-status">{r.status === "served" ? "Meal served" : "Registered"}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activePage === "worker" && (
          <section id="worker" className="page">
            <div className="section-heading"><div><p className="eyebrow">WORKER PORTAL</p><h2>Verify a meal pass</h2></div></div>
            <div className="panel">
              <p>Enter a student's pass ID to test the verification flow.</p>
              <label htmlFor="pass-input">Pass ID</label>
              <input id="pass-input" placeholder="Example: MM-A1B2C3" value={passInput} onChange={(e) => setPassInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") verifyPass(); }} />
              <button className="primary-btn" onClick={verifyPass}>Verify pass</button>
              <div id="verification-result" className={`result ${verificationType}`} aria-live="polite">{verificationMessage}</div>
              {selectedPassId && <button id="serve-btn" className="primary-btn" style={{ marginTop: 12, width: "100%" }} onClick={confirmMealServed}>Confirm meal served</button>}
            </div>
            <p className="notice">Demo only: camera scanning and worker login are not implemented yet.</p>
          </section>
        )}

        {activePage === "admin" && (
          <section id="admin" className="page">
            <div className="section-heading"><div><p className="eyebrow">ADMIN PORTAL</p><h2>Mess overview</h2></div></div>
            <div className="stats">
              <div className="stat-card"><p>Registrations</p><strong>{records.filter((r) => r.optedIn).length}</strong></div>
              <div className="stat-card"><p>Meals served</p><strong>{servedCount}</strong></div>
              <div className="stat-card"><p>Not yet served</p><strong>{pendingCount}</strong></div>
            </div>
            <div className="panel">
              <h3>Meal registration records</h3>
              <div className="table-wrap"><table>
                <thead><tr><th>Meal</th><th>Pass ID</th><th>Status</th></tr></thead>
                <tbody>
                  {records.filter((r) => r.optedIn).length === 0 ? <tr><td colSpan="3">No registrations yet.</td></tr> : records.filter((r) => r.optedIn).map((r) => (
                    <tr key={r.passId}><td>{r.meal}</td><td>{r.passId}</td><td>{r.status === "served" ? "Served" : "Registered"}</td></tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </section>
        )}

        <footer><p>MessMate · Smarter meals, less waste.</p><p>Student project prototype · Sample data only</p></footer>
      </main>

      <div id="toast" className={`toast ${toast ? "show" : ""}`} role="status">{toast}</div>
    </>
  );
}

export default App;

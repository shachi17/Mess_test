
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Html5QrcodeScanner } from "html5-qrcode";
import "../style.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function makePassId() {
  return "MM-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function CameraScanner({ onScan }) {
  const callbackRef = useRef(onScan);

  useEffect(() => {
    callbackRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "messmate-qr-reader",
      {
        fps: 10,
        qrbox: { width: 230, height: 230 },
        rememberLastUsedCamera: true,
      },
      false
    );

    scanner.render(
      (text) => {
        callbackRef.current(text.trim());
        scanner.clear().catch(() => {});
      },
      () => {}
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  return <div id="messmate-qr-reader" />;
}

function App() {
  const [records, setRecords] = useState([]);
  const [activePage, setActivePage] = useState("student");

  const [studentName, setStudentName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");

  const [passInput, setPassInput] = useState("");
  const [selectedPassId, setSelectedPassId] = useState(null);
  const [verificationMessage, setVerificationMessage] = useState(
    "Ready to scan a meal pass."
  );
  const [verificationType, setVerificationType] = useState("");

  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const normalizedReg = registrationNumber.trim().toUpperCase();

  async function loadRecords() {
    const response = await fetch(`${API_URL}/api/registrations`);

    if (!response.ok) {
      throw new Error("Could not load registrations from the backend.");
    }

    const data = await response.json();
    setRecords(data);
    return data;
  }

  useEffect(() => {
    loadRecords().catch((error) => {
      console.error(error);
      setToast(error.message);
    });
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  function switchPage(page) {
    setActivePage(page);
    setSelectedPassId(null);
    setPassInput("");
    setShowScanner(false);
    setVerificationType("");
    setVerificationMessage("Ready to scan a meal pass.");

    loadRecords().catch((error) => setToast(error.message));
  }

  // Only show registrations belonging to the entered student.
  const studentRecords = normalizedReg
    ? records.filter(
        (record) =>
          record.registrationNumber?.trim().toUpperCase() === normalizedReg
      )
    : [];

  const activeStudentRecords = studentRecords.filter(
    (record) => record.optedIn
  );

  async function handleMeal(meal) {
    if (busy) return;

    if (!studentName.trim() || !normalizedReg) {
      setToast("Enter your name and college registration number first.");
      return;
    }

    const existing = studentRecords.find(
      (record) => record.meal === meal && record.optedIn
    );

    if (existing?.status === "served") {
      setToast("This meal has already been served.");
      return;
    }

    setBusy(true);

    try {
      if (existing) {
        const response = await fetch(
          `${API_URL}/api/registrations/${encodeURIComponent(existing.passId)}`,
          { method: "DELETE" }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Cancellation failed.");
        }

        await loadRecords();
        setToast(`${meal} registration cancelled.`);
      } else {
        const passId = makePassId();

        const response = await fetch(`${API_URL}/api/registrations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentName: studentName.trim(),
            registrationNumber: normalizedReg,
            meal,
            passId,
            optedIn: true,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Registration failed.");
        }

        await loadRecords();
        setToast(`${meal} registered successfully!`);
      }
    } catch (error) {
      console.error(error);
      setToast(error.message || "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyPass(scannedPassId = passInput) {
    const passId = scannedPassId.trim().toUpperCase();

    setPassInput(passId);
    setSelectedPassId(null);
    setVerificationType("");

    if (!passId) {
      setVerificationMessage("Scan a QR code or enter a pass ID.");
      setVerificationType("bad");
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/registrations/${encodeURIComponent(passId)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Invalid pass.");
      }

      const registration = data.registration;

      if (!registration || registration.optedIn === false) {
        throw new Error("This registration is cancelled or inactive.");
      }

      if (registration.status === "served") {
        throw new Error("This pass has already been redeemed.");
      }

      setSelectedPassId(registration.passId || passId);
      setVerificationMessage(
        `Valid pass: ${registration.studentName} — ${registration.meal}. Confirm only after serving the meal.`
      );
      setVerificationType("good");

      await loadRecords();
    } catch (error) {
      setSelectedPassId(null);
      setVerificationMessage(error.message || "Verification failed.");
      setVerificationType("bad");
    }
  }

  async function confirmMealServed() {
    if (!selectedPassId || busy) return;

    setBusy(true);

    try {
      const response = await fetch(
        `${API_URL}/api/registrations/${encodeURIComponent(selectedPassId)}/serve`,
        { method: "PATCH" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Confirmation failed.");
      }

      await loadRecords();

      setSelectedPassId(null);
      setPassInput("");
      setVerificationMessage("Meal served successfully. Attendance recorded.");
      setVerificationType("good");
      setToast("Meal served successfully.");
    } catch (error) {
      setSelectedPassId(null);
      setVerificationMessage(error.message || "Could not confirm meal.");
      setVerificationType("bad");
    } finally {
      setBusy(false);
    }
  }

  const servedCount = records.filter(
    (record) => record.optedIn && record.status === "served"
  ).length;

  const pendingCount = records.filter(
    (record) => record.optedIn && record.status === "registered"
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
        <span className="demo-label">MESS MANAGEMENT</span>
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
                <h2>Your meals</h2>
              </div>
            </div>

            <div className="student-name-field">
              <label htmlFor="studentName">Your full name</label>
              <input
                id="studentName"
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                placeholder="Enter your full name"
              />
            </div>

            <div className="student-name-field">
              <label htmlFor="registrationNumber">
                College registration number
              </label>
              <input
                id="registrationNumber"
                value={registrationNumber}
                onChange={(event) =>
                  setRegistrationNumber(event.target.value)
                }
                placeholder="Enter your registration number"
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
              const record = studentRecords.find(
                (item) => item.meal === meal.name && item.optedIn
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
                    className={`register-btn ${record ? "registered" : ""}`}
                    disabled={busy || record?.status === "served"}
                    onClick={() => handleMeal(meal.name)}
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

              {!normalizedReg ? (
                <p className="muted">
                  Enter your registration number to view your passes.
                </p>
              ) : activeStudentRecords.length === 0 ? (
                <p className="muted">
                  No active meal passes for this registration number.
                </p>
              ) : (
                <div className="pass-list">
                  {activeStudentRecords.map((record) => (
                    <div className="pass-item" key={record.passId}>
                      <div>
                        <p style={{ fontWeight: 700 }}>{record.meal}</p>
                        <p className="pass-id">{record.passId}</p>
                        <QRCodeCanvas
                          value={record.passId}
                          size={160}
                          level="M"
                          includeMargin
                        />
                      </div>

                      <span className="pass-status">
                        {record.status === "served"
                          ? "Meal served"
                          : "Registered"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activePage === "worker" && (
          <section id="worker" className="page">
            <div className="section-heading">
              <div>
                <p className="eyebrow">WORKER PORTAL</p>
                <h2>Scan a meal pass</h2>
              </div>
            </div>

            <div className="panel">
              <p>Scan the student's QR code to verify their meal pass.</p>

              <button
                className="primary-btn"
                onClick={() => {
                  if (showScanner) {
                    setShowScanner(false);
                    return;
                  }

                  setSelectedPassId(null);
                  setPassInput("");
                  setVerificationMessage("Point the camera at a meal QR code.");
                  setVerificationType("");
                  setShowScanner(true);
                }}
              >
                {showScanner ? "Close QR scanner" : "Scan QR Code"}
              </button>

              {showScanner && (
                <CameraScanner
                  onScan={(text) => {
                    setShowScanner(false);
                    verifyPass(text);
                  }}
                />
              )}

              <div
                className={`result ${verificationType}`}
                aria-live="polite"
              >
                {verificationMessage}
              </div>

              {selectedPassId && (
                <button
                  className="primary-btn"
                  style={{ marginTop: 12, width: "100%" }}
                  onClick={confirmMealServed}
                  disabled={busy}
                >
                  {busy ? "Processing..." : "Confirm Meal Served"}
                </button>
              )}
            </div>
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
                <strong>
                  {records.filter((record) => record.optedIn).length}
                </strong>
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
                      <th>Student</th>
                      <th>Registration No.</th>
                      <th>Meal</th>
                      <th>Pass ID</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {records.filter((record) => record.optedIn).length ===
                    0 ? (
                      <tr>
                        <td colSpan="5">No registrations yet.</td>
                      </tr>
                    ) : (
                      records
                        .filter((record) => record.optedIn)
                        .map((record) => (
                          <tr key={record.passId}>
                            <td>{record.studentName}</td>
                            <td>
                              {record.registrationNumber || "Older record"}
                            </td>
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
        </footer>
      </main>

      <div className={`toast ${toast ? "show" : ""}`} role="status">
        {toast}
      </div>
    </>
  );
}

export default App;

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Html5QrcodeScanner } from "html5-qrcode";
import "../style.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const STORAGE_KEY = "messmate_auth";

const MEAL_META = {
  Breakfast: { icon: "☀" },
  Lunch: { icon: "◉" },
  Dinner: { icon: "☾" },
};

// Condensed from the 2026 hostel menu (0 = Sunday). Check against the original sheet.
const MENU = {
  0: {
    Breakfast: "Idli / Bada · Sambhar · Nariyal Chutney · Chai · Poha",
    Lunch: "Poori · Poha · Sandwich · Kheer",
    Dinner: "Paneer Butter Masala · Arhar Dal · Roti · Ghee · Dahi · Doodh",
  },
  1: {
    Breakfast: "Dalya / Poha · Chutney · Chai · Doodh · Aloo Bonda",
    Lunch: "Tinde ki Sabzi · Dal Makhani · Roti · Chawal · Dahi · Salad",
    Dinner: "Mixed Veg · Dal · Roti · Chawal · Salad · Achaar · Doodh",
  },
  2: {
    Breakfast: "Poha · Jalebi · Boondi · Chai · Doodh · Aloo Bonda",
    Lunch: "Arhar Dal · Bhindi ki Pyaz · Roti · Ghee · Dahi · Salad",
    Dinner: "Poori · Aloo Tamatar ki Sabzi · Kheer · Chawal · Salad · Doodh",
  },
  3: {
    Breakfast: "Aloo Paratha · Chutney · Sambhar · Chai · Doodh",
    Lunch: "Kadi Pakoda · Chana Dal · Aloo Gobhi · Roti · Chawal · Dahi · Papad",
    Dinner: "Arhar Dal · Paneer · Roti · Papad · Salad · Doodh",
  },
  4: {
    Breakfast: "Dosa · Wada · Sambhar · Soup · Chai",
    Lunch: "Dal Makhani · Chana Dal · Aloo Gobhi · Puri · Roti · Chawal · Dahi",
    Dinner: "Roti · Paneer · Dal · Chawal · Salad · Doodh · Jamun",
  },
  5: {
    Breakfast: "Aloo ki Sabzi · Poha · Paratha · Chole · Chai · Doodh",
    Lunch: "Dabeli · Rajma · Aloo Jeera · Boondi Raita · Roti · Chawal",
    Dinner: "Roti · Dal · Chawal · Salad · Doodh · Halwa",
  },
  6: {
    Breakfast: "Dal · Butter Khichdi · Dahi Aloo · Chutney · Chai · Doodh",
    Lunch: "Kadi · Aloo Bhujia · Roti · Chawal · Dahi · Salad",
    Dinner: "Paneer Veg Biryani · Aloo Gobhi · Papad · Raita · Doodh",
  },
};

const formatTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/* ---------------- QR scanner ---------------- */
function CameraScanner({ onScan }) {
  const callbackRef = useRef(onScan);

  useEffect(() => {
    callbackRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "messmate-qr-reader",
      { fps: 10, qrbox: { width: 230, height: 230 }, rememberLastUsedCamera: true },
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

/* ---------------- Login / signup ---------------- */
function LoginScreen({ onSession, notify }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      const isSignup = mode === "signup";
      const response = await fetch(
        `${API_URL}/api/auth/${isSignup ? "signup" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isSignup
              ? { name, registrationNumber: username, password }
              : { username, password }
          ),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not sign in.");
      onSession({ token: data.token, user: data.user });
    } catch (error) {
      notify(error.message === "Failed to fetch" ? "Cannot reach the server." : error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page auth-card panel">
      <p className="eyebrow">{mode === "login" ? "SIGN IN" : "STUDENT SIGN UP"}</p>
      <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>

      {mode === "signup" && (
        <>
          <label htmlFor="name">Full name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </>
      )}

      <label htmlFor="username">
        {mode === "signup" ? "College registration number" : "Registration number (or staff ID)"}
      </label>
      <input
        id="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoCapitalize="characters"
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />

      <button className="primary-btn" style={{ width: "100%" }} onClick={submit} disabled={busy}>
        {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
      </button>

      <p className="notice" style={{ marginTop: 14 }}>
        {mode === "login" ? "New student? " : "Already have an account? "}
        <button className="link-btn" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </section>
  );
}

/* ---------------- Student ---------------- */
function StudentPortal({ api, notify }) {
  const [config, setConfig] = useState(null);
  const [records, setRecords] = useState([]);
  const [day, setDay] = useState("today");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cfg, recs] = await Promise.all([
        api("/api/config"),
        api("/api/my/registrations"),
      ]);
      setConfig(cfg);
      setRecords(recs);
    } catch (error) {
      notify(error.message);
    }
  }, [api, notify]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  if (!config) return <p className="muted">Loading meals...</p>;

  const date = day === "today" ? config.today : config.tomorrow;
  const weekday = new Date(`${date}T00:00:00`).getDay();

  async function toggle(meal) {
    if (busy) return;
    const existing = records.find((r) => r.meal === meal && r.mealDate === date);
    setBusy(true);
    try {
      if (existing) {
        await api(`/api/my/registrations/${encodeURIComponent(existing.passId)}`, { method: "DELETE" });
        notify(`${meal} cancelled.`);
      } else {
        await api("/api/my/registrations", { method: "POST", body: { meal, date } });
        notify(`${meal} registered.`);
      }
      await load();
    } catch (error) {
      notify(error.message);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">STUDENT PORTAL</p>
          <h2>Your meals</h2>
        </div>
        <div className="seg">
          <button className={day === "today" ? "on" : ""} onClick={() => setDay("today")}>Today</button>
          <button className={day === "tomorrow" ? "on" : ""} onClick={() => setDay("tomorrow")}>Tomorrow</button>
        </div>
      </div>

      {config.demoMode && <p className="notice demo-note">Demo mode: scanning works at any hour.</p>}

      {config.meals.map((meal) => {
        const record = records.find((r) => r.meal === meal.name && r.mealDate === date);
        const closed = day === "today" && config.cutoffPassed[meal.name];
        const served = record?.status === "served";
        const label = served ? "Served" : record ? "Cancel" : closed ? "Closed" : "Register";

        return (
          <div className="meal-card" key={meal.name}>
            <div className="meal-icon">{MEAL_META[meal.name].icon}</div>
            <div className="meal-info">
              <h3>{meal.name}</h3>
              <p>{meal.start} – {meal.end} · register by {meal.cutoff}</p>
              <span className="meal-menu">{MENU[weekday][meal.name]}</span>
            </div>
            <button
              className={`register-btn ${record ? "registered" : ""}`}
              disabled={busy || served || (closed && !record) || (closed && record)}
              onClick={() => toggle(meal.name)}
            >
              {record && closed && !served ? "Locked" : label}
            </button>
          </div>
        );
      })}

      <div className="panel">
        <h3>Your meal passes</h3>
        {records.length === 0 ? (
          <p className="muted">No active passes. Register for a meal to get a QR pass.</p>
        ) : (
          <div className="pass-list">
            {records.map((record) => (
              <div className="pass-item" key={record.passId}>
                <div>
                  <p style={{ fontWeight: 700 }}>
                    {record.meal} · {record.mealDate === config.today ? "Today" : "Tomorrow"}
                  </p>
                  <p className="pass-id">{record.passId}</p>
                  <QRCodeCanvas value={record.passId} size={160} level="M" marginSize={2} />
                </div>
                <span className="pass-status">
                  {record.status === "served" ? "Meal served" : "Registered"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------------- Worker ---------------- */
function WorkerPortal({ api, notify }) {
  const [passInput, setPassInput] = useState("");
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("Ready to scan a meal pass.");
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanner, setScanner] = useState(false);

  async function verify(raw = passInput) {
    const passId = raw.trim().toUpperCase();
    setPassInput(passId);
    setSelected(null);
    setType("");

    if (!passId) {
      setMessage("Scan a QR code or enter a pass ID.");
      setType("bad");
      return;
    }

    try {
      const { registration: r } = await api(`/api/passes/${encodeURIComponent(passId)}`);
      setSelected(r.passId);
      setMessage(`Valid pass: ${r.studentName} (${r.registrationNumber}) · ${r.meal}. Confirm only after serving the meal.`);
      setType("good");
    } catch (error) {
      setMessage(error.message);
      setType("bad");
    }
  }

  async function confirm() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const data = await api(`/api/passes/${encodeURIComponent(selected)}/serve`, { method: "PATCH" });
      setSelected(null);
      setPassInput("");
      setMessage(
        data.idempotent
          ? "Already confirmed a moment ago. Attendance is recorded once."
          : "Meal served. Attendance recorded."
      );
      setType("good");
      notify("Meal served.");
    } catch (error) {
      if (error.network) {
        // Pass stays selected: retrying is safe, the server will not double count.
        setMessage("Network problem. The pass is not consumed yet. Tap Confirm again.");
      } else {
        setSelected(null);
        setMessage(error.message);
      }
      setType("bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">WORKER PORTAL</p>
          <h2>Scan a meal pass</h2>
        </div>
      </div>

      <div className="panel">
        <p>Scan the student's QR code, or type the pass ID if the camera is not available.</p>

        <button
          className="primary-btn"
          onClick={() => {
            setSelected(null);
            setType("");
            setMessage("Point the camera at a meal QR code.");
            setScanner((open) => !open);
          }}
        >
          {scanner ? "Close QR scanner" : "Scan QR Code"}
        </button>

        {scanner && (
          <CameraScanner
            onScan={(text) => {
              setScanner(false);
              verify(text);
            }}
          />
        )}

        <label htmlFor="passInput">Or enter pass ID</label>
        <div className="row">
          <input
            id="passInput"
            value={passInput}
            onChange={(e) => setPassInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && verify()}
            placeholder="MM-XXXXXXXXXX"
          />
          <button className="primary-btn" onClick={() => verify()}>Check</button>
        </div>

        <div className={`result ${type}`} aria-live="polite">{message}</div>

        {selected && (
          <button
            className="primary-btn"
            style={{ marginTop: 12, width: "100%" }}
            onClick={confirm}
            disabled={busy}
          >
            {busy ? "Processing..." : "Confirm meal served"}
          </button>
        )}
      </div>
    </section>
  );
}

/* ---------------- Admin ---------------- */
function AdminPortal({ api, notify }) {
  const [date, setDate] = useState("");
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showLog, setShowLog] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = date ? `?date=${date}` : "";
      const [s, r, a] = await Promise.all([
        api(`/api/admin/stats${q}`),
        api(`/api/admin/registrations${q}`),
        api("/api/admin/audit"),
      ]);
      setStats(s);
      setRecords(r);
      setLogs(a);
    } catch (error) {
      notify(error.message);
    }
  }, [api, notify, date]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  if (!stats) return <p className="muted">Loading dashboard...</p>;

  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const isPast = stats.date < todayIST;
  const line = { borderTop: "1px solid rgba(128,128,128,0.25)", margin: "12px 0" };
  const row = { display: "flex", justifyContent: "space-between", margin: "4px 0" };

  const term = search.trim().toLowerCase();
  const shown = records.filter(
    (r) =>
      (filter === "All" || r.meal === filter) &&
      (!term ||
        r.studentName.toLowerCase().includes(term) ||
        (r.registrationNumber || "").toLowerCase().includes(term))
  );

  return (
    <section className="page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">ADMIN PORTAL</p>
          <h2>Mess overview</h2>
        </div>
        <input
          type="date"
          value={date || stats.date}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: "auto" }}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
        {stats.meals.map((m) => {
          const turnout = m.planned ? Math.round((m.served / m.planned) * 100) : 0;
          return (
            <div className="panel" key={m.meal} style={{ margin: 0 }}>
              <p className="eyebrow">{m.meal.toUpperCase()}</p>
              <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.1 }}>{m.planned}</div>
              <p className="muted" style={{ margin: 0 }}>registered</p>

              <div style={line} />
              <div style={row}><span>Served</span><strong>{m.served}</strong></div>
              <div style={row}>
                <span>{isPast ? "Did not turn up" : "Yet to be served"}</span>
                <strong>{m.pending}</strong>
              </div>

              <div style={line} />
              {isPast ? (
                <div style={row}><span>Actual turnout</span><strong>{turnout}%</strong></div>
              ) : (
                <>
                  <div style={row}><span>Chance of eating</span><strong>{m.showUpRate}%</strong></div>
                  <div style={row}><span>Expected diners</span><strong>{m.suggestedPrep}</strong></div>
                  <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
                    {m.basedOnHistory
                      ? `Based on ${m.samples} past registrations`
                      : "Not enough history yet. Using a default of 90%."}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Registered students</h3>
          <div className="seg">
            {["All", "Breakfast", "Lunch", "Dinner"].map((f) => (
              <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f}</button>
            ))}
          </div>
        </div>
        <input
          placeholder="Search by name or registration number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginTop: 12 }}
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Student</th><th>Reg. No.</th><th>Meal</th><th>Status</th></tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr><td colSpan="4">No registrations.</td></tr>
              ) : (
                shown.map((r) => (
                  <tr key={r.passId}>
                    <td>{r.studentName}</td>
                    <td>{r.registrationNumber}</td>
                    <td>{r.meal}</td>
                    <td>{r.status === "served" ? "Served" : isPast ? "Did not turn up" : "Registered"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button className="link-btn" onClick={() => setShowLog((v) => !v)}>
        {showLog ? "Hide activity log" : "Show activity log"}
      </button>
      {showLog && (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Time</th><th>Who</th><th>Action</th><th>Pass</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{formatTime(l.createdAt)}</td>
                    <td>{l.actor}</td>
                    <td>{l.action}</td>
                    <td>{l.passId || "-"}</td>
                    <td>{l.result || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
/* ---------------- App shell ---------------- */
const PORTALS = { student: StudentPortal, worker: WorkerPortal, admin: AdminPortal };

function App() {
  const [auth, setAuth] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  });
  const [toast, setToast] = useState("");

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }, []);

  function onSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAuth(session);
  }

  const token = auth?.token;
  const api = useCallback(
    async (path, { method = "GET", body } = {}) => {
      let response;
      try {
        response = await fetch(`${API_URL}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch {
        throw Object.assign(new Error("Network error. Check your connection."), { network: true });
      }

      const data = await response.json().catch(() => ({}));

      if (response.status === 401 && token) {
        logout();
        throw new Error("Session expired. Please sign in again.");
      }
      if (!response.ok) throw new Error(data.message || "Request failed.");
      return data;
    },
    [token, logout]
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const Portal = auth ? PORTALS[auth.user.role] : null;

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
        {auth ? (
          <span className="user-box">
            <span className="demo-label">{auth.user.name} · {auth.user.role}</span>
            <button className="link-btn" onClick={logout}>Sign out</button>
          </span>
        ) : (
          <span className="demo-label">MESS MANAGEMENT</span>
        )}
      </header>

      <main className="container">
        {!auth && (
          <section className="hero">
            <p className="eyebrow">YOUR CAMPUS. YOUR MEALS.</p>
            <h1>
              Good food starts
              <br />
              with a <span>better system.</span>
            </h1>
            <p>Register for meals, verify passes and help your mess plan smarter.</p>
          </section>
        )}

        {auth ? (
          <Portal api={api} notify={setToast} />
        ) : (
          <LoginScreen onSession={onSession} notify={setToast} />
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

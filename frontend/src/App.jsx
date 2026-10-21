
import "./App.css";

function App() {
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
          <button className="tab active">Student</button>
          <button className="tab">Mess Worker</button>
          <button className="tab">Admin</button>
        </nav>

        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">STUDENT PORTAL</p>
              <h2>Today's meals</h2>
            </div>
            <span className="status">Demo mode</span>
          </div>

          <div className="meal-card">
            <div className="meal-icon">☀</div>
            <div className="meal-info">
              <h3>Breakfast</h3>
              <p>8:00 AM – 9:30 AM</p>
              <span className="meal-menu">Poha · Fruit · Tea</span>
            </div>
            <button className="register-btn">Register</button>
          </div>

          <div className="meal-card">
            <div className="meal-icon">◉</div>
            <div className="meal-info">
              <h3>Lunch</h3>
              <p>12:30 PM – 2:00 PM</p>
              <span className="meal-menu">Roti · Dal · Rice · Sabzi</span>
            </div>
            <button className="register-btn">Register</button>
          </div>

          <div className="meal-card">
            <div className="meal-icon">☾</div>
            <div className="meal-info">
              <h3>Dinner</h3>
              <p>7:30 PM – 9:00 PM</p>
              <span className="meal-menu">Roti · Paneer · Rice</span>
            </div>
            <button className="register-btn">Register</button>
          </div>

          <div className="panel">
            <h3>Your meal passes</h3>
            <p className="muted">
              Register for a meal to generate its demo pass.
            </p>
            <div className="pass-list">
              <p className="muted">No meal passes yet.</p>
            </div>
          </div>
        </section>

        <footer>
          <p>MessMate · Smarter meals, less waste.</p>
          <p>Student project prototype · Sample data only</p>
        </footer>
      </main>
    </>
  );
}

export default App;

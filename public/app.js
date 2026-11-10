* {
  box-sizing: border-box;
}

:root {
  --bg: #f4f7fb;
  --panel: #ffffff;
  --panel-muted: #eef3ff;
  --primary: #2f6fed;
  --primary-dark: #1d4fc7;
  --text: #18212f;
  --muted: #607089;
  --line: #dfe8f6;
  --green: #1cac72;
  --yellow: #f7b731;
  --red: #eb5757;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
}

.page-shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 260px;
  background: #0f172a;
  color: #fff;
  padding: 32px 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 36px;
}

.brand-mark {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--primary), #8ab4ff);
  display: grid;
  place-items: center;
  font-weight: 700;
}

.brand h1 {
  margin: 0;
  font-size: 1.6rem;
}

.brand p {
  margin: 0;
  color: #bfdbfe;
  font-size: 0.85rem;
}

.sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar nav a {
  color: #dbeafe;
  text-decoration: none;
  padding: 12px 14px;
  border-radius: 10px;
  transition: background 0.2s ease;
}

.sidebar nav a.active,
.sidebar nav a:hover {
  background: rgba(255, 255, 255, 0.08);
}

.main-content {
  flex: 1;
  padding: 30px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.eyebrow {
  margin: 0;
  font-size: 0.8rem;
  text-transform: uppercase;
  color: var(--muted);
}

.topbar h2 {
  margin: 6px 0 0;
  font-size: 2rem;
}

.primary-btn {
  background: var(--primary);
  color: white;
  border: none;
  padding: 11px 16px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}

.primary-btn:hover {
  background: var(--primary-dark);
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 18px;
  margin-bottom: 24px;
}

.card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.03);
}

.card .label {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}

.card .value {
  display: block;
  margin-top: 12px;
  font-size: 2rem;
  font-weight: 700;
}

.card .trend {
  display: inline-block;
  margin-top: 10px;
  font-size: 0.78rem;
  color: var(--green);
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 20px;
  margin-top: 22px;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.03);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.section-header h3 {
  margin: 0;
  font-size: 1.2rem;
}

.form-grid {
  margin-bottom: 18px;
}

form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

input,
select {
  width: 100%;
  border: 1px solid var(--line);
  background: #f9fbff;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 0.95rem;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  text-align: left;
  padding: 12px 10px;
  border-bottom: 1px solid var(--line);
}

th {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.badge {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge.active {
  background: rgba(28, 172, 114, 0.12);
  color: var(--green);
}

.badge.on_leave {
  background: rgba(247, 183, 49, 0.12);
  color: #b87800;
}

.badge.pending {
  background: rgba(47, 111, 237, 0.12);
  color: var(--primary);
}

.badge.approved {
  background: rgba(28, 172, 114, 0.12);
  color: var(--green);
}

.badge.rejected {
  background: rgba(235, 87, 87, 0.12);
  color: var(--red);
}

@media (max-width: 768px) {
  .page-shell {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
  }

  .main-content {
    padding: 18px;
  }
}

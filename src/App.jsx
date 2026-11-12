import { useEffect, useMemo, useState } from 'react';

const initialStats = {
  total: 0,
  active: 0,
  onLeave: 0,
  pendingAbsences: 0,
  approvedAbsences: 0,
  attendanceRate: 0,
  departmentBreakdown: {},
  trend: []
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'La requête a échoué.');
  return data;
}

function statusBadge(status) {
  if (status === 'active' || status === 'Approuvée') return 'success';
  if (status === 'on_leave') return 'warning';
  if (status === 'En attente') return 'primary';
  if (status === 'Refusée') return 'danger';
  return 'neutral';
}

function StatCard({ label, value, note, tone }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

function Dashboard({ user, stats, employees, absences, onCreateEmployee, onCreateAbsence, onDecideAbsence, onLogout }) {
  const [employeeForm, setEmployeeForm] = useState({ firstName: '', lastName: '', email: '', role: '', department: 'RH', status: 'active', startDate: '' });
  const [absenceForm, setAbsenceForm] = useState({ employeeId: String(user.id), type: 'Congé', startDate: '', endDate: '' });
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [absenceSearch, setAbsenceSearch] = useState('');
  const [absenceFilter, setAbsenceFilter] = useState('all');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const isAdmin = user.role === 'admin';

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();
    return employees.filter((employee) => `${employee.firstName} ${employee.lastName} ${employee.email} ${employee.department}`.toLowerCase().includes(query));
  }, [employees, employeeSearch]);

  const filteredAbsences = useMemo(() => {
    const query = absenceSearch.trim().toLowerCase();
    return absences.filter((absence) => {
      const matchesQuery = `${absence.employee} ${absence.type} ${absence.status}`.toLowerCase().includes(query);
      return matchesQuery && (absenceFilter === 'all' || absence.status === absenceFilter);
    });
  }, [absences, absenceFilter, absenceSearch]);

  async function submitEmployee(event) {
    event.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      await onCreateEmployee(employeeForm);
      setEmployeeForm({ firstName: '', lastName: '', email: '', role: '', department: 'RH', status: 'active', startDate: '' });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitAbsence(event) {
    event.preventDefault();
    setFormError('');
    setBusy(true);
    try {
      await onCreateAbsence({ ...absenceForm, employeeId: Number(absenceForm.employeeId) });
      setAbsenceForm((current) => ({ ...current, startDate: '', endDate: '' }));
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function decide(id, status) {
    setFormError('');
    try {
      await onDecideAbsence(id, status);
    } catch (error) {
      setFormError(error.message);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-icon">H</div>
          <div><h1>Hiver</h1><span>Suivi RH</span></div>
        </div>
        <nav className="nav-menu" aria-label="Navigation principale">
          <a href="#overview">Vue d’ensemble</a>
          <a href="#employees">Employés</a>
          <a href="#absences">Absences</a>
          <a href="#reports">Rapports</a>
        </nav>
        <div className="user-card">
          <p>Connecté</p>
          <strong>{user.firstName} {user.lastName}</strong>
          <small>{isAdmin ? 'Administrateur' : 'Employé'}</small>
          <button type="button" onClick={onLogout}>Déconnexion</button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar" id="overview">
          <div><p className="eyebrow">Espace de gestion</p><h2>Tableau de bord RH</h2></div>
          <div className="chip">{stats.attendanceRate}% de présence</div>
        </header>

        {formError && <p className="error-box" role="alert">{formError}</p>}

        <section className="stats-grid" aria-label="Indicateurs RH">
          <StatCard label="Total employés" value={stats.total} note="Dans l’organisation" tone="primary" />
          <StatCard label="Actifs" value={stats.active} note="Statut actif" tone="success" />
          <StatCard label="En congé" value={stats.onLeave} note="Statut en congé" tone="warning" />
          <StatCard label="En attente" value={stats.pendingAbsences} note={`${stats.approvedAbsences} demandes approuvées`} tone="primary" />
        </section>

        <section className="panel-grid" id="reports">
          <div className="panel">
            <div className="panel-header"><h3>Répartition par service</h3></div>
            <div className="bars">
              {Object.entries(stats.departmentBreakdown).map(([department, count]) => (
                <div key={department} className="bar-row">
                  <label>{department}</label><div className="bar-track"><span style={{ width: `${(count / Math.max(stats.total, 1)) * 100}%` }} /></div><strong>{count}</strong>
                </div>
              ))}
              {stats.total === 0 && <p className="empty-state">Aucune donnée à afficher.</p>}
            </div>
          </div>
          <div className="panel">
            <div className="panel-header"><h3>Évolution RH</h3><span>Effectif mensuel</span></div>
            <div className="mini-chart" aria-label="Évolution mensuelle des effectifs">
              {stats.trend.map((point) => <div key={point.month} className="mini-item"><span className="mini-bar" style={{ height: `${point.value * 2.5}px` }} /><label>{point.month}</label></div>)}
            </div>
          </div>
        </section>

        <section className="panel" id="employees">
          <div className="panel-header"><h3>Employés</h3><span>{employees.length} personnes</span></div>
          {isAdmin && (
            <form className="form-grid" onSubmit={submitEmployee}>
              <input aria-label="Prénom" value={employeeForm.firstName} onChange={(e) => setEmployeeForm({ ...employeeForm, firstName: e.target.value })} placeholder="Prénom" required />
              <input aria-label="Nom" value={employeeForm.lastName} onChange={(e) => setEmployeeForm({ ...employeeForm, lastName: e.target.value })} placeholder="Nom" required />
              <input aria-label="Email" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} placeholder="Email professionnel" type="email" required />
              <input aria-label="Poste" value={employeeForm.role} onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })} placeholder="Poste" required />
              <input aria-label="Service" value={employeeForm.department} onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })} placeholder="Service" required />
              <select aria-label="Statut" value={employeeForm.status} onChange={(e) => setEmployeeForm({ ...employeeForm, status: e.target.value })}><option value="active">Actif</option><option value="on_leave">En congé</option></select>
              <input aria-label="Date d’embauche" value={employeeForm.startDate} onChange={(e) => setEmployeeForm({ ...employeeForm, startDate: e.target.value })} type="date" />
              <button type="submit" disabled={busy}>{busy ? 'Enregistrement…' : 'Ajouter'}</button>
            </form>
          )}
          <div className="toolbar"><input type="search" aria-label="Rechercher un employé" value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} placeholder="Rechercher un employé" /></div>
          <div className="table-wrap"><table>
            <thead><tr><th>Nom</th><th>Poste</th><th>Service</th><th>Email</th><th>Statut</th></tr></thead>
            <tbody>{filteredEmployees.length ? filteredEmployees.map((employee) => (
              <tr key={employee.id}><td>{employee.firstName} {employee.lastName}</td><td>{employee.role}</td><td>{employee.department}</td><td>{employee.email}</td><td><span className={`badge ${statusBadge(employee.status)}`}>{employee.status === 'active' ? 'Actif' : 'En congé'}</span></td></tr>
            )) : <tr><td colSpan="5" className="empty-state">Aucun employé correspondant.</td></tr>}</tbody>
          </table></div>
        </section>

        <section className="panel" id="absences">
          <div className="panel-header"><h3>Demandes d’absence</h3><span>{absences.length} demandes visibles</span></div>
          <form className="form-grid" onSubmit={submitAbsence}>
            {isAdmin && <select aria-label="Employé concerné" value={absenceForm.employeeId} onChange={(e) => setAbsenceForm({ ...absenceForm, employeeId: e.target.value })} required>
              <option value="">Sélectionner un employé</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
            </select>}
            {!isAdmin && <input value={`${user.firstName} ${user.lastName}`} aria-label="Employé concerné" disabled />}
            <select aria-label="Type d’absence" value={absenceForm.type} onChange={(e) => setAbsenceForm({ ...absenceForm, type: e.target.value })}><option>Congé</option><option>RTT</option><option>Maladie</option><option>Formation</option></select>
            <label className="field-label">Début<input aria-label="Date de début" value={absenceForm.startDate} onChange={(e) => setAbsenceForm({ ...absenceForm, startDate: e.target.value })} type="date" required /></label>
            <label className="field-label">Fin<input aria-label="Date de fin" value={absenceForm.endDate} onChange={(e) => setAbsenceForm({ ...absenceForm, endDate: e.target.value })} type="date" min={absenceForm.startDate || undefined} required /></label>
            <button type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Soumettre la demande'}</button>
          </form>
          <p className="form-hint">Les nouvelles demandes sont enregistrées « En attente » et doivent être validées par un administrateur.</p>
          <div className="toolbar">
            <input type="search" aria-label="Rechercher une demande" value={absenceSearch} onChange={(e) => setAbsenceSearch(e.target.value)} placeholder="Rechercher une demande" />
            <select aria-label="Filtrer par statut" value={absenceFilter} onChange={(e) => setAbsenceFilter(e.target.value)}><option value="all">Tous les statuts</option><option>En attente</option><option>Approuvée</option><option>Refusée</option></select>
          </div>
          <div className="table-wrap"><table>
            <thead><tr><th>Employé</th><th>Type</th><th>Début</th><th>Fin</th><th>Statut</th>{isAdmin && <th>Décision</th>}</tr></thead>
            <tbody>{filteredAbsences.length ? filteredAbsences.map((absence) => (
              <tr key={absence.id}><td>{absence.employee}</td><td>{absence.type}</td><td>{absence.startDate}</td><td>{absence.endDate}</td><td><span className={`badge ${statusBadge(absence.status)}`}>{absence.status}</span></td>{isAdmin && <td>{absence.status === 'En attente' ? <div className="row-actions"><button type="button" className="approve-button" onClick={() => decide(absence.id, 'Approuvée')}>Approuver</button><button type="button" className="reject-button" onClick={() => decide(absence.id, 'Refusée')}>Refuser</button></div> : '—'}</td>}</tr>
            )) : <tr><td colSpan={isAdmin ? 6 : 5} className="empty-state">Aucune demande d’absence trouvée.</td></tr>}</tbody>
          </table></div>
        </section>
      </main>
    </div>
  );
}

function LoginScreen({ onLogin, error, busy }) {
  const [email, setEmail] = useState('admin@hiver.fr');
  const [password, setPassword] = useState('admin123');
  return (
    <div className="login-shell"><div className="login-card">
      <div className="brand-block center"><div className="brand-icon">H</div><div><h1>Hiver</h1><span>Suivi RH</span></div></div>
      <h2>Connexion</h2><p className="login-subtitle">Accédez à votre espace RH</p>
      <form onSubmit={(event) => { event.preventDefault(); onLogin({ email, password }); }} className="login-form">
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Mot de passe<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <div className="error-box" role="alert">{error}</div>}
        <button type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
      <div className="demo-credentials"><p>Comptes de démonstration</p><small>admin@hiver.fr / admin123</small><small>employee@hiver.fr / employee123</small><small>Les comptes de démonstration ne conviennent pas à une mise en production.</small></div>
    </div></div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [stats, setStats] = useState(initialStats);
  const [employees, setEmployees] = useState([]);
  const [absences, setAbsences] = useState([]);

  async function refreshData() {
    const [nextStats, nextEmployees, nextAbsences] = await Promise.all([
      api('/api/dashboard'), api('/api/employees'), api('/api/absences')
    ]);
    setStats(nextStats);
    setEmployees(nextEmployees);
    setAbsences(nextAbsences);
  }

  useEffect(() => {
    api('/api/auth/session')
      .then(async (data) => {
        if (data.authenticated) {
          setSession(data.user);
          await refreshData();
        }
      })
      .catch(() => setAuthError('Impossible de joindre le serveur. Vérifiez qu’il est démarré puis réessayez.'))
      .finally(() => setLoading(false));
  }, []);

  async function login(credentials) {
    setAuthError('');
    setAuthBusy(true);
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
      await refreshData();
      setSession(data.user);
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } finally { setSession(null); }
  }

  async function createEmployee(payload) {
    await api('/api/employees', { method: 'POST', body: JSON.stringify(payload) });
    await refreshData();
  }

  async function createAbsence(payload) {
    await api('/api/absences', { method: 'POST', body: JSON.stringify(payload) });
    await refreshData();
  }

  async function decideAbsence(id, status) {
    await api(`/api/absences/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await refreshData();
  }

  if (loading) return <div className="loading-state">Chargement de votre espace…</div>;
  if (!session) return <LoginScreen onLogin={login} error={authError} busy={authBusy} />;
  return <Dashboard user={session} stats={stats} employees={employees} absences={absences} onCreateEmployee={createEmployee} onCreateAbsence={createAbsence} onDecideAbsence={decideAbsence} onLogout={logout} />;
}

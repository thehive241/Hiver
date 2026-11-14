import { useCallback, useEffect, useRef, useState } from 'react';

const IDLE_TIMEOUT = 15 * 60 * 1000;

async function request(path, options = {}) {
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

export default function FeaturesPanel() {
  const [user, setUser] = useState(null);
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [tasks, setTasks] = useState([]);
  const [audit, setAudit] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [includeEmployees, setIncludeEmployees] = useState(true);
  const [includeAbsences, setIncludeAbsences] = useState(true);
  const fileInput = useRef(null);
  const timer = useRef(null);

  const refreshSession = useCallback(async () => {
    try {
      const session = await request('/api/auth/session');
      setUser(session.authenticated ? session.user : null);
      setLocked(Boolean(session.locked));
    } catch {
      // Le composant reste discret si le serveur est indisponible.
    }
  }, []);

  const refreshPanelData = useCallback(async () => {
    try {
      const [nextTasks, nextAudit] = await Promise.all([
        request('/api/tasks'),
        request('/api/audit').catch(() => [])
      ]);
      setTasks(nextTasks);
      setAudit(nextAudit);
    } catch {
      setTasks([]);
      setAudit([]);
    }
  }, []);

  const lockSession = useCallback(async () => {
    if (!user || locked) return;
    try {
      await request('/api/auth/lock', { method: 'POST' });
      setLocked(true);
      setPassword('');
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [locked, user]);

  const resetIdleTimer = useCallback(() => {
    if (!user || locked) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(lockSession, IDLE_TIMEOUT);
  }, [lockSession, locked, user]);

  useEffect(() => {
    refreshSession();
    const interval = window.setInterval(refreshSession, 15000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer.current);
    };
  }, [refreshSession]);

  useEffect(() => {
    if (!user || locked) {
      window.clearTimeout(timer.current);
      return undefined;
    }
    const events = ['pointerdown', 'keydown', 'mousemove', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetIdleTimer, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach((event) => window.removeEventListener(event, resetIdleTimer));
      window.clearTimeout(timer.current);
    };
  }, [locked, resetIdleTimer, user]);

  useEffect(() => {
    if (user && !locked) refreshPanelData();
  }, [locked, refreshPanelData, user]);

  async function unlock(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request('/api/auth/unlock', { method: 'POST', body: JSON.stringify({ password }) });
      setLocked(false);
      setPassword('');
      await refreshSession();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function exportData() {
    setError('');
    try {
      const response = await fetch('/api/data/export');
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Impossible de créer la sauvegarde.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `hiver-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      await refreshPanelData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function restoreData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const backup = JSON.parse(await file.text());
      const include = [includeEmployees && 'employees', includeAbsences && 'absences'].filter(Boolean);
      await request('/api/data/restore', { method: 'POST', body: JSON.stringify({ backup, include }) });
      event.target.value = '';
      await refreshPanelData();
      window.location.reload();
    } catch (requestError) {
      setError(requestError instanceof SyntaxError ? 'Le fichier sélectionné ne contient pas un JSON valide.' : requestError.message);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <>
      {!locked && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000, display: 'flex', gap: 8 }}>
          <button type="button" onClick={lockSession} style={buttonStyle}>Verrouiller</button>
          <button type="button" onClick={() => { setOpen((value) => !value); refreshPanelData(); }} style={buttonStyle} aria-expanded={open}>
            À faire ({tasks.length}) · Outils RH
          </button>
        </div>
      )}

      {open && !locked && (
        <aside aria-label="Outils RH" style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Outils RH</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" style={closeStyle}>×</button>
          </div>
          <section>
            <h3>À faire cette semaine</h3>
            {tasks.length ? <ul>{tasks.map((task) => <li key={task.id}><strong>{task.title}</strong><br /><small>{task.detail}</small></li>)}</ul> : <p>Aucune demande d’absence en attente.</p>}
          </section>
          {user.role === 'admin' && <>
            <section>
              <h3>Sauvegarde des données</h3>
              <p>Exportez les données Hiver actuelles ou restaurez les catégories sélectionnées depuis un export Hiver.</p>
              <button type="button" onClick={exportData} style={buttonStyle}>Télécharger un export JSON</button>
              <div style={{ marginTop: 10 }}>
                <label style={{ display: 'block' }}><input type="checkbox" checked={includeEmployees} onChange={(event) => setIncludeEmployees(event.target.checked)} /> Collaborateurs</label>
                <label style={{ display: 'block' }}><input type="checkbox" checked={includeAbsences} onChange={(event) => setIncludeAbsences(event.target.checked)} /> Absences</label>
                <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || (!includeEmployees && !includeAbsences)} style={{ ...buttonStyle, marginTop: 8 }}>
                  {busy ? 'Restauration…' : 'Choisir un export à restaurer'}
                </button>
                <input ref={fileInput} type="file" accept="application/json,.json" onChange={restoreData} hidden />
              </div>
              <p><small>La restauration remplace les catégories cochées. Vérifiez le fichier avant de continuer.</small></p>
            </section>
            <section>
              <h3>Journal d’audit récent</h3>
              {audit.length ? <div style={{ maxHeight: 180, overflowY: 'auto' }}>{audit.map((entry) => <p key={entry.id} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: 6 }}><strong>{entry.action}</strong><br /><small>{new Date(entry.at).toLocaleString()} · {entry.actor}{entry.detail ? ` · ${entry.detail}` : ''}</small></p>)}</div> : <p>Aucune activité enregistrée.</p>}
            </section>
          </>}
          {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
        </aside>
      )}

      {locked && (
        <div role="dialog" aria-modal="true" aria-labelledby="hiver-lock-title" style={overlayStyle}>
          <form onSubmit={unlock} style={lockCardStyle}>
            <h1 id="hiver-lock-title">Session verrouillée</h1>
            <p>Confirmez votre mot de passe pour reprendre votre session.</p>
            <label style={{ display: 'block', textAlign: 'left' }}>Mot de passe
              <input autoFocus type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required style={inputStyle} />
            </label>
            {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
            <button type="submit" disabled={busy} style={{ ...buttonStyle, width: '100%', marginTop: 12 }}>{busy ? 'Vérification…' : 'Déverrouiller'}</button>
          </form>
        </div>
      )}
    </>
  );
}

const buttonStyle = { border: 0, borderRadius: 9, padding: '10px 14px', color: '#fff', background: '#1d4ed8', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px #0f172a22' };
const closeStyle = { border: 0, background: 'transparent', fontSize: 24, cursor: 'pointer' };
const panelStyle = { position: 'fixed', right: 16, bottom: 72, zIndex: 1001, width: 'min(440px, calc(100vw - 32px))', maxHeight: '75vh', overflowY: 'auto', padding: 20, borderRadius: 16, background: '#fff', color: '#111827', boxShadow: '0 16px 55px #0f172a33', border: '1px solid #e5e7eb' };
const overlayStyle = { position: 'fixed', inset: 0, zIndex: 2000, display: 'grid', placeItems: 'center', background: '#0f172aee', padding: 20 };
const lockCardStyle = { width: 'min(420px, 100%)', padding: 28, textAlign: 'center', borderRadius: 18, background: '#fff', color: '#111827', boxShadow: '0 20px 70px #0005' };
const inputStyle = { display: 'block', boxSizing: 'border-box', width: '100%', marginTop: 6, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8 };

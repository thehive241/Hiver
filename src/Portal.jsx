import { useCallback, useEffect, useState } from 'react';

const QUEUE_KEY = 'hiver-offline-request-drafts-v1';
const ROLE_LABELS = { employee: 'Salarié', admin: 'Administration', delegate: 'Délégué du personnel' };
const DEMO_ACCOUNTS = [
  { email: 'employee@hiver.fr', password: 'employee123', role: 'Salarié' },
  { email: 'admin@hiver.fr', password: 'admin123', role: 'Administration' },
  { email: 'delegate@hiver.fr', password: 'delegate123', role: 'Délégué du personnel' }
];

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, credentials: 'same-origin', headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'La requête a échoué.');
  return data;
}
function readQueue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; } }
function saveQueue(queue) { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); }
function dateText(date) { return date ? new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR') : '—'; }

export default function Portal() {
  const [user, setUser] = useState(null);
  const [login, setLogin] = useState({ email: 'employee@hiver.fr', password: 'employee123' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [tab, setTab] = useState('home');
  const [requests, setRequests] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [cases, setCases] = useState([]);
  const [queue, setQueue] = useState(readQueue);
  const [requestForm, setRequestForm] = useState({ type: 'Congé', startDate: '', endDate: '', details: '' });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', audience: 'all' });
  const [caseForm, setCaseForm] = useState({ employeeId: '', subject: '', message: '' });

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const [nextRequests, nextAnnouncements, nextCases] = await Promise.all([
        api('/api/portal/requests'), api('/api/portal/announcements'), api('/api/portal/cases')
      ]);
      setRequests(nextRequests); setAnnouncements(nextAnnouncements); setCases(nextCases);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener('online', onlineHandler); window.addEventListener('offline', offlineHandler);
    api('/api/auth/session').then((data) => { if (data.authenticated) setUser(data.user); }).catch(() => {}).finally(() => {});
    return () => { window.removeEventListener('online', onlineHandler); window.removeEventListener('offline', offlineHandler); };
  }, []);

  useEffect(() => { if (user && online) refresh(); }, [user, online, refresh]);

  useEffect(() => {
    if (!user || !online || queue.length === 0) return;
    let cancelled = false;
    (async () => {
      const remaining = [];
      for (const draft of queue) {
        try { await api('/api/portal/requests', { method: 'POST', body: JSON.stringify(draft) }); }
        catch { remaining.push(draft); }
      }
      if (!cancelled) { saveQueue(remaining); setQueue(remaining); if (remaining.length !== queue.length) refresh(); }
    })();
    return () => { cancelled = true; };
  }, [user, online, queue, refresh]);

  async function signIn(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try { const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(login) }); setUser(result.user); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function signOut() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* Offline logout still clears the local view. */ }
    setUser(null); setRequests([]); setCases([]); setAnnouncements([]); setTab('home');
  }
  async function submitRequest(event) {
    event.preventDefault(); setError('');
    const payload = { ...requestForm };
    if (!online) {
      const next = [...queue, { ...payload, offlineDraftId: crypto.randomUUID?.() || String(Date.now()), createdAt: new Date().toISOString() }];
      saveQueue(next); setQueue(next); setRequestForm({ type: 'Congé', startDate: '', endDate: '', details: '' });
      setError('Demande enregistrée en brouillon sur cet appareil. Elle sera envoyée au retour de la connexion. Évitez les détails médicaux dans un brouillon hors ligne.');
      return;
    }
    try { await api('/api/portal/requests', { method: 'POST', body: JSON.stringify(payload) }); setRequestForm({ type: 'Congé', startDate: '', endDate: '', details: '' }); await refresh(); }
    catch (e) { setError(e.message); }
  }
  async function publishAnnouncement(event) {
    event.preventDefault(); setError('');
    try { await api('/api/portal/announcements', { method: 'POST', body: JSON.stringify(announcementForm) }); setAnnouncementForm({ title: '', message: '', audience: 'all' }); await refresh(); }
    catch (e) { setError(e.message); }
  }
  async function createCase(event) {
    event.preventDefault(); setError('');
    try { await api('/api/portal/cases', { method: 'POST', body: JSON.stringify(caseForm) }); setCaseForm({ employeeId: '', subject: '', message: '' }); await refresh(); }
    catch (e) { setError(e.message); }
  }
  async function answerRequest(id, status) {
    try { await api(`/api/portal/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await refresh(); }
    catch (e) { setError(e.message); }
  }
  async function replyCase(id) {
    const message = window.prompt('Votre réponse :'); if (!message?.trim()) return;
    try { await api(`/api/portal/cases/${id}/messages`, { method: 'POST', body: JSON.stringify({ message }) }); await refresh(); }
    catch (e) { setError(e.message); }
  }

  if (!user) return <main className="portal-login-shell"><section className="portal-login"><div className="portal-brand"><span>H</span><div><b>Hiver RH</b><small>Aluminium & vitrage · Gabon</small></div></div><p className="portal-eyebrow">ESPACE DE TRAVAIL</p><h1>Connectez-vous à votre espace</h1><p className="portal-muted">Les menus et les informations disponibles dépendent de votre profil.</p><form onSubmit={signIn} className="portal-login-form"><label>Email<input type="email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} required /></label><label>Mot de passe<input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} required /></label>{error && <p className="portal-alert">{error}</p>}<button disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button></form><details className="demo-login"><summary>Comptes de démonstration</summary>{DEMO_ACCOUNTS.map((account) => <button key={account.email} type="button" onClick={() => setLogin({ email: account.email, password: account.password })}>{account.role} · {account.email}</button>)}</details><p className="portal-security-note">Prototype de démonstration. Ne téléversez pas de document médical réel dans cette version.</p></section></main>;

  const isAdmin = user.role === 'admin';
  const isDelegate = user.role === 'delegate';
  const isEmployee = user.role === 'employee';
  const nav = [{ key: 'home', title: 'Accueil' }, ...(isEmployee ? [{ key: 'my-info', title: 'Mes informations' }, { key: 'requests', title: 'Mes démarches' }] : [{ key: 'requests', title: 'Demandes RH' }]), ...(isDelegate || isAdmin ? [{ key: 'cases', title: 'Suivi & échanges' }, { key: 'announcements', title: 'Annonces' }] : [])];
  return <div className="portal-shell"><aside className="portal-sidebar"><div className="portal-brand"><span>H</span><div><b>Hiver RH</b><small>Aluminium & vitrage · Gabon</small></div></div><p className="portal-nav-label">ESPACE DE TRAVAIL</p><nav>{nav.map((item) => <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}>{item.title}</button>)}</nav><div className="portal-user"><b>{user.firstName} {user.lastName}</b><span>{ROLE_LABELS[user.role] || user.role}</span><button onClick={signOut}>Déconnexion</button></div></aside>
    <main className="portal-main"><header className="portal-topbar"><div><p className="portal-eyebrow">{ROLE_LABELS[user.role]?.toUpperCase()}</p><h1>{tab === 'home' ? `Bonjour ${user.firstName}` : nav.find((item) => item.key === tab)?.title}</h1></div><span className={`connection-pill ${online ? 'is-online' : 'is-offline'}`}>{online ? 'En ligne' : 'Hors ligne'}</span></header>
      {!online && <div className="portal-offline-banner">Mode hors ligne : les pages de l’application restent disponibles. Les nouvelles démarches sont mises en brouillon sur cet appareil et seront envoyées après reconnexion.</div>}
      {error && <div className="portal-alert" role="status">{error}<button onClick={() => setError('')}>×</button></div>}
      {tab === 'home' && <><section className="portal-welcome"><div><span className="portal-eyebrow">VOTRE ESPACE HIVER</span><h2>Un espace de travail plus simple et plus transparent.</h2><p>Consultez vos informations, échangez avec les ressources humaines et suivez les démarches.</p></div><div className="portal-home-mark">HR</div></section><section className="portal-cards"><article><span>{isEmployee ? 'Mes demandes' : 'Demandes à suivre'}</span><strong>{requests.filter((item) => item.status === 'En attente').length}</strong><button onClick={() => setTab('requests')}>Ouvrir les demandes →</button></article><article><span>Annonces disponibles</span><strong>{announcements.length}</strong><button onClick={() => setTab(isEmployee ? 'home' : 'announcements')}>Consulter les annonces →</button></article><article><span>Échanges ouverts</span><strong>{cases.filter((item) => item.status !== 'Résolu').length}</strong><button onClick={() => setTab(isEmployee ? 'requests' : 'cases')}>Voir le suivi →</button></article></section><section className="portal-panel"><h2>Accès selon votre profil</h2><p><b>Salarié :</b> ses informations et démarches personnelles.</p><p><b>Délégué :</b> annonces, dossiers de suivi et échanges autorisés.</p><p><b>Administration :</b> traitement des demandes, réponse et suivi RH.</p></section></>}
      {tab === 'my-info' && <section className="portal-panel"><span className="portal-eyebrow">DOSSIER PERSONNEL</span><h2>Mes informations</h2><dl className="personal-data"><dt>Nom</dt><dd>{user.firstName} {user.lastName}</dd><dt>Email professionnel</dt><dd>{user.email}</dd><dt>Service</dt><dd>{user.department || 'Non renseigné'}</dd><dt>Profil</dt><dd>{ROLE_LABELS[user.role]}</dd></dl><p className="portal-muted">Pour corriger une information, adressez une demande à l’administration.</p></section>}
      {tab === 'requests' && <div className="portal-columns"><section className="portal-panel"><span className="portal-eyebrow">DÉMARCHES</span><h2>{isEmployee ? 'Nouvelle demande' : 'Demandes des salariés'}</h2>{isEmployee && <form className="portal-form" onSubmit={submitRequest}><label>Type de démarche<select value={requestForm.type} onChange={(e) => setRequestForm({ ...requestForm, type: e.target.value })}><option>Congé</option><option>Justification d’absence</option><option>Demande administrative</option><option>Suggestion</option><option>Plainte</option><option>Autre</option></select></label><label>Date de début<input type="date" value={requestForm.startDate} onChange={(e) => setRequestForm({ ...requestForm, startDate: e.target.value })} /></label><label>Date de fin<input type="date" value={requestForm.endDate} onChange={(e) => setRequestForm({ ...requestForm, endDate: e.target.value })} /></label><label>Message / justification<textarea rows="4" value={requestForm.details} onChange={(e) => setRequestForm({ ...requestForm, details: e.target.value })} required placeholder="Décrivez votre demande sans inclure de données médicales sensibles." /></label><p className="portal-form-hint">Les pièces médicales ne sont pas téléversées dans cette version d’essai. Remettez-les par le canal sécurisé défini par l’entreprise.</p><button>Envoyer la demande</button></form>}</section><section className="portal-panel"><span className="portal-eyebrow">HISTORIQUE</span><h2>{isEmployee ? 'Mes demandes' : 'Demandes à traiter'}</h2><div className="portal-list">{[...queue.map((item) => ({ ...item, status: 'Brouillon hors ligne', id: item.offlineDraftId })), ...requests].map((item) => <article key={item.id}><div className="portal-list-heading"><b>{item.type}</b><span className={`request-status ${item.status === 'Approuvée' ? 'approved' : ''}`}>{item.status}</span></div><p>{item.details || '—'}</p><small>{item.employeeName || `${user.firstName} ${user.lastName}`} · {dateText(item.startDate)}{item.endDate ? ` au ${dateText(item.endDate)}` : ''}</small>{isAdmin && item.status === 'En attente' && <div className="portal-row-actions"><button onClick={() => answerRequest(item.id, 'Approuvée')}>Approuver</button><button onClick={() => answerRequest(item.id, 'Refusée')}>Refuser</button></div>}</article>)}{requests.length === 0 && queue.length === 0 && <p className="portal-muted">Aucune demande à afficher.</p>}</div></section></div>}
      {tab === 'announcements' && <div className="portal-columns"><section className="portal-panel"><span className="portal-eyebrow">INFORMATION DU PERSONNEL</span><h2>Publier une annonce</h2><form className="portal-form" onSubmit={publishAnnouncement}><label>Titre<input value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} required /></label><label>Destinataires<select value={announcementForm.audience} onChange={(e) => setAnnouncementForm({ ...announcementForm, audience: e.target.value })}><option value="all">Tous les salariés</option><option value="employees">Salariés uniquement</option><option value="delegates">Délégués et administration</option></select></label><label>Message<textarea rows="5" value={announcementForm.message} onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })} required /></label><button>Publier l’annonce</button></form></section><section className="portal-panel"><span className="portal-eyebrow">FIL D’INFORMATION</span><h2>Annonces</h2><div className="portal-list">{announcements.map((item) => <article key={item.id}><b>{item.title}</b><p>{item.message}</p><small>Publié par {item.authorName} · {new Date(item.createdAt).toLocaleString('fr-FR')}</small></article>)}{!announcements.length && <p className="portal-muted">Aucune annonce publiée.</p>}</div></section></div>}
      {tab === 'cases' && <div className="portal-columns"><section className="portal-panel"><span className="portal-eyebrow">SUIVI SOCIAL</span><h2>Ouvrir un suivi salarié</h2><form className="portal-form" onSubmit={createCase}><label>ID du salarié<input type="number" value={caseForm.employeeId} onChange={(e) => setCaseForm({ ...caseForm, employeeId: e.target.value })} placeholder="Ex. 2" required /></label><label>Sujet<input value={caseForm.subject} onChange={(e) => setCaseForm({ ...caseForm, subject: e.target.value })} required /></label><label>Message à transmettre<textarea rows="4" value={caseForm.message} onChange={(e) => setCaseForm({ ...caseForm, message: e.target.value })} required /></label><button>Créer le suivi</button></form><p className="portal-form-hint">La transmission directe est limitée au salarié concerné et aux profils habilités. Les cas sensibles doivent être traités par l’administration.</p></section><section className="portal-panel"><span className="portal-eyebrow">DOSSIERS ET DISCUSSIONS</span><h2>Suivis en cours</h2><div className="portal-list">{cases.map((item) => <article key={item.id}><div className="portal-list-heading"><b>{item.subject}</b><span className="request-status">{item.status}</span></div><small>Salarié : {item.employeeName}</small><div className="case-messages">{item.messages?.map((message, index) => <p key={`${item.id}-${index}`}><b>{message.authorName} :</b> {message.message}</p>)}</div><button className="portal-text-button" onClick={() => replyCase(item.id)}>Répondre</button></article>)}{!cases.length && <p className="portal-muted">Aucun suivi à afficher.</p>}</div></section></div>}
      <footer className="portal-footer">Hiver RH · Accès limité selon votre profil · {online ? 'Synchronisation disponible' : `${queue.length} brouillon(s) en attente sur cet appareil`}</footer>
    </main></div>;
}

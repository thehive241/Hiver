import { useEffect, useMemo, useState } from 'react';

const STORE = 'hiver-journaliers-v1';
const DAYS = [
  { key: 1, label: 'Lun' }, { key: 2, label: 'Mar' }, { key: 3, label: 'Mer' },
  { key: 4, label: 'Jeu' }, { key: 5, label: 'Ven' }, { key: 6, label: 'Sam' }, { key: 0, label: 'Dim' }
];
const DEFAULT_RATE = 875;
const money = (value) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value || 0)} FCFA`;
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const monthOf = (date) => date.slice(0, 7);
const parseJSON = (value) => { try { return value ? JSON.parse(value) : null; } catch { return null; } };
const dayCount = (month) => {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m, 0).getDate();
};
const dateFor = (month, day) => `${month}-${String(day).padStart(2, '0')}`;
const weekday = (date) => new Date(`${date}T12:00:00`).getDay();
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const toCSV = (rows) => `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;

function readStore() {
  const stored = parseJSON(localStorage.getItem(STORE));
  return {
    workers: Array.isArray(stored?.workers) ? stored.workers : [],
    attendance: stored?.attendance && typeof stored.attendance === 'object' ? stored.attendance : {},
    deductions: stored?.deductions && typeof stored.deductions === 'object' ? stored.deductions : {},
    holidays: Array.isArray(stored?.holidays) ? stored.holidays : []
  };
}

function normalizeWorker(worker) {
  return {
    ...worker,
    status: worker.status || 'active',
    payMode: worker.payMode || 'daily',
    dailyRate: Number(worker.dailyRate) || 0,
    weeklyRate: Number(worker.weeklyRate) || 0,
    hourlyRate: Number(worker.hourlyRate) || DEFAULT_RATE,
    hoursPerDay: Number(worker.hoursPerDay) || 2,
    maxDays: Number(worker.maxDays) || 30,
    workDays: Array.isArray(worker.workDays) ? worker.workDays : [1, 2, 3, 4, 5, 6]
  };
}

function downloadCSV(name, rows) {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function payForWorker(worker, month, attendance, deductions) {
  let gross = 0;
  let worked = 0;
  const days = dayCount(month);
  for (let day = 1; day <= days; day += 1) {
    const date = dateFor(month, day);
    const record = attendance[worker.id]?.[date];
    if (!record || !worker.workDays.includes(weekday(date))) continue;
    if (record.status === 'present') {
      worked += 1;
      if (worker.payMode === 'weekly') gross += worker.weeklyRate / Math.max(worker.workDays.length, 1);
      if (worker.payMode === 'daily') gross += worker.dailyRate;
      if (worker.payMode === 'hourly') gross += worker.hourlyRate * worker.hoursPerDay;
    } else if (record.status === 'holiday') {
      // A scheduled public holiday is paid as a worked day, without requiring attendance.
      worked += 1;
      if (worker.payMode === 'weekly') gross += worker.weeklyRate / Math.max(worker.workDays.length, 1);
      if (worker.payMode === 'daily') gross += worker.dailyRate;
      if (worker.payMode === 'hourly') gross += worker.hourlyRate * worker.hoursPerDay;
    }
  }
  const withheld = Number(deductions[worker.id]?.[month]) || 0;
  return { gross, withheld, net: Math.max(0, gross - withheld), worked };
}

export default function Journaliers() {
  const [store, setStore] = useState(readStore);
  const [filter, setFilter] = useState('active');
  const [month, setMonth] = useState(monthOf(localToday()));
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [view, setView] = useState('registre');
  const [workerForm, setWorkerForm] = useState({
    firstName: '', lastName: '', task: '', department: '', startDate: localToday(), contractEndDate: '',
    maxDays: 30, payMode: 'daily', dailyRate: '', weeklyRate: '', hourlyRate: DEFAULT_RATE,
    hoursPerDay: 2, workDays: [1, 2, 3, 4, 5, 6], evaluation: 'pending'
  });

  const workers = useMemo(() => store.workers.map(normalizeWorker).map((worker) => {
    if (worker.status === 'active' && ((worker.contractEndDate && worker.contractEndDate <= localToday()) || worker.evaluation === 'poor')) {
      return { ...worker, status: 'inactive', inactiveReason: worker.contractEndDate && worker.contractEndDate <= localToday() ? 'Fin de contrat' : 'Mauvaise évaluation', inactiveDate: worker.contractEndDate || localToday(), automaticDeactivation: true };
    }
    return worker;
  }), [store.workers]);

  useEffect(() => {
    const next = { ...store, workers };
    if (JSON.stringify(next.workers) !== JSON.stringify(store.workers)) setStore(next);
    localStorage.setItem(STORE, JSON.stringify(next));
  }, [store, workers]);

  const visibleWorkers = workers.filter((worker) => filter === 'all' || (filter === 'active' ? worker.status === 'active' : worker.status === 'inactive'));
  const dates = Array.from({ length: dayCount(month) }, (_, index) => dateFor(month, index + 1));
  const payroll = workers.map((worker) => ({ worker, ...payForWorker(worker, month, store.attendance, store.deductions) }));
  const activeCount = workers.filter((worker) => worker.status === 'active').length;
  const attendanceCellKey = (workerId, date) => store.attendance[workerId]?.[date] || {};

  function updateStore(updater) { setStore((current) => updater(current)); }
  function resetForm() {
    setWorkerForm({ firstName: '', lastName: '', task: '', department: '', startDate: localToday(), contractEndDate: '', maxDays: 30, payMode: 'daily', dailyRate: '', weeklyRate: '', hourlyRate: DEFAULT_RATE, hoursPerDay: 2, workDays: [1, 2, 3, 4, 5, 6], evaluation: 'pending' });
    setEditing(null);
    setShowForm(false);
    setError('');
  }
  function editWorker(worker) {
    setEditing(worker.id);
    setWorkerForm({ ...normalizeWorker(worker), firstName: worker.firstName, lastName: worker.lastName, task: worker.task || '', department: worker.department || '', contractEndDate: worker.contractEndDate || '', evaluation: worker.evaluation || 'pending' });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function saveWorker(event) {
    event.preventDefault();
    const name = `${workerForm.firstName.trim()} ${workerForm.lastName.trim()}`.trim();
    if (!name || !workerForm.task.trim() || workerForm.workDays.length === 0) {
      setError('Renseignez le nom, la tâche et au moins un jour de travail.');
      return;
    }
    if (workerForm.payMode === 'weekly' && !(Number(workerForm.weeklyRate) > 0)) { setError('Indiquez le montant forfaitaire hebdomadaire.'); return; }
    if (workerForm.payMode === 'daily' && !(Number(workerForm.dailyRate) > 0)) { setError('Indiquez le taux journalier.'); return; }
    if (workerForm.payMode === 'hourly' && !(Number(workerForm.hourlyRate) > 0)) { setError('Indiquez le taux horaire.'); return; }
    const payload = { ...workerForm, id: editing || `j-${Date.now()}`, firstName: workerForm.firstName.trim(), lastName: workerForm.lastName.trim(), task: workerForm.task.trim(), department: workerForm.department.trim(), maxDays: Number(workerForm.maxDays), dailyRate: Number(workerForm.dailyRate) || 0, weeklyRate: Number(workerForm.weeklyRate) || 0, hourlyRate: Number(workerForm.hourlyRate) || DEFAULT_RATE, hoursPerDay: Number(workerForm.hoursPerDay) || 0, workDays: workerForm.workDays.map(Number), status: editing ? (workers.find((worker) => worker.id === editing)?.status || 'active') : 'active' };
    updateStore((current) => ({ ...current, workers: editing ? current.workers.map((worker) => worker.id === editing ? { ...worker, ...payload } : worker) : [...current.workers, payload] }));
    resetForm();
  }
  function toggleWorkDay(day) {
    setWorkerForm((current) => ({ ...current, workDays: current.workDays.includes(day) ? current.workDays.filter((value) => value !== day) : [...current.workDays, day].sort((a, b) => a - b) }));
  }
  function deactivate(worker) {
    const reason = window.prompt(`Motif de désactivation de ${worker.firstName} ${worker.lastName} (fin de contrat, évaluation, autre) :`, 'Fin de contrat');
    if (!reason?.trim()) return;
    updateStore((current) => ({ ...current, workers: current.workers.map((item) => item.id === worker.id ? { ...item, status: 'inactive', inactiveReason: reason.trim(), inactiveDate: localToday(), automaticDeactivation: false } : item) }));
  }
  function reactivate(worker) {
    updateStore((current) => ({ ...current, workers: current.workers.map((item) => item.id === worker.id ? { ...item, status: 'active', inactiveReason: '', inactiveDate: '' } : item) }));
  }
  function setAttendance(worker, date, status) {
    const eligible = worker.workDays.includes(weekday(date));
    if (!eligible) return;
    const stopped = worker.status === 'inactive' && worker.inactiveDate && date > worker.inactiveDate;
    if (stopped || date > localToday()) return;
    updateStore((current) => {
      const perWorker = { ...(current.attendance[worker.id] || {}) };
      if (!status) delete perWorker[date];
      else perWorker[date] = { status, updatedAt: new Date().toISOString() };
      return { ...current, attendance: { ...current.attendance, [worker.id]: perWorker } };
    });
  }
  function addHoliday(event) {
    event.preventDefault();
    if (!holidayDate) return;
    updateStore((current) => ({ ...current, holidays: [...current.holidays.filter((holiday) => holiday.date !== holidayDate), { date: holidayDate, name: holidayName.trim() || 'Jour férié' }] }));
    setHolidayDate(''); setHolidayName('');
  }
  function markHoliday(date) {
    const holiday = store.holidays.find((item) => item.date === date);
    if (!holiday) return;
    updateStore((current) => {
      const attendance = { ...current.attendance };
      workers.filter((worker) => worker.status === 'active' && worker.workDays.includes(weekday(date))).forEach((worker) => {
        attendance[worker.id] = { ...(attendance[worker.id] || {}), [date]: { status: 'holiday', updatedAt: new Date().toISOString() } };
      });
      return { ...current, attendance };
    });
  }
  function setDeduction(workerId, amount) {
    updateStore((current) => ({ ...current, deductions: { ...current.deductions, [workerId]: { ...(current.deductions[workerId] || {}), [month]: Math.max(0, Number(amount) || 0) } } }));
  }
  function exportAttendance() {
    const rows = [['Journalier', 'Tâche', 'Date', 'Jour', 'Pointage', 'Mode de paie', 'Rémunération estimée']];
    workers.forEach((worker) => dates.forEach((date) => {
      const record = attendanceCellKey(worker.id, date);
      if (record.status) {
        const amount = record.status === 'absent' ? 0 : worker.payMode === 'weekly' ? worker.weeklyRate / Math.max(worker.workDays.length, 1) : worker.payMode === 'daily' ? worker.dailyRate : worker.hourlyRate * worker.hoursPerDay;
        rows.push([`${worker.firstName} ${worker.lastName}`, worker.task, date, DAYS.find((day) => day.key === weekday(date))?.label, record.status, worker.payMode, amount]);
      }
    }));
    downloadCSV(`pointage-journaliers-${month}.csv`, rows);
  }
  function exportPayroll() {
    downloadCSV(`paie-journaliers-${month}.csv`, [['Journalier', 'Tâche', 'Mode', 'Jours payés', 'Brut FCFA', 'Retenues FCFA', 'Net FCFA'], ...payroll.map(({ worker, worked, gross, withheld, net }) => [`${worker.firstName} ${worker.lastName}`, worker.task, worker.payMode, worked, gross.toFixed(2), withheld.toFixed(2), net.toFixed(2)])]);
  }

  return (
    <main className="journal-app">
      <header className="journal-header">
        <div><p className="journal-eyebrow">ALUMINIUM & VITRAGE · GABON</p><h1>Gestion des journaliers</h1><p>Registre, présence mensuelle et paie conservés localement dans ce navigateur.</p></div>
        <div className="journal-actions"><button className="journal-button secondary" onClick={exportAttendance}>Exporter pointage CSV</button><button className="journal-button secondary" onClick={() => window.print()}>Exporter / imprimer PDF</button><button className="journal-button" onClick={() => { setShowForm((value) => !value); setEditing(null); }}>＋ Nouveau journalier</button></div>
      </header>
      <section className="journal-stats" aria-label="Résumé des journaliers">
        <article><span>Journaliers enregistrés</span><strong>{workers.length}</strong></article><article><span>Actifs</span><strong>{activeCount}</strong></article><article><span>Inactifs conservés</span><strong>{workers.length - activeCount}</strong></article><article><span>Forfaits hebdomadaires</span><strong>{workers.filter((worker) => worker.status === 'active' && worker.payMode === 'weekly').length}</strong></article>
      </section>
      <div className="journal-tabs" role="tablist" aria-label="Gestion des journaliers">
        <button className={view === 'registre' ? 'active' : ''} onClick={() => setView('registre')}>Registre & fiches</button>
        <button className={view === 'presence' ? 'active' : ''} onClick={() => setView('presence')}>Pointage mensuel</button>
        <button className={view === 'paie' ? 'active' : ''} onClick={() => setView('paie')}>Paie & retenues</button>
      </div>
      {error && <p className="journal-error" role="alert">{error}</p>}

      {showForm && <section className="journal-panel journal-form-panel">
        <div className="journal-panel-heading"><div><span className="journal-kicker">FICHE DU JOURNALIER</span><h2>{editing ? 'Modifier le dossier' : 'Nouveau dossier'}</h2></div><button className="journal-close" onClick={resetForm} aria-label="Fermer">×</button></div>
        <form className="journal-form" onSubmit={saveWorker}>
          <label>Prénom<input value={workerForm.firstName} onChange={(e) => setWorkerForm({ ...workerForm, firstName: e.target.value })} required /></label>
          <label>Nom<input value={workerForm.lastName} onChange={(e) => setWorkerForm({ ...workerForm, lastName: e.target.value })} required /></label>
          <label>Tâche / activité<input value={workerForm.task} onChange={(e) => setWorkerForm({ ...workerForm, task: e.target.value })} placeholder="Ex. Nettoyage" required /></label>
          <label>Service<input value={workerForm.department} onChange={(e) => setWorkerForm({ ...workerForm, department: e.target.value })} placeholder="Ex. Atelier" /></label>
          <label>Date de début<input type="date" value={workerForm.startDate} onChange={(e) => setWorkerForm({ ...workerForm, startDate: e.target.value })} /></label>
          <label>Fin de contrat (désactivation auto)<input type="date" value={workerForm.contractEndDate} onChange={(e) => setWorkerForm({ ...workerForm, contractEndDate: e.target.value })} /></label>
          <label>Durée maximale (jours)<input type="number" min="1" max="365" value={workerForm.maxDays} onChange={(e) => setWorkerForm({ ...workerForm, maxDays: e.target.value })} /></label>
          <label>Mode de paie<select value={workerForm.payMode} onChange={(e) => setWorkerForm({ ...workerForm, payMode: e.target.value })}><option value="daily">Taux journalier</option><option value="weekly">Paie forfaitaire hebdomadaire</option><option value="hourly">Taux horaire personnalisé</option></select></label>
          {workerForm.payMode === 'daily' && <label>Taux journalier (FCFA)<input type="number" min="0" step="any" value={workerForm.dailyRate} onChange={(e) => setWorkerForm({ ...workerForm, dailyRate: e.target.value })} required /></label>}
          {workerForm.payMode === 'weekly' && <label>Forfait par semaine (FCFA)<input type="number" min="0" step="any" value={workerForm.weeklyRate} onChange={(e) => setWorkerForm({ ...workerForm, weeklyRate: e.target.value })} placeholder="20000" required /></label>}
          {workerForm.payMode === 'hourly' && <><label>Taux horaire (FCFA)<input type="number" min="0" step="any" value={workerForm.hourlyRate} onChange={(e) => setWorkerForm({ ...workerForm, hourlyRate: e.target.value })} required /></label><label>Heures prévues par jour<input type="number" min="0.25" max="24" step="0.25" value={workerForm.hoursPerDay} onChange={(e) => setWorkerForm({ ...workerForm, hoursPerDay: e.target.value })} required /></label></>}
          <fieldset className="workdays-field"><legend>Jours de travail prévus</legend><div className="weekday-options">{DAYS.map((day) => <label key={day.key}><input type="checkbox" checked={workerForm.workDays.includes(day.key)} onChange={() => toggleWorkDay(day.key)} />{day.label}</label>)}</div></fieldset>
          <label>Évaluation<select value={workerForm.evaluation} onChange={(e) => setWorkerForm({ ...workerForm, evaluation: e.target.value })}><option value="pending">À évaluer</option><option value="good">Satisfaisante</option><option value="poor">Insuffisante (désactivation auto)</option></select></label>
          <p className="journal-hint">Forfait hebdomadaire : montant réparti sur les jours prévus. Un jour férié configuré et prévu est payé comme une journée travaillée. Exemple 20 000 FCFA sur 6 jours = 3 333,33 FCFA par jour.</p>
          <div className="journal-form-actions"><button type="button" className="journal-button secondary" onClick={resetForm}>Annuler</button><button className="journal-button" type="submit">{editing ? 'Enregistrer la fiche' : 'Créer le dossier'}</button></div>
        </form>
      </section>}

      {view === 'registre' && <section className="journal-panel">
        <div className="journal-panel-heading"><div><span className="journal-kicker">DOSSIERS CONSERVÉS</span><h2>Registre des journaliers</h2></div><label className="journal-filter">Afficher<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="active">Actifs</option><option value="inactive">Inactifs</option><option value="all">Tous</option></select></label></div>
        <div className="journal-table-wrap"><table className="journal-table"><thead><tr><th>Journalier</th><th>Tâche / service</th><th>Jours prévus</th><th>Paie</th><th>Durée / contrat</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
          {visibleWorkers.map((worker) => <tr key={worker.id} className={worker.status === 'inactive' ? 'inactive-row' : ''}><td><strong>{worker.firstName} {worker.lastName}</strong><small>Depuis le {worker.startDate || '—'}</small></td><td>{worker.task}<small>{worker.department || 'Sans service'}</small></td><td>{DAYS.filter((day) => worker.workDays.includes(day.key)).map((day) => day.label).join(', ') || '—'}</td><td><span className="pay-mode-pill">{worker.payMode === 'weekly' ? 'Forfait / semaine' : worker.payMode === 'hourly' ? 'Horaire' : 'Journalier'}</span><small>{money(worker.payMode === 'weekly' ? worker.weeklyRate : worker.payMode === 'hourly' ? worker.hourlyRate : worker.dailyRate)}{worker.payMode === 'weekly' ? ' / sem.' : worker.payMode === 'hourly' ? ' / h' : ' / jour'}</small></td><td>{worker.maxDays} jours max<small>{worker.contractEndDate ? `Fin : ${worker.contractEndDate}` : 'Fin non définie'}</small></td><td><span className={`worker-status ${worker.status}`}>{worker.status === 'active' ? 'Actif' : `Inactif · ${worker.inactiveReason || 'archivé'}`}</span></td><td className="row-actions"><button onClick={() => editWorker(worker)}>Modifier</button>{worker.status === 'active' ? <button className="deactivate-action" onClick={() => deactivate(worker)}>Désactiver</button> : <button onClick={() => reactivate(worker)}>Réactiver</button>}</td></tr>)}
          {!visibleWorkers.length && <tr><td colSpan="7" className="journal-empty">Aucun dossier dans ce filtre. Les journaliers inactifs ne sont jamais supprimés.</td></tr>}
        </tbody></table></div>
      </section>}

      {view === 'presence' && <section className="journal-panel">
        <div className="journal-panel-heading"><div><span className="journal-kicker">SUIVI QUOTIDIEN</span><h2>Feuille de présence</h2><p className="journal-description">Tous les dossiers restent consultables pour compléter le pointage antérieur à la désactivation.</p></div><div className="journal-toolbar"><label>Mois<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label><button className="journal-button secondary" onClick={exportAttendance}>Exporter CSV</button><button className="journal-button secondary" onClick={() => window.print()}>PDF / impression</button></div></div>
        <form className="holiday-form" onSubmit={addHoliday}><strong>Jour férié</strong><input type="date" value={holidayDate} onChange={(e) => setHolidayDate(e.target.value)} required /><input value={holidayName} onChange={(e) => setHolidayName(e.target.value)} placeholder="Nom du jour férié" /><button className="journal-button secondary" type="submit">Ajouter</button></form>
        <div className="holiday-list">{store.holidays.filter((holiday) => monthOf(holiday.date) === month).map((holiday) => <span key={holiday.date}>{holiday.date} · {holiday.name}<button title="Supprimer ce jour férié" onClick={() => updateStore((current) => ({ ...current, holidays: current.holidays.filter((item) => item.date !== holiday.date) }))}>×</button></span>)}</div>
        <div className="journal-table-wrap attendance-wrap"><table className="journal-table attendance-table"><thead><tr><th className="sticky-worker">Journalier</th>{dates.map((date) => <th key={date} className={store.holidays.some((holiday) => holiday.date === date) ? 'holiday-column' : ''}>{Number(date.slice(-2))}<small>{DAYS.find((day) => day.key === weekday(date))?.label}</small></th>)}</tr></thead><tbody>
          {workers.map((worker) => <tr key={worker.id}><td className="sticky-worker"><strong>{worker.firstName} {worker.lastName}</strong><small>{worker.status === 'inactive' ? `Inactif · ${worker.inactiveReason || ''}` : worker.task}</small></td>{dates.map((date) => {
            const scheduled = worker.workDays.includes(weekday(date));
            const record = attendanceCellKey(worker.id, date);
            const stopped = worker.status === 'inactive' && worker.inactiveDate && date > worker.inactiveDate;
            const disabled = !scheduled || date > localToday() || stopped;
            const holiday = store.holidays.find((item) => item.date === date);
            return <td key={date} className={`${holiday ? 'holiday-column ' : ''}${!scheduled ? 'unscheduled-cell' : ''}`} title={holiday?.name || ''}><select aria-label={`${worker.firstName} ${worker.lastName}, ${date}`} value={record.status || ''} disabled={disabled} onChange={(e) => setAttendance(worker, date, e.target.value)}><option value="">—</option><option value="present">P</option><option value="absent">A</option>{holiday && <option value="holiday">F</option>}</select></td>;
          })}</tr>)}
          {!workers.length && <tr><td colSpan={dates.length + 1} className="journal-empty">Ajoutez un journalier pour commencer le pointage.</td></tr>}
        </tbody></table></div>
        <p className="journal-legend"><span><b>P</b> Présent</span><span><b>A</b> Absent</span><span><b>F</b> Jour férié payé (si prévu)</span><span>— Jour non prévu / non pointé</span></p>
        <button className="holiday-mark-button" onClick={() => { if (window.confirm('Marquer comme férié les journées prévues à cette date ?')) markHoliday(localToday()); }}>Marquer les jours prévus comme fériés aujourd’hui</button>
      </section>}

      {view === 'paie' && <section className="journal-panel">
        <div className="journal-panel-heading"><div><span className="journal-kicker">CALCUL SUR POINTAGE</span><h2>Paie des journaliers</h2><p className="journal-description">Le net tient compte des retenues saisies. Les absences ne sont pas rémunérées.</p></div><div className="journal-toolbar"><label>Mois<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label><button className="journal-button secondary" onClick={exportPayroll}>Exporter CSV</button><button className="journal-button secondary" onClick={() => window.print()}>PDF / impression</button></div></div>
        <div className="payroll-note"><strong>Calcul du forfait :</strong> forfait hebdomadaire ÷ nombre de jours prévus, multiplié par les jours prévus pointés présents ou fériés. Les retenues restent appliquées au brut.</div>
        <div className="journal-table-wrap"><table className="journal-table payroll-table"><thead><tr><th>Journalier</th><th>Mode</th><th>Jours payés</th><th>Brut du mois</th><th>Retenues (FCFA)</th><th>Net estimé</th></tr></thead><tbody>
          {payroll.map(({ worker, worked, gross, withheld, net }) => <tr key={worker.id}><td><strong>{worker.firstName} {worker.lastName}</strong><small>{worker.task} · {worker.status === 'inactive' ? 'Inactif (historique)' : 'Actif'}</small></td><td>{worker.payMode === 'weekly' ? `${money(worker.weeklyRate)} / semaine` : worker.payMode === 'hourly' ? `${money(worker.hourlyRate)} / heure × ${worker.hoursPerDay} h/j` : `${money(worker.dailyRate)} / jour`}</td><td>{worked}</td><td>{money(gross)}</td><td><input aria-label={`Retenues de ${worker.firstName} ${worker.lastName}`} className="deduction-input" type="number" min="0" step="any" value={store.deductions[worker.id]?.[month] ?? ''} onChange={(e) => setDeduction(worker.id, e.target.value)} placeholder="0" /></td><td><strong>{money(net)}</strong></td></tr>)}
          {!payroll.length && <tr><td colSpan="6" className="journal-empty">Aucun journalier enregistré.</td></tr>}
        </tbody></table></div>
        <div className="payroll-total"><span>Total net estimé</span><strong>{money(payroll.reduce((sum, item) => sum + item.net, 0))}</strong></div>
      </section>}
      <footer className="journal-footer">Données sauvegardées dans le stockage local du navigateur. Pensez à exporter vos sauvegardes.</footer>
    </main>
  );
}

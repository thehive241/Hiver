import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;

if (isProduction && !sessionSecret) {
  throw new Error('SESSION_SECRET doit être défini en production.');
}

app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '32kb' }));
app.use(
  session({
    name: 'hiver.sid',
    secret: sessionSecret || 'hiver-secret-dev-only',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
      secure: isProduction
    }
  })
);

// Démonstration uniquement : la création/gestion des comptes en base reste à mettre en place.
const demoUsers = [
  { id: 1, firstName: 'Alice', lastName: 'Martin', email: 'admin@hiver.fr', password: 'admin123', role: 'admin', department: 'RH' },
  { id: 2, firstName: 'Thomas', lastName: 'Dubois', email: 'employee@hiver.fr', password: 'employee123', role: 'employee', department: 'Finance' },
  { id: 3, firstName: 'Sara', lastName: 'Lemoine', email: 'sara@hiver.fr', password: 'sara123', role: 'employee', department: 'Produit' }
];

const demoEmployees = [
  { id: 1, firstName: 'Alice', lastName: 'Martin', email: 'admin@hiver.fr', department: 'RH', status: 'active', role: 'Chargée de recrutement', startDate: '2024-01-15' },
  { id: 2, firstName: 'Thomas', lastName: 'Dubois', email: 'employee@hiver.fr', department: 'Finance', status: 'active', role: 'Analyste paie', startDate: '2023-06-01' },
  { id: 3, firstName: 'Sara', lastName: 'Lemoine', email: 'sara@hiver.fr', department: 'Produit', status: 'on_leave', role: 'Product Manager', startDate: '2022-09-12' },
  { id: 4, firstName: 'Nicolas', lastName: 'Bourgeois', email: 'nicolas@hiver.fr', department: 'IT', status: 'active', role: 'Développeur back-end', startDate: '2025-02-10' },
  { id: 5, firstName: 'Lina', lastName: 'Roux', email: 'lina@hiver.fr', department: 'RH', status: 'active', role: 'Business partner', startDate: '2024-11-01' }
];

const demoAbsences = [
  { id: 1, employeeId: 3, employee: 'Sara Lemoine', type: 'Congé', startDate: '2026-11-10', endDate: '2026-11-15', status: 'Approuvée' },
  { id: 2, employeeId: 2, employee: 'Thomas Dubois', type: 'RTT', startDate: '2026-11-20', endDate: '2026-11-20', status: 'En attente' },
  { id: 3, employeeId: 4, employee: 'Nicolas Bourgeois', type: 'Maladie', startDate: '2026-11-08', endDate: '2026-11-09', status: 'Approuvée' },
  { id: 4, employeeId: 5, employee: 'Lina Roux', type: 'Formation', startDate: '2026-11-27', endDate: '2026-11-29', status: 'En attente' }
];

const dataFile = process.env.HIVER_DATA_FILE || path.join(__dirname, 'data', 'hiver.json');
let employees = demoEmployees;
let absences = demoAbsences;
let auditLog = [];

try {
  const saved = JSON.parse(readFileSync(dataFile, 'utf8'));
  if (Array.isArray(saved.employees) && Array.isArray(saved.absences)) {
    employees = saved.employees;
    absences = saved.absences;
    auditLog = Array.isArray(saved.auditLog) ? saved.auditLog : [];
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

function saveData() {
  mkdirSync(path.dirname(dataFile), { recursive: true });
  writeFileSync(dataFile, JSON.stringify({ employees, absences, auditLog }, null, 2));
}

function recordAudit(req, action, detail = '') {
  auditLog.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    actor: req.session?.user?.email || 'anonyme',
    action,
    detail: String(detail).slice(0, 180)
  });
  auditLog = auditLog.slice(0, 1000);
  saveData();
}

function publicUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentification nécessaire.' });
  if (req.session.locked) return res.status(423).json({ error: 'Session verrouillée. Déverrouillez votre session pour continuer.' });
  return next();
}

function requireAdmin(req, res, next) {
  if (req.session.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Action réservée aux administrateurs.' });
  }
  return next();
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validEmployees(value) {
  if (!Array.isArray(value)) return false;
  const ids = new Set();
  const emails = new Set();
  return value.every((employee) => {
    if (!employee || !Number.isFinite(Number(employee.id)) || !employee.firstName || !employee.lastName || !employee.email || !employee.role || !employee.department || !['active', 'on_leave'].includes(employee.status) || !validDate(employee.startDate)) return false;
    const email = String(employee.email).toLowerCase();
    if (ids.has(employee.id) || emails.has(email)) return false;
    ids.add(employee.id);
    emails.add(email);
    return true;
  });
}

function validAbsences(value, knownEmployees = employees) {
  if (!Array.isArray(value)) return false;
  const employeeIds = new Set(knownEmployees.map((employee) => employee.id));
  const ids = new Set();
  return value.every((absence) => {
    if (!absence || !Number.isFinite(Number(absence.id)) || ids.has(absence.id) || !employeeIds.has(absence.employeeId) || !['Congé', 'RTT', 'Maladie', 'Formation'].includes(absence.type) || !['En attente', 'Approuvée', 'Refusée'].includes(absence.status) || !validDate(absence.startDate) || !validDate(absence.endDate) || absence.startDate > absence.endDate) return false;
    ids.add(absence.id);
    return true;
  });
}

app.get('/api/auth/session', (req, res) => {
  res.json({ authenticated: Boolean(req.session.user), locked: Boolean(req.session.locked), user: req.session.user || null });
});

app.post('/api/auth/login', (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });

  const user = demoUsers.find((entry) => entry.email.toLowerCase() === email && entry.password === password);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides.' });

  req.session.regenerate((error) => {
    if (error) return next(error);
    req.session.user = publicUser(user);
    return req.session.save((saveError) => {
      if (saveError) return next(saveError);
      recordAudit(req, 'Connexion');
      return res.json({ message: 'Connexion réussie', user: req.session.user });
    });
  });
});

app.post('/api/auth/logout', (req, res, next) => {
  if (req.session.user) recordAudit(req, 'Déconnexion');
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('hiver.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction });
    return res.json({ message: 'Déconnecté' });
  });
});

app.post('/api/auth/lock', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Authentification nécessaire.' });
  req.session.locked = true;
  recordAudit(req, 'Verrouillage de session');
  return res.json({ locked: true });
});

app.post('/api/auth/unlock', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Authentification nécessaire.' });
  const password = String(req.body?.password || '');
  const account = demoUsers.find((user) => user.id === req.session.user.id);
  if (!account || account.password !== password) return res.status(401).json({ error: 'Mot de passe incorrect.' });
  req.session.locked = false;
  recordAudit(req, 'Déverrouillage de session');
  return res.json({ locked: false, user: req.session.user });
});

app.use('/api', requireAuth);

app.get('/api/dashboard', (req, res) => {
  const total = employees.length;
  const active = employees.filter((employee) => employee.status === 'active').length;
  const onLeave = employees.filter((employee) => employee.status === 'on_leave').length;
  const pendingAbsences = absences.filter((absence) => absence.status === 'En attente').length;
  const approvedAbsences = absences.filter((absence) => absence.status === 'Approuvée').length;
  const departmentBreakdown = employees.reduce((result, employee) => {
    result[employee.department] = (result[employee.department] || 0) + 1;
    return result;
  }, {});

  res.json({
    total,
    active,
    onLeave,
    pendingAbsences,
    approvedAbsences,
    attendanceRate: total ? Math.round((active / total) * 1000) / 10 : 0,
    departmentBreakdown,
    trend: [
      { month: 'Jan', value: 18 }, { month: 'Fév', value: 22 }, { month: 'Mar', value: 24 },
      { month: 'Avr', value: 31 }, { month: 'Mai', value: 29 }, { month: 'Juin', value: 34 }
    ]
  });
});

app.get('/api/tasks', (req, res) => {
  const tasks = absences
    .filter((absence) => absence.status === 'En attente')
    .map((absence) => ({
      id: `absence-${absence.id}`,
      title: `Décider la demande de ${absence.employee}`,
      detail: `${absence.type} · ${absence.startDate} au ${absence.endDate}`,
      kind: 'Absence en attente',
      createdAt: absence.startDate
    }));
  res.json(tasks);
});

app.get('/api/employees', (req, res) => res.json(employees));

app.post('/api/employees', requireAdmin, (req, res) => {
  const firstName = String(req.body?.firstName || '').trim();
  const lastName = String(req.body?.lastName || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const role = String(req.body?.role || '').trim();
  const department = String(req.body?.department || '').trim();
  const status = req.body?.status || 'active';
  const startDate = req.body?.startDate || new Date().toISOString().slice(0, 10);

  if (!firstName || !lastName || !email || !role || !department) {
    return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis.' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Adresse email invalide.' });
  if (employees.some((employee) => employee.email.toLowerCase() === email)) {
    return res.status(409).json({ error: 'Un employé utilise déjà cette adresse email.' });
  }
  if (!['active', 'on_leave'].includes(status) || !validDate(startDate)) {
    return res.status(400).json({ error: 'Statut ou date d’embauche invalide.' });
  }

  const employee = { id: Date.now(), firstName, lastName, email, role, department, status, startDate };
  employees.push(employee);
  recordAudit(req, 'Création de collaborateur', `${firstName} ${lastName}`);
  return res.status(201).json(employee);
});

app.get('/api/absences', (req, res) => {
  const visibleAbsences = req.session.user.role === 'admin'
    ? absences
    : absences.filter((absence) => absence.employeeId === req.session.user.id);
  res.json(visibleAbsences);
});

app.post('/api/absences', (req, res) => {
  const { type, startDate, endDate } = req.body || {};
  const employeeId = req.session.user.role === 'admin' ? Number(req.body?.employeeId) : req.session.user.id;
  const employee = employees.find((entry) => entry.id === employeeId);

  if (!employee || !['Congé', 'RTT', 'Maladie', 'Formation'].includes(type)) {
    return res.status(400).json({ error: 'Employé ou type d’absence invalide.' });
  }
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    return res.status(400).json({ error: 'Veuillez vérifier les dates de début et de fin.' });
  }

  const absence = {
    id: Date.now(),
    employeeId: employee.id,
    employee: `${employee.firstName} ${employee.lastName}`,
    type,
    startDate,
    endDate,
    status: 'En attente'
  };
  absences.unshift(absence);
  recordAudit(req, 'Création de demande d’absence', `${absence.employee} · ${type}`);
  return res.status(201).json(absence);
});

app.patch('/api/absences/:id', requireAdmin, (req, res) => {
  const absence = absences.find((entry) => entry.id === Number(req.params.id));
  const status = req.body?.status;
  if (!absence) return res.status(404).json({ error: 'Demande d’absence introuvable.' });
  if (!['Approuvée', 'Refusée'].includes(status)) {
    return res.status(400).json({ error: 'Statut de décision invalide.' });
  }

  absence.status = status;
  recordAudit(req, 'Décision sur demande d’absence', `${absence.employee} · ${status}`);
  return res.json(absence);
});

app.get('/api/data/export', requireAdmin, (req, res) => {
  recordAudit(req, 'Export des données');
  res.setHeader('Content-Disposition', `attachment; filename="hiver-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ format: 'hiver-export-v1', exportedAt: new Date().toISOString(), employees, absences, auditLog });
});

app.get('/api/audit', requireAdmin, (req, res) => {
  res.json(auditLog.slice(0, 100));
});

app.post('/api/data/restore', requireAdmin, (req, res) => {
  const { backup, include } = req.body || {};
  const selected = new Set(Array.isArray(include) ? include : []);
  if (!backup || !['hiver-export-v1', 'hiver-backup-v1'].includes(backup.format)) {
    return res.status(400).json({ error: 'Format de sauvegarde Hiver non reconnu.' });
  }
  if (![...selected].every((item) => ['employees', 'absences'].includes(item)) || selected.size === 0) {
    return res.status(400).json({ error: 'Sélectionnez au moins une catégorie à restaurer.' });
  }
  const nextEmployees = selected.has('employees') ? backup.employees : employees;
  const nextAbsences = selected.has('absences') ? backup.absences : absences;
  if (!validEmployees(nextEmployees)) return res.status(400).json({ error: 'La liste des collaborateurs de la sauvegarde est invalide.' });
  if (!validAbsences(nextAbsences, nextEmployees)) return res.status(400).json({ error: 'Les demandes d’absence sont invalides ou font référence à un collaborateur absent.' });

  employees = nextEmployees;
  absences = nextAbsences;
  recordAudit(req, 'Restauration de données', [...selected].join(', '));
  return res.json({ message: 'Restauration terminée.', restored: [...selected] });
});

if (isProduction) {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Une erreur interne est survenue.' });
});

app.listen(PORT, () => console.log(`Hiver is running on http://localhost:${PORT}`));

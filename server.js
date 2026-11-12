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

try {
  const saved = JSON.parse(readFileSync(dataFile, 'utf8'));
  if (Array.isArray(saved.employees) && Array.isArray(saved.absences)) {
    employees = saved.employees;
    absences = saved.absences;
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

function saveData() {
  mkdirSync(path.dirname(dataFile), { recursive: true });
  writeFileSync(dataFile, JSON.stringify({ employees, absences }, null, 2));
}

function publicUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentification nécessaire.' });
  return next();
}

function requireAdmin(req, res, next) {
  if (req.session.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Action réservée aux administrateurs.' });
  }
  return next();
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

app.get('/api/auth/session', (req, res) => {
  res.json({ authenticated: Boolean(req.session.user), user: req.session.user || null });
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
      return res.json({ message: 'Connexion réussie', user: req.session.user });
    });
  });
});

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('hiver.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction });
    return res.json({ message: 'Déconnecté' });
  });
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
  saveData();
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
  saveData();
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
  saveData();
  return res.json(absence);
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

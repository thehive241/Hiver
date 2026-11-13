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
if (isProduction && !sessionSecret) throw new Error('SESSION_SECRET doit être défini en production.');
app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '128kb' }));
app.use(session({ name: 'hiver.sid', secret: sessionSecret || 'hiver-secret-dev-only', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8, secure: isProduction } }));

const demoUsers = [
  { id: 1, firstName: 'Alice', lastName: 'Martin', email: 'admin@hiver.fr', password: 'admin123', role: 'admin', department: 'RH' },
  { id: 2, firstName: 'Thomas', lastName: 'Dubois', email: 'employee@hiver.fr', password: 'employee123', role: 'employee', department: 'Finance' },
  { id: 3, firstName: 'Sara', lastName: 'Lemoine', email: 'sara@hiver.fr', password: 'sara123', role: 'employee', department: 'Produit' },
  { id: 6, firstName: 'Marc', lastName: 'Nziengui', email: 'delegate@hiver.fr', password: 'delegate123', role: 'delegate', department: 'Personnel' }
];
const demoEmployees = [
  { id: 1, firstName: 'Alice', lastName: 'Martin', email: 'admin@hiver.fr', department: 'RH', status: 'active', role: 'Chargée de recrutement', startDate: '2024-01-15' },
  { id: 2, firstName: 'Thomas', lastName: 'Dubois', email: 'employee@hiver.fr', department: 'Finance', status: 'active', role: 'Analyste paie', startDate: '2023-06-01' },
  { id: 3, firstName: 'Sara', lastName: 'Lemoine', email: 'sara@hiver.fr', department: 'Produit', status: 'on_leave', role: 'Product Manager', startDate: '2022-09-12' },
  { id: 4, firstName: 'Nicolas', lastName: 'Bourgeois', email: 'nicolas@hiver.fr', department: 'IT', status: 'active', role: 'Développeur back-end', startDate: '2025-02-10' },
  { id: 5, firstName: 'Lina', lastName: 'Roux', email: 'lina@hiver.fr', department: 'RH', status: 'active', role: 'Business partner', startDate: '2024-11-01' },
  { id: 6, firstName: 'Marc', lastName: 'Nziengui', email: 'delegate@hiver.fr', department: 'Personnel', status: 'active', role: 'Délégué du personnel', startDate: '2024-03-01' }
];
const dataFile = process.env.HIVER_DATA_FILE || path.join(__dirname, 'data', 'hiver.json');
let employees = demoEmployees;
let absences = [
  { id: 1, employeeId: 3, employee: 'Sara Lemoine', type: 'Congé', startDate: '2026-11-10', endDate: '2026-11-15', status: 'Approuvée' },
  { id: 2, employeeId: 2, employee: 'Thomas Dubois', type: 'RTT', startDate: '2026-11-20', endDate: '2026-11-20', status: 'En attente' }
];
let requests = [];
let announcements = [];
let cases = [];
try {
  const saved = JSON.parse(readFileSync(dataFile, 'utf8'));
  if (Array.isArray(saved.employees)) employees = saved.employees;
  if (Array.isArray(saved.absences)) absences = saved.absences;
  if (Array.isArray(saved.requests)) requests = saved.requests;
  if (Array.isArray(saved.announcements)) announcements = saved.announcements;
  if (Array.isArray(saved.cases)) cases = saved.cases;
} catch (error) { if (error.code !== 'ENOENT') throw error; }
function saveData() {
  mkdirSync(path.dirname(dataFile), { recursive: true });
  writeFileSync(dataFile, JSON.stringify({ employees, absences, requests, announcements, cases }, null, 2));
}
function publicUser(user) { const { password, ...safeUser } = user; return safeUser; }
function requireAuth(req, res, next) { if (!req.session.user) return res.status(401).json({ error: 'Authentification nécessaire.' }); next(); }
function allow(...roles) { return (req, res, next) => roles.includes(req.session.user?.role) ? next() : res.status(403).json({ error: 'Votre profil ne permet pas cette action.' }); }
function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function employeeForUser(user) { return employees.find((employee) => employee.id === user.id) || employees.find((employee) => employee.email === user.email); }
function cleanText(value, max = 4000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

app.get('/api/auth/session', (req, res) => res.json({ authenticated: Boolean(req.session.user), user: req.session.user || null }));
app.post('/api/auth/login', (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase(); const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });
  const user = demoUsers.find((entry) => entry.email.toLowerCase() === email && entry.password === password);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides.' });
  req.session.regenerate((error) => { if (error) return next(error); req.session.user = publicUser(user); req.session.save((saveError) => saveError ? next(saveError) : res.json({ message: 'Connexion réussie', user: req.session.user })); });
});
app.post('/api/auth/logout', (req, res, next) => req.session.destroy((error) => { if (error) return next(error); res.clearCookie('hiver.sid', { httpOnly: true, sameSite: 'lax', secure: isProduction }); res.json({ message: 'Déconnecté' }); }));
app.use('/api', requireAuth);

app.get('/api/dashboard', (req, res) => {
  const visibleEmployees = employees.filter((employee) => req.session.user.role === 'admin' || employee.id === req.session.user.id);
  const pendingAbsences = absences.filter((absence) => absence.status === 'En attente').length;
  res.json({ total: visibleEmployees.length, active: visibleEmployees.filter((employee) => employee.status === 'active').length, onLeave: visibleEmployees.filter((employee) => employee.status === 'on_leave').length, pendingAbsences, approvedAbsences: absences.filter((absence) => absence.status === 'Approuvée').length, attendanceRate: 0, departmentBreakdown: {}, trend: [] });
});
app.get('/api/employees', (req, res) => {
  if (req.session.user.role === 'admin' || req.session.user.role === 'delegate') return res.json(employees);
  const own = employeeForUser(req.session.user); return res.json(own ? [own] : []);
});
app.post('/api/employees', allow('admin'), (req, res) => {
  const firstName = cleanText(req.body?.firstName, 100); const lastName = cleanText(req.body?.lastName, 100); const email = cleanText(req.body?.email, 200).toLowerCase(); const role = cleanText(req.body?.role, 120); const department = cleanText(req.body?.department, 120); const status = req.body?.status || 'active'; const startDate = req.body?.startDate || new Date().toISOString().slice(0, 10);
  if (!firstName || !lastName || !email || !role || !department) return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis.' });
  if (!/^\S+@\S+\.\S+$/.test(email) || employees.some((employee) => employee.email.toLowerCase() === email)) return res.status(409).json({ error: 'Adresse invalide ou déjà utilisée.' });
  if (!['active', 'on_leave'].includes(status) || !validDate(startDate)) return res.status(400).json({ error: 'Statut ou date invalide.' });
  const employee = { id: Date.now(), firstName, lastName, email, role, department, status, startDate }; employees.push(employee); saveData(); res.status(201).json(employee);
});
app.get('/api/absences', (req, res) => res.json(req.session.user.role === 'admin' ? absences : absences.filter((absence) => absence.employeeId === req.session.user.id)));
app.post('/api/absences', (req, res) => {
  const { type, startDate, endDate } = req.body || {}; const employeeId = req.session.user.role === 'admin' ? Number(req.body?.employeeId) : req.session.user.id; const employee = employees.find((entry) => entry.id === employeeId);
  if (!employee || !['Congé', 'RTT', 'Maladie', 'Formation'].includes(type)) return res.status(400).json({ error: 'Employé ou type d’absence invalide.' });
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) return res.status(400).json({ error: 'Veuillez vérifier les dates.' });
  const absence = { id: Date.now(), employeeId: employee.id, employee: `${employee.firstName} ${employee.lastName}`, type, startDate, endDate, status: 'En attente' }; absences.unshift(absence); saveData(); res.status(201).json(absence);
});
app.patch('/api/absences/:id', allow('admin'), (req, res) => { const absence = absences.find((entry) => entry.id === Number(req.params.id)); const status = req.body?.status; if (!absence) return res.status(404).json({ error: 'Demande introuvable.' }); if (!['Approuvée', 'Refusée'].includes(status)) return res.status(400).json({ error: 'Décision invalide.' }); absence.status = status; saveData(); res.json(absence); });

app.get('/api/portal/requests', (req, res) => {
  const role = req.session.user.role; const ownId = req.session.user.id;
  res.json(role === 'admin' || role === 'delegate' ? requests : requests.filter((request) => request.employeeId === ownId));
});
app.post('/api/portal/requests', (req, res) => {
  if (!['employee', 'admin'].includes(req.session.user.role)) return res.status(403).json({ error: 'Seuls les salariés peuvent soumettre une demande depuis cet espace.' });
  const type = cleanText(req.body?.type, 80); const details = cleanText(req.body?.details, 4000); const startDate = req.body?.startDate || ''; const endDate = req.body?.endDate || '';
  if (!['Congé', 'Justification d’absence', 'Demande administrative', 'Suggestion', 'Plainte', 'Autre'].includes(type) || !details) return res.status(400).json({ error: 'Type ou message de demande invalide.' });
  if ((startDate && !validDate(startDate)) || (endDate && !validDate(endDate)) || (startDate && endDate && startDate > endDate)) return res.status(400).json({ error: 'Les dates de la demande sont invalides.' });
  const employee = employeeForUser(req.session.user); if (!employee) return res.status(404).json({ error: 'Dossier salarié introuvable.' });
  const request = { id: Date.now(), employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}`, type, details, startDate, endDate, status: 'En attente', createdAt: new Date().toISOString(), response: '' };
  requests.unshift(request); saveData(); res.status(201).json(request);
});
app.patch('/api/portal/requests/:id', allow('admin'), (req, res) => {
  const item = requests.find((entry) => entry.id === Number(req.params.id)); if (!item) return res.status(404).json({ error: 'Demande introuvable.' });
  const status = req.body?.status; if (!['Approuvée', 'Refusée'].includes(status)) return res.status(400).json({ error: 'Décision invalide.' });
  item.status = status; item.response = cleanText(req.body?.response, 2000); item.updatedAt = new Date().toISOString(); saveData(); res.json(item);
});
app.get('/api/portal/announcements', (req, res) => {
  const role = req.session.user.role; const visible = announcements.filter((item) => item.audience === 'all' || (item.audience === 'employees' && role === 'employee') || (item.audience === 'delegates' && ['delegate', 'admin'].includes(role)));
  res.json(visible);
});
app.post('/api/portal/announcements', allow('admin', 'delegate'), (req, res) => {
  const title = cleanText(req.body?.title, 160); const message = cleanText(req.body?.message, 4000); const audience = req.body?.audience;
  if (!title || !message || !['all', 'employees', 'delegates'].includes(audience)) return res.status(400).json({ error: 'Titre, message et destinataires requis.' });
  const item = { id: Date.now(), title, message, audience, authorId: req.session.user.id, authorName: `${req.session.user.firstName} ${req.session.user.lastName}`, createdAt: new Date().toISOString() }; announcements.unshift(item); saveData(); res.status(201).json(item);
});
app.get('/api/portal/cases', (req, res) => {
  const role = req.session.user.role; res.json(role === 'admin' || role === 'delegate' ? cases : cases.filter((item) => item.employeeId === req.session.user.id));
});
app.post('/api/portal/cases', allow('admin', 'delegate'), (req, res) => {
  const employee = employees.find((entry) => entry.id === Number(req.body?.employeeId)); const subject = cleanText(req.body?.subject, 180); const message = cleanText(req.body?.message, 3000);
  if (!employee || !subject || !message) return res.status(400).json({ error: 'Salarié, sujet et message sont requis.' });
  const item = { id: Date.now(), employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}`, subject, status: 'Ouvert', createdAt: new Date().toISOString(), messages: [{ authorId: req.session.user.id, authorName: `${req.session.user.firstName} ${req.session.user.lastName}`, message, createdAt: new Date().toISOString() }] }; cases.unshift(item); saveData(); res.status(201).json(item);
});
app.post('/api/portal/cases/:id/messages', (req, res) => {
  const item = cases.find((entry) => entry.id === Number(req.params.id)); if (!item) return res.status(404).json({ error: 'Suivi introuvable.' });
  const role = req.session.user.role; if (!['admin', 'delegate'].includes(role) && item.employeeId !== req.session.user.id) return res.status(403).json({ error: 'Ce suivi ne vous est pas destiné.' });
  const message = cleanText(req.body?.message, 3000); if (!message) return res.status(400).json({ error: 'Le message est requis.' });
  item.messages.push({ authorId: req.session.user.id, authorName: `${req.session.user.firstName} ${req.session.user.lastName}`, message, createdAt: new Date().toISOString() }); item.updatedAt = new Date().toISOString(); saveData(); res.status(201).json(item);
});

if (isProduction) { const distPath = path.join(__dirname, 'dist'); app.use(express.static(distPath)); app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html'))); }
app.use((error, req, res, next) => { console.error(error); if (res.headersSent) return next(error); res.status(500).json({ error: 'Une erreur interne est survenue.' }); });
app.listen(PORT, () => console.log(`Hiver is running on http://localhost:${PORT}`));

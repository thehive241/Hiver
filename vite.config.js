import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'hiver-secret-dev',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
      secure: false
    }
  })
);

const users = [
  {
    id: 1,
    firstName: 'Alice',
    lastName: 'Martin',
    email: 'admin@hiver.fr',
    password: 'admin123',
    role: 'admin',
    department: 'RH',
    status: 'active'
  },
  {
    id: 2,
    firstName: 'Thomas',
    lastName: 'Dubois',
    email: 'employee@hiver.fr',
    password: 'employee123',
    role: 'employee',
    department: 'Finance',
    status: 'active'
  },
  {
    id: 3,
    firstName: 'Sara',
    lastName: 'Lemoine',
    email: 'sara@hiver.fr',
    password: 'sara123',
    role: 'employee',
    department: 'Produit',
    status: 'on_leave'
  }
];

const employees = [
  {
    id: 1,
    firstName: 'Alice',
    lastName: 'Martin',
    email: 'admin@hiver.fr',
    department: 'RH',
    status: 'active',
    role: 'Chargée de recrutement',
    startDate: '2024-01-15'
  },
  {
    id: 2,
    firstName: 'Thomas',
    lastName: 'Dubois',
    email: 'employee@hiver.fr',
    department: 'Finance',
    status: 'active',
    role: 'Analyste paie',
    startDate: '2023-06-01'
  },
  {
    id: 3,
    firstName: 'Sara',
    lastName: 'Lemoine',
    email: 'sara@hiver.fr',
    department: 'Produit',
    status: 'on_leave',
    role: 'Product Manager',
    startDate: '2022-09-12'
  },
  {
    id: 4,
    firstName: 'Nicolas',
    lastName: 'Bourgeois',
    email: 'nicolas@hiver.fr',
    department: 'IT',
    status: 'active',
    role: 'Développeur back-end',
    startDate: '2025-02-10'
  },
  {
    id: 5,
    firstName: 'Lina',
    lastName: 'Roux',
    email: 'lina@hiver.fr',
    department: 'RH',
    status: 'active',
    role: 'Business partner',
    startDate: '2024-11-01'
  }
];

const absences = [
  {
    id: 1,
    employee: 'Sara Lemoine',
    type: 'Congé',
    startDate: '2026-11-10',
    endDate: '2026-11-15',
    status: 'Approuvée'
  },
  {
    id: 2,
    employee: 'Thomas Dubois',
    type: 'RTT',
    startDate: '2026-11-20',
    endDate: '2026-11-20',
    status: 'En attente'
  },
  {
    id: 3,
    employee: 'Nicolas Bourgeois',
    type: 'Maladie',
    startDate: '2026-11-08',
    endDate: '2026-11-09',
    status: 'Approuvée'
  },
  {
    id: 4,
    employee: 'Lina Roux',
    type: 'Formation',
    startDate: '2026-11-27',
    endDate: '2026-11-29',
    status: 'En attente'
  }
];

app.get('/api/auth/session', (req, res) => {
  if (!req.session.user) {
    return res.json({ authenticated: false, user: null });
  }

  return res.json({
    authenticated: true,
    user: {
      id: req.session.user.id,
      firstName: req.session.user.firstName,
      lastName: req.session.user.lastName,
      email: req.session.user.email,
      role: req.session.user.role,
      department: req.session.user.department
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const user = users.find(
    (entry) => entry.email.toLowerCase() === String(email).toLowerCase() && entry.password === String(password)
  );

  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides.' });
  }

  const sessionUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    department: user.department
  };

  req.session.user = sessionUser;

  return res.json({
    message: 'Connexion réussie',
    user: sessionUser
  });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Déconnecté' });
  });
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth')) {
    return next();
  }

  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentification nécessaire.' });
  }

  return next();
});

app.get('/api/dashboard', (req, res) => {
  const total = employees.length;
  const active = employees.filter((employee) => employee.status === 'active').length;
  const onLeave = employees.filter((employee) => employee.status === 'on_leave').length;
  const pendingAbsences = absences.filter((absence) => absence.status === 'En attente').length;
  const approvedAbsences = absences.filter((absence) => absence.status === 'Approuvée').length;
  const attendanceRate = Math.round(((active / total) * 100 + Number.EPSILON) * 10) / 10;

  const departmentBreakdown = employees.reduce((acc, employee) => {
    acc[employee.department] = (acc[employee.department] || 0) + 1;
    return acc;
  }, {});

  const trend = [
    { month: 'Jan', value: 18 },
    { month: 'Fév', value: 22 },
    { month: 'Mar', value: 24 },
    { month: 'Avr', value: 31 },
    { month: 'Mai', value: 29 },
    { month: 'Juin', value: 34 }
  ];

  res.json({
    total,
    active,
    onLeave,
    pendingAbsences,
    approvedAbsences,
    attendanceRate,
    departmentBreakdown,
    trend,
    roleDistribution: {
      admin: users.filter((user) => user.role === 'admin').length,
      employee: users.filter((user) => user.role === 'employee').length
    }
  });
});

app.get('/api/employees', (req, res) => {
  res.json(employees);
});

app.post('/api/employees', (req, res) => {
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
  }

  const { firstName, lastName, email, role, department, status, startDate } = req.body || {};

  if (!firstName || !lastName || !email || !role || !department) {
    return res.status(400).json({ error: 'Tous les champs obligatoires doivent être remplis.' });
  }

  const newEmployee = {
    id: Date.now(),
    firstName,
    lastName,
    email,
    role,
    department,
    status: status || 'active',
    startDate: startDate || new Date().toISOString().slice(0, 10)
  };

  employees.push(newEmployee);
  return res.status(201).json(newEmployee);
});

app.get('/api/absences', (req, res) => {
  res.json(absences);
});

app.post('/api/absences', (req, res) => {
  const { employee, type, startDate, endDate, status } = req.body || {};

  if (!employee || !type || !startDate || !endDate) {
    return res.status(400).json({ error: 'Les informations de demande d’absence sont incomplètes.' });
  }

  const newAbsence = {
    id: Date.now(),
    employee,
    type,
    startDate,
    endDate,
    status: status || 'En attente'
  };

  absences.unshift(newAbsence);
  return res.status(201).json(newAbsence);
});

if (isProduction) {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Hiver is running on http://localhost:${PORT}`);
});

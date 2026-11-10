# Hiver

Suivi RH est une application de gestion interne pour suivre les collaborateurs, les congés et l'activité RH d'une entreprise.

## Fonctionnalités

- Tableau de bord RH
- Liste des employés
- Suivi des absences / congés
- Ajout rapide d'un employé ou d'une demande d'absence
- Interface web simple et légère

## Stack

- Node.js
- Express
- HTML / CSS / JavaScript

## Démarrage

```bash
npm install
npm start
```

Puis ouvrez : http://localhost:3000

## Arborescence

```text
.
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── .gitignore
├── package.json
├── README.md
└── server.js
```

## Exemple d'utilisation

- Ajouter un employé depuis le formulaire de la page d'accueil
- Consulter le nombre d'employés actifs et en congé
- Ajouter une demande d'absence (congé, RTT, maladie, formation)

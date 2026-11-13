import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Journaliers from './Journaliers';
import './styles.css';
import './journaliers.css';

function Workspace() {
  const [section, setSection] = useState('journaliers');
  return (
    <>
      <nav className="workspace-nav" aria-label="Modules Hiver">
        <strong>Hiver RH</strong>
        <button type="button" className={section === 'journaliers' ? 'selected' : ''} onClick={() => setSection('journaliers')}>Journaliers</button>
        <button type="button" className={section === 'rh' ? 'selected' : ''} onClick={() => setSection('rh')}>Espace RH</button>
      </nav>
      {section === 'journaliers' ? <Journaliers /> : <App />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Workspace /></React.StrictMode>
);

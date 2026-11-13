import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import Portal from './Portal';
import './styles.css';
import './journaliers.css';
import './portal.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Portal /></React.StrictMode>
);

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initDb } from './db/init.js';
import './styles.css';

// Open the database and seed first-run defaults before rendering.
initDb().catch((err) => {
  console.error('[BudgetAppV4] Database initialisation failed:', err);
});

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

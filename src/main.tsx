/**
 * HTTP Basic Authentication Layer (browser-enforced)
 * 
 * This code prompts the user for a username and password before loading the React app.
 * If credentials do not match, it keeps prompting.
 * 
 * IMPORTANT:
 * - Credentials are hardcoded here for demonstration only.
 * - This only applies as a frontend measure and is not truly secure for protecting backend endpoints.
 * - You must still keep your real authentication for the app.
 */
const BASIC_AUTH_USER = "admin";
const BASIC_AUTH_PASS = "lolblock2025";
function basicAuth() {
  // If already granted in this session, don't prompt again
  if (sessionStorage.getItem("__basic_auth_ok__") === "yes") return;

  // Native prompt for browser basic auth look and feel
  function promptBasicAuth() {
    const user = window.prompt("HTTP Basic Auth\n\nUsername:", "");
    if (user !== BASIC_AUTH_USER) {
      alert("Access denied.");
      promptBasicAuth();
      return;
    }
    const pass = window.prompt("Password:", "");
    if (pass !== BASIC_AUTH_PASS) {
      alert("Access denied.");
      promptBasicAuth();
      return;
    }
    sessionStorage.setItem("__basic_auth_ok__", "yes");
  }

  promptBasicAuth();
}
basicAuth();

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import './components/editor/editor.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

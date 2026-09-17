import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ApiProvider } from './data/context';
import { createMockApi } from './data/mockApi';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';

const api = createMockApi();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApiProvider api={api}>
      <App />
    </ApiProvider>
  </React.StrictMode>,
);

// The service worker only in production builds: in dev it would cache Vite's module graph.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {
      /* offline install is a nicety; the app still runs */
    });
  });
}

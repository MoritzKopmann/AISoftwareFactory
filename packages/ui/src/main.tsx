import { createRoot } from 'react-dom/client';
import { AppShell } from './app-shell.js';
import './app.css';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element');
}

createRoot(rootElement).render(<AppShell />);

import { createRoot } from 'react-dom/client';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element');
}

createRoot(rootElement).render(<h1>aisf</h1>);

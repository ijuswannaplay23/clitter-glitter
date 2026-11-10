import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createLocalRepository, openDatabase } from './data';
import { RepositoryProvider } from './features/repository';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const repo = createLocalRepository(openDatabase());

createRoot(root).render(
  <StrictMode>
    <RepositoryProvider repo={repo}>
      <App />
    </RepositoryProvider>
  </StrictMode>,
);

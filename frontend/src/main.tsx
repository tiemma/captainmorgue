import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CaptainWorkspace } from './screens';
import './tokens.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CaptainWorkspace />
  </StrictMode>,
);

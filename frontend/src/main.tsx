import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { LiveWorkspace } from './live-workspace';
import './tokens.css';
import './styles.css';

const Preview = lazy(() => import('./screens').then(module => ({ default: module.CaptainWorkspace })));
const preview = new URLSearchParams(window.location.search).get('preview') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {preview ? <Suspense fallback={<p>Loading preview</p>}><Preview /></Suspense> : <LiveWorkspace />}
  </StrictMode>,
);

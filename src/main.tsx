import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// iOS Safari ignores user-scalable=no: block pinch zoom explicitly so the
// app does not end up zoomed in and misaligned by accident.
['gesturestart', 'gesturechange'].forEach(type =>
  document.addEventListener(type, e => e.preventDefault(), { passive: false })
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

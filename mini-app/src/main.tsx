import { render } from 'preact';
import { App } from './App';
import './styles/index.css';

// Register service worker for offline support (optional)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration failed, continue without it
    });
  });
}

// Render app
render(<App />, document.getElementById('app')!);

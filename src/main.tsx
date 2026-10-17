import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';
import { RescueGame } from './rescue/RescueGame';

function Root() {
  const [rescue, setRescue] = useState(
    () =>
      new URLSearchParams(window.location.search).get('game') === 'last-elevator' ||
      document.documentElement.dataset.game === 'last-elevator',
  );
  function navigate(open: boolean) {
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      const url = new URL(window.location.href);
      if (open) url.searchParams.set('game', 'last-elevator');
      else url.searchParams.delete('game');
      window.history.replaceState(null, '', url);
    }
    setRescue(open);
    window.scrollTo(0, 0);
  }
  return rescue ? (
    <RescueGame onExit={() => navigate(false)} />
  ) : (
    <App onPlayRescue={() => navigate(true)} />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

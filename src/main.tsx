import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';
import { HauntGame } from './haunt/HauntGame';
import { StallGame } from './stall/StallGame';
import { RescueGame } from './rescue/RescueGame';

function Root() {
  const [game, setGame] = useState(() => {
    const query = new URLSearchParams(window.location.search).get('game');
    return query ?? document.documentElement.dataset.game ?? '';
  });
  function navigate(next: string) {
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      const url = new URL(window.location.href);
      if (next) url.searchParams.set('game', next);
      else url.searchParams.delete('game');
      window.history.replaceState(null, '', url);
    }
    setGame(next);
    window.scrollTo(0, 0);
  }
  return game === 'zero-echo' ? (
    <HauntGame onExit={() => navigate('')} />
  ) : game === 'night-stall' ? (
    <StallGame onExit={() => navigate('')} />
  ) : game === 'last-elevator' ? (
    <RescueGame onExit={() => navigate('')} />
  ) : (
    <App
      onPlayRescue={() => navigate('last-elevator')}
      onPlayStall={() => navigate('night-stall')}
      onPlayHaunt={() => navigate('zero-echo')}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

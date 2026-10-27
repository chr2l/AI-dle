// Entry point: idle loop + the test interface (src/ui).
import { createInitialState, update } from './core';
import { App } from './ui/app';
import { loadGame } from './ui/persist';

void (async () => {
  const saved = await loadGame(Date.now());
  const now = Date.now();
  const state = saved ?? createInitialState(now);
  const app = new App(state, document.getElementById('ui')!);
  // Catch up on the time spent away before the first frame.
  const offline = update(state, now);
  app.render();
  if (saved) app.showOffline(offline);
  app.start();
})();

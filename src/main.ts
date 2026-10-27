// Entry point: idle loop + the test interface (src/ui).
import { createInitialState, demoState, update } from './core';
import { App } from './ui/app';
import { freezeSaves, loadGame } from './ui/persist';

void (async () => {
  // ?demo=1: a mid-game airport for screenshots, never saved.
  const demo = new URLSearchParams(location.search).has('demo');
  if (demo) freezeSaves();
  const saved = demo ? null : await loadGame(Date.now());
  const now = Date.now();
  const state = demo ? demoState(now) : saved ?? createInitialState(now);
  const app = new App(state, document.getElementById('ui')!);
  // Catch up on the time spent away before the first frame.
  const offline = update(state, now);
  app.render();
  if (saved) app.showOffline(offline);
  app.start();
})();

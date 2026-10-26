// Entry point: idle loop + the test interface (src/ui).
import { createInitialState, load, update } from './core';
import { App } from './ui/app';

const now = Date.now();
const saved = load(now);
const state = saved ?? createInitialState(now);
const app = new App(state, document.getElementById('ui')!);
// Catch up on the time spent away before the first frame.
const offline = update(state, now);
app.render();
if (saved) app.showOffline(offline);
app.start();

// Temporary entry point until the renderer and UI land: runs the idle loop
// and shows the main counters so the engine can be tried in a browser.
import { createInitialState, tick, totalShopRate } from './core';

const state = createInitialState(Date.now());
const ui = document.getElementById('ui')!;

function frame() {
  tick(state, Date.now());
  ui.textContent = `🪙 ${Math.floor(state.coins)} · ✈️ ${state.miles} · ⭐ niv. ${state.level} · ${totalShopRate(state).toFixed(1)} 🪙/s`;
  requestAnimationFrame(frame);
}
frame();

// Temporary entry point until the renderer and UI land: runs the idle loop
// and shows the main counters so the engine can be tried in a browser.
import { createInitialState, load, save, totalShopRate, update } from './core';

const state = load(Date.now()) ?? createInitialState(Date.now());
const ui = document.getElementById('ui')!;

function frame() {
  update(state, Date.now());
  ui.textContent = `🪙 ${Math.floor(state.coins)} · ✈️ ${state.miles} · ⭐ niv. ${state.level} · ${totalShopRate(state).toFixed(1)} 🪙/s`;
  requestAnimationFrame(frame);
}
frame();
setInterval(() => save(state), 10_000);
window.addEventListener('pagehide', () => save(state));

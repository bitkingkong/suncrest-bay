// Boot and the one loop: the world advances in fixed 1/60 s steps (several in a
// slow frame, none in a fast one) and the renderer paints what is there. The game
// moves between title, play, paused, busted and wasted screens.
//
// ?shot=start|play|chase|mission (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { createWorld } from './world.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const errBox = document.getElementById('err');

window.addEventListener('error', (event) => {
  const message = String((event && event.message) || 'unknown error');
  window.__error = message;
  if (errBox) errBox.textContent = message;
});
window.addEventListener('unhandledrejection', (event) => {
  const message = String((event && event.reason && event.reason.message) || event.reason || 'unhandled rejection');
  window.__error = message;
  if (errBox) errBox.textContent = message;
});

const world = createWorld(canvas, seed);

function wire(id, fn) {
  const button = document.getElementById(id);
  if (button) button.addEventListener('click', fn);
}

wire('btn-new', () => {
  world.audio.unlock();
  world.startGame(true);
});
wire('btn-continue', () => {
  const save = world.loadGame();
  if (save) world.applySave(save);
  world.audio.unlock();
  world.startGame(false);
});
wire('btn-resume', () => {
  world.state.screen = 'play';
  world.hud.showScreen('play');
});
wire('btn-save', () => {
  if (world.saveGame()) {
    document.getElementById('save-note').textContent = 'Tersimpan.';
  } else {
    document.getElementById('save-note').textContent = 'Gagal menyimpan (storage mati).';
  }
});
wire('btn-restart', () => window.location.reload());
wire('btn-busted', () => world.respawn(100));
wire('btn-wasted', () => world.respawn(50));
wire('btn-title-quit', () => window.location.reload());

window.addEventListener('resize', () => {
  world.cameraRig.resize();
  world.renderer.setSize(window.innerWidth, window.innerHeight);
});

if (shot) {
  try {
    stageShot(shot, world);
    let painted = 0;
    const paint = () => {
      world.step(0);
      painted += 1;
      if (painted < 2) requestAnimationFrame(paint);
      else {
        window.__shotReady = true;
        document.documentElement.setAttribute('data-shot-ready', 'true');
      }
    };
    requestAnimationFrame(paint);
  } catch (error) {
    const message = String((error && error.stack) || error);
    window.__shotError = message;
    if (errBox) errBox.textContent = message;
  }
} else {
  const save = world.loadGame();
  world.hud.setContinueVisible(!!save);
  if (save) world.hud.setTitleStats(save.cash || 0, (save.completed || []).length);
  world.state.screen = 'title';
  world.hud.showScreen('title');
  let last = performance.now();
  let accumulator = 0;
  const STEP = 1 / 60;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    accumulator += dt;
    let n = 0;
    while (accumulator >= STEP && n < 5) {
      world.step(STEP);
      accumulator -= STEP;
      n += 1;
    }
    if (n === 5) accumulator = 0;
  }
  requestAnimationFrame(frame);
}

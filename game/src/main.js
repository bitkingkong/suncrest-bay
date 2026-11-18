// Suncrest Bay — boot and the one loop.
// Input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the view paints what
// is there. The game moves between four screens: title, play, pause and
// game over (busted / wasted).
//
// ?seed=N fixes the city layout. ?shot=start|play|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { createWorld } from './world.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;
const STEP = 1 / 60;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const world = createWorld(canvas, seed);
// A debug handle for the browser console (and the screenshot driver).
window.__world = world;

// Any uncaught page error is surfaced for the screenshot driver.
window.addEventListener('error', (event) => {
  window.__error = String(event.message || event.error || 'page error');
});

function runShot(name) {
  try {
    const scene = stageShot(name, world);
    // Two real renders so shadows and the HUD settle, then signal ready.
    world.render();
    world.render();
    window.__shotReady = true;
  } catch (err) {
    window.__error = String(err?.message || err);
  }
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    let guard = 0;
    while (accumulator >= STEP && guard < 5) {
      world.step(STEP);
      accumulator -= STEP;
      guard += 1;
    }
    if (guard === 5) accumulator = 0;
    // The world renders inside step(); on a paused screen step() still
    // paints, so nothing else is needed here.
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.state.screen === 'play') world.setScreen('pause');
  });

  world.hud.announce('Suncrest Bay. Continue atau New Game.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

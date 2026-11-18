// Suncrest Bay — keyboard + mouse input.
// Held keys are read every frame; one-shot presses (pause, enter car,
// punch, reload, mute, horn) are queued as flags and taken once, so a
// press between two frames is never lost and never counted twice.
// The camera orbits while the pointer drags.
export const PRESS_ENTER_CAR = 1;
export const PRESS_PUNCH = 2;
export const PRESS_RELOAD = 4;
export const PRESS_PAUSE = 8;
export const PRESS_MUTE = 16;
export const PRESS_HORN = 32;
export const PRESS_SHOOT = 64;

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function createInput(canvas) {
  const keys = new Set();
  let pressed = 0;
  let orbitDx = 0;
  let orbitDy = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let mouseHeld = false;

  function onKeyDown(event) {
    if (event.repeat) {
      if (MOVE_KEYS.has(event.code)) event.preventDefault();
      return;
    }
    keys.add(event.code);
    if (event.code === 'KeyE') pressed |= PRESS_ENTER_CAR;
    else if (event.code === 'KeyF') pressed |= PRESS_PUNCH;
    else if (event.code === 'KeyR') pressed |= PRESS_RELOAD;
    else if (event.code === 'KeyP' || event.code === 'Escape') pressed |= PRESS_PAUSE;
    else if (event.code === 'KeyM') pressed |= PRESS_MUTE;
    else if (event.code === 'KeyH') pressed |= PRESS_HORN;
    if (MOVE_KEYS.has(event.code) || event.code === 'Space') event.preventDefault();
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onPointerDown(event) {
    mouseHeld = true;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (!dragging) return;
    orbitDx += event.clientX - lastX;
    orbitDy += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  }

  function onPointerUp(event) {
    mouseHeld = false;
    dragging = false;
    // A click (no drag) while playing fires the pistol.
    if (Math.abs(event.clientX - lastX) < 6 && Math.abs(event.clientY - lastY) < 6) {
      pressed |= PRESS_SHOOT;
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  return {
    held(code) {
      return keys.has(code);
    },
    // -1..1 forward/back and left/right, from WASD or arrows.
    move() {
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      return { forward: f, strafe: s };
    },
    run() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    jump() {
      return keys.has('Space');
    },
    handbrake() {
      return keys.has('Space');
    },
    mouseHeld() {
      return mouseHeld;
    },
    takeOrbit() {
      const out = { dx: orbitDx, dy: orbitDy };
      orbitDx = 0;
      orbitDy = 0;
      return out;
    },
    takePressed() {
      const out = pressed;
      pressed = 0;
      return out;
    },
    wasPressed(flag) {
      return (pressed & flag) !== 0;
    },
    endFrame() {
      pressed = 0;
    },
  };
}

// A fake input for scripted scenes (screenshots, autopilot): the world
// reads it exactly like the real keyboard.
export function fakeInput(forward, strafe) {
  return {
    held: () => false,
    move: () => ({ forward, strafe }),
    run: () => false,
    jump: () => false,
    handbrake: () => false,
    mouseHeld: () => false,
    takeOrbit: () => ({ dx: 0, dy: 0 }),
    takePressed: () => 0,
    wasPressed: () => false,
    endFrame: () => {},
  };
}

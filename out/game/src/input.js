// Keyboard + mouse input. WASD moves, mouse drag orbits the camera, and every
// action key reports a pressed edge exactly once per keydown.
export const ACTION_ENTER = 'enter';
export const ACTION_PUNCH = 'punch';
export const ACTION_SHOOT = 'shoot';
export const ACTION_RELOAD = 'reload';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';
export const ACTION_HORN = 'horn';
export const ACTION_JUMP = 'jump';
export const ACTION_SPRINT = 'sprint';

const KEY_ACTIONS = {
  KeyE: ACTION_ENTER,
  KeyF: ACTION_PUNCH,
  KeyR: ACTION_RELOAD,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyM: ACTION_MUTE,
  KeyH: ACTION_HORN,
  Space: ACTION_JUMP,
  ShiftLeft: ACTION_SPRINT,
  ShiftRight: ACTION_SPRINT,
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDown = false;
  let orbitDX = 0;
  let orbitDY = 0;
  let lastX = 0;
  let lastY = 0;
  let dragging = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) pressed.add(action);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      pressed.add(ACTION_SHOOT);
    }
    if (event.button === 2) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  }
  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
    if (event.button === 2) dragging = false;
  }
  function onMouseMove(event) {
    if (!dragging) return;
    orbitDX += event.clientX - lastX;
    orbitDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  }
  function onContextMenu(event) {
    event.preventDefault();
  }
  function onBlur() {
    keys.clear();
    mouseDown = false;
    dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('blur', onBlur);

  return {
    // Held movement keys, camera-relative.
    moveX() {
      let x = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      return x;
    },
    moveY() {
      let y = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      return y;
    },
    sprint() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    handbrake() {
      return keys.has('Space');
    },
    mouseHeld() {
      return mouseDown;
    },
    // Consume the orbit delta accumulated since the last call (pixels).
    takeOrbit() {
      const out = { dx: orbitDX, dy: orbitDY };
      orbitDX = 0;
      orbitDY = 0;
      return out;
    },
    // True once per keydown; callers check then clear at the end of the frame.
    wasPressed(action) {
      return pressed.has(action);
    },
    endFrame() {
      pressed.clear();
    },
  };
}

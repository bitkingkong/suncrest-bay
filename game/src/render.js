// Suncrest Bay — the 3D view: renderer, camera and its follow behaviour.
// The camera is a third-person orbit: it trails behind the player or the
// car, the player drags to look around, and on the title screen it slowly
// circles the whole city. Nothing here knows the rules; the world hands it
// a focus point and a heading each frame.
import * as THREE from 'three';
import { clamp, lerp } from './random.js';

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);

  let yaw = Math.PI; // behind the player, looking north (-z) at spawn
  let pitch = 0.42;
  let distance = 8;
  let focus = new THREE.Vector3(0, 1.5, 60);
  let titleAngle = 0.6;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // Drag deltas from input: yaw around, pitch up/down within limits.
  function applyOrbit(dx, dy) {
    yaw -= dx * 0.005;
    pitch = clamp(pitch + dy * 0.003, 0.12, 1.15);
  }

  function updateCamera(targetX, targetZ, targetHeading, inCar, dt) {
    const wantDist = inCar ? 11 : 7.5;
    const wantHeight = inCar ? 4.6 : 3.4;
    distance = lerp(distance, wantDist, Math.min(1, dt * 3));
    // Ease the camera behind the direction of travel.
    const behind = targetHeading + Math.PI;
    let dyaw = behind - yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    yaw += dyaw * Math.min(1, dt * 1.6);
    const cx = targetX + Math.sin(yaw) * Math.cos(pitch) * distance;
    const cz = targetZ + Math.cos(yaw) * Math.cos(pitch) * distance;
    const cy = wantHeight + Math.sin(pitch) * distance * 0.6;
    focus.x = lerp(focus.x, targetX, Math.min(1, dt * 8));
    focus.y = lerp(focus.y, 1.6, Math.min(1, dt * 8));
    focus.z = lerp(focus.z, targetZ, Math.min(1, dt * 8));
    camera.position.set(
      lerp(camera.position.x, cx, Math.min(1, dt * 10)),
      lerp(camera.position.y, cy, Math.min(1, dt * 10)),
      lerp(camera.position.z, cz, Math.min(1, dt * 10)),
    );
    camera.lookAt(focus.x, focus.y, focus.z);
  }

  function updateTitleCamera(dt) {
    titleAngle += dt * 0.045;
    const r = 150;
    camera.position.set(Math.sin(titleAngle) * r, 62, Math.cos(titleAngle) * r);
    camera.lookAt(0, 8, 0);
  }

  function render() {
    renderer.render(scene, camera);
  }

  return {
    renderer,
    scene,
    camera,
    resize,
    applyOrbit,
    updateCamera,
    updateTitleCamera,
    render,
    get yaw() {
      return yaw;
    },
    set yaw(v) {
      yaw = v;
    },
  };
}

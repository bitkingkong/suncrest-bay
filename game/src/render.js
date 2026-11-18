// Three.js scene, sun, sky and the third-person follow camera. Rendering only;
// the rules live in world.js.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { angleLerp, clamp, lerp } from './random.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 180, 420);
  const hemi = new THREE.HemisphereLight(0xbfd9e8, 0x8a7a5a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.2);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 500;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);
  return { scene, sun };
}

// Third-person camera: orbits the player, follows behind while driving.
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 800);
  return {
    camera,
    yaw: Math.PI,
    pitch: 0.32,
    distance: 10,
    update(targetX, targetY, targetZ, targetHeading, driving, dt, orbit) {
      this.yaw -= orbit.dx * 0.005;
      this.pitch = clamp(this.pitch + orbit.dy * 0.004, 0.08, 1.1);
      // While driving the camera eases behind the car; on foot it stays free.
      if (driving) {
        const behind = targetHeading + Math.PI;
        this.yaw = angleLerp(this.yaw, behind, Math.min(1, dt * 1.8));
      }
      const dist = driving ? 13 : 9.5;
      const height = driving ? 5 : 3.6;
      this.distance = lerp(this.distance, dist, Math.min(1, dt * 3));
      const cx = targetX - Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
      const cz = targetZ - Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;
      const cy = targetY + Math.sin(this.pitch) * this.distance + height * 0.4;
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(targetX, targetY + 1.6, targetZ);
    },
    resize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    },
  };
}

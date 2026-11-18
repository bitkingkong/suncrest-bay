// Suncrest Bay — combat and pickups.
// Fists at close range, a hitscan pistol with a 12-round magazine, and the
// pickups scattered around the city: green crosses heal, yellow boxes give
// ammo. Damage numbers live here; the world decides who gets hurt and what
// a crime is worth in wanted stars.
import * as THREE from 'three';
import { PICKUPS, PLAYER } from './config.js';
import { dist2d } from './random.js';

const MEDKIT_COLOR = 0x37c978;
const AMMO_COLOR = 0xe0b93c;

function makePickupMesh(kind) {
  const group = new THREE.Group();
  const color = kind === 'medkit' ? MEDKIT_COLOR : AMMO_COLOR;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ color }));
  box.position.y = 0.7;
  box.castShadow = true;
  group.add(box);
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.94, 0.2, 0.94),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  band.position.y = 0.7;
  group.add(band);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(1.1, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.06;
  group.add(glow);
  return group;
}

export function spawnPickups(scene, rng) {
  const pickups = [];
  const spots = [
    { x: -78, z: 26, kind: 'medkit' },
    { x: 78, z: -78, kind: 'medkit' },
    { x: 26, z: 104, kind: 'medkit' },
    { x: -104, z: -52, kind: 'ammo' },
    { x: 104, z: -26, kind: 'ammo' },
    { x: -26, z: -78, kind: 'ammo' },
    { x: 52, z: 52, kind: 'medkit' },
    { x: -52, z: 52, kind: 'ammo' },
  ];
  for (const s of spots) {
    const mesh = makePickupMesh(s.kind);
    mesh.position.set(s.x, 0, s.z);
    scene.add(mesh);
    pickups.push({ mesh, kind: s.kind, x: s.x, z: s.z, taken: false, bob: rng.range(0, Math.PI * 2) });
  }
  return pickups;
}

// Spin the pickup boxes; collect one when the player walks over it.
// Returns 'medkit' | 'ammo' | null.
export function stepPickups(pickups, playerX, playerZ, time) {
  for (const p of pickups) {
    if (p.taken) continue;
    p.mesh.rotation.y = time * 1.2;
    p.mesh.children[0].position.y = 0.7 + Math.sin(time * 2 + p.bob) * 0.12;
    if (dist2d(playerX, playerZ, p.x, p.z) < 1.6) {
      p.taken = true;
      p.mesh.visible = false;
      return p.kind;
    }
  }
  return null;
}

export function respawnPickup(p) {
  p.taken = false;
  p.mesh.visible = true;
}

// A punch: the nearest living person within range and in front takes damage.
// Returns the victim or null.
export function punchAttack(playerX, playerZ, heading, targets) {
  let best = null;
  let bestD = PLAYER.punchRange;
  for (const t of targets) {
    if (!t.alive) continue;
    const d = dist2d(playerX, playerZ, t.x, t.z);
    if (d > PLAYER.punchRange) continue;
    const angle = Math.atan2(t.x - playerX, t.z - playerZ);
    let diff = angle - heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > 1.2) continue;
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  if (best) best.hp -= PLAYER.punchDamage;
  return best;
}

// A pistol shot: a hitscan ray from the camera through the crosshair.
// Returns the first living target the ray passes near, or null.
export function shootRay(origin, direction, targets) {
  const ray = new THREE.Ray(origin, direction.clone().normalize());
  let best = null;
  let bestT = PLAYER.pistolRange;
  const point = new THREE.Vector3();
  for (const t of targets) {
    if (!t.alive) continue;
    const centre = new THREE.Vector3(t.x, 1.1, t.z);
    const hit = ray.intersectSphere({ center: centre, radius: 1.0 }, point);
    if (!hit) continue;
    const d = origin.distanceTo(point);
    if (d < bestT) {
      bestT = d;
      best = t;
    }
  }
  if (best) best.hp -= PLAYER.pistolDamage;
  return best;
}

// A short-lived tracer line so the player sees where the shot went.
export function makeTracer(scene, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  scene.add(line);
  return { line, life: 0.09 };
}

export function stepTracer(tracer, dt) {
  tracer.life -= dt;
  if (tracer.life <= 0) {
    tracer.line.parent?.remove(tracer.line);
    tracer.line.geometry.dispose();
    tracer.line.material.dispose();
    return true;
  }
  return false;
}

export { PICKUPS, PLAYER };

// Combat: fists and a hitscan pistol, player health, and medkit/ammo pickups
// scattered around the city. Damage numbers are simple and readable.
import * as THREE from 'three';
import { CITY } from './config.js';
import { dist2D, pick } from './random.js';

export function createCombat(scene, random) {
  const pickups = [];
  const medGeo = new THREE.BoxGeometry(0.8, 0.5, 0.8);
  const medMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xe02020 });
  const ammoGeo = new THREE.BoxGeometry(0.7, 0.4, 0.7);
  const ammoMat = new THREE.MeshLambertMaterial({ color: 0x2a4a2a });
  const spots = [
    { x: -110, z: -110, kind: 'med' }, { x: 98, z: 98, kind: 'med' },
    { x: -58, z: 46, kind: 'ammo' }, { x: 46, z: -58, kind: 'ammo' },
    { x: 98, z: -110, kind: 'med' }, { x: -110, z: 72, kind: 'ammo' },
  ];
  for (const spot of spots) {
    const group = new THREE.Group();
    if (spot.kind === 'med') {
      const box = new THREE.Mesh(medGeo, medMat);
      box.castShadow = true;
      group.add(box);
      const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.16), crossMat);
      c1.position.y = 0.26;
      const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.6), crossMat);
      c2.position.y = 0.26;
      group.add(c1);
      group.add(c2);
    } else {
      const box = new THREE.Mesh(ammoGeo, ammoMat);
      box.castShadow = true;
      group.add(box);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), new THREE.MeshBasicMaterial({ color: 0xe8c832 }));
      top.position.y = 0.26;
      group.add(top);
    }
    group.position.set(spot.x, 0.4, spot.z);
    scene.add(group);
    pickups.push({ mesh: group, x: spot.x, z: spot.z, kind: spot.kind, taken: false, respawn: 0 });
  }
  // Tracer line for gunshots.
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.frustumCulled = false;
  scene.add(tracer);
  return {
    health: 100,
    ammo: 12,
    magSize: 12,
    reloadTimer: 0,
    punchTimer: 0,
    pickups,
    tracer, tracerTimer: 0,
  };
}

// Melee: hits the nearest person in front of the player within range.
export function tryPunch(combat, player, people, onHit) {
  if (combat.punchTimer > 0) return false;
  combat.punchTimer = 0.45;
  const px = player.x;
  const pz = player.z;
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  let best = null;
  let bestD = 2.4;
  for (const person of people) {
    if (person.health <= 0 || person.state === 'down') continue;
    const d = dist2D(px, pz, person.x, person.z);
    if (d > bestD) continue;
    const dx = (person.x - px) / d;
    const dz = (person.z - pz) / d;
    if (dx * fx + dz * fz < 0.3) continue;
    best = person;
    bestD = d;
  }
  if (best) {
    best.health -= 25;
    if (best.health <= 0 && !best.cop) {
      best.state = 'down';
      best.downTimer = 8;
    }
    if (onHit) onHit(best);
    return true;
  }
  return false;
}

// Hitscan pistol: fires from the camera toward the crosshair centre. Returns the
// person hit (or null) and the end point for the tracer.
export function tryShoot(combat, origin, direction, people, cars) {
  if (combat.reloadTimer > 0 || combat.ammo <= 0) return null;
  combat.ammo -= 1;
  const range = 60;
  let best = null;
  let bestT = range;
  const targets = [];
  for (const person of people) {
    if (person.health <= 0 || person.state === 'down') continue;
    targets.push({ obj: person, x: person.x, y: 1.2, z: person.z, radius: 0.7 });
  }
  for (const car of cars) {
    targets.push({ obj: car, x: car.x, y: 0.9, z: car.z, radius: 2.4 });
  }
  for (const t of targets) {
    const ox = t.x - origin.x;
    const oy = t.y - origin.y;
    const oz = t.z - origin.z;
    const along = ox * direction.x + oy * direction.y + oz * direction.z;
    if (along < 0 || along > bestT) continue;
    const px = origin.x + direction.x * along;
    const py = origin.y + direction.y * along;
    const pz = origin.z + direction.z * along;
    const miss = Math.hypot(t.x - px, t.y - py, t.z - pz);
    if (miss < t.radius && along < bestT) {
      best = t;
      bestT = along;
    }
  }
  const end = {
    x: origin.x + direction.x * bestT,
    y: origin.y + direction.y * bestT,
    z: origin.z + direction.z * bestT,
  };
  combat.tracer.geometry.setFromPoints([new THREE.Vector3(origin.x, origin.y, origin.z), new THREE.Vector3(end.x, end.y, end.z)]);
  combat.tracer.material.opacity = 0.9;
  combat.tracerTimer = 0.08;
  if (best) {
    if (best.obj.health !== undefined) {
      best.obj.health -= 34;
      if (best.obj.health <= 0 && !best.obj.cop && best.obj.state) {
        best.obj.state = 'down';
        best.obj.downTimer = 8;
      }
    }
    return best.obj;
  }
  return null;
}

export function stepCombat(combat, dt, player, onPickup) {
  combat.punchTimer = Math.max(0, combat.punchTimer - dt);
  combat.reloadTimer = Math.max(0, combat.reloadTimer - dt);
  if (combat.tracerTimer > 0) {
    combat.tracerTimer -= dt;
    if (combat.tracerTimer <= 0) combat.tracer.material.opacity = 0;
  }
  for (const pickup of combat.pickups) {
    if (pickup.taken) {
      pickup.respawn -= dt;
      if (pickup.respawn <= 0) {
        pickup.taken = false;
        pickup.mesh.visible = true;
      }
      continue;
    }
    pickup.mesh.rotation.y += dt * 1.5;
    pickup.mesh.position.y = 0.4 + Math.sin(performance.now() / 400) * 0.08;
    if (dist2D(player.x, player.z, pickup.x, pickup.z) < 1.6) {
      pickup.taken = true;
      pickup.respawn = 30;
      pickup.mesh.visible = false;
      if (pickup.kind === 'med') combat.health = Math.min(100, combat.health + 40);
      else combat.ammo = Math.min(48, combat.ammo + 12);
      if (onPickup) onPickup(pickup.kind);
    }
  }
}

export { pick };

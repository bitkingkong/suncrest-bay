// Pedestrians and foot police. Peds walk the sidewalks and flee from crime;
// foot cops chase the player on foot when the wanted level is high enough.
import * as THREE from 'three';
import { CITY } from './config.js';
import { clamp, dist2D, pick, range } from './random.js';
import { collideCircle, nearestRoadCenter } from './city.js';

const SHIRTS = [0xd95f4b, 0x4b8fd9, 0x7bc24b, 0xe8c832, 0x9e6fd9, 0xe8e8e8, 0x2a2d34, 0xd97b2e];
const PANTS = [0x2a2d34, 0x4a3a28, 0x5a6a7a, 0x333333];

export function makePersonMesh(shirt, pants, cop = false) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: cop ? 0x1e3a6e : shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: cop ? 0x14263e : pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirtMat);
  body.position.y = 1.05;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skinMat);
  head.position.y = 1.65;
  head.castShadow = true;
  group.add(head);
  if (cop) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.38), new THREE.MeshLambertMaterial({ color: 0x0e1a2e }));
    cap.position.y = 1.86;
    group.add(cap);
  } else {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.36), new THREE.MeshLambertMaterial({ color: 0x2a1c10 }));
    hair.position.y = 1.84;
    group.add(hair);
  }
  const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.14, 0.35, 0);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.14, 0.35, 0);
  group.add(legL);
  group.add(legR);
  const armGeo = new THREE.BoxGeometry(0.14, 0.65, 0.16);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.36, 1.05, 0);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.36, 1.05, 0);
  group.add(armL);
  group.add(armR);
  return { group, legL, legR, armL, armR };
}

function sidewalkPoint(random) {
  const road = pick(random, CITY.roadCenters);
  const along = range(random, -CITY.half + 8, CITY.half - 8);
  const side = random() < 0.5 ? 8 : -8;
  if (random() < 0.5) return { x: road + side, z: along };
  return { x: along, z: road + side };
}

export function createPedestrians(scene, random, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = sidewalkPoint(random);
    const { group, legL, legR, armL, armR } = makePersonMesh(pick(random, SHIRTS), pick(random, PANTS), false);
    group.position.set(p.x, 0, p.z);
    scene.add(group);
    const target = sidewalkPoint(random);
    peds.push({
      mesh: group, legL, legR, armL, armR,
      x: p.x, z: p.z, heading: random() * Math.PI * 2,
      speed: 1 + random() * 0.8,
      target, state: 'walk', health: 100, walkPhase: random() * 10,
      downTimer: 0,
    });
  }
  return peds;
}

export function createFootCop(scene, x, z) {
  const { group, legL, legR, armL, armR } = makePersonMesh(0x1e3a6e, 0x14263e, true);
  group.position.set(x, 0, z);
  scene.add(group);
  return {
    mesh: group, legL, legR, armL, armR,
    x, z, heading: 0, speed: 5.2, health: 50, state: 'chase',
    punchTimer: 0, walkPhase: 0, cop: true,
  };
}

function animateWalk(person, dt, moving) {
  person.walkPhase += dt * (moving ? 9 : 2);
  const swing = moving ? Math.sin(person.walkPhase) * 0.5 : 0;
  person.legL.rotation.x = swing;
  person.legR.rotation.x = -swing;
  person.armL.rotation.x = -swing * 0.7;
  person.armR.rotation.x = swing * 0.7;
}

export function stepPedestrians(peds, dt, random, colliders, crimePoint) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      ped.mesh.rotation.x = -Math.PI / 2 + 0.2;
      if (ped.downTimer <= 0) {
        ped.state = 'walk';
        ped.mesh.rotation.x = 0;
        ped.health = 100;
      }
      continue;
    }
    // Flee if a crime just happened nearby.
    if (crimePoint && dist2D(ped.x, ped.z, crimePoint.x, crimePoint.z) < 25) {
      ped.state = 'flee';
      ped.fleeFrom = { x: crimePoint.x, z: crimePoint.z };
      ped.fleeTimer = 4;
    }
    let speed = ped.speed;
    let tx;
    let tz;
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const dx = ped.x - ped.fleeFrom.x;
      const dz = ped.z - ped.fleeFrom.z;
      const d = Math.hypot(dx, dz) || 1;
      tx = ped.x + (dx / d) * 10;
      tz = ped.z + (dz / d) * 10;
      speed = 4.5;
      if (ped.fleeTimer <= 0) ped.state = 'walk';
    } else {
      tx = ped.target.x;
      tz = ped.target.z;
      if (dist2D(ped.x, ped.z, tx, tz) < 2) ped.target = sidewalkPoint(random);
    }
    const dx = tx - ped.x;
    const dz = tz - ped.z;
    const d = Math.hypot(dx, dz) || 1;
    const want = Math.atan2(dx, dz);
    let diff = want - ped.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.heading += clamp(diff, -3 * dt, 3 * dt);
    const nx = ped.x + Math.sin(ped.heading) * speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * speed * dt;
    const resolved = collideCircle(colliders, nx, nz, 0.5);
    ped.x = clamp(resolved.x, -CITY.half, CITY.half + 20);
    ped.z = clamp(resolved.z, -CITY.half, CITY.half + 20);
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    animateWalk(ped, dt, true);
  }
}

export function stepFootCop(cop, playerX, playerZ, playerInCar, dt, colliders) {
  if (cop.health <= 0) return false;
  const d = dist2D(cop.x, cop.z, playerX, playerZ);
  if (playerInCar || d > 60) {
    // Stand at the nearest road and wait.
    cop.mesh.position.set(cop.x, 0, cop.z);
    animateWalk(cop, dt, false);
    return false;
  }
  const want = Math.atan2(playerX - cop.x, playerZ - cop.z);
  let diff = want - cop.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  cop.heading += clamp(diff, -4 * dt, 4 * dt);
  const nx = cop.x + Math.sin(cop.heading) * cop.speed * dt;
  const nz = cop.z + Math.cos(cop.heading) * cop.speed * dt;
  const resolved = collideCircle(colliders, nx, nz, 0.5);
  cop.x = resolved.x;
  cop.z = resolved.z;
  cop.mesh.position.set(cop.x, 0, cop.z);
  cop.mesh.rotation.y = cop.heading;
  animateWalk(cop, dt, true);
  // Punch when close.
  cop.punchTimer -= dt;
  if (d < 1.6 && cop.punchTimer <= 0) {
    cop.punchTimer = 1.0;
    return true;
  }
  return false;
}

export { nearestRoadCenter };

// Suncrest Bay — pedestrians and foot police.
// People are small box-built figures: torso, head, two arms and two legs.
// The mesh record keeps `legs` as { legL, legR } so the walk animation in
// world.js swings the right pivots, and `arms` the same way. Pedestrians
// stroll the sidewalks and run from trouble; foot police chase the player
// on foot when the heat is on and can bust them.
import * as THREE from 'three';
import { ROAD_CENTRES, TRAFFIC } from './config.js';
import { angleDelta, clamp, dist2d } from './random.js';

const SHIRTS = [0xd94f30, 0x2e6fb0, 0xe0b93c, 0x4f8f5a, 0x8a6fb0, 0xd8d8d8, 0xc98a2e, 0x7fb0b8, 0xb03a5a, 0x5a6b7a];
const SKINS = [0xe8b88a, 0xc98a5a, 0x8a5a30, 0xf0c8a0, 0xa06a42];

export function makePersonMesh(shirtHex, skinHex = 0xe8b88a, isPolice = false) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtHex });
  const skin = new THREE.MeshLambertMaterial({ color: skinHex });
  const pants = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1c2a4a : 0x2e3a4a });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skin);
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);

  if (isPolice) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.36), new THREE.MeshLambertMaterial({ color: 0x14203a }));
    cap.position.y = 1.76;
    group.add(cap);
  } else {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.34), new THREE.MeshLambertMaterial({ color: 0x2a1c10 }));
    hair.position.y = 1.74;
    group.add(hair);
  }

  const legGeo = new THREE.BoxGeometry(0.2, 0.72, 0.22);
  legGeo.translate(0, -0.36, 0);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.14, 0.74, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.14, 0.74, 0);
  legR.castShadow = true;
  group.add(legR);

  const armGeo = new THREE.BoxGeometry(0.15, 0.58, 0.18);
  armGeo.translate(0, -0.29, 0);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.34, 1.32, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.34, 1.32, 0);
  group.add(armR);

  return { group, legs: { legL, legR }, arms: { armL, armR }, torso, head };
}

export function makePlayerMesh() {
  // Jax Marlowe: teal jacket, dark jeans, the one face the camera follows.
  const person = makePersonMesh(0x1f8a7a, 0xe8b88a, false);
  return person;
}

// A pedestrian record: position, heading, speed, mesh and mood.
export function makePed(scene, rng, x, z) {
  const shirt = SHIRTS[rng.int(0, SHIRTS.length - 1)];
  const skin = SKINS[rng.int(0, SKINS.length - 1)];
  const person = makePersonMesh(shirt, skin, false);
  person.group.position.set(x, 0, z);
  scene.add(person.group);
  return {
    mesh: person.group,
    legs: person.legs,
    arms: person.arms,
    x,
    z,
    heading: rng.range(0, Math.PI * 2),
    speed: rng.range(TRAFFIC.pedSpeedMin, TRAFFIC.pedSpeedMax),
    walkPhase: rng.range(0, Math.PI * 2),
    fleeing: false,
    hp: 100,
    alive: true,
  };
}

export function spawnPeds(scene, rng) {
  const peds = [];
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    // On a sidewalk: just off a road centre line, anywhere along it.
    const road = ROAD_CENTRES[rng.int(0, ROAD_CENTRES.length - 1)];
    const side = rng.pick([-8.5, 8.5]);
    const alongX = rng.chance(0.5);
    const x = alongX ? rng.range(-120, 120) : road + side;
    const z = alongX ? road + side : rng.range(-120, 120);
    peds.push(makePed(scene, rng, x, z));
  }
  return peds;
}

export function makeFootCop(scene, x, z) {
  const person = makePersonMesh(0x1c2a4a, 0xe8b88a, true);
  person.group.position.set(x, 0, z);
  scene.add(person.group);
  return {
    mesh: person.group,
    legs: person.legs,
    arms: person.arms,
    x,
    z,
    heading: 0,
    speed: 5.2,
    walkPhase: 0,
    hp: 50,
    alive: true,
    punchCooldown: 0,
  };
}

// Swing the legs and arms for one step of walking.
export function animateWalk(person, phase, amount = 1) {
  const swing = Math.sin(phase) * 0.55 * amount;
  person.legs.legL.rotation.x = swing;
  person.legs.legR.rotation.x = -swing;
  person.arms.armL.rotation.x = -swing * 0.7;
  person.arms.armR.rotation.x = swing * 0.7;
}

export function syncPersonMesh(person) {
  person.mesh.position.set(person.x, 0, person.z);
  person.mesh.rotation.y = person.heading;
}

// Pedestrians stroll along the sidewalk; when a crime happens nearby they
// run away from it. Returns nothing; mutates the ped.
export function stepPed(ped, dt, city, threat) {
  if (!ped.alive) return;
  let speed = ped.speed;
  if (threat && dist2d(ped.x, ped.z, threat.x, threat.z) < 14) {
    ped.fleeing = true;
    ped.heading = Math.atan2(ped.x - threat.x, ped.z - threat.z);
    speed = ped.speed * 3.2;
  } else if (ped.fleeing && (!threat || dist2d(ped.x, ped.z, threat.x, threat.z) > 30)) {
    ped.fleeing = false;
  }
  if (!ped.fleeing && Math.random() < 0.004) {
    ped.heading += (Math.random() - 0.5) * 1.6;
  }
  const nx = ped.x + Math.sin(ped.heading) * speed * dt;
  const nz = ped.z + Math.cos(ped.heading) * speed * dt;
  const solved = city.resolveCollision(nx, nz, 0.4);
  if (solved.hit) {
    ped.heading += Math.PI / 2;
  } else {
    ped.x = solved.x;
    ped.z = solved.z;
  }
  const clamped = city.clampToCity(ped.x, ped.z, 2);
  ped.x = clamped.x;
  ped.z = clamped.z;
  ped.walkPhase += dt * speed * 2.4;
  animateWalk(ped, ped.walkPhase, clamp(speed / 2, 0.2, 1.4));
  syncPersonMesh(ped);
}

// A foot cop runs at the player; returns the distance to the player.
export function stepFootCop(cop, targetX, targetZ, dt, city) {
  if (!cop.alive) return Infinity;
  const dx = targetX - cop.x;
  const dz = targetZ - cop.z;
  const want = Math.atan2(dx, dz);
  cop.heading += clamp(angleDelta(cop.heading, want), -3.2 * dt, 3.2 * dt);
  const dist = Math.sqrt(dx * dx + dz * dz);
  const speed = dist > 3 ? cop.speed : cop.speed * 0.4;
  const nx = cop.x + Math.sin(cop.heading) * speed * dt;
  const nz = cop.z + Math.cos(cop.heading) * speed * dt;
  const solved = city.resolveCollision(nx, nz, 0.4);
  if (!solved.hit) {
    cop.x = solved.x;
    cop.z = solved.z;
  }
  cop.walkPhase += dt * speed * 2.4;
  animateWalk(cop, cop.walkPhase, 1);
  syncPersonMesh(cop);
  return dist;
}

// Suncrest Bay — cars.
// One factory builds every car in the city: the player's stolen rides, the
// parked cars (including the red Comet GT), the traffic and the police
// interceptors. EVERY car carries `wheels` and `lightBar` (null when it has
// no light bar), because the driving code spins the wheels and flashes the
// bar on whatever car the player happens to be sitting in.
import * as THREE from 'three';
import { CAR, ROAD_CENTRES, TRAFFIC } from './config.js';
import { angleDelta, clamp } from './random.js';

const BODY_COLORS = [0xd94f30, 0x2e6fb0, 0xe0b93c, 0x4f8f5a, 0x8a6fb0, 0xd8d8d8, 0x3a3f45, 0xc98a2e, 0x7fb0b8, 0xb03a5a];
const WHEEL_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);

export function makeCarMesh(colorHex, isPolice = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colorHex });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a2027 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc4d8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.3), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.58, 2.1), glass);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  group.add(cabin);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.9), dark);
  hood.position.set(0, 0.9, 1.75);
  group.add(hood);

  // Headlights and tail lights.
  const lightGeo = new THREE.BoxGeometry(0.34, 0.14, 0.06);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  for (const sx of [-0.62, 0.62]) {
    const head = new THREE.Mesh(lightGeo, headMat);
    head.position.set(sx, 0.62, 2.16);
    group.add(head);
    const tail = new THREE.Mesh(lightGeo, tailMat);
    tail.position.set(sx, 0.62, -2.16);
    group.add(tail);
  }

  // Wheels: spun by the driving code, so they must exist on every car.
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  let lightBar = null;
  if (isPolice) {
    // White body, blue stripe, red/blue light bar on the roof.
    body.material = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.14, 4.32), new THREE.MeshLambertMaterial({ color: 0x1c4fd0 }));
    stripe.position.y = 0.72;
    group.add(stripe);
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.x = -0.3;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.x = 0.3;
    lightBar.add(red);
    lightBar.add(blue);
    lightBar.position.set(0, 1.48, -0.25);
    lightBar.userData = { red, blue };
    group.add(lightBar);
  }

  return { mesh: group, wheels, lightBar };
}

// A full car record. `kind` is 'parked' | 'traffic' | 'police'.
export function makeCar(scene, { x, z, heading = 0, color = 0xd94f30, kind = 'parked', isPolice = false, comet = false, speed = 0 } = {}) {
  const { mesh, wheels, lightBar } = makeCarMesh(color, isPolice);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  return {
    mesh,
    wheels,
    lightBar,
    x,
    z,
    heading,
    speed,
    color,
    kind,
    isPolice,
    comet,
    cruise: 0,
    targetHeading: heading,
    flash: 0,
    wheelSpin: 0,
  };
}

// Parked cars dotted along the avenues; one of them is the red Comet GT
// for mission 2, parked in the Downtown lot.
export function spawnParkedCars(scene, rng) {
  const parked = [];
  const spots = [];
  for (const c of ROAD_CENTRES) {
    for (let t = -110; t <= 110; t += 36) {
      spots.push({ x: c + 8.4, z: t + rng.range(-6, 6), heading: Math.PI / 2 });
      spots.push({ x: c - 8.4, z: t + 18 + rng.range(-6, 6), heading: -Math.PI / 2 });
    }
  }
  // Thin the spots out so the streets are not a car park.
  const chosen = spots.filter(() => rng.chance(0.22)).slice(0, 16);
  chosen.forEach((s, i) => {
    parked.push(makeCar(scene, { x: s.x, z: s.z, heading: s.heading, color: BODY_COLORS[i % BODY_COLORS.length], kind: 'parked' }));
  });
  // The Comet GT: bright red, in the Downtown lot.
  parked.push(makeCar(scene, { x: 26, z: -26, heading: Math.PI / 2, color: 0xc01818, kind: 'parked', comet: true }));
  return parked;
}

export function spawnTraffic(scene, rng) {
  const traffic = [];
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const alongX = rng.chance(0.5);
    const road = ROAD_CENTRES[rng.int(0, ROAD_CENTRES.length - 1)];
    const lane = rng.pick([-2.8, 2.8]);
    const x = alongX ? rng.range(-120, 120) : road + lane;
    const z = alongX ? road + lane : rng.range(-120, 120);
    const heading = alongX ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : lane > 0 ? 0 : Math.PI;
    const car = makeCar(scene, {
      x,
      z,
      heading,
      color: BODY_COLORS[rng.int(0, BODY_COLORS.length - 1)],
      kind: 'traffic',
      speed: rng.range(TRAFFIC.carSpeedMin, TRAFFIC.carSpeedMax),
    });
    car.cruise = car.speed;
    traffic.push(car);
  }
  return traffic;
}

// --- driving ----------------------------------------------------------------

function syncCarMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.wheelSpin += car.speed * 0.016;
  for (const wheel of car.wheels) wheel.rotation.x = car.wheelSpin;
  if (car.lightBar) {
    car.flash += 0.016;
    const on = Math.floor(car.flash * 6) % 2 === 0;
    car.lightBar.userData.red.material.color.setHex(on ? 0xff2020 : 0x551010);
    car.lightBar.userData.blue.material.color.setHex(on ? 0x101050 : 0x2040ff);
  }
}

// Drive the player's car for one step. `drive` is {forward, strafe} from input.
export function stepPlayerCar(car, drive, handbrake, dt, city) {
  const forward = drive.forward;
  const steerInput = drive.strafe;
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    car.speed -= car.speed > 0.5 ? CAR.brake * dt : CAR.reverseAccel * dt;
  } else {
    car.speed -= car.speed * CAR.drag * dt;
    if (Math.abs(car.speed) < 0.2) car.speed = 0;
  }
  if (handbrake) car.speed -= car.speed * CAR.handbrake * dt * 0.1;
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const grip = Math.min(1, Math.abs(car.speed) / 8 + 0.25);
  car.heading += steerInput * CAR.steer * dt * grip * (car.speed >= 0 ? 1 : -1);
  // The car moves along its nose.
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const solved = city.resolveCollision(nx, nz, 1.6);
  if (solved.hit) car.speed *= 0.4;
  car.x = solved.x;
  car.z = solved.z;
  const clamped = city.clampToCity(car.x, car.z, 2);
  car.x = clamped.x;
  car.z = clamped.z;
  syncCarMesh(car);
}

// Traffic: follow the lane, turn at random at intersections, never leave town.
export function stepTrafficCar(car, dt, city, rng) {
  const atXCrossing = ROAD_CENTRES.some((c) => Math.abs(car.z - c) < 1.2);
  const atZCrossing = ROAD_CENTRES.some((c) => Math.abs(car.x - c) < 1.2);
  if ((atXCrossing || atZCrossing) && rng.chance(0.02)) {
    // Turn 90 degrees at an intersection, sometimes.
    car.heading += rng.pick([-Math.PI / 2, Math.PI / 2]);
  }
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  if (Math.abs(nx) > 132 || Math.abs(nz) > 132) {
    car.heading += Math.PI;
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
  } else {
    const solved = city.resolveCollision(nx, nz, 1.6);
    if (solved.hit) {
      car.heading += Math.PI / 2;
    } else {
      car.x = nx;
      car.z = nz;
    }
  }
  // Ease back to cruising speed.
  car.speed += (car.cruise - car.speed) * dt;
  syncCarMesh(car);
}

// A police interceptor chasing a point: steer toward it, ram on contact.
// `car.chaseOffset` is a lateral offset (metres) so several interceptors
// fan out instead of queuing on the same line.
export function stepPoliceCar(car, targetX, targetZ, dt, city) {
  const lat = car.chaseOffset || 0;
  const tx = targetX - Math.cos(car.heading) * lat;
  const tz = targetZ + Math.sin(car.heading) * lat;
  const dx = tx - car.x;
  const dz = tz - car.z;
  const want = Math.atan2(dx, dz);
  const turn = clamp(angleDelta(car.heading, want), -2.4 * dt, 2.4 * dt);
  car.heading += turn;
  const dist = Math.sqrt(dx * dx + dz * dz);
  // Interceptors are faster than a player's top speed up close, or a
  // straight-line escape would always work: 34 / 36 / 38 vs the player's 34.
  const targetSpeed = dist > 26 ? 38 : dist > 8 ? 36 : 34;
  car.speed += (targetSpeed - car.speed) * dt * 0.9;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const solved = city.resolveCollision(nx, nz, 1.6);
  if (solved.hit) car.speed *= 0.3;
  car.x = solved.x;
  car.z = solved.z;
  syncCarMesh(car);
  // Return the true distance to the player (not to the offset aim point):
  // the world uses it for the ram check.
  return Math.sqrt((targetX - car.x) ** 2 + (targetZ - car.z) ** 2);
}

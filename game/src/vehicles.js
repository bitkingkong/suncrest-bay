// Cars: mesh factory, arcade driving, traffic AI on the road grid, and parked
// cars (including the mission Comet GT). All meshes are boxes and cylinders.
import * as THREE from 'three';
import { CAR, CITY } from './config.js';
import { clamp, dist2D, pick } from './random.js';
import { collideCircle } from './city.js';

const BODY_COLORS = [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa655, 0xe8e8e8, 0x22242a, 0x7a4a9e, 0xd97b2e];

export function makeCarMesh(color, police = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? 0xf0f0f0 : color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2028 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.75, 2.0), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.65, 1.8), darkMat);
  cabin.position.set(-0.2, 1.2, 0);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelPositions = [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]];
  const wheels = [];
  for (const [wx, wz] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.38, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const z of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.35), headMat);
    head.position.set(2.22, 0.6, z);
    group.add(head);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const z of [-0.7, 0.7]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.35), tailMat);
    tail.position.set(-2.22, 0.6, z);
    group.add(tail);
  }
  let lightBar = null;
  if (police) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(0, 0, -0.45);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0, 0, 0.45);
    bar.add(red);
    bar.add(blue);
    bar.position.set(-0.2, 1.65, 0);
    group.add(bar);
    lightBar = { red: red.material, blue: blue.material, phase: 0 };
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.42, 0.2, 2.02), new THREE.MeshLambertMaterial({ color: 0x2040c0 }));
    stripe.position.y = 0.55;
    group.add(stripe);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group, wheels, lightBar };
}

// A drivable car: position, heading, speed, and arcade physics.
export function createPlayerCar(scene, color, x, z, heading) {
  const { group, wheels, lightBar } = makeCarMesh(color, false);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  const car = {
    mesh: group,
    wheels,
    lightBar,
    x, z, heading,
    speed: 0,
    color,
    isPlayer: true,
    police: false,
  };
  return car;
}

export function stepPlayerCar(car, input, dt, colliders, others) {
  const forward = input.moveY();
  const steer = input.moveX();
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    car.speed -= car.speed > 0.5 ? CAR.brake * dt : CAR.reverseAccel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  if (input.handbrake()) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.handbrake * dt);
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const steerAmount = steer * CAR.steerRate * dt * clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.heading -= steerAmount;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const resolved = collideCircle(colliders, nx, nz, CAR.radius);
  if (resolved.hit && Math.abs(car.speed) > 3) car.speed *= 0.4;
  car.x = clamp(resolved.x, -CITY.half - 6, CITY.half + 24);
  car.z = clamp(resolved.z, -CITY.half - 6, CITY.half + 24);
  // Gentle push away from other cars.
  for (const other of others) {
    if (other === car) continue;
    const d = dist2D(car.x, car.z, other.x, other.z);
    if (d < CAR.radius * 2 && d > 0.01) {
      const push = (CAR.radius * 2 - d) / 2;
      car.x += ((car.x - other.x) / d) * push;
      car.z += ((car.z - other.z) / d) * push;
      car.speed *= 0.85;
    }
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.6;
  for (const w of car.wheels || []) w.rotation.z -= spin;
}

// Traffic: cars that follow the road grid, turning at intersections.
export function createTraffic(scene, random, count, parkingSpots) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const axis = random() < 0.5 ? 'x' : 'z';
    const road = pick(random, CITY.roadCenters);
    const lane = random() < 0.5 ? 3 : -3;
    const along = (random() * 2 - 1) * (CITY.half - 10);
    const color = pick(random, BODY_COLORS);
    const { group, wheels, lightBar } = makeCarMesh(color, false);
    const car = {
      mesh: group, wheels, lightBar, color, axis, road, lane, along,
      dir: random() < 0.5 ? 1 : -1,
      speed: 7 + random() * 4,
      x: 0, z: 0, heading: 0, police: false,
    };
    scene.add(group);
    cars.push(car);
  }
  // Parked cars at spots (stealable). The Comet GT is the mission car.
  const parked = [];
  for (const spot of parkingSpots) {
    if (random() < 0.35 && spot.kind === 'parked') continue;
    const isComet = spot.kind === 'comet';
    const color = isComet ? 0xd21f2b : pick(random, BODY_COLORS);
    const { group, wheels, lightBar } = makeCarMesh(color, false);
    group.position.set(spot.x, 0, spot.z);
    group.rotation.y = spot.heading;
    scene.add(group);
    parked.push({
      mesh: group, wheels, lightBar, color, x: spot.x, z: spot.z, heading: spot.heading,
      speed: 0, parked: true, comet: isComet, police: false,
    });
  }
  return { traffic: cars, parked };
}

export function stepTraffic(cars, dt, random) {
  for (const car of cars) {
    // The player's stolen car is driven by the player, not by traffic AI.
    if (car.isPlayer) continue;
    car.along += car.dir * car.speed * dt;
    if (car.along > CITY.half) car.along = -CITY.half;
    if (car.along < -CITY.half) car.along = CITY.half;
    // At an intersection, sometimes turn onto the crossing road.
    const near = CITY.roadCenters.find((c) => Math.abs(car.along - c) < 1.2);
    if (near !== undefined && random() < 0.02) {
      const newAxis = car.axis === 'x' ? 'z' : 'x';
      const oldRoad = car.road;
      car.axis = newAxis;
      car.road = near;
      car.along = oldRoad;
      car.lane = random() < 0.5 ? 3 : -3;
      car.dir = random() < 0.5 ? 1 : -1;
    }
    if (car.axis === 'x') {
      car.x = car.along;
      car.z = car.road + car.lane;
      car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.x = car.road + car.lane;
      car.z = car.along;
      car.heading = car.dir > 0 ? 0 : Math.PI;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
}

// Police cars: spawn at the city edge, chase the player, ram on contact.
export function createPoliceCar(scene, x, z) {
  const { group, wheels, lightBar } = makeCarMesh(0xf0f0f0, true);
  group.position.set(x, 0, z);
  scene.add(group);
  return {
    mesh: group, wheels, lightBar, x, z, heading: 0, speed: 0,
    color: 0xf0f0f0, police: true, phase: Math.random() * 10,
  };
}

export function stepPoliceCar(car, targetX, targetZ, dt, colliders) {
  const dx = targetX - car.x;
  const dz = targetZ - car.z;
  const dist = Math.hypot(dx, dz) || 1;
  const wantHeading = Math.atan2(dx, dz);
  let diff = wantHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += clamp(diff, -1.6 * dt, 1.6 * dt);
  const targetSpeed = dist > 6 ? 26 : 12;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const resolved = collideCircle(colliders, nx, nz, CAR.radius);
  car.x = clamp(resolved.x, -CITY.half - 6, CITY.half + 24);
  car.z = clamp(resolved.z, -CITY.half - 6, CITY.half + 24);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.6;
  for (const w of car.wheels) w.rotation.z -= spin;
  // Flash the light bar.
  if (car.lightBar) {
    car.phase += dt * 6;
    const on = Math.sin(car.phase) > 0;
    car.lightBar.red.color.setHex(on ? 0xff2020 : 0x550000);
    car.lightBar.blue.color.setHex(on ? 0x101040 : 0x2040ff);
  }
}

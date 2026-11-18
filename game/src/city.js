// Suncrest Bay — the city itself.
// A 5x5-block coastal city built once from the seed: asphalt roads with
// dashes, sidewalks, tower blocks from one InstancedMesh with a painted
// window texture, palms along the beach, lamps, hydrants and bus stops.
// It also owns the collision data: building footprints the player and the
// cars slide around, and the road test the traffic uses.
import * as THREE from 'three';
import { BLOCK_CENTRES, CITY, ROAD_CENTRES } from './config.js';
import { makeOceanTexture, makeRoadTexture, makeSandTexture, makeSidewalkTexture, makeWindowTexture } from './textures.js';
import { clamp } from './random.js';

const PALETTE_TINTS = [0xd8c49a, 0xc9b18a, 0xb7a284, 0x9fb4a4, 0xc2a58e, 0xa8b8c0, 0xd0b48f, 0x8fa3a8];

function canvasTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const half = CITY.half;
  const buildings = []; // {minX,maxX,minZ,maxZ} footprints for collision

  // --- sky, sun and fog -------------------------------------------------
  scene.background = new THREE.Color(0x8fc3e8);
  scene.fog = new THREE.Fog(0x9fc8e8, 180, 520);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.1);
  sun.position.set(90, 160, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));

  // --- ground, beach and ocean ------------------------------------------
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x9db380 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 40, half * 2 + 40), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 40, 26),
    new THREE.MeshLambertMaterial({ map: canvasTexture(makeSandTexture(), 12, 1) }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, half + 13);
  sand.receiveShadow = true;
  scene.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 260, 220),
    new THREE.MeshLambertMaterial({ map: canvasTexture(makeOceanTexture(), 10, 4) }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.01, half + 26 + 110);
  scene.add(ocean);

  // --- roads and sidewalks ----------------------------------------------
  const roadTex = canvasTexture(makeRoadTexture(), 1, 1);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const walkMat = new THREE.MeshLambertMaterial({ map: canvasTexture(makeSidewalkTexture(), 8, 8) });
  for (const c of ROAD_CENTRES) {
    // East-west avenue: long in X, centred on z = c.
    const roadEW = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, CITY.roadWidth), roadMat.clone());
    roadEW.material.map = roadTex.clone();
    roadEW.material.map.repeat.set((half * 2) / 12, 1);
    roadEW.material.map.needsUpdate = true;
    roadEW.rotation.x = -Math.PI / 2;
    roadEW.position.set(0, 0.05, c);
    roadEW.receiveShadow = true;
    scene.add(roadEW);
    // North-south avenue: long in Z, centred on x = c.
    const roadNS = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, CITY.roadWidth), roadMat.clone());
    roadNS.material.map = roadTex.clone();
    roadNS.material.map.repeat.set((half * 2) / 12, 1);
    roadNS.material.map.needsUpdate = true;
    roadNS.rotation.x = -Math.PI / 2;
    roadNS.rotation.z = Math.PI / 2;
    roadNS.position.set(c, 0.05, 0);
    roadNS.receiveShadow = true;
    scene.add(roadNS);
    // Sidewalk ribbons flanking each avenue.
    for (const off of [-CITY.roadWidth / 2 - 2.5, CITY.roadWidth / 2 + 2.5]) {
      const walkEW = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 5), walkMat);
      walkEW.rotation.x = -Math.PI / 2;
      walkEW.position.set(0, 0.04, c + off);
      walkEW.receiveShadow = true;
      scene.add(walkEW);
      const walkNS = new THREE.Mesh(new THREE.PlaneGeometry(5, half * 2), walkMat);
      walkNS.rotation.x = -Math.PI / 2;
      walkNS.position.set(c + off, 0.04, 0);
      walkNS.receiveShadow = true;
      scene.add(walkNS);
    }
  }

  // --- tower blocks (one InstancedMesh, tinted per instance) ------------
  const windowTex = canvasTexture(makeWindowTexture(rng), 1, 1);
  const towerGeo = new THREE.BoxGeometry(1, 1, 1);
  towerGeo.translate(0, 0.5, 0);
  const towerMat = new THREE.MeshLambertMaterial({ map: windowTex });
  const placements = [];
  for (const bx of BLOCK_CENTRES) {
    for (const bz of BLOCK_CENTRES) {
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i += 1) {
        const w = rng.range(13, 24);
        const d = rng.range(13, 24);
        const h = rng.range(16, 52);
        const ox = count === 1 ? 0 : rng.range(-8, 8);
        const oz = count === 1 ? 0 : rng.range(-8, 8);
        const x = bx + ox;
        const z = bz + oz;
        placements.push({ x, z, w, d, h });
        buildings.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }
  const towers = new THREE.InstancedMesh(towerGeo, towerMat, placements.length);
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const tint = new THREE.Color();
  placements.forEach((p, i) => {
    pos.set(p.x, 0, p.z);
    scale.set(p.w, p.h, p.d);
    matrix.compose(pos, quat, scale);
    towers.setMatrixAt(i, matrix);
    tint.setHex(PALETTE_TINTS[i % PALETTE_TINTS.length]);
    towers.setColorAt(i, tint);
  });
  towers.castShadow = true;
  towers.receiveShadow = true;
  scene.add(towers);

  // Roof boxes so the towers read as buildings from above, too.
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6d5b45 });
  const roofs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), roofMat, placements.length);
  placements.forEach((p, i) => {
    pos.set(p.x, p.h + 0.4, p.z);
    scale.set(p.w * 0.7, 0.8, p.d * 0.7);
    matrix.compose(pos, quat, scale);
    roofs.setMatrixAt(i, matrix);
  });
  roofs.castShadow = true;
  scene.add(roofs);

  // --- palms along the beach and the avenues ----------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 7, 6);
  const frondGeo = new THREE.ConeGeometry(2.6, 3.2, 7);
  const palmSpots = [];
  for (let x = -120; x <= 120; x += 24) palmSpots.push([x + rng.range(-4, 4), half + 6 + rng.range(-2, 2)]);
  for (const c of [-78, 26]) for (let z = -120; z <= 100; z += 44) palmSpots.push([c + 8, z]);
  for (const [x, z] of palmSpots) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.castShadow = true;
    scene.add(trunk);
    const fronds = new THREE.Mesh(frondGeo, frondMat);
    fronds.position.set(x, 8.2, z);
    fronds.castShadow = true;
    scene.add(fronds);
  }

  // --- street lamps, hydrants, bus stops --------------------------------
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 6);
  const bulbGeo = new THREE.SphereGeometry(0.32, 8, 6);
  for (const c of ROAD_CENTRES) {
    for (let t = -110; t <= 110; t += 52) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(c + 7, 3, t);
      scene.add(pole);
      const bulb = new THREE.Mesh(bulbGeo, lampMat);
      bulb.position.set(c + 7, 6.2, t);
      scene.add(bulb);
    }
  }
  const hydrantMat = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  const hydrantGeo = new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8);
  for (let i = 0; i < 10; i += 1) {
    const h = new THREE.Mesh(hydrantGeo, hydrantMat);
    h.position.set(rng.range(-120, 120), 0.45, ROAD_CENTRES[rng.int(0, 5)] + 7.5);
    h.castShadow = true;
    scene.add(h);
  }
  const stopMat = new THREE.MeshLambertMaterial({ color: 0x2e6fb0 });
  for (const [x, z] of [[-78, -26], [26, 78], [78, -78]]) {
    const shelter = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 2), stopMat);
    shelter.position.set(x, 2.6, z);
    scene.add(shelter);
    for (const dx of [-1.8, 1.8]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.6, 0.18), poleMat);
      leg.position.set(x + dx, 1.3, z);
      scene.add(leg);
    }
  }

  // --- collision helpers --------------------------------------------------
  function collides(x, z, radius) {
    for (const b of buildings) {
      if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) return b;
    }
    return null;
  }

  // Push a circle out of any building it overlaps; returns the building or null.
  function resolveCollision(x, z, radius) {
    const b = collides(x, z, radius);
    if (!b) return { x, z, hit: null };
    const pushLeft = x + radius - b.minX;
    const pushRight = b.maxX - (x - radius);
    const pushUp = z + radius - b.minZ;
    const pushDown = b.maxZ - (z - radius);
    const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
    if (m === pushLeft) return { x: b.minX - radius, z, hit: b };
    if (m === pushRight) return { x: b.maxX + radius, z, hit: b };
    if (m === pushUp) return { x, z: b.minZ - radius, hit: b };
    return { x, z: b.maxZ + radius, hit: b };
  }

  function onRoad(x, z) {
    for (const c of ROAD_CENTRES) {
      if (Math.abs(x - c) < CITY.roadWidth / 2 + 0.5) return true;
      if (Math.abs(z - c) < CITY.roadWidth / 2 + 0.5) return true;
    }
    return false;
  }

  function clampToCity(x, z, margin = 4) {
    return {
      x: clamp(x, -half - margin, half + margin),
      z: clamp(z, -half - margin, half + 22),
    };
  }

  return { buildings, collides, resolveCollision, onRoad, clampToCity };
}

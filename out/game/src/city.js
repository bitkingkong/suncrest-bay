// Procedural Suncrest Bay: a 5x5 block grid with roads, sidewalks, instanced
// buildings, streetlights, palms, a beach and the sea. Returns the colliders
// (building AABBs), road data for traffic, and parking spots for stealable cars.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { mulberry32, range, rangeInt, pick } from './random.js';
import { buildingTexture, roadTexture, sidewalkTexture, sandTexture } from './textures.js';

function hex(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function createCity(scene, seed) {
  const random = mulberry32(seed);
  const colliders = [];
  const parkingSpots = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  const half = CITY.half;
  const roadW = CITY.roadWidth;

  // Ground: grass-ish base under the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 80, half * 2 + 80),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // Beach + sea on the south edge (positive z).
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 80, 30),
    new THREE.MeshLambertMaterial({ map: sandTexture() }),
  );
  sand.material.map.repeat.set(8, 1);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0, half + 15);
  sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 400, 260),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, half + 160);
  group.add(sea);

  // Roads: dark strips along every road centre line, both axes.
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const c of CITY.roadCenters) {
    for (const axis of ['x', 'z']) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, roadW), roadMat);
      road.material = roadMat;
      road.rotation.x = -Math.PI / 2;
      if (axis === 'x') {
        road.rotation.z = Math.PI / 2;
        road.position.set(c, 0, 0);
      } else {
        road.position.set(0, 0, c);
      }
      road.receiveShadow = true;
      group.add(road);
    }
  }

  // Sidewalks: light strips flanking each road, one per block edge.
  const walkTex = sidewalkTexture();
  const walkMat = new THREE.MeshLambertMaterial({ map: walkTex });
  walkTex.repeat.set(20, 1);
  for (const c of CITY.roadCenters) {
    for (const off of [-8, 8]) {
      for (const axis of ['x', 'z']) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, 4), walkMat);
        walk.rotation.x = -Math.PI / 2;
        if (axis === 'x') {
          walk.rotation.z = Math.PI / 2;
          walk.position.set(c + off, 0.02, 0);
        } else {
          walk.position.set(0, 0.02, c + off);
        }
        walk.receiveShadow = true;
        group.add(walk);
      }
    }
  }

  // Centre dashes on each road.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8b0 });
  const dashGeo = new THREE.PlaneGeometry(3, 0.35);
  for (const c of CITY.roadCenters) {
    for (let t = -half + 6; t < half - 6; t += 12) {
      for (const axis of ['x', 'z']) {
        const dash = new THREE.Mesh(dashGeo, dashMat);
        dash.rotation.x = -Math.PI / 2;
        if (axis === 'x') {
          dash.rotation.z = Math.PI / 2;
          dash.position.set(c, 0.03, t);
        } else {
          dash.position.set(t, 0.03, c);
        }
        group.add(dash);
      }
    }
  }

  // Buildings: one InstancedMesh per facade variant, boxes scaled per instance.
  const variants = PALETTE.building.slice(0, 4).map((color, i) => ({
    texture: buildingTexture(hex(color), seed + i * 977),
    count: 0,
  }));
  const placements = [];
  for (const bx of CITY.blockCenters) {
    for (const bz of CITY.blockCenters) {
      const n = rangeInt(random, 2, 4);
      for (let i = 0; i < n; i += 1) {
        const w = range(random, 12, 18);
        const d = range(random, 12, 18);
        const h = range(random, 10, 42);
        const x = bx + range(random, -10, 10);
        const z = bz + range(random, -10, 10);
        placements.push({ x, z, w, d, h, variant: rangeInt(random, 0, variants.length - 1) });
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  for (const [vi, variant] of variants.entries()) {
    const list = placements.filter((p) => p.variant === vi);
    if (list.length === 0) continue;
    const mesh = new THREE.InstancedMesh(
      boxGeo,
      new THREE.MeshLambertMaterial({ map: variant.texture }),
      list.length,
    );
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const pos = new THREE.Vector3();
    list.forEach((p, i) => {
      pos.set(p.x, 0, p.z);
      scale.set(p.w, p.h, p.d);
      matrix.compose(pos, quat, scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Rooftop boxes on a few tall buildings (water towers / AC units).
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5f66 });
  for (const p of placements) {
    if (p.h < 28 || random() < 0.6) continue;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), roofMat);
    roof.position.set(p.x + range(random, -4, 4), p.h + 1, p.z + range(random, -4, 4));
    roof.castShadow = true;
    group.add(roof);
  }

  // Streetlights at intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const lampGeo = new THREE.SphereGeometry(0.35, 8, 6);
  for (const cx of CITY.roadCenters) {
    for (const cz of CITY.roadCenters) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(cx + 7, 3, cz + 7);
      pole.castShadow = true;
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(cx + 7, 6.1, cz + 7);
      group.add(lamp);
    }
  }

  // Palms along the beach and a few on sidewalks.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const leafGeo = new THREE.ConeGeometry(2.2, 2.5, 6);
  for (let i = 0; i < 26; i += 1) {
    const x = range(random, -half, half);
    const z = i < 14 ? range(random, half + 4, half + 26) : pick(random, CITY.blockCenters) + range(random, -14, 14);
    const px = i < 14 ? x : range(random, -half, half);
    const pz = i < 14 ? z : pick(random, CITY.blockCenters) + range(random, -14, 14);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(px, 3.5, pz);
    trunk.castShadow = true;
    group.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(px, 8, pz);
    leaves.castShadow = true;
    group.add(leaves);
  }

  // Parking spots: along road edges, a few per avenue. The Comet GT (mission 2)
  // parks in the Downtown lot near (20, 20).
  for (const c of CITY.roadCenters) {
    for (let t = -100; t <= 100; t += 34) {
      if (random() < 0.45) continue;
      parkingSpots.push({ x: c + 4.4, z: t, heading: Math.PI / 2, kind: 'parked' });
      parkingSpots.push({ x: c - 4.4, z: t + 17, heading: -Math.PI / 2, kind: 'parked' });
    }
  }
  parkingSpots.push({ x: 24, z: 26, heading: 0, kind: 'comet' });

  return { group, colliders, parkingSpots, roadCenters: CITY.roadCenters };
}

// Circle (x, z, radius) vs building AABBs: push the circle out, return true on hit.
export function collideCircle(colliders, x, z, radius) {
  let hit = false;
  let nx = x;
  let nz = z;
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(nx, b.maxX));
    const cz = Math.max(b.minZ, Math.min(nz, b.maxZ));
    const dx = nx - cx;
    const dz = nz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * radius;
        nz = cz + (dz / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pl = nx - b.minX;
        const pr = b.maxX - nx;
        const pt = nz - b.minZ;
        const pb = b.maxZ - nz;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) nx = b.minX - radius;
        else if (m === pr) nx = b.maxX + radius;
        else if (m === pt) nz = b.minZ - radius;
        else nz = b.maxZ + radius;
      }
    }
  }
  return { hit, x: nx, z: nz };
}

export function nearestRoadCenter(value) {
  let best = CITY.roadCenters[0];
  for (const c of CITY.roadCenters) {
    if (Math.abs(c - value) < Math.abs(best - value)) best = c;
  }
  return best;
}

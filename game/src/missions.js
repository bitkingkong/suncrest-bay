// Suncrest Bay — the three-mission story chain.
// Missions are a small state machine: each mission has stages with a
// target point, a radius and an objective line for the HUD. The world owns
// the money and the wanted level; this module only says what the current
// objective is, where its marker stands, and what happens when the player
// reaches it. Markers are a pillar of light plus a floating diamond.
import * as THREE from 'three';
import { MISSIONS, PLACES } from './config.js';
import { dist2d } from './random.js';

// Stage targets per mission, in order. `at` names a place; `radius` how
// close the player must get; `text` is the HUD objective.
const STAGES = [
  [
    { key: 'pickup', at: 'harbor', radius: 6, text: 'Ambil paket di Harbor (ikon merah muda).' },
    { key: 'deliver', at: 'diner', radius: 6, text: 'Antar paket ke Diner Marina sebelum waktu habis!' },
  ],
  [
    { key: 'steal', at: 'downtownLot', radius: 5, text: 'Curi Comet GT merah di lot Downtown (tombol E).' },
    { key: 'garage', at: 'garage', radius: 7, text: 'Bawa Comet GT ke bengkel Dex di Old Town.' },
  ],
  [
    { key: 'survive', at: null, radius: 0, text: 'Bertahan dari polisi — jangan sampai tertangkap!' },
    { key: 'hideout', at: 'hideout', radius: 6, text: 'Lolos! Pergi ke hideout Old Town.' },
  ],
];

export function createMissions(scene) {
  // The light pillar.
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0xff5a8a,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true), pillarMat);
  pillar.visible = false;
  scene.add(pillar);

  // The floating diamond above the target.
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xff5a8a }),
  );
  diamond.visible = false;
  scene.add(diamond);

  const state = {
    index: 0, // which mission (0..2); 3 means the chain is done
    stage: 0, // stage inside the mission
    timer: 0, // seconds left when the mission has a limit, else 0
    active: false,
    done: false,
    hasPackage: false,
    inComet: false,
    surviveLeft: 0,
    elapsed: 0,
  };

  function currentDef() {
    return MISSIONS[state.index] ?? null;
  }

  function currentStage() {
    const stages = STAGES[state.index];
    return stages ? stages[state.stage] ?? null : null;
  }

  function targetPoint() {
    const stage = currentStage();
    if (!stage || !stage.at) return null;
    return PLACES[stage.at];
  }

  function objectiveText() {
    if (state.done) return 'Semua misi selesai! Suncrest Bay milikmu, Jax.';
    if (!state.active) return 'Pergi ke Diner Marina dan bicara dengan Mama Lou (ikon merah muda).';
    const stage = currentStage();
    return stage ? stage.text : '';
  }

  function start(index) {
    state.index = index;
    state.stage = 0;
    state.active = true;
    state.hasPackage = false;
    state.inComet = false;
    const def = MISSIONS[index];
    state.timer = def.timeLimit;
    state.surviveLeft = def.id === 'heat' ? 0 : 0;
    state.elapsed = 0;
    return def.intro;
  }

  function completeMission() {
    const def = currentDef();
    state.active = false;
    state.index += 1;
    state.stage = 0;
    state.timer = 0;
    if (state.index >= MISSIONS.length) state.done = true;
    return def;
  }

  // Advance the mission clock. Returns an event string or null:
  // 'stage' (reached the target), 'complete' (mission done),
  // 'failed' (timer ran out), 'survive-done' (heat survived, go hide).
  function update(dt, playerX, playerZ, inCometCar) {
    if (!state.active || state.done) return null;
    state.elapsed += dt;
    const def = currentDef();
    if (state.timer > 0) {
      state.timer -= dt;
      if (state.timer <= 0) {
        state.timer = 0;
        state.active = false;
        return 'failed';
      }
    }
    const stage = currentStage();
    if (!stage) return null;

    if (state.index === 2 && stage.key === 'survive') {
      // Mission 3, stage 1: survive `timeLimit` seconds at wanted >= 3.
      state.surviveLeft += dt;
      if (state.surviveLeft >= def.timeLimit) {
        state.stage = 1;
        return 'survive-done';
      }
      return null;
    }

    const target = targetPoint();
    if (!target) return null;
    const d = dist2d(playerX, playerZ, target.x, target.z);
    if (d > stage.radius) return null;

    if (state.index === 0 && stage.key === 'pickup') {
      state.hasPackage = true;
      state.stage = 1;
      state.timer = def.timeLimit;
      return 'stage';
    }
    if (state.index === 0 && stage.key === 'deliver') {
      return 'complete';
    }
    if (state.index === 1 && stage.key === 'steal') {
      if (!inCometCar) return null;
      state.inComet = true;
      state.stage = 1;
      return 'stage';
    }
    if (state.index === 1 && stage.key === 'garage') {
      if (!inCometCar) return null;
      return 'complete';
    }
    if (state.index === 2 && stage.key === 'hideout') {
      return 'complete';
    }
    return null;
  }

  // Move the pillar and the diamond to the current target; hide them when idle.
  function updateMarker(time) {
    const target = state.active ? targetPoint() : state.done ? null : PLACES.diner;
    if (!target) {
      pillar.visible = false;
      diamond.visible = false;
      return null;
    }
    pillar.visible = true;
    pillar.position.set(target.x, 15, target.z);
    diamond.visible = true;
    diamond.position.set(target.x, 6 + Math.sin(time * 2) * 0.5, target.z);
    diamond.rotation.y = time * 1.5;
    return target;
  }

  function reset() {
    state.index = 0;
    state.stage = 0;
    state.timer = 0;
    state.active = false;
    state.done = false;
    state.hasPackage = false;
    state.inComet = false;
    state.surviveLeft = 0;
    state.elapsed = 0;
    pillar.visible = false;
    diamond.visible = false;
  }

  return {
    state,
    currentDef,
    currentStage,
    targetPoint,
    objectiveText,
    start,
    completeMission,
    update,
    updateMarker,
    reset,
  };
}

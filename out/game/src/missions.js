// The three-mission story chain. Each mission is a list of objectives; the
// beacon marks the current one. All names, places and dialogue are original.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

export function createMissions(scene) {
  // Beacon: a tall translucent pillar + a floating diamond over the target.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xff5fa2, transparent: true, opacity: 0.28, side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), beaconMat);
  beacon.position.y = 30;
  beacon.visible = false;
  scene.add(beacon);
  const diamondMat = new THREE.MeshBasicMaterial({ color: 0xff5fa2 });
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), diamondMat);
  diamond.visible = false;
  scene.add(diamond);
  return {
    index: -1, // -1 = no mission yet; 0..2 = mission running; 3 = all done
    objectiveIndex: 0,
    timer: 0,
    active: false,
    beacon, diamond,
    completed: [],
    banner: null,
  };
}

export function currentMission(missions) {
  if (missions.index < 0 || missions.index >= MISSIONS.length) return null;
  return MISSIONS[missions.index];
}

export function currentObjective(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  return mission.objectives[missions.objectiveIndex] ?? null;
}

export function startMission(missions, index) {
  missions.index = index;
  missions.objectiveIndex = 0;
  missions.active = true;
  const objective = currentObjective(missions);
  missions.timer = objective && objective.timeLimit ? objective.timeLimit : 0;
  return MISSIONS[index];
}

export function advanceObjective(missions) {
  missions.objectiveIndex += 1;
  const objective = currentObjective(missions);
  if (!objective) {
    // Mission complete.
    const mission = MISSIONS[missions.index];
    missions.completed.push(mission.id);
    missions.active = false;
    missions.beacon.visible = false;
    missions.diamond.visible = false;
    return { done: true, mission };
  }
  missions.timer = objective.timeLimit ? objective.timeLimit : 0;
  return { done: false, objective };
}

export function updateBeacon(missions, time) {
  const objective = currentObjective(missions);
  const show = missions.active && objective && (objective.type === 'goto' || objective.type === 'deliver' || objective.type === 'deliverCar' || objective.type === 'escape');
  missions.beacon.visible = !!show;
  missions.diamond.visible = !!show;
  if (show) {
    missions.beacon.position.set(objective.x, 30, objective.z);
    missions.diamond.position.set(objective.x, 8 + Math.sin(time * 2) * 0.6, objective.z);
    missions.diamond.rotation.y = time * 1.5;
  }
  return objective;
}

export function objectiveText(missions) {
  const mission = currentMission(missions);
  const objective = currentObjective(missions);
  if (!mission || !objective) {
    if (missions.index >= MISSIONS.length) return 'Semua misi selesai. Suncrest Bay milikmu, Jax.';
    return 'Pergi ke Diner Marina dan bicara dengan Mama Lou (ikon merah muda).';
  }
  return `${mission.title}: ${objective.text}`;
}

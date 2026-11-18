// SUNCREST BAY — the world: state, the fixed-step simulation, screens, wanted
// level, missions, save/load, and the wiring between every system.
import * as THREE from 'three';
import { CAR, CITY, MISSIONS, PALETTE, PLAYER, SAVE_KEY, WANTED } from './config.js';
import { mulberry32, clamp, dist2D, angleLerp, pick } from './random.js';
import { createCity, collideCircle, nearestRoadCenter } from './city.js';
import { createRenderer, createScene, createCamera } from './render.js';
import { createInput, ACTION_ENTER, ACTION_PUNCH, ACTION_RELOAD, ACTION_PAUSE, ACTION_MUTE, ACTION_HORN } from './input.js';
import { createAudio } from './audio.js';
import { createPlayerCar, createTraffic, stepTraffic, stepPlayerCar, createPoliceCar, stepPoliceCar } from './vehicles.js';
import { createPedestrians, createFootCop, stepPedestrians, stepFootCop, makePersonMesh } from './people.js';
import { createMissions, currentMission, currentObjective, startMission, advanceObjective, updateBeacon, objectiveText } from './missions.js';
import { createCombat, tryPunch, tryShoot, stepCombat } from './combat.js';
import { createHud } from './hud.js';

const HOSPITAL = { x: -58, z: -58 };
const DINER = { x: 98, z: -110 };

export function createWorld(canvas, seed) {
  const random = mulberry32(seed);
  const renderer = createRenderer(canvas);
  const { scene } = createScene();
  const cameraRig = createCamera();
  const city = createCity(scene, seed);
  const audio = createAudio();
  const hud = createHud();
  const input = createInput(canvas);
  const missions = createMissions(scene);
  const combat = createCombat(scene, random);
  const { traffic, parked } = createTraffic(scene, random, 10, city.parkingSpots);
  const peds = createPedestrians(scene, random, 14);

  // The player: Jax Marlowe, teal jacket, dark jeans.
  const person = makePersonMesh(0x2e8b8b, 0x2a2d34, false);
  person.group.position.set(0, 0, 20);
  scene.add(person.group);

  const state = {
    seed, random, scene, renderer, cameraRig, city, audio, hud, input, missions, combat,
    screen: 'title',
    time: 0,
    player: {
      mesh: person.group, legs: person, x: 0, z: 20, y: 0, vy: 0,
      heading: Math.PI, speed: 0, onGround: true,
    },
    playerCar: null,
    traffic, parked, peds,
    footCops: [],
    policeCars: [],
    wanted: 0,
    wantedTimer: 0,
    crimePoint: null,
    crimeTimer: 0,
    cash: 0,
    bustedTimer: 0,
    shootTimer: 0,
    reloading: false,
    reloadTimer: 0,
    titleOrbit: 0,
    saved: null,
  };

  // Ambient title camera: slow orbit above the city centre.
  function titleCamera(dt) {
    state.titleOrbit += dt * 0.05;
    const r = 150;
    cameraRig.camera.position.set(
      Math.sin(state.titleOrbit) * r, 70, Math.cos(state.titleOrbit) * r,
    );
    cameraRig.camera.lookAt(0, 0, 0);
  }

  function addWanted(stars, x, z) {
    state.wanted = Math.min(WANTED.maxStars, state.wanted + stars);
    state.wantedTimer = WANTED.decaySeconds;
    state.crimePoint = { x, z };
    state.crimeTimer = 3;
    syncPolice();
  }

  function syncPolice() {
    const wantCars = WANTED.policeCars[state.wanted];
    const wantCops = WANTED.footCops[state.wanted];
    while (state.policeCars.length < wantCars) {
      const angle = random() * Math.PI * 2;
      const px = state.player.x + Math.sin(angle) * 70;
      const pz = state.player.z + Math.cos(angle) * 70;
      state.policeCars.push(createPoliceCar(scene, clamp(px, -CITY.half, CITY.half), clamp(pz, -CITY.half, CITY.half)));
    }
    while (state.policeCars.length > wantCars) {
      const car = state.policeCars.pop();
      scene.remove(car.mesh);
    }
    while (state.footCops.length < wantCops) {
      const angle = random() * Math.PI * 2;
      const px = state.player.x + Math.sin(angle) * 25;
      const pz = state.player.z + Math.cos(angle) * 25;
      state.footCops.push(createFootCop(scene, px, pz));
    }
    while (state.footCops.length > wantCops) {
      const cop = state.footCops.pop();
      scene.remove(cop.mesh);
    }
  }

  function nearestCar(maxDist) {
    const list = state.parked.filter((c) => !c.stolen);
    let best = null;
    let bestD = maxDist;
    for (const car of list) {
      const d = dist2D(state.player.x, state.player.z, car.x, car.z);
      if (d < bestD) { best = car; bestD = d; }
    }
    for (const car of state.traffic) {
      if (Math.abs(car.speed) > 2) continue;
      const d = dist2D(state.player.x, state.player.z, car.x, car.z);
      if (d < bestD) { best = car; bestD = d; }
    }
    return best;
  }

  function enterCar(car) {
    state.playerCar = car;
    car.isPlayer = true;
    car.stolen = true;
    state.player.mesh.visible = false;
    // Stealing a car is a crime; taking the mission Comet GT is the job itself.
    const objective = currentObjective(state.missions);
    const isMissionCar = car.comet && objective && objective.type === 'stealCar';
    if (!isMissionCar) addWanted(1, car.x, car.z);
    if (car.parked) {
      state.parked = state.parked.filter((c) => c !== car);
      state.traffic.push(car);
      car.parked = false;
    }
    if (isMissionCar) {
      const res = advanceObjective(state.missions);
      state.hud.banner('Comet GT didapat!', 'Bawa ke bengkel Dex di Old Town.', 3);
      state.audio.jingle();
      void res;
    }
    state.audio.setEngine(0, true);
  }

  function exitCar() {
    const car = state.playerCar;
    if (!car) return;
    car.isPlayer = false;
    car.speed = 0;
    // A formerly parked car re-joins traffic on the nearest road.
    if (car.axis === undefined) {
      car.axis = 'x';
      car.road = nearestRoadCenter(car.z);
      car.along = car.x;
      car.lane = 3;
      car.dir = 1;
    }
    state.playerCar = null;
    state.player.x = car.x + Math.sin(car.heading + Math.PI / 2) * 3;
    state.player.z = car.z + Math.cos(car.heading + Math.PI / 2) * 3;
    state.player.mesh.visible = true;
    state.player.mesh.position.set(state.player.x, 0, state.player.z);
    state.audio.setEngine(0, false);
  }

  function respawn(lostCash) {
    state.cash = Math.max(0, state.cash - lostCash);
    state.player.x = HOSPITAL.x;
    state.player.z = HOSPITAL.z;
    state.player.y = 0;
    state.player.vy = 0;
    if (state.playerCar) {
      state.playerCar.isPlayer = false;
      state.playerCar.speed = 0;
      state.playerCar = null;
      state.player.mesh.visible = true;
    }
    combat.health = 100;
    state.wanted = 0;
    syncPolice();
    state.player.mesh.position.set(state.player.x, 0, state.player.z);
    state.screen = 'play';
    state.hud.showScreen('play');
  }

  function saveGame() {
    try {
      const data = {
        cash: state.cash,
        x: state.player.x, z: state.player.z,
        health: combat.health, ammo: combat.ammo,
        missionIndex: state.missions.index,
        completed: state.missions.completed,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      state.saved = data;
      return true;
    } catch {
      return false;
    }
  }

  function loadGame() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function applySave(data) {
    state.cash = data.cash || 0;
    state.player.x = data.x ?? 0;
    state.player.z = data.z ?? 20;
    combat.health = data.health ?? 100;
    combat.ammo = data.ammo ?? 12;
    state.missions.completed = data.completed || [];
    state.missions.index = (data.missionIndex ?? -1);
    if (state.missions.index >= 0 && state.missions.index < MISSIONS.length) {
      state.missions.objectiveIndex = 0;
      state.missions.active = true;
      const objective = currentObjective(state.missions);
      state.missions.timer = objective && objective.timeLimit ? objective.timeLimit : 0;
    }
    state.player.mesh.position.set(state.player.x, 0, state.player.z);
  }

  function stepMission(dt) {
    const mission = currentMission(state.missions);
    const objective = currentObjective(state.missions);
    if (!mission || !objective) {
      // No active mission: standing at the diner starts the next one.
      if (state.missions.index < MISSIONS.length - 1 || state.missions.index === -1) {
        const next = state.missions.index < 0 ? 0 : state.missions.index + 1;
        if (dist2D(state.player.x, state.player.z, DINER.x, DINER.z) < 8) {
          const started = startMission(state.missions, next);
          state.hud.banner(`${started.title} — ${started.giver}`, started.briefing, 5);
          state.audio.jingle();
        }
      }
      return;
    }
    if (objective.timeLimit) {
      state.missions.timer -= dt;
      if (state.missions.timer <= 0) {
        if (objective.type === 'survive') {
          const res = advanceObjective(state.missions);
          if (!res.done) state.hud.banner('Bertahan!', 'Sekarang capai hideout.', 3);
          else finishMission(res.mission);
        } else {
          // Failed the timer: restart the mission.
          state.missions.objectiveIndex = 0;
          state.missions.timer = objective.timeLimit;
          state.hud.banner('Misi gagal', 'Waktu habis — coba lagi dari awal.', 3);
          state.audio.busted();
        }
        return;
      }
    }
    const px = state.playerCar ? state.playerCar.x : state.player.x;
    const pz = state.playerCar ? state.playerCar.z : state.player.z;
    if (objective.type === 'goto' || objective.type === 'deliver' || objective.type === 'escape') {
      if (dist2D(px, pz, objective.x, objective.z) < objective.radius) {
        const res = advanceObjective(state.missions);
        if (res.done) finishMission(res.mission);
        else state.hud.banner('Objektif selesai', res.objective.text, 3);
      }
    } else if (objective.type === 'deliverCar') {
      if (state.playerCar && state.playerCar.comet && dist2D(px, pz, objective.x, objective.z) < objective.radius) {
        const res = advanceObjective(state.missions);
        if (res.done) finishMission(res.mission);
      }
    } else if (objective.type === 'survive') {
      if (state.wanted < 3) {
        state.wanted = 3;
        syncPolice();
      }
      state.wantedTimer = Math.max(state.wantedTimer, 5);
    }
  }

  function finishMission(mission) {
    state.cash += mission.reward;
    state.hud.banner('Misi selesai!', `${mission.title} — +$${mission.reward}`, 4);
    state.audio.jingle();
    saveGame();
  }

  function stepPlay(dt) {
    state.time += dt;
    const input = state.autopilotInput || state.input;
    const orbit = input.takeOrbit();
    const player = state.player;

    // Wanted decay: quiet for a while and no police close by.
    if (state.wanted > 0) {
      state.wantedTimer -= dt;
      const policeNear = state.policeCars.some((c) => dist2D(c.x, c.z, player.x, player.z) < 30)
        || state.footCops.some((c) => dist2D(c.x, c.z, player.x, player.z) < 20);
      if (state.wantedTimer <= 0 && !policeNear) {
        state.wanted -= 1;
        state.wantedTimer = WANTED.decaySeconds;
        syncPolice();
      }
    }
    if (state.crimeTimer > 0) {
      state.crimeTimer -= dt;
      if (state.crimeTimer <= 0) state.crimePoint = null;
    }

    if (input.wasPressed(ACTION_PAUSE)) {
      state.screen = 'paused';
      state.hud.showScreen('pause');
      input.endFrame();
      return;
    }
    if (input.wasPressed(ACTION_MUTE)) {
      state.audio.setMuted(!state.audio.isMuted());
    }

    if (state.playerCar) {
      const car = state.playerCar;
      stepPlayerCar(car, input, dt, state.city.colliders, [...state.traffic, ...state.policeCars]);
      state.audio.setEngine(Math.abs(car.speed) / CAR.maxSpeed, true);
      if (input.wasPressed(ACTION_ENTER)) exitCar();
      if (input.wasPressed(ACTION_HORN)) state.audio.horn();
      cameraRig.update(car.x, 0, car.z, car.heading, true, dt, orbit);
    } else {
      // On foot.
      const mx = input.moveX();
      const my = input.moveY();
      const camYaw = cameraRig.yaw;
      const fx = -Math.sin(camYaw);
      const fz = -Math.cos(camYaw);
      const rx = -fz;
      const rz = fx;
      let dx = fx * my + rx * mx;
      let dz = fz * my + rz * mx;
      const len = Math.hypot(dx, dz);
      const speed = input.sprint() ? PLAYER.runSpeed : PLAYER.walkSpeed;
      if (len > 0.01) {
        dx /= len;
        dz /= len;
        const wantHeading = Math.atan2(dx, dz);
        player.heading = angleLerp(player.heading, wantHeading, Math.min(1, dt * 10));
        const nx = player.x + dx * speed * dt;
        const nz = player.z + dz * speed * dt;
        const resolved = collideCircle(state.city.colliders, nx, nz, PLAYER.radius);
        player.x = clamp(resolved.x, -CITY.half - 4, CITY.half + 24);
        player.z = clamp(resolved.z, -CITY.half - 4, CITY.half + 24);
        player.speed = speed;
        // Walk-cycle legs.
        const phase = state.time * (input.sprint() ? 11 : 8);
        player.legs.legL.rotation.x = Math.sin(phase) * 0.6;
        player.legs.legR.rotation.x = -Math.sin(phase) * 0.6;
        player.legs.armL.rotation.x = -Math.sin(phase) * 0.45;
        player.legs.armR.rotation.x = Math.sin(phase) * 0.45;
      } else {
        player.speed = 0;
        player.legs.legL.rotation.x *= 0.8;
        player.legs.legR.rotation.x *= 0.8;
        player.legs.armL.rotation.x *= 0.8;
        player.legs.armR.rotation.x *= 0.8;
      }
      // Jump + gravity.
      if (player.onGround && input.wasPressed('jump')) {
        player.vy = PLAYER.jumpSpeed;
        player.onGround = false;
      }
      if (!player.onGround) {
        player.vy -= 22 * dt;
        player.y += player.vy * dt;
        if (player.y <= 0) {
          player.y = 0;
          player.vy = 0;
          player.onGround = true;
        }
      }
      player.mesh.position.set(player.x, player.y, player.z);
      player.mesh.rotation.y = player.heading;
      state.audio.setEngine(0, false);

      // Enter a car.
      if (input.wasPressed(ACTION_ENTER)) {
        const car = nearestCar(3.5);
        if (car) enterCar(car);
      }
      // Punch.
      if (input.wasPressed(ACTION_PUNCH)) {
        const hit = tryPunch(combat, player, [...state.peds, ...state.footCops], (target) => {
          if (target.cop) {
            addWanted(1, target.x, target.z);
            if (target.health <= 0) {
              state.footCops = state.footCops.filter((c) => c !== target);
              scene.remove(target.mesh);
            }
          } else {
            addWanted(1, target.x, target.z);
          }
        });
        if (hit) state.audio.punch();
      }
      // Shoot (hold mouse).
      state.shootTimer -= dt;
      if (input.mouseHeld() && state.shootTimer <= 0 && combat.ammo > 0 && combat.reloadTimer <= 0) {
        state.shootTimer = 0.18;
        const cam = cameraRig.camera;
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const origin = cam.position.clone();
        const hit = tryShoot(combat, origin, dir, [...state.peds, ...state.footCops], [...state.traffic, ...state.policeCars]);
        state.audio.shot();
        if (hit) {
          if (hit.cop) {
            addWanted(1, hit.x, hit.z);
            if (hit.health <= 0) {
              state.footCops = state.footCops.filter((c) => c !== hit);
              scene.remove(hit.mesh);
            }
          } else if (hit.health !== undefined) {
            addWanted(1, hit.x, hit.z);
          }
        } else {
          // Firing a gun in public draws attention.
          addWanted(1, player.x, player.z);
        }
      }
      if (input.wasPressed(ACTION_RELOAD) && combat.ammo < combat.magSize) {
        combat.reloadTimer = 1.2;
        state.reloading = true;
        state.reloadTimer = 1.2;
      }
      cameraRig.update(player.x, player.y, player.z, player.heading, false, dt, orbit);
    }

    // Reload completes.
    if (state.reloading) {
      state.reloadTimer -= dt;
      if (state.reloadTimer <= 0) {
        combat.ammo = combat.magSize;
        state.reloading = false;
      }
    }

    // Traffic, pedestrians, police.
    stepTraffic(state.traffic, dt, state.random);
    stepPedestrians(state.peds, dt, state.random, state.city.colliders, state.crimePoint);
    const tx = state.playerCar ? state.playerCar.x : player.x;
    const tz = state.playerCar ? state.playerCar.z : player.z;
    for (const car of state.policeCars) {
      stepPoliceCar(car, tx, tz, dt, state.city.colliders);
      // Ramming the player's car damages it; on foot, a touch busts the player.
      if (state.playerCar && dist2D(car.x, car.z, tx, tz) < 4) {
        state.playerCar.speed *= 0.6;
        combat.health = Math.max(0, combat.health - 12 * dt);
      }
    }
    for (const cop of [...state.footCops]) {
      const punched = stepFootCop(cop, player.x, player.z, !!state.playerCar, dt, state.city.colliders);
      if (punched) {
        combat.health = Math.max(0, combat.health - 10);
        state.audio.punch();
      }
      if (!state.playerCar && dist2D(cop.x, cop.z, player.x, player.z) < 1.7) {
        state.bustedTimer += dt;
        if (state.bustedTimer > 1.5) {
          state.bustedTimer = 0;
          state.screen = 'busted';
          state.hud.showScreen('busted');
          state.audio.busted();
          input.endFrame();
          return;
        }
      }
    }
    if (state.bustedTimer > 0) state.bustedTimer = Math.max(0, state.bustedTimer - dt * 2);

    // Car hits a pedestrian: crime + ped down.
    const allCars = [...state.traffic, ...state.policeCars];
    if (state.playerCar) allCars.push(state.playerCar);
    for (const car of allCars) {
      if (Math.abs(car.speed || 0) < 2) continue;
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        if (dist2D(car.x, car.z, ped.x, ped.z) < 2.2) {
          ped.state = 'down';
          ped.downTimer = 10;
          ped.health = 0;
          if (car === state.playerCar) addWanted(1, ped.x, ped.z);
        }
      }
    }

    stepCombat(combat, dt, player, (kind) => {
      state.audio.pickup();
      state.hud.banner(kind === 'med' ? 'Medkit +40 HP' : 'Amunisi +12', '', 1.5);
    });
    stepMission(dt);
    updateBeacon(state.missions, state.time);

    // Siren when police are close.
    const policeNear = state.policeCars.some((c) => dist2D(c.x, c.z, tx, tz) < 45);
    state.audio.setSiren(policeNear && state.wanted > 0);

    // Wasted?
    if (combat.health <= 0) {
      state.screen = 'wasted';
      state.hud.showScreen('wasted');
      state.audio.busted();
      input.endFrame();
      return;
    }

    // HUD.
    const objective = updateBeacon(state.missions, state.time);
    state.hud.setCash(state.cash);
    state.hud.setHealth(combat.health);
    state.hud.setAmmo(combat.ammo, state.reloading);
    state.hud.setWanted(state.wanted);
    state.hud.setObjective(objectiveText(state.missions), state.missions.timer);
    state.hud.setSpeed(state.playerCar ? Math.abs(state.playerCar.speed) * 3.6 : 0, !!state.playerCar);
    state.hud.setHint(state.playerCar
      ? 'W/S gas & rem · A/D setir · Space rem tangan · E keluar · H klakson'
      : 'WASD gerak · Shift lari · E masuk mobil · F pukul · Klik tembak · R reload');
    state.hud.tickBanner(dt);
    state.hud.drawMinimap({
      playerX: tx, playerZ: tz, playerHeading: state.playerCar ? state.playerCar.heading : player.heading,
      traffic: state.traffic, policeCars: state.policeCars, footCops: state.footCops,
      missionTarget: state.missions.active && objective && objective.x !== undefined
        ? { x: objective.x, z: objective.z } : null,
    });
    input.endFrame();
  }

  function stepTitle(dt) {
    state.time += dt;
    titleCamera(dt);
    stepTraffic(state.traffic, dt, state.random);
    stepPedestrians(state.peds, dt, state.random, state.city.colliders, null);
    state.hud.tickBanner(dt);
  }

  return {
    state,
    renderer,
    cameraRig,
    input,
    hud,
    audio,
    saveGame,
    loadGame,
    applySave,
    respawn,
    // Deterministic staging helpers for ?shot= screenshots.
    setAutopilotInput(fake) {
      state.autopilotInput = fake;
    },
    teleportPlayer(x, z) {
      state.player.x = x;
      state.player.z = z;
      state.player.mesh.position.set(x, 0, z);
    },
    giveCar(car) {
      enterCar(car);
    },
    setWanted(n) {
      state.wanted = n;
      syncPolice();
    },
    startMissionDebug(index) {
      startMission(state.missions, index);
    },
    showMissionBanner() {
      const mission = currentMission(state.missions);
      if (mission) state.hud.banner(`${mission.title} — ${mission.giver}`, mission.briefing, 5);
    },
    setScreen(name) {
      state.screen = name;
      state.hud.showScreen(name === 'title' ? 'title' : 'play');
    },
    startGame(fresh) {
      if (fresh) {
        state.cash = 0;
        state.missions.index = -1;
        state.missions.completed = [];
        state.missions.active = false;
        combat.health = 100;
        combat.ammo = 12;
        state.player.x = 0;
        state.player.z = 20;
        state.wanted = 0;
        syncPolice();
      }
      state.screen = 'play';
      state.hud.showScreen('play');
      state.audio.unlock();
      state.hud.banner('Suncrest Bay', 'Pergi ke Diner Marina — ikon merah muda di minimap.', 4);
    },
    step(dt, opts = {}) {
      if (state.screen === 'play') stepPlay(dt);
      else if (state.screen === 'title') stepTitle(dt);
      else if (state.screen === 'busted' || state.screen === 'wasted') {
        // Frozen behind the overlay; input is handled by the overlay buttons.
        state.input.endFrame();
      }
      // Paused: fully frozen. Shot staging steps the world without painting
      // each intermediate frame (opts.render === false); the final frame is
      // painted by the caller, so the screenshot is still a real render.
      if (state.screen !== 'paused' && opts.render !== false) {
        renderer.render(scene, cameraRig.camera);
      }
    },
  };
}

export { DINER, HOSPITAL };

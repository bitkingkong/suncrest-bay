// Suncrest Bay — the world: everything wired together.
// The world owns the state (player, cars, police, pedestrians, wanted
// level, money, missions), builds the city, steps the simulation and talks
// to the HUD, the audio and the camera. It exposes `hud` and `audio` so the
// boot code can reach them, and the shot stager can drive it through the
// same public methods the real game uses: setScreen, startGame,
// teleportPlayer, giveCar, setWanted, startMissionDebug, showMissionBanner,
// setAutopilotInput and step(dt, { render }).
import * as THREE from 'three';
import { CAR, CITY, MISSIONS, PICKUPS, PLACES, PLAYER, SAVE_KEY, WANTED } from './config.js';
import { makeRng, clamp, dist2d } from './random.js';
import { createInput, PRESS_ENTER_CAR, PRESS_HORN, PRESS_MUTE, PRESS_PAUSE, PRESS_PUNCH, PRESS_RELOAD, PRESS_SHOOT } from './input.js';
import { buildCity } from './city.js';
import { createAudio } from './audio.js';
import { makeCar, spawnParkedCars, spawnTraffic, stepPlayerCar, stepPoliceCar, stepTrafficCar } from './vehicles.js';
import { animateWalk, makeFootCop, makePed, makePlayerMesh, spawnPeds, stepFootCop, stepPed, syncPersonMesh } from './people.js';
import { createMissions } from './missions.js';
import { makeTracer, punchAttack, shootRay, spawnPickups, stepPickups, stepTracer } from './combat.js';
import { createHud } from './hud.js';
import { createView } from './render.js';

const STEP = 1 / 60;

export function createWorld(canvas, seed) {
  const rng = makeRng(seed);
  const view = createView(canvas);
  const { scene, camera } = view;
  const city = buildCity(scene, rng);
  const hud = createHud();
  const audio = createAudio();
  const input = createInput(canvas);
  const missions = createMissions(scene);

  // --- player --------------------------------------------------------------
  const person = makePlayerMesh();
  scene.add(person.group);
  const player = {
    mesh: person.group,
    legs: person.legs,
    arms: person.arms,
    x: PLACES.spawn.x,
    z: PLACES.spawn.z,
    y: 0,
    vy: 0,
    heading: Math.PI,
    hp: PLAYER.maxHp,
    ammo: PLAYER.pistolAmmo,
    walkPhase: 0,
    onGround: true,
    punchCooldown: 0,
    shootCooldown: 0,
    hurtCooldown: 0,
  };

  const parked = spawnParkedCars(scene, rng);
  const traffic = spawnTraffic(scene, rng);
  const peds = spawnPeds(scene, rng);
  const pickups = spawnPickups(scene, rng);

  const state = {
    seed,
    screen: 'title',
    time: 0,
    elapsed: 0,
    money: 0,
    wanted: 0,
    lastCrimeAt: -999,
    bustTimer: 0,
    policeCars: [],
    footCops: [],
    drivenCar: null,
    tracers: [],
    player,
    parked,
    traffic,
    peds,
    pickups,
    missions,
    city,
    paused: false,
  };

  let autopilotInput = null;
  let missionBannerShown = false;

  function currentInput() {
    return autopilotInput ?? input;
  }

  // --- wanted level ---------------------------------------------------------
  function addWanted(n, why) {
    if (n <= 0) return;
    state.wanted = Math.min(WANTED.maxStars, state.wanted + n);
    state.lastCrimeAt = state.elapsed;
    hud.setWanted(state.wanted);
    hud.announce(`Kejahatan: ${why}. Wanted ${state.wanted} bintang.`);
  }

  function setWanted(n) {
    state.wanted = clamp(n, 0, WANTED.maxStars);
    state.lastCrimeAt = state.elapsed;
    hud.setWanted(state.wanted);
  }

  function nearestPoliceDistance() {
    let best = Infinity;
    for (const c of state.policeCars) best = Math.min(best, dist2d(player.x, player.z, c.x, c.z));
    for (const c of state.footCops) {
      if (c.alive) best = Math.min(best, dist2d(player.x, player.z, c.x, c.z));
    }
    return best;
  }

  function ensurePolice() {
    const wantCars = state.wanted === 0 ? 0 : state.wanted >= 5 ? 4 : state.wanted >= 3 ? 3 : 2;
    while (state.policeCars.length < wantCars) {
      const angle = rng.range(0, Math.PI * 2);
      const x = clamp(player.x + Math.sin(angle) * 55, -128, 128);
      const z = clamp(player.z + Math.cos(angle) * 55, -128, 128);
      const car = makeCar(scene, { x, z, heading: 0, color: 0xe8e8e8, kind: 'police', isPolice: true });
      state.policeCars.push(car);
    }
    while (state.policeCars.length > wantCars) {
      const car = state.policeCars.pop();
      scene.remove(car.mesh);
    }
    const wantCops = state.wanted >= WANTED.footCopsAt ? Math.min(3, state.wanted - 1) : 0;
    const aliveCops = state.footCops.filter((c) => c.alive).length;
    if (aliveCops < wantCops) {
      const angle = rng.range(0, Math.PI * 2);
      const cop = makeFootCop(scene, clamp(player.x + Math.sin(angle) * 14, -128, 128), clamp(player.z + Math.cos(angle) * 14, -128, 128));
      state.footCops.push(cop);
    }
  }

  function clearPolice() {
    for (const car of state.policeCars) scene.remove(car.mesh);
    state.policeCars.length = 0;
    for (const cop of state.footCops) scene.remove(cop.mesh);
    state.footCops.length = 0;
    audio.setSiren(false);
  }

  // --- respawn ---------------------------------------------------------------
  function respawn(kind) {
    const fine = kind === 'busted' ? WANTED.bustFine : WANTED.wastedFine;
    state.money = Math.max(0, state.money - fine);
    player.hp = PLAYER.maxHp;
    player.x = PLACES.hospital.x;
    player.z = PLACES.hospital.z;
    player.y = 0;
    player.vy = 0;
    player.heading = Math.PI;
    if (state.drivenCar) {
      state.drivenCar.kind = 'parked';
      state.parked.push(state.drivenCar);
      state.drivenCar = null;
    }
    setWanted(0);
    clearPolice();
    state.bustTimer = 0;
    audio.busted();
    hud.showBanner(kind === 'busted' ? `BUSTED! Denda $${fine}. Dibebaskan di Rumah Sakit.` : `WASTED! Kehilangan $${fine}. Bangun di Rumah Sakit.`, 3600);
    setScreen('over', kind);
  }

  // --- screens ----------------------------------------------------------------
  function setScreen(name, overKind) {
    state.screen = name;
    if (name === 'over') {
      hud.els.overTitle.textContent = overKind === 'busted' ? 'BUSTED!' : 'WASTED!';
      hud.els.overText.textContent = overKind === 'busted'
        ? 'Polisi menangkapmu. Jax dibebaskan di Rumah Sakit setelah membayar denda.'
        : 'Jax tumbang. Ia bangun di Rumah Sakit, lebih miskin tapi masih hidup.';
    }
    hud.setScreen(name);
    hud.announce(name === 'title' ? 'Suncrest Bay. Continue atau New Game.' : name);
  }

  function hasSave() {
    try {
      return window.localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  function saveGame() {
    try {
      const data = {
        money: state.money,
        hp: player.hp,
        ammo: player.ammo,
        x: player.x,
        z: player.z,
        heading: player.heading,
        missionIndex: missions.state.index,
        missionDone: missions.state.done,
        wanted: state.wanted,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function applySave(data) {
    state.money = data.money ?? 0;
    player.hp = data.hp ?? PLAYER.maxHp;
    player.ammo = data.ammo ?? PLAYER.pistolAmmo;
    player.x = data.x ?? PLACES.spawn.x;
    player.z = data.z ?? PLACES.spawn.z;
    player.heading = data.heading ?? Math.PI;
    if (data.missionDone) {
      missions.state.done = true;
      missions.state.index = MISSIONS.length;
    } else {
      missions.state.index = data.missionIndex ?? 0;
    }
    setWanted(data.wanted ?? 0);
  }

  function startGame(fresh) {
    audio.ensure();
    if (fresh) {
      state.money = 0;
      player.hp = PLAYER.maxHp;
      player.ammo = PLAYER.pistolAmmo;
      player.x = PLACES.spawn.x;
      player.z = PLACES.spawn.z;
      player.y = 0;
      player.vy = 0;
      player.heading = Math.PI;
      missions.reset();
      setWanted(0);
      clearPolice();
      if (state.drivenCar) {
        state.drivenCar.kind = 'parked';
        state.parked.push(state.drivenCar);
        state.drivenCar = null;
      }
    } else {
      const data = loadSave();
      if (data) applySave(data);
    }
    state.elapsed = 0;
    state.lastCrimeAt = -999;
    state.bustTimer = 0;
    missionBannerShown = false;
    hud.setMoney(state.money);
    hud.setHp(player.hp, PLAYER.maxHp);
    hud.setAmmo(player.ammo, false);
    hud.setWanted(state.wanted);
    hud.setHint(false);
    hud.setCrosshair(true);
    setScreen('play');
  }

  // --- car entry ---------------------------------------------------------------
  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of [...state.parked, ...state.traffic]) {
      const d = dist2d(player.x, player.z, car.x, car.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar() {
    if (state.drivenCar) {
      // Get out: step out to the side of the car.
      const car = state.drivenCar;
      player.x = car.x + Math.cos(car.heading) * 2.4;
      player.z = car.z - Math.sin(car.heading) * 2.4;
      player.heading = car.heading;
      car.kind = 'parked';
      state.parked.push(car);
      state.drivenCar = null;
      hud.setHint(false);
      hud.setCrosshair(true);
      hud.setAmmo(player.ammo, false);
      return;
    }
    const car = nearestCar(3.6);
    if (!car) return;
    // Stealing an NPC car is a crime.
    if (car.kind === 'parked' || car.kind === 'traffic') addWanted(1, 'Mencuri mobil');
    state.parked = state.parked.filter((c) => c !== car);
    state.traffic = state.traffic.filter((c) => c !== car);
    car.kind = 'driven';
    state.drivenCar = car;
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    hud.setHint(true);
    hud.setCrosshair(false);
    hud.setAmmo(player.ammo, true);
    audio.ensure();
  }

  function giveCar(car) {
    state.parked = state.parked.filter((c) => c !== car);
    state.traffic = state.traffic.filter((c) => c !== car);
    car.kind = 'driven';
    state.drivenCar = car;
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    hud.setHint(true);
    hud.setCrosshair(false);
    hud.setAmmo(player.ammo, true);
  }

  function teleportPlayer(x, z) {
    player.x = x;
    player.z = z;
    player.y = 0;
    player.vy = 0;
    syncPersonMesh(player);
  }

  // --- missions (debug / shots) --------------------------------------------------
  function startMissionDebug(index) {
    const intro = missions.start(index);
    if (index === 2) setWanted(3);
    hud.showBanner(intro, 4200);
    hud.setObjective(missions.objectiveText(), missions.state.timer);
    return intro;
  }

  function showMissionBanner(ms = 4200) {
    const def = missions.currentDef();
    if (!def) return;
    const stageText = missions.currentStage()?.text ?? def.intro;
    hud.showBanner(`${def.name} — ${stageText}`, ms);
  }

  function setAutopilotInput(fake) {
    autopilotInput = fake;
  }

  // --- combat actions -------------------------------------------------------------
  function doPunch() {
    if (player.punchCooldown > 0 || state.drivenCar) return;
    player.punchCooldown = PLAYER.punchCooldown;
    audio.punch();
    const targets = [...state.peds, ...state.footCops];
    const victim = punchAttack(player.x, player.z, player.heading, targets);
    if (victim) {
      addWanted(1, victim.hp <= 0 ? 'Menyerang warga' : 'Memukul warga');
      if (victim.hp <= 0) {
        victim.alive = false;
        victim.mesh.visible = false;
        if (victim.kind === 'cop' || state.footCops.includes(victim)) addWanted(1, 'Menyerang polisi');
      }
    }
  }

  function doShoot() {
    if (player.shootCooldown > 0 || state.drivenCar) return;
    if (player.ammo <= 0) {
      hud.showBanner('Pistol kosong — tekan R untuk reload.', 1600);
      return;
    }
    player.shootCooldown = PLAYER.shootCooldown;
    player.ammo -= 1;
    audio.gunshot();
    addWanted(1, 'Menembak');
    const origin = camera.position.clone();
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const targets = [...state.peds, ...state.footCops];
    const victim = shootRay(origin, direction, targets);
    const end = victim
      ? new THREE.Vector3(victim.x, 1.1, victim.z)
      : origin.clone().add(direction.multiplyScalar(PLAYER.pistolRange));
    const from = new THREE.Vector3(player.x, 1.4, player.z);
    state.tracers.push(makeTracer(scene, from, end));
    if (victim) {
      if (victim.hp <= 0) {
        victim.alive = false;
        victim.mesh.visible = false;
        addWanted(1, 'Menembak polisi');
      }
    }
    hud.setAmmo(player.ammo, false);
  }

  function hurtPlayer(amount, why) {
    if (player.hurtCooldown > 0) return;
    player.hurtCooldown = 0.6;
    player.hp -= amount;
    hud.setHp(player.hp, PLAYER.maxHp);
    if (player.hp <= 0) {
      player.hp = 0;
      respawn('wasted');
    }
  }

  // --- one simulation step ---------------------------------------------------------
  function stepPlayer(dt, inp) {
    const move = inp.move();
    const camYaw = view.yaw;
    // Movement is relative to the camera.
    let mx = 0;
    let mz = 0;
    if (move.forward !== 0 || move.strafe !== 0) {
      const fx = Math.sin(camYaw + Math.PI);
      const fz = Math.cos(camYaw + Math.PI);
      const rx = Math.sin(camYaw + Math.PI / 2);
      const rz = Math.cos(camYaw + Math.PI / 2);
      mx = fx * move.forward + rx * move.strafe;
      mz = fz * move.forward + rz * move.strafe;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len;
      mz /= len;
    }
    const speed = inp.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const nx = player.x + mx * speed * dt;
    const nz = player.z + mz * speed * dt;
    if (mx !== 0 || mz !== 0) {
      player.heading = Math.atan2(mx, mz);
      player.walkPhase += dt * speed * 2.4;
      animateWalk(player, player.walkPhase, inp.run() ? 1.3 : 1);
    } else {
      animateWalk(player, 0, 0);
      player.legs.legL.rotation.x = 0;
      player.legs.legR.rotation.x = 0;
    }
    // Jump + gravity.
    if (inp.jump() && player.onGround) {
      player.vy = PLAYER.jumpSpeed;
      player.onGround = false;
    }
    player.vy -= PLAYER.gravity * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.onGround = true;
    }
    // Collide with buildings, then with parked/traffic cars (soft circles).
    const solved = city.resolveCollision(nx, nz, PLAYER.radius);
    player.x = solved.x;
    player.z = solved.z;
    for (const car of [...state.parked, ...state.traffic]) {
      const d = dist2d(player.x, player.z, car.x, car.z);
      if (d < 1.9 && d > 0.01) {
        const push = (1.9 - d) / d;
        player.x += (player.x - car.x) * push;
        player.z += (player.z - car.z) * push;
      }
    }
    const clamped = city.clampToCity(player.x, player.z, 2);
    player.x = clamped.x;
    player.z = clamped.z;
    player.mesh.position.set(player.x, player.y, player.z);
    player.mesh.rotation.y = player.heading;
    if (player.punchCooldown > 0) player.punchCooldown -= dt;
    if (player.shootCooldown > 0) player.shootCooldown -= dt;
    if (player.hurtCooldown > 0) player.hurtCooldown -= dt;
  }

  function step(dt, opts = {}) {
    const doRender = opts.render !== false;
    state.time += dt;
    if (state.screen === 'title') {
      // The city lives behind the title: traffic rolls, people stroll.
      for (const car of state.traffic) stepTrafficCar(car, dt, city, rng);
      for (const ped of state.peds) stepPed(ped, dt, city, null);
      missions.updateMarker(state.time);
      view.updateTitleCamera(dt);
      if (doRender) view.render();
      return;
    }
    if (state.screen !== 'play') {
      if (doRender) view.render();
      return;
    }
    state.elapsed += dt;
    const inp = currentInput();
    const orbit = inp.takeOrbit();
    view.applyOrbit(orbit.dx, orbit.dy);
    const pressed = inp.takePressed();

    if (pressed & PRESS_PAUSE) {
      setScreen('pause');
      hud.setSaveNote('');
      if (doRender) view.render();
      return;
    }
    if (pressed & PRESS_MUTE) {
      audio.ensure();
      const muted = audio.toggleMute();
      hud.showBanner(muted ? 'Suara dimatikan (M).' : 'Suara dinyalakan (M).', 1400);
    }
    if (pressed & PRESS_HORN && state.drivenCar) audio.horn();
    if (pressed & PRESS_ENTER_CAR) enterCar();
    if (pressed & PRESS_PUNCH) doPunch();
    if (pressed & PRESS_SHOOT) doShoot();
    if (pressed & PRESS_RELOAD && !state.drivenCar) {
      player.ammo = PLAYER.pistolAmmo;
      hud.setAmmo(player.ammo, false);
      hud.showBanner('Pistol di-reload.', 1200);
    }
    inp.endFrame();

    // --- player / car ---
    if (state.drivenCar) {
      const car = state.drivenCar;
      stepPlayerCar(car, inp.move(), inp.handbrake(), dt, city);
      player.x = car.x;
      player.z = car.z;
      player.heading = car.heading;
      player.mesh.visible = false;
      // Running over a pedestrian is a crime.
      for (const ped of state.peds) {
        if (ped.alive && Math.abs(car.speed) > 3 && dist2d(car.x, car.z, ped.x, ped.z) < 2.0) {
          ped.alive = false;
          ped.mesh.visible = false;
          addWanted(1, 'Menabrak pejalan kaki');
          audio.crash();
        }
      }
      audio.setEngine(Math.abs(car.speed) / CAR.maxSpeed, true);
    } else {
      player.mesh.visible = true;
      stepPlayer(dt, inp);
      audio.setEngine(0, false);
    }

    // --- traffic, pedestrians, pickups ---
    for (const car of state.traffic) stepTrafficCar(car, dt, city, rng);
    const threat = state.wanted > 0 ? { x: player.x, z: player.z } : null;
    for (const ped of state.peds) stepPed(ped, dt, city, threat);
    const got = stepPickups(state.pickups, player.x, player.z, state.time);
    if (got === 'medkit') {
      player.hp = Math.min(PLAYER.maxHp, player.hp + PICKUPS.medkitHeal);
      hud.setHp(player.hp, PLAYER.maxHp);
      hud.showBanner('Medkit +40 HP.', 1400);
      audio.pickup();
    } else if (got === 'ammo') {
      player.ammo += PICKUPS.ammoAmount;
      hud.setAmmo(player.ammo, !!state.drivenCar);
      hud.showBanner(`Amunisi +${PICKUPS.ammoAmount}.`, 1400);
      audio.pickup();
    }

    // --- wanted decay ---
    if (state.wanted > 0 && state.elapsed - state.lastCrimeAt > WANTED.decaySeconds && nearestPoliceDistance() > WANTED.policeFar) {
      setWanted(state.wanted - 1);
      state.lastCrimeAt = state.elapsed;
      hud.showBanner('Polisi kehilangan jejakmu. Wanted turun.', 1800);
    }

    // --- police ---
    ensurePolice();
    audio.setSiren(state.wanted > 0);
    audio.updateSiren(dt);
    for (const car of state.policeCars) {
      const dist = stepPoliceCar(car, player.x, player.z, dt, city);
      if (dist < 3.2) {
        // A ram: the player takes a hit and the interceptor bounces off.
        hurtPlayer(10, 'ram');
        audio.crash();
        car.speed *= -0.4;
      }
    }
    if (state.wanted >= WANTED.footCopsAt && !state.drivenCar) {
      let closest = Infinity;
      for (const cop of state.footCops) {
        if (!cop.alive) continue;
        const d = stepFootCop(cop, player.x, player.z, dt, city);
        closest = Math.min(closest, d);
        if (d < 1.9 && cop.punchCooldown <= 0) {
          cop.punchCooldown = 1.0;
          hurtPlayer(8, 'police punch');
        }
        if (cop.punchCooldown > 0) cop.punchCooldown -= dt;
      }
      if (closest < WANTED.bustDistance) {
        state.bustTimer += dt;
        if (state.bustTimer >= WANTED.bustSeconds) respawn('busted');
      } else {
        state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
      }
    } else {
      state.bustTimer = 0;
      for (const cop of state.footCops) {
        if (cop.alive) stepFootCop(cop, player.x, player.z, dt, city);
      }
    }
    if (state.screen !== 'play') {
      if (doRender) view.render();
      return;
    }

    // --- missions ---
    const inComet = !!state.drivenCar && state.drivenCar.comet;
    if (!missions.state.active && !missions.state.done) {
      // Talking to Mama Lou at the diner starts the chain.
      if (dist2d(player.x, player.z, PLACES.diner.x, PLACES.diner.z) < 6) {
        const intro = missions.start(missions.state.index);
        if (missions.state.index === 2) setWanted(3);
        hud.showBanner(intro, 4200);
        missionBannerShown = true;
      }
    }
    const event = missions.update(dt, player.x, player.z, inComet);
    if (event === 'stage') {
      hud.showBanner(missions.state.index === 0 ? 'Paket diambil! Antar ke Diner Marina.' : 'Comet GT didapat! Bawa ke bengkel Dex.', 3000);
      audio.pickup();
    } else if (event === 'survive-done') {
      hud.showBanner('Kamu lolos dari kejaran! Sekarang ke hideout.', 3200);
      audio.missionJingle();
    } else if (event === 'complete') {
      const def = missions.completeMission();
      state.money += def.reward;
      hud.setMoney(state.money);
      hud.showBanner(`Misi selesai: ${def.name}! +$${def.reward}`, 3600);
      audio.missionJingle();
      saveGame();
      // The next mission starts when the player reaches its giver again;
      // mission 3's heat is raised by the start itself.
      if (missions.state.index === 2) {
        const intro = missions.start(2);
        setWanted(3);
        hud.showBanner(intro, 4200);
      }
    } else if (event === 'failed') {
      hud.showBanner('Misi gagal — waktu habis. Bicara lagi dengan Mama Lou di Diner.', 3600);
      missions.state.index = 0;
      missions.state.active = false;
    }
    const target = missions.updateMarker(state.time);
    hud.setObjective(missions.objectiveText(), missions.state.timer);
    hud.drawMinimap(state, target, state.time);
    hud.setMoney(state.money);
    hud.setHp(player.hp, PLAYER.maxHp);
    hud.setSpeed(state.drivenCar ? state.drivenCar.speed * 3.6 : 0, !!state.drivenCar);

    // --- tracers ---
    for (let i = state.tracers.length - 1; i >= 0; i -= 1) {
      if (stepTracer(state.tracers[i], dt)) state.tracers.splice(i, 1);
    }

    // --- camera ---
    if (state.drivenCar) {
      view.updateCamera(state.drivenCar.x, state.drivenCar.z, state.drivenCar.heading, true, dt);
    } else {
      view.updateCamera(player.x, player.z, player.heading, false, dt);
    }
    if (doRender) view.render();
  }

  function render() {
    view.render();
  }

  // Wire the buttons. The HUD hands over its elements; the world owns what
  // each button does, so the boot code stays small.
  hud.els.btnNew.addEventListener('click', () => startGame(true));
  hud.els.btnContinue.addEventListener('click', () => startGame(false));
  hud.els.btnResume.addEventListener('click', () => setScreen('play'));
  hud.els.btnRestart.addEventListener('click', () => startGame(true));
  hud.els.btnSave.addEventListener('click', () => {
    const ok = saveGame();
    hud.setSaveNote(ok ? 'Tersimpan.' : 'Gagal menyimpan.');
  });
  hud.els.btnQuit.addEventListener('click', () => setScreen('title'));
  hud.els.btnAgain.addEventListener('click', () => startGame(true));

  // Title screen state.
  hud.setContinueVisible(hasSave());
  hud.setMoney(0);
  hud.setHp(PLAYER.maxHp, PLAYER.maxHp);
  hud.setWanted(0);
  hud.setObjective(missions.objectiveText(), 0);
  setScreen('title');

  return {
    state,
    view,
    scene,
    camera,
    hud,
    audio,
    input,
    city,
    missions,
    step,
    render,
    setScreen,
    startGame,
    saveGame,
    loadSave,
    hasSave,
    setWanted,
    addWanted,
    teleportPlayer,
    giveCar,
    startMissionDebug,
    showMissionBanner,
    setAutopilotInput,
    enterCar,
  };
}

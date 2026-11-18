// Suncrest Bay — the HUD and the screens.
// Plain DOM over the WebGL canvas: money and health top-left, wanted stars
// top-right, the mission objective top-centre, a 2D minimap bottom-right,
// control hints bottom-left, a crosshair while armed, banners for mission
// results, and the title / pause / game-over panels. The minimap is drawn
// on a small canvas: roads, the player arrow, cars, flashing police and
// the pink mission marker.
import { CITY, ROAD_CENTRES } from './config.js';

const STAR_FULL = '★';
const STAR_EMPTY = '☆';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    hud: $('hud'),
    money: $('money'),
    hpFill: $('hp-fill'),
    hpText: $('hp-text'),
    ammo: $('ammo'),
    stars: $('stars'),
    objective: $('objective'),
    banner: $('banner'),
    minimap: $('minimap'),
    crosshair: $('crosshair'),
    hint: $('hint'),
    speed: $('speed'),
    title: $('title-screen'),
    pause: $('pause-screen'),
    over: $('over-screen'),
    btnNew: $('btn-new'),
    btnContinue: $('btn-continue'),
    btnResume: $('btn-resume'),
    btnRestart: $('btn-restart'),
    btnSave: $('btn-save'),
    btnQuit: $('btn-quit'),
    btnAgain: $('btn-again'),
    saveNote: $('save-note'),
    overTitle: $('over-title'),
    overText: $('over-text'),
    status: $('status'),
  };
  const mapCtx = els.minimap.getContext('2d');
  let bannerTimer = null;

  function show(el) {
    if (el) el.style.display = '';
  }
  function hide(el) {
    if (el) el.style.display = 'none';
  }

  function setScreen(name) {
    hide(els.title);
    hide(els.pause);
    hide(els.over);
    if (name === 'title') show(els.title);
    else if (name === 'pause') show(els.pause);
    else if (name === 'over') show(els.over);
    els.hud.style.display = name === 'play' ? '' : 'none';
  }

  function setMoney(value) {
    els.money.textContent = `$${Math.floor(value)}`;
  }

  function setHp(hp, maxHp) {
    const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    els.hpFill.style.width = `${pct}%`;
    els.hpFill.style.background = pct > 50 ? '#7ed957' : pct > 25 ? '#f2c94c' : '#e5534b';
    els.hpText.textContent = String(Math.ceil(hp));
  }

  function setAmmo(ammo, inCar) {
    els.ammo.textContent = inCar ? 'Mengemudi — W/S gas · A/D setir' : `Pistol ${ammo} peluru`;
  }

  function setWanted(stars) {
    let text = '';
    for (let i = 0; i < 5; i += 1) text += i < stars ? STAR_FULL : STAR_EMPTY;
    els.stars.textContent = text;
    els.stars.classList.toggle('hot', stars >= 3);
  }

  function setObjective(text, timer) {
    els.objective.textContent = timer > 0 ? `${text} (${Math.ceil(timer)} dtk)` : text;
  }

  function setSpeed(kmh, inCar) {
    els.speed.textContent = inCar ? `${Math.round(Math.abs(kmh))} km/j` : '';
  }

  function setHint(inCar) {
    els.hint.textContent = inCar
      ? 'W/S gas & rem · A/D setir · Space rem tangan · E keluar · H klakson'
      : 'WASD gerak · Shift lari · Space lompat · Mouse drag putar kamera · E masuk mobil · F pukul · Klik tembak · R reload · P pause · M mute';
  }

  function setCrosshair(visible) {
    els.crosshair.style.display = visible ? '' : 'none';
  }

  function showBanner(text, ms = 2600) {
    els.banner.textContent = text;
    els.banner.style.display = 'block';
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => {
      els.banner.style.display = 'none';
    }, ms);
  }

  function hideBanner() {
    els.banner.style.display = 'none';
    if (bannerTimer) clearTimeout(bannerTimer);
  }

  function announce(message) {
    if (els.status) els.status.textContent = message;
  }

  function setContinueVisible(visible) {
    els.btnContinue.style.display = visible ? '' : 'none';
  }

  function setSaveNote(text) {
    if (els.saveNote) els.saveNote.textContent = text;
  }

  // --- minimap -------------------------------------------------------------
  function drawMinimap(state, missionTarget, time) {
    const ctx = mapCtx;
    const size = 180;
    const half = CITY.half;
    const toMap = (x, z) => [((x + half) / (half * 2)) * size, ((z + half) / (half * 2)) * size];
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#10151d';
    ctx.fillRect(0, 0, size, size);
    // Blocks.
    ctx.fillStyle = '#232a35';
    for (const bx of [-104, -52, 0, 52, 104]) {
      for (const bz of [-104, -52, 0, 52, 104]) {
        const [mx, mz] = toMap(bx - 20, bz - 20);
        ctx.fillRect(mx, mz, (40 / (half * 2)) * size, (40 / (half * 2)) * size);
      }
    }
    // Roads.
    ctx.strokeStyle = '#4a5566';
    ctx.lineWidth = 5;
    for (const c of ROAD_CENTRES) {
      const [mx] = toMap(c, 0);
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, size);
      ctx.stroke();
      const [, mz] = toMap(0, c);
      ctx.beginPath();
      ctx.moveTo(0, mz);
      ctx.lineTo(size, mz);
      ctx.stroke();
    }
    // Ocean strip at the bottom (south).
    ctx.fillStyle = '#1d5c82';
    ctx.fillRect(0, size - 8, size, 8);
    // Mission marker: pink diamond, pulsing.
    if (missionTarget) {
      const [mx, mz] = toMap(missionTarget.x, missionTarget.z);
      const r = 5 + Math.sin(time * 4) * 1.5;
      ctx.fillStyle = '#ff5a8a';
      ctx.beginPath();
      ctx.moveTo(mx, mz - r);
      ctx.lineTo(mx + r, mz);
      ctx.lineTo(mx, mz + r);
      ctx.lineTo(mx - r, mz);
      ctx.closePath();
      ctx.fill();
    }
    // Parked and traffic cars: small amber dots.
    ctx.fillStyle = '#e0b93c';
    for (const car of [...state.parked, ...state.traffic]) {
      const [mx, mz] = toMap(car.x, car.z);
      ctx.fillRect(mx - 1.5, mz - 1.5, 3, 3);
    }
    // Police: flashing blue/red dots.
    const flash = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#3a7bff' : '#ff3a3a';
    for (const car of state.policeCars) {
      const [mx, mz] = toMap(car.x, car.z);
      ctx.beginPath();
      ctx.arc(mx, mz, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of state.footCops) {
      if (!cop.alive) continue;
      const [mx, mz] = toMap(cop.x, cop.z);
      ctx.beginPath();
      ctx.arc(mx, mz, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player: white triangle pointing along the heading.
    const [px, pz] = toMap(state.player.x, state.player.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(Math.atan2(Math.sin(state.player.heading), -Math.cos(state.player.heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#8b93a3';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('N', size - 12, 12);
  }

  return {
    els,
    setScreen,
    setMoney,
    setHp,
    setAmmo,
    setWanted,
    setObjective,
    setSpeed,
    setHint,
    setCrosshair,
    showBanner,
    hideBanner,
    announce,
    setContinueVisible,
    setSaveNote,
    drawMinimap,
  };
}

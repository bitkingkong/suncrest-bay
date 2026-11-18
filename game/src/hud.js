// HUD: DOM readouts (cash, health, wanted stars, mission objective, banners) and
// a 2D canvas minimap. All text is plain and readable at a glance.
import { CITY } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  let bannerTimer = 0;
  return {
    setCash(value) {
      el('cash').textContent = `$${Math.floor(value).toLocaleString('en-US')}`;
    },
    setHealth(value) {
      const bar = el('health-fill');
      bar.style.width = `${Math.max(0, Math.min(100, value))}%`;
      bar.style.background = value > 50 ? '#7fb069' : value > 25 ? '#e8c832' : '#e65a4e';
      el('health-text').textContent = `${Math.ceil(Math.max(0, value))}`;
    },
    setAmmo(ammo, reloading) {
      el('ammo').textContent = reloading ? 'RELOAD…' : `Pistol ${ammo}`;
    },
    setWanted(stars) {
      let out = '';
      for (let i = 0; i < 5; i += 1) out += i < stars ? '★' : '☆';
      el('wanted').textContent = out;
      el('wanted').classList.toggle('hot', stars >= 3);
    },
    setObjective(text, timer) {
      el('objective').textContent = text;
      el('objective-timer').textContent = timer > 0 ? `${Math.ceil(timer)} dtk` : '';
    },
    setSpeed(speedKmh, driving) {
      el('speed').textContent = driving ? `${Math.round(speedKmh)} km/j` : '';
    },
    setHint(text) {
      el('hint').textContent = text;
    },
    banner(text, sub, seconds = 3) {
      const b = el('banner');
      el('banner-title').textContent = text;
      el('banner-sub').textContent = sub || '';
      b.classList.add('show');
      bannerTimer = seconds;
    },
    tickBanner(dt) {
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) el('banner').classList.remove('show');
      }
    },
    showScreen(name) {
      for (const id of ['title-screen', 'pause-screen', 'busted-screen', 'wasted-screen']) {
        el(id).classList.toggle('show', id === `${name}-screen`);
      }
      el('hud').classList.toggle('hidden', name === 'title');
    },
    setTitleStats(cash, missionsDone) {
      el('title-stats').textContent = `Uang $${Math.floor(cash).toLocaleString('en-US')} · Misi selesai ${missionsDone}/3`;
    },
    setContinueVisible(visible) {
      el('btn-continue').style.display = visible ? '' : 'none';
    },
    // Minimap: roads, sea, player, cars, police (flashing), mission marker.
    drawMinimap(state) {
      const size = 180;
      const half = CITY.half + 24;
      const toMap = (x, z) => [((x + half) / (half * 2)) * size, ((z + half) / (half * 2)) * size];
      mctx.fillStyle = '#10141a';
      mctx.fillRect(0, 0, size, size);
      // Sea (south edge).
      mctx.fillStyle = '#2e7f9e';
      const [, seaY] = toMap(0, CITY.half + 15);
      mctx.fillRect(0, seaY, size, size - seaY);
      // Blocks.
      mctx.fillStyle = '#23262e';
      for (const bx of CITY.blockCenters) {
        for (const bz of CITY.blockCenters) {
          const [x, y] = toMap(bx - 20, bz - 20);
          mctx.fillRect(x, y, 40 / (half * 2) * size, 40 / (half * 2) * size);
        }
      }
      // Roads.
      mctx.strokeStyle = '#3a3f47';
      mctx.lineWidth = 3;
      for (const c of CITY.roadCenters) {
        const [x1, y1] = toMap(c, -half);
        const [x2, y2] = toMap(c, half);
        mctx.beginPath(); mctx.moveTo(x1, y1); mctx.lineTo(x2, y2); mctx.stroke();
        const [x3, y3] = toMap(-half, c);
        const [x4, y4] = toMap(half, c);
        mctx.beginPath(); mctx.moveTo(x3, y3); mctx.lineTo(x4, y4); mctx.stroke();
      }
      // Mission marker.
      if (state.missionTarget) {
        const [mx, my] = toMap(state.missionTarget.x, state.missionTarget.z);
        mctx.fillStyle = '#ff5fa2';
        mctx.beginPath();
        mctx.moveTo(mx, my - 7); mctx.lineTo(mx + 6, my); mctx.lineTo(mx, my + 7); mctx.lineTo(mx - 6, my);
        mctx.closePath(); mctx.fill();
      }
      // Traffic (yellow), parked cars (grey).
      mctx.fillStyle = '#e8c832';
      for (const car of state.traffic) {
        const [x, y] = toMap(car.x, car.z);
        mctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }
      // Police (flashing blue/red).
      const flash = Math.floor(performance.now() / 300) % 2 === 0;
      mctx.fillStyle = flash ? '#2040ff' : '#ff2020';
      for (const car of state.policeCars) {
        const [x, y] = toMap(car.x, car.z);
        mctx.beginPath(); mctx.arc(x, y, 3.5, 0, Math.PI * 2); mctx.fill();
      }
      for (const cop of state.footCops) {
        const [x, y] = toMap(cop.x, cop.z);
        mctx.beginPath(); mctx.arc(x, y, 2.5, 0, Math.PI * 2); mctx.fill();
      }
      // Player arrow (white), rotated by heading.
      const [px, py] = toMap(state.playerX, state.playerZ);
      mctx.save();
      mctx.translate(px, py);
      mctx.rotate(Math.atan2(Math.sin(state.playerHeading), Math.cos(state.playerHeading)) + Math.PI);
      mctx.fillStyle = '#ffffff';
      mctx.beginPath();
      mctx.moveTo(0, -6); mctx.lineTo(4.5, 5); mctx.lineTo(-4.5, 5);
      mctx.closePath(); mctx.fill();
      mctx.restore();
      // Border + N.
      mctx.strokeStyle = '#555c66';
      mctx.lineWidth = 1;
      mctx.strokeRect(0.5, 0.5, size - 1, size - 1);
      mctx.fillStyle = '#9aa0a8';
      mctx.font = 'bold 11px sans-serif';
      mctx.fillText('N', size - 14, 14);
    },
  };
}

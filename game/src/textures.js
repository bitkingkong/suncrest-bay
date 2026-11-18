// Suncrest Bay — procedural canvas textures.
// Every texture is painted at load from a 2D canvas: window grids for the
// tower blocks, lane dashes for the asphalt, slabs for the sidewalks and
// planks for the docks. No image files, no network, nothing copyrighted.
export function makeWindowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8a7a63';
  g.fillRect(0, 0, 128, 256);
  const cols = 5;
  const rows = 10;
  const cw = 128 / cols;
  const rh = 256 / rows;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const lit = rng.chance(0.42);
      const shade = rng.int(0, 3);
      g.fillStyle = lit ? ['#ffd97a', '#ffe9a8', '#f7c95c', '#ffdf8a'][shade] : ['#20242c', '#262b33', '#1c2027', '#2b313b'][shade];
      g.fillRect(x * cw + 3, y * rh + 4, cw - 6, rh - 8);
    }
  }
  // A darker ground-floor band: shops and doors at street level.
  g.fillStyle = '#5d5346';
  g.fillRect(0, 256 - 26, 128, 26);
  g.fillStyle = '#2c2118';
  g.fillRect(52, 256 - 24, 24, 24);
  return c;
}

export function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#33363b';
  g.fillRect(0, 0, 128, 128);
  // Speckle so the asphalt is not a flat slab.
  for (let i = 0; i < 260; i += 1) {
    const v = 40 + Math.floor(Math.random() * 26);
    g.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  // Centre dashes, repeated by the texture wrap.
  g.fillStyle = '#d8d4c2';
  g.fillRect(62, 8, 4, 44);
  g.fillRect(62, 76, 4, 44);
  return c;
}

export function makeSidewalkTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#b9b4a4';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#9a9484';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i += 1) {
    g.beginPath();
    g.moveTo(i * 32, 0);
    g.lineTo(i * 32, 128);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i * 32);
    g.lineTo(128, i * 32);
    g.stroke();
  }
  return c;
}

export function makeSandTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e0c98f';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 320; i += 1) {
    const v = 200 + Math.floor(Math.random() * 40);
    g.fillStyle = `rgb(${v},${Math.floor(v * 0.85)},${Math.floor(v * 0.55)})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  return c;
}

export function makeOceanTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#2f7fa8');
  grad.addColorStop(1, '#1d5c82');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  for (let y = 12; y < 128; y += 26) {
    g.beginPath();
    for (let x = 0; x <= 128; x += 8) g.lineTo(x, y + Math.sin(x * 0.2 + y) * 3);
    g.stroke();
  }
  return c;
}

// A soft radial glow used for the mission light pillar and the pickup rings.
export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

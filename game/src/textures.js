// Canvas-generated textures: building facades with lit windows, road asphalt with
// lane dashes, sidewalk slabs. No image files, no network, all procedural.
import * as THREE from 'three';
import { mulberry32 } from './random.js';

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

export function buildingTexture(baseColor, seed) {
  const random = mulberry32(seed);
  const [canvas, ctx] = makeCanvas(128, 256);
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);
  // Slight vertical shade at the base.
  const shade = ctx.createLinearGradient(0, 200, 0, 256);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 200, 128, 56);
  // Window grid: some lit warm, some dark.
  const cols = 6;
  const rows = 12;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = random() < 0.35;
      ctx.fillStyle = lit ? '#ffd98a' : '#2c3542';
      ctx.fillRect(10 + c * 19, 12 + r * 20, 12, 13);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(10 + c * 19, 12 + r * 20, 12, 3);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function roadTexture() {
  const [canvas, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#2e3138';
  ctx.fillRect(0, 0, 128, 128);
  // Asphalt speckle.
  for (let i = 0; i < 900; i += 1) {
    const v = Math.floor(40 + Math.random() * 30);
    ctx.fillStyle = `rgb(${v},${v},${v + 6})`;
    ctx.fillRect(Math.floor(Math.random() * 128), Math.floor(Math.random() * 128), 2, 2);
  }
  // Edge lines.
  ctx.fillStyle = '#c8c8a8';
  ctx.fillRect(0, 4, 128, 3);
  ctx.fillRect(0, 121, 128, 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function sidewalkTexture() {
  const [canvas, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#8f9296';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 32, 0);
    ctx.lineTo(i * 32, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * 32);
    ctx.lineTo(128, i * 32);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function sandTexture() {
  const [canvas, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i += 1) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(Math.floor(Math.random() * 128), Math.floor(Math.random() * 128), 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

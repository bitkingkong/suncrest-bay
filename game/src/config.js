// SUNCREST BAY — shared constants. All original: a fictional coastal city.
export const CITY = {
  blocks: 5,
  blockSize: 40,
  roadWidth: 12,
  // Road centre lines (both axes), derived: 5*40 + 6*12 = 272 wide, half 136.
  roadCenters: [-136, -84, -32, 20, 72, 124],
  blockCenters: [-110, -58, -6, 46, 98],
  half: 136,
  seaStart: 150,
};

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 7.2,
  jumpSpeed: 7.5,
  radius: 0.55,
  health: 100,
};

export const CAR = {
  accel: 16,
  brake: 26,
  reverseAccel: 10,
  maxSpeed: 30,
  maxReverse: 9,
  steerRate: 1.9,
  handbrake: 30,
  radius: 2.3,
};

export const WANTED = {
  maxStars: 5,
  decaySeconds: 25,
  policeCars: [0, 1, 2, 3, 3, 4],
  footCops: [0, 0, 1, 2, 2, 3],
};

export const MISSIONS = [
  {
    id: 'courier',
    title: 'Pesan Antar',
    giver: 'Mama Lou',
    briefing: 'Paket di Harbor harus sampai ke Diner Marina. Jangan sampai telat, Jax.',
    reward: 150,
    objectives: [
      { type: 'goto', text: 'Ambil paket di dermaga Harbor', x: -110, z: 124, radius: 5 },
      { type: 'deliver', text: 'Antar paket ke Diner Marina (90 dtk)', x: 98, z: -110, radius: 6, timeLimit: 90 },
    ],
  },
  {
    id: 'towjob',
    title: 'Mobil Titipan',
    giver: 'Dex',
    briefing: 'Comet GT merah terparkir di lot Downtown. Bawa ke bengkelku, tanpa goresan kalau bisa.',
    reward: 300,
    objectives: [
      { type: 'stealCar', text: 'Curi Comet GT merah di lot Downtown', car: 'comet' },
      { type: 'deliverCar', text: 'Bawa Comet GT ke bengkel Dex di Old Town', x: -110, z: -58, radius: 7 },
    ],
  },
  {
    id: 'heatwave',
    title: 'Panas Dingin',
    giver: 'Mama Lou',
    briefing: 'Polisi sudah mengendusmu. Bertahan 60 detik, lalu menghilang ke hideout Old Town.',
    reward: 500,
    objectives: [
      { type: 'survive', text: 'Bertahan dari kejaran polisi (60 dtk)', timeLimit: 60, wanted: 3 },
      { type: 'escape', text: 'Capai hideout di Old Town', x: -58, z: 46, radius: 6 },
    ],
  },
];

export const SAVE_KEY = 'suncrest-save-v1';
export const PALETTE = {
  sky: 0x87b5d6,
  fog: 0xa8c4d4,
  sun: 0xfff2d0,
  ground: 0x9aa078,
  sand: 0xd9c08a,
  sea: 0x2e7f9e,
  road: 0x2e3138,
  sidewalk: 0x8f9296,
  building: [0xe8b4a0, 0xa8c4b0, 0xd6c49a, 0xb0b8d6, 0xe0a8b8, 0x9fc4d6],
  carColors: [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa655, 0xe8e8e8, 0x22242a, 0x7a4a9e, 0xd97b2e],
};

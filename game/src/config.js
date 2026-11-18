// Suncrest Bay — tuning & world constants.
// One place for every number the rest of the game shares: city layout,
// player and car physics, wanted rules, combat numbers and mission payouts.
export const CITY = {
  blocks: 5, // 5x5 blocks
  blockSize: 40, // metres per block
  roadWidth: 12, // metres per road
  half: 136, // half the built-up span (5*40 + 6*12) / 2
};

// Road centre lines, one per gap between (and around) the blocks.
export const ROAD_CENTRES = [-130, -78, -26, 26, 78, 130];
// Block centre lines.
export const BLOCK_CENTRES = [-104, -52, 0, 52, 104];

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 7.5,
  jumpSpeed: 7.0,
  gravity: 20,
  radius: 0.55,
  maxHp: 100,
  punchRange: 2.2,
  punchDamage: 25,
  punchCooldown: 0.45,
  pistolAmmo: 12,
  pistolDamage: 34,
  pistolRange: 60,
  shootCooldown: 0.28,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 9,
  maxSpeed: 34,
  maxReverse: 10,
  steer: 1.9,
  handbrake: 40,
  drag: 0.55,
};

export const WANTED = {
  decaySeconds: 25, // -1 star after this long with no crime and police far away
  policeFar: 42, // police beyond this count as "far" for decay
  maxStars: 5,
  bustDistance: 2.2, // foot cop this close starts the bust clock
  bustSeconds: 1.5,
  bustFine: 100,
  wastedFine: 50,
  footCopsAt: 3, // wanted level that adds foot police
  maxPoliceCars: 4,
};

export const TRAFFIC = {
  cars: 10,
  peds: 14,
  carSpeedMin: 6,
  carSpeedMax: 11,
  pedSpeedMin: 1.1,
  pedSpeedMax: 1.9,
};

// Mission chain: name, payout, objective text and where it happens.
export const MISSIONS = [
  {
    id: 'courier',
    name: 'Pesan Antar',
    reward: 150,
    timeLimit: 90,
    giver: 'Mama Lou',
    intro: 'Mama Lou: "Jax, ambil paket di Harbor dan antar ke Diner Marina. Jangan telat!"',
  },
  {
    id: 'hotcar',
    name: 'Mobil Titipan',
    reward: 300,
    timeLimit: 0,
    giver: 'Dex',
    intro: 'Dex: "Ada Comet GT merah di lot Downtown. Bawa ke bengkelku, jangan sampai lecet."',
  },
  {
    id: 'heat',
    name: 'Panas Dingin',
    reward: 500,
    timeLimit: 60,
    giver: 'Mama Lou',
    intro: 'Mama Lou: "Polisi panas, Jax. Bertahan 60 detik, lalu menghilang ke hideout Old Town."',
  },
];

export const PICKUPS = {
  medkitHeal: 40,
  ammoAmount: 12,
};

export const SAVE_KEY = 'suncrest-bay-save-v1';

// Named places on the map (x, z). The districts give the city its story:
// Harbor by the south docks, Downtown in the middle, Marina diner by the
// east shore, Dex's garage in Old Town, the hideout tucked behind it.
export const PLACES = {
  harbor: { x: -104, z: 104, label: 'Harbor' },
  diner: { x: 104, z: 52, label: 'Diner Marina' },
  downtownLot: { x: 26, z: -26, label: 'Lot Downtown' },
  garage: { x: -52, z: -104, label: 'Bengkel Dex' },
  hideout: { x: -104, z: -52, label: 'Hideout Old Town' },
  hospital: { x: 52, z: 104, label: 'Rumah Sakit' },
  spawn: { x: -26, z: 78, label: 'Apartemen Jax' },
};

export const DISTRICT_NAMES = ['Harbor', 'Old Town', 'Downtown', 'Marina', 'Uptown'];

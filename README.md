# suncrest-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bitkingkong/suncrest-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bitkingkong/suncrest-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game built for the make.fun bounty **gta6-01** — a
procedural 3D coastal city in Three.js 0.187.0 (vendored, no network requests
at runtime). Everything is original: the fictional city of Suncrest Bay, its
characters, story and dialogue share nothing with Rockstar or GTA.

## Run it

Serve `game/` locally and open it in a desktop browser:

```sh
node serve.ts        # http://localhost:8080
```

Or open `game/index.html` directly with
`--allow-file-access-from-files` (ES modules + import map).

## The game

- **Jax Marlowe**, a hired driver new in town, takes three chained jobs from
  Mama Lou (Marina diner) and Dex (Old Town garage):
  1. **Pesan Antar** — pick up a package at Harbor pier, deliver it to the
     Marina diner within 90 seconds. $150.
  2. **Mobil Titipan** — steal the red Comet GT from the Downtown lot and
     bring it to Dex's garage. $300.
  3. **Panas Dingin** — survive 60 seconds at wanted level 3, then reach the
     Old Town hideout. $500.
- **City**: a 5×5 block grid (~272×272 m) with roads, sidewalks, procedural
  buildings, streetlights, palms, a beach and the sea; ~10 traffic cars and
  ~14 pedestrians.
- **Wanted 0–5 stars**: stealing cars, hitting pedestrians, punching and
  shooting raise it; police cars chase and ram, foot cops chase on foot.
  Busted (caught on foot) or wasted (HP 0) respawns you at the hospital with
  a fine.
- **Combat**: fists (25 dmg) and a hitscan pistol (12 rounds, R reload);
  medkit and ammo pickups scattered around the city.
- **HUD**: cash + health, wanted stars, mission objective with timer, speed,
  minimap (roads, player, traffic, flashing police, mission marker).
- **Save**: localStorage (cash, position, health, ammo, mission progress);
  autosaves on mission completion, manual Save in the pause menu, Continue
  on the title screen.
- **Sound**: synthesized WebAudio only — engine hum, two-tone siren,
  gunshots, pickups, mission jingle and a bass/hat music loop. No audio files.
- **Controls**: WASD move (Shift run, Space jump), mouse drag orbits the
  camera, E enter/exit car, F punch, left-click shoot, R reload, P/Esc pause,
  M mute, H horn. Driving: W/S gas/brake/reverse, A/D steer, Space handbrake.

## Deterministic screenshots

`shots.json` lists the four shots the build takes, all seeded (`seed=1`):

| file | scene |
| ---- | ----- |
| `1-start.jpg` | title screen over the city |
| `2-drive.jpg` | driving down an avenue, mission 1 active |
| `3-chase.jpg` | wanted 3, police cars in pursuit |
| `4-mission.jpg` | mission 2, Jax beside the red Comet GT |

`game/index.html?shot=start|play|chase|mission&seed=1` stages the scene from
the real game (no mock rendering) and sets `window.__shotReady` when painted.

## Build

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `game/` and `screenshots/` into the output dir and writes
`out/dossier.json` (schema `makefun/dossier/v1`) via the vendored make.fun
library in `vendor/makefun-game.ts`.

## Structure

- `game/index.html` — HUD DOM, screens, import map for three.js.
- `game/src/main.js` — boot + fixed-step loop + `?shot=` staging.
- `game/src/world.js` — state, simulation, screens, wanted, save/load.
- `game/src/city.js` — procedural city, colliders, parking spots.
- `game/src/render.js` — renderer, scene, follow camera.
- `game/src/vehicles.js` — car meshes, arcade driving, traffic, police.
- `game/src/people.js` — pedestrians and foot police.
- `game/src/combat.js` — fists, pistol, pickups.
- `game/src/missions.js` — the three-mission chain + beacon.
- `game/src/hud.js` — DOM HUD + minimap.
- `game/src/audio.js` — synthesized WebAudio.
- `game/src/input.js`, `game/src/config.js`, `game/src/random.js`,
  `game/src/textures.js`, `game/src/shots.js`.
- `game/vendor/three/` — vendored Three.js 0.187.0.
- `main.ts`, `serve.ts`, `shots.json`, `vendor/makefun-game.ts`.

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=tdkre7h4&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

# Suncrest Bay

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/bitkingkong/suncrest-bay/rank.svg)
![reward](https://make.fun/badge/gta6-01/bitkingkong/suncrest-bay/reward.svg)

An open-world crime game for the [gta6-01 "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) on make.fun — built entirely from original code, art, story and sound. No assets from any commercial game.

## The game

Jax Marlowe, a hired driver, has just arrived in **Suncrest Bay**, a sun-soaked coastal city of five districts — Harbor, Downtown, Old Town, Marina and Uptown. Mama Lou, who runs the Marina diner, has three jobs for him, and the city's police have very little patience.

- **Explore a living city on foot or by car** — 5×5 blocks of procedural towers, avenues with traffic, sidewalks full of pedestrians, palms along the beach and the ocean at the south edge.
- **Steal and drive cars** — parked cars and traffic are yours for the taking (press E), but stealing is a crime and the wanted stars notice.
- **Wanted 0–5 stars** — police interceptors chase and ram you; at 3 stars foot police join in and can bust you. Lay low and the heat cools off.
- **Combat** — fists (F) and a pistol (click to shoot, R to reload), with medkits and ammo boxes scattered around the city.
- **Three chained story missions** — a courier run against the clock ($150), a hot red Comet GT for Dex's garage ($300), and sixty seconds of heat before disappearing to the Old Town hideout ($500).
- **HUD with a minimap** — money, health, ammo, wanted stars, mission objective, live minimap with police and mission markers, and a speed readout while driving.
- **Save and continue** — progress autosaves after each mission and from the pause menu (localStorage), so you can pick up where Jax left off.
- **Synthesised sound** — engine hum, two-tone sirens, gunshots, pickup blips, mission jingles and a bass-and-hat loop, all generated with WebAudio. No audio files. M mutes.

## How to play

```sh
node serve.ts
```

Then open <http://localhost:8080> in desktop Chrome.

| Key | Action |
| --- | --- |
| WASD | Move / drive (W gas, S brake/reverse, A/D steer) |
| Shift | Run |
| Space | Jump / handbrake while driving |
| Mouse drag | Orbit camera |
| E | Enter / exit car |
| F | Punch |
| Click | Shoot pistol |
| R | Reload |
| H | Horn |
| P / Esc | Pause |
| M | Mute |

## Screenshots

The four screenshots in `screenshots/` are deterministic renders of the game itself (`?shot=start|play|chase|mission&seed=1`): the title over the city, driving down the avenue on mission 1, a three-star chase with police interceptors, and mission 2 beside the red Comet GT.

## Tech

- Three.js 0.187.0, vendored under `game/vendor/three/` — the only library.
- Everything else is original: the city generator, traffic and pedestrian AI, police pursuit, missions, combat, HUD, minimap and sound are all hand-written ES modules under `game/src/`.
- Static files only — no build step, no network request while playing.
- `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the kit's `vendor/makefun-game.ts`.

## License

MIT — see [LICENSE](LICENSE).

// Suncrest Bay — the deterministic screenshot scenes behind ?shot=.
// Each scene plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a scripted input, so the frame is what real
// play looks like and the same seed always gives the same frame. Steps run
// with rendering off (world.step(dt, { render: false })); the boot code
// paints the final frame for real.
import { fakeInput } from './input.js';

const STEP = 1 / 60;

function stepFor(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, { render: false });
}

export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play' || name === 'chase') {
    world.setScreen('play');
    world.startGame(true);
    // Put Jax in a parked car on the -84 avenue, heading north (into the
    // built-up city, away from the beach palms at the south edge).
    const car = state.parked.find((c) => !c.comet);
    world.teleportPlayer(car.x + 3, car.z);
    world.giveCar(car);
    car.x = -84;
    car.z = 60;
    car.heading = Math.PI;
    car.speed = 0;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = Math.PI;
    if (name === 'chase') {
      world.setWanted(3);
    } else {
      world.startMissionDebug(0);
    }
    // Drive straight down the avenue; the camera eases in behind the car.
    world.setAutopilotInput(fakeInput(1, 0));
    stepFor(world, 5);
    if (name === 'chase') {
      // The interceptors spawned during the drive; pull them in tight
      // behind the player's car for the final frame, on the same avenue,
      // then let the chase run a moment longer so they close in.
      const lead = state.drivenCar;
      state.policeCars.forEach((cop, i) => {
        const back = 3 + i * 3;
        const side = -(3 + i);
        cop.x = lead.x - Math.sin(lead.heading) * back + Math.cos(lead.heading) * side;
        cop.z = lead.z - Math.cos(lead.heading) * back - Math.sin(lead.heading) * side;
        cop.heading = lead.heading;
        cop.speed = 34;
        cop.chaseOffset = -side;
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
      });
      stepFor(world, 0.7);
    }
    world.setAutopilotInput(null);
    return { screen: 'play' };
  }
  if (name === 'mission') {
    world.setScreen('play');
    world.startGame(true);
    world.startMissionDebug(1);
    const comet = state.parked.find((c) => c.comet);
    world.teleportPlayer(comet.x + 4, comet.z + 3);
    state.player.heading = Math.atan2(comet.x - state.player.x, comet.z - state.player.z);
    state.player.mesh.rotation.y = state.player.heading;
    world.setAutopilotInput(fakeInput(0, 0));
    stepFor(world, 1.5);
    world.setAutopilotInput(null);
    // Raise the mission banner last, with a long life, so it is still up
    // when the screenshot lands.
    world.showMissionBanner(30000);
    return { screen: 'play' };
  }
  // start (default): the title screen over a slow orbit of the city.
  world.setScreen('title');
  stepFor(world, 3);
  return { screen: 'title' };
}

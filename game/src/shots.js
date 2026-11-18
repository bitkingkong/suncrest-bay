// Deterministic screenshot scenes behind ?shot=start|play|chase|mission.
// Each one stages the real game (no mock rendering), steps it forward with a
// scripted driver, and leaves a frame that a short game really looks like.
// The same seed always gives the same frame.
function fakeInput(throttle, steer) {
  return {
    moveX: () => steer,
    moveY: () => throttle,
    sprint: () => false,
    handbrake: () => false,
    mouseHeld: () => false,
    takeOrbit: () => ({ dx: 0, dy: 0 }),
    wasPressed: () => false,
    endFrame: () => {},
  };
}

function stepFor(world, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) world.step(1 / 60, { render: false });
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
    world.setAutopilotInput(null);
    return { screen: 'play' };
  }
  if (name === 'mission') {
    world.setScreen('play');
    world.startGame(true);
    world.startMissionDebug(1);
    world.showMissionBanner();
    const comet = state.parked.find((c) => c.comet);
    world.teleportPlayer(comet.x + 4, comet.z + 3);
    state.player.heading = Math.atan2(comet.x - state.player.x, comet.z - state.player.z);
    state.player.mesh.rotation.y = state.player.heading;
    world.setAutopilotInput(fakeInput(0, 0));
    stepFor(world, 1.5);
    world.setAutopilotInput(null);
    return { screen: 'play' };
  }
  // start (default): the title screen over a slow orbit of the city.
  world.setScreen('title');
  stepFor(world, 3);
  return { screen: 'title' };
}

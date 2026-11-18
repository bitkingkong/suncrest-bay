// Synthesized sound only (WebAudio): engine hum, sirens, gunshots, pickups and a
// small music loop. No audio files, no copyrighted material. Everything is
// guarded so a missing AudioContext never breaks the game.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: sawtooth through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: square wave, two alternating tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    try {
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* sound is best-effort */ }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch { /* sound is best-effort */ }
  }

  // Bass line + hats, scheduled a bar at a time. Original, 8 steps, 112 BPM.
  const BASS = [55, 0, 55, 65.4, 55, 0, 49, 58.3];
  function startMusic() {
    if (musicTimer || !ctx) return;
    const stepDur = 60 / 112 / 2;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const note = BASS[musicStep % BASS.length];
      if (note > 0) blip(note, stepDur * 0.9, 'triangle', 0.16);
      if (musicStep % 2 === 0) noiseBurst(0.03, 0.05, 6000);
      musicStep += 1;
    }, stepDur * 1000);
  }

  return {
    unlock() {
      if (ensure()) resume();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    setEngine(speed01, driving) {
      if (!ctx) return;
      try {
        engineGain.gain.value = driving ? 0.05 + speed01 * 0.08 : 0;
        engineOsc.frequency.value = 50 + speed01 * 130;
      } catch { /* ignore */ }
    },
    setSiren(on) {
      if (!ctx) return;
      try {
        sirenGain.gain.value = on && !muted ? 0.045 : 0;
        if (on) sirenOsc.frequency.value = Math.floor(performance.now() / 400) % 2 === 0 ? 700 : 950;
      } catch { /* ignore */ }
    },
    shot() {
      noiseBurst(0.12, 0.5, 1800);
    },
    punch() {
      noiseBurst(0.08, 0.35, 500);
    },
    pickup() {
      blip(660, 0.1, 'sine', 0.25);
      blip(990, 0.14, 'sine', 0.25, 0.09);
    },
    click() {
      blip(440, 0.05, 'square', 0.12);
    },
    horn() {
      blip(330, 0.25, 'square', 0.2);
      blip(415, 0.25, 'square', 0.15);
    },
    jingle() {
      [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.18, 'sine', 0.25, i * 0.12));
    },
    busted() {
      [392, 330, 262].forEach((f, i) => blip(f, 0.25, 'sawtooth', 0.2, i * 0.16));
    },
  };
}

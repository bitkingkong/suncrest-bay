// Suncrest Bay — synthesised sound, no audio files.
// Everything is WebAudio oscillators and filtered noise: an engine hum
// whose pitch follows the car's speed, a two-tone siren, gunshots, punches,
// pickup blips, a mission jingle and a quiet bass-and-hat loop. The context
// is only created on the first user gesture; if audio is unavailable the
// game simply stays silent.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      startEngine();
      startMusic();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function startEngine() {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function startMusic() {
    // A laid-back loop: a bass note and a hat tick, scheduled twice a second.
    musicTimer = setInterval(() => {
      if (!ctx || muted) return;
      const now = ctx.currentTime;
      const bassNotes = [55, 55, 65.4, 49];
      const note = bassNotes[musicStep % 4];
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = note;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.10, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 0.45);
      // Hat: a short burst of high-passed noise.
      const len = Math.floor(ctx.sampleRate * 0.05);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6000;
      const hg = ctx.createGain();
      hg.gain.value = 0.05;
      src.connect(hp);
      hp.connect(hg);
      hg.connect(master);
      src.start(now);
      musicStep += 1;
    }, 500);
  }

  function noiseBurst(duration, volume, filterFreq, type = 'lowpass') {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(now);
  }

  function blip(freq, duration, volume = 0.16, type = 'sine') {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + duration);
  }

  return {
    ensure,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    // speed 0..1: the engine hum follows the car.
    setEngine(speed, driving) {
      if (!ctx || !engineOsc) return;
      const target = driving ? 0.05 + speed * 0.11 : 0.0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speed * 130, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(300 + speed * 900, ctx.currentTime, 0.08);
    },
    setSiren(on) {
      if (!ctx) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenOsc.frequency.value = 720;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = muted ? 0 : 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        sirenTimer = 0;
      } else if (!on && sirenOsc) {
        try {
          sirenOsc.stop();
        } catch {
          /* already stopped */
        }
        sirenOsc.disconnect();
        sirenOsc = null;
        sirenGain = null;
      }
    },
    updateSiren(dt) {
      if (!sirenOsc) return;
      sirenTimer += dt;
      // Two-tone wail: 720 Hz, then 960 Hz, alternating every 0.4 s.
      sirenOsc.frequency.value = Math.floor(sirenTimer / 0.4) % 2 === 0 ? 720 : 960;
    },
    gunshot() {
      noiseBurst(0.14, 0.5, 1800);
    },
    punch() {
      noiseBurst(0.09, 0.35, 300);
      blip(90, 0.09, 0.2, 'square');
    },
    pickup() {
      blip(660, 0.09);
      setTimeout(() => blip(990, 0.12), 70);
    },
    crash() {
      noiseBurst(0.25, 0.4, 500);
    },
    horn() {
      blip(370, 0.35, 0.18, 'square');
      blip(466, 0.35, 0.14, 'square');
    },
    missionJingle() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 0.18), i * 110));
    },
    busted() {
      [392, 311, 233].forEach((f, i) => setTimeout(() => blip(f, 0.3, 0.18, 'triangle'), i * 160));
    },
    dispose() {
      if (musicTimer) clearInterval(musicTimer);
      if (ctx) ctx.close().catch(() => {});
      ctx = null;
    },
  };
}

// v3 audio: procedural WebAudio only (no samples, no licences needed except the existing hero voice clips).
// SFX: layered oscillators + filtered noise.  Music: a small generative sequencer, one theme per zone (+ boss), crossfaded.
(function () {
  const PW = window.PW, G = PW.G;
  let ac = null, master = null, sfxBus = null, musBus = null, noiseBuf = null, notes = 0;
  const st = () => (G.S && G.S.settings) || {};
  const soundOn = () => st().sound !== false;
  const pct = (k, d) => { const v = st()[k]; return (v == null ? d : v) / 100; };
  PW.audioApplyVol = () => {
    if (!ac) return; const t = ac.currentTime;
    sfxBus.gain.setTargetAtTime(soundOn() ? pct("sfxVol", 80) : 0, t, 0.05);
    musBus.gain.setTargetAtTime(soundOn() ? pct("musicVol", 50) * 0.55 : 0, t, 0.08);
  };
  PW.audioUnlock = () => {
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = new AC();
        const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5;
        master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
        sfxBus = ac.createGain(); sfxBus.connect(master); musBus = ac.createGain(); musBus.connect(master);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        PW.audioApplyVol(); startMusicLoop();
      }
      if (ac.state === "suspended") ac.resume();
    } catch (e) { /* audio is optional */ }
  };
  document.addEventListener("visibilitychange", () => { if (!ac) return; if (document.hidden) ac.suspend(); else ac.resume(); });

  // ------------------------------------------------------------ sfx primitives
  function tone(f, d, type, vol, slide, delay, bus, att) {
    if (!ac || !soundOn()) return; const t0 = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + d);
    const a = att || 0.004; g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol || 0.08, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(bus || sfxBus); o.start(t0); o.stop(t0 + d + 0.03);
  }
  function noise(d, vol, ftype, f0, f1, delay, bus, q) {
    if (!ac || !soundOn()) return; const t0 = ac.currentTime + (delay || 0), s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; fl.type = ftype || "bandpass"; fl.Q.value = q || 1; fl.frequency.setValueAtTime(f0, t0); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t0 + d);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    s.connect(fl); fl.connect(g); g.connect(bus || sfxBus); s.start(t0, Math.random() * 0.5); s.stop(t0 + d + 0.03);
  }
  let lastHit = 0;
  const SFX = {
    hit() { noise(0.09, 0.22, "bandpass", 1800, 600, 0, 0, 1.2); tone(170 + Math.random() * 50, 0.09, "square", 0.05, 0.5); },
    crit() { noise(0.14, 0.3, "bandpass", 2600, 500, 0, 0, 1); tone(420, 0.16, "sawtooth", 0.06, 0.4); tone(840, 0.2, "triangle", 0.07, 0.7, 0.03); },
    hurt() { tone(130, 0.2, "sawtooth", 0.07, 0.45); noise(0.1, 0.16, "lowpass", 900, 200); },
    down() { tone(330, 0.5, "triangle", 0.09, 0.35); tone(220, 0.6, "sine", 0.08, 0.4, 0.1); },
    swing() { noise(0.14, 0.12, "bandpass", 500, 2600, 0, 0, 1.4); },
    arrow() { noise(0.1, 0.1, "highpass", 3200, 1200); tone(900, 0.08, "triangle", 0.05, 0.4); },
    magic() { tone(520, 0.22, "sine", 0.07, 1.9); tone(780, 0.24, "triangle", 0.04, 1.6, 0.03); },
    skill() { noise(0.28, 0.14, "bandpass", 400, 3200, 0, 0, 1.6); tone(300, 0.28, "triangle", 0.07, 2.4); tone(600, 0.3, "sine", 0.04, 2, 0.05); },
    ult() { tone(110, 0.9, "sawtooth", 0.07, 3.5); noise(0.9, 0.2, "bandpass", 200, 4200, 0, 0, 0.8); [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, "triangle", 0.07, 1, 0.1 + i * 0.07)); },
    coin() { tone(988, 0.07, "square", 0.04); tone(1480, 0.14, "square", 0.04, 1, 0.06); },
    loot() { tone(660, 0.1, "triangle", 0.06, 1.5); tone(990, 0.14, "triangle", 0.05, 1.3, 0.07); },
    level() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.26, "triangle", 0.085, 1, i * 0.09)); },
    pot() { tone(480, 0.22, "sine", 0.08, 1.9); tone(720, 0.2, "sine", 0.05, 1.6, 0.08); },
    click() { tone(660, 0.05, "square", 0.025); },
    open() { tone(440, 0.09, "triangle", 0.05, 1.5); tone(660, 0.1, "triangle", 0.04, 1.3, 0.06); },
    pop() { tone(300, 0.12, "sine", 0.07, 0.4); noise(0.08, 0.1, "bandpass", 1500, 400); },
    boss() { tone(70, 0.9, "sawtooth", 0.09, 0.6); tone(105, 0.9, "square", 0.04, 0.5); noise(0.7, 0.2, "lowpass", 500, 90); },
    capture() { [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.15, "sine", 0.07, 1.05, i * 0.07)); noise(0.3, 0.07, "highpass", 4000, 6000, 0.25); },
    evolve() { [392, 494, 587, 740, 880, 1175].forEach((f, i) => tone(f, 0.4, "triangle", 0.075, 1, i * 0.1)); noise(0.8, 0.1, "highpass", 2000, 7000, 0.1); },
    zone() { tone(523, 0.5, "sine", 0.045, 1, 0, 0, 0.05); tone(784, 0.7, "sine", 0.04, 1, 0.14, 0, 0.05); },
    step() { noise(0.05, 0.05, "lowpass", 700, 300); },
  };
  PW.sfx = (k) => { if (!ac) return; const f = SFX[k]; if (f) { try { f(); } catch (e) { /* */ } } };

  // hero voice clips (v1 assets)
  const vcache = {}; let curVoice = null;
  PW.playVoice = (heroId, n) => {
    if (!soundOn() || pct("sfxVol", 80) <= 0.01) return;
    try {
      const k = heroId + "_" + n; if (!vcache[k]) { vcache[k] = new Audio("assets/audio/" + k + ".mp3"); vcache[k].preload = "auto"; }
      if (curVoice && curVoice !== vcache[k]) { curVoice.pause(); curVoice.currentTime = 0; }
      curVoice = vcache[k]; curVoice.volume = Math.min(1, pct("sfxVol", 80)); curVoice.currentTime = 0; const p = curVoice.play(); if (p && p.catch) p.catch(() => {});
    } catch (e) { /* */ }
  };

  // ------------------------------------------------------------ music
  const SC = { maj: [0, 2, 4, 5, 7, 9, 11], pent: [0, 2, 4, 7, 9], dor: [0, 2, 3, 5, 7, 9, 10], phr: [0, 1, 4, 5, 7, 8, 10], lyd: [0, 2, 4, 6, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10] };
  const TRACKS = {
    town:   { bpm: 96,  root: 57, scale: "maj",  prog: [0, 4, 5, 3], pad: "triangle", lead: "triangle", dens: 0.55, perc: 0, bass: 1 },
    meadow: { bpm: 112, root: 55, scale: "pent", prog: [0, 3, 4, 0], pad: "sine",     lead: "square",   dens: 0.7,  perc: 1, bass: 1 },
    forest: { bpm: 76,  root: 52, scale: "dor",  prog: [0, 5, 3, 4], pad: "sawtooth", lead: "sine",     dens: 0.4,  perc: 0, bass: 1 },
    desert: { bpm: 92,  root: 50, scale: "phr",  prog: [0, 1, 0, 6], pad: "sawtooth", lead: "triangle", dens: 0.55, perc: 2, bass: 1 },
    ice:    { bpm: 68,  root: 59, scale: "lyd",  prog: [0, 4, 1, 5], pad: "triangle", lead: "sine",     dens: 0.35, perc: 0, bass: 0 },
    boss:   { bpm: 142, root: 45, scale: "min",  prog: [0, 5, 3, 4], pad: "sawtooth", lead: "square",   dens: 0.8,  perc: 3, bass: 1 },
  };
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; }
  function degToMidi(T, deg) { const sc = SC[T.scale], n = sc.length, o = Math.floor(deg / n), i = ((deg % n) + n) % n; return T.root + sc[i] + 12 * o; }
  function makeMelody(id) {
    const T = TRACKS[id], r = rng(hash(id)), bars = []; let cur = 4;
    for (let b = 0; b < 8; b++) { const bar = []; for (let s = 0; s < 8; s++) { if (r() > T.dens) { bar.push(null); continue; } cur = Math.max(0, Math.min(11, cur + [-2, -1, -1, 0, 1, 1, 2][Math.floor(r() * 7)])); bar.push(cur); } bars.push(bar); }
    return bars;
  }
  let cur = null, timer = null;
  function lowQ() { return PW.quality && PW.quality() === "low"; }
  function playStep(tr, step, when) {
    const T = tr.T, bar = Math.floor(step / 16), s = step % 16, spb = 60 / T.bpm / 4, chord = T.prog[bar % 4], out = tr.out;
    const nt = (deg, dur, type, vol, delay, att) => { // note on the music bus
      const t0 = when + (delay || 0), o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = mtof(degToMidi(T, deg));
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + (att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05); notes++;
    };
    if (s === 0 && !lowQ()) { [0, 2, 4].forEach((k, i) => nt(chord + k - 7, spb * 15.5, T.pad, 0.045, i * 0.01, spb * 3)); }
    if (T.bass && (s === 0 || s === 8 || (T.perc >= 2 && (s === 6 || s === 14)))) nt(chord - 14, spb * 3, "triangle", 0.2, 0, 0.01);
    if (s % 8 === 0 && !T.bass) nt(chord - 7, spb * 7, "sine", 0.1, 0, 0.2);
    // arpeggio on 16ths in the quiet themes, melody on 8ths
    if (s % 2 === 0) { const m = tr.mel[bar % 8][s / 2]; if (m != null) nt(m, spb * 3.4, T.lead, T.lead === "square" ? 0.05 : 0.09, 0, 0.008); }
    if ((s === 3 || s === 7 || s === 11 || s === 15) && T.dens < 0.5) nt(chord + [0, 2, 4, 7][(s >> 2) & 3], spb * 2.5, "sine", 0.05, 0, 0.005);
    if (T.perc && !lowQ()) {
      const kick = (T.perc === 3 ? [0, 6, 8, 10] : T.perc === 2 ? [0, 10] : [0]).includes(s) || (T.perc === 1 && s === 8);
      if (kick) { const t0 = when, o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(42, t0 + 0.12); g.gain.setValueAtTime(0.28, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16); o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + 0.2); }
      if (T.perc >= 2 && (s === 4 || s === 12)) hat(when, out, 0.13, 1400, 0.1);
      if (s % 4 === 2 || (T.perc === 3 && s % 2 === 1)) hat(when, out, 0.05, 6000, 0.04);
    }
  }
  function hat(when, out, vol, f, d) { const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noiseBuf; fl.type = f > 3000 ? "highpass" : "bandpass"; fl.frequency.value = f; g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + d); s.connect(fl); fl.connect(g); g.connect(out); s.start(when, Math.random() * 0.5); s.stop(when + d + 0.02); }
  function pump() {
    if (!ac || ac.state !== "running" && ac.currentTime > 0.5 || !cur) return;
    const tr = cur, T = tr.T, spb = 60 / T.bpm / 4;
    if (tr.next < ac.currentTime) tr.next = ac.currentTime + 0.05;
    while (tr.next < ac.currentTime + 0.4) { playStep(tr, tr.step++, tr.next); tr.next += spb * ((tr.step & 1) && T.perc === 1 ? 1.12 : T.perc === 1 ? 0.88 : 1); }
  }
  function startMusicLoop() { if (!timer) timer = setInterval(pump, 100); }
  PW.music = (id) => {
    if (!ac || !TRACKS[id] || (cur && cur.id === id)) return;
    const t = ac.currentTime;
    if (cur) { const old = cur; old.out.gain.cancelScheduledValues(t); old.out.gain.setValueAtTime(old.out.gain.value, t); old.out.gain.linearRampToValueAtTime(0, t + 1.2); setTimeout(() => { try { old.out.disconnect(); } catch (e) { /* */ } }, 1500); }
    const out = ac.createGain(); out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(1, t + 1.4); out.connect(musBus);
    cur = { id, T: TRACKS[id], out, step: 0, next: t + 0.1, mel: makeMelody(id) }; PW.musicId = id;
  };
  // follow the player: zone theme, boss theme when a boss is awake nearby
  setInterval(() => {
    if (!ac || !G.running || !G.hero || G.paused) return; const h = G.hero;
    const boss = G.monsters.some((m) => !m.dead && PW.MONSTERS[m.type].boss && Math.hypot(m.x - h.x, m.y - h.y) < 430);
    const z = PW.zoneAt(h.x, h.y).id; PW.music(boss ? "boss" : TRACKS[z] ? z : "meadow");
  }, 600);
  PW.audioInfo = () => ({ ready: !!ac, state: ac ? ac.state : "none", track: cur ? cur.id : null, notes, music: pct("musicVol", 50), sfx: pct("sfxVol", 80), on: soundOn() });
  PW.TRACK_IDS = Object.keys(TRACKS);
})();

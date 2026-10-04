/* Neon Drift — offline top-down arcade. Classic script, no modules, no network assets. */
(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d", { alpha: false });

  var el = {
    start: document.getElementById("screen-start"),
    pause: document.getElementById("screen-pause"),
    over: document.getElementById("screen-over"),
    mute: document.getElementById("mute"),
    play: document.getElementById("btn-play"),
    resume: document.getElementById("btn-resume"),
    restart: document.getElementById("btn-restart"),
    menu: document.getElementById("btn-menu"),
    menuBest: document.getElementById("menu-best"),
    menuMeta: document.getElementById("menu-meta"),
    skillTree: document.getElementById("skill-tree"),
    pointToast: document.getElementById("point-toast"),
    ptsAvailable: document.getElementById("pts-available"),
    ptsEarned: document.getElementById("pts-earned"),
    ptsSpent: document.getElementById("pts-spent"),
    ptsLeft: document.getElementById("pts-left"),
    overScore: document.getElementById("over-score"),
    overBest: document.getElementById("over-best"),
    overWave: document.getElementById("over-wave"),
    overKills: document.getElementById("over-kills"),
    overCombo: document.getElementById("over-combo"),
    ribbon: document.getElementById("over-ribbon"),
    win: document.getElementById("screen-win"),
    winScore: document.getElementById("win-score"),
    winTime: document.getElementById("win-time"),
    winKills: document.getElementById("win-kills"),
    winUps: document.getElementById("win-ups"),
    winAgain: document.getElementById("btn-win-again"),
    winMenu: document.getElementById("btn-win-menu")
  };

  var userTag = "";
  try { userTag = new URLSearchParams(location.search).get("user") || ""; } catch (err) { userTag = ""; }
  userTag = String(userTag).replace(/[^a-zA-Z0-9._-]+/g, "").slice(0, 40);
  var KEY_BEST = userTag ? "neon-drift-best:" + userTag : "neon-drift-best";
  var KEY_MUTE = "neon-drift-mute";
  var KEY_META = userTag ? "neon-drift-meta:" + userTag : "neon-drift-meta";
  var meta = null;
  var pointToast = "";
  var MAX_HP = 6;
  var MAX_WAVE = 5;
  var ACTOR = 2.1;
  var MOVE = 1.18;
  var BG_ZOOM = 1;
  var ACCEL = 720;
  var DRAG = 1.85;
  var BOOST_DUR = 0.34;
  var ROLL_DIST = 104;
  var BOOST_CD = 1.12;
  var FIRE_CD = 0.22;

  var GUNS = [
    { id: "pistol", name: "Pistol", tier: 0, icon: "pistol", mode: "semi", desc: "Semi-auto. One shot per click.", interval: 0.22, damage: 1, pellets: 1, spread: 0, speed: 760, life: 8, pierce: 0, color: "#d7fff8", style: "bolt", radius: 3.2, bore: 2.5, blen: 5, drawW: 22, grip: [0.28, 0.72], muzzle: [0.97, 0.22] },
    { id: "rifle", name: "Assault Rifle", tier: 1, icon: "rifle", mode: "auto", desc: "Full auto. Hold to spray.", interval: 0.12, damage: 1, pellets: 1, spread: 0.05, speed: 740, life: 8, pierce: 0, color: "#c6ebff", style: "bolt", radius: 2.8, bore: 4, blen: 6.5, drawW: 48, grip: [0.34, 0.58], muzzle: [0.99, 0.28] },
    { id: "sniper", name: "Sniper", tier: 2, icon: "sniper", mode: "semi", desc: "Semi-auto. Slow, heavy, piercing.", interval: 0.78, damage: 7, pellets: 1, spread: 0, speed: 1180, life: 8, pierce: 4, color: "#f3e2a0", style: "slug", radius: 4.2, bore: 2, blen: 14, drawW: 74, grip: [0.24, 0.58], muzzle: [0.99, 0.38] },
    { id: "mg", name: "Machine Gun", tier: 1, icon: "mg", mode: "auto", desc: "Full auto. Very fast, wide, slows you.", interval: 0.07, damage: 1, pellets: 1, spread: 0.2, speed: 640, life: 8, pierce: 0, color: "#ffe27a", style: "bolt", radius: 2.6, bore: 4.5, blen: 5.5, drawW: 50, moveSlow: 0.82, grip: [0.32, 0.58], muzzle: [0.99, 0.27] }
  ];

  var gunImgs = { pistol: new Image(), rifle: new Image(), sniper: new Image(), mg: new Image() };
  var heroImg = new Image();
  var rollImgs = [new Image(), new Image(), new Image(), new Image()];
  var dayImg = new Image();
  var nightImg = new Image();
  var bunnySitImg = new Image();
  var bunnyJumpImg = new Image();
  var bunnyAtkImg = new Image();
  var hamImg = new Image();
  var hamE1 = new Image();
  var hamE2 = new Image();
  var hamE3 = new Image();
  var deerImg = new Image();
  function attachArt() {
    if (typeof GUN_SRC === "undefined") return;
    gunImgs.pistol.src = GUN_SRC.pistol;
    gunImgs.rifle.src = GUN_SRC.rifle;
    gunImgs.sniper.src = GUN_SRC.sniper;
    gunImgs.mg.src = GUN_SRC.mg;
    heroImg.src = HERO_SRC;
    rollImgs[0].src = ROLL_SRC[0];
    rollImgs[1].src = ROLL_SRC[1];
    rollImgs[2].src = ROLL_SRC[2];
    rollImgs[3].src = ROLL_SRC[3];
    dayImg.src = DAY_SRC;
    nightImg.src = NIGHT_SRC;
    bunnySitImg.src = BUNNY_SIT_SRC;
    bunnyJumpImg.src = BUNNY_JUMP_SRC;
    bunnyAtkImg.src = BUNNY_ATK_SRC;
    hamImg.src = HAM_SRC;
    hamE1.src = HAM_E1_SRC;
    hamE2.src = HAM_E2_SRC;
    hamE3.src = HAM_E3_SRC;
    deerImg.src = DEER_SRC;
  }
  window.ELAK_ATTACH_ART = attachArt;

  var deerParts = null;
  var spriteFlash = {};
  var heroFlashCanvas = null;
  var BOSSES = [
    { name: "DEER", deer: true, patterns: ["charge", "swipe"], phase2: ["charge", "swipe"], threshold: 0.5 }
  ];

  var reduceMotion = false;
  try {
    reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (err) {
    reduceMotion = false;
  }

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function fmt(n) { return Math.floor(n).toLocaleString("en-US"); }
  function len(x, y) { return Math.hypot(x, y); }

  function loadNum(key, fallback) {
    try {
      var n = Number(localStorage.getItem(key));
      return Number.isFinite(n) ? n : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function saveRaw(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (err) { /* private mode / file origin */ }
  }

  function roman(n) {
    var r = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
    return r[n] || String(n);
  }

  function waveSub(w) {
    if (w === 1) return "BUNNIES HOP IN";
    if (w === 2) return "HAMSTERS IN THE DIRT";
    if (w === 3) return "THE CLEARING FILLS";
    if (w === 4) return "LAST LIGHT";
    if (w >= 5) return "THE DEER";
    return "HOLD THE LINE";
  }

  /* ---------- audio ---------- */

  var audio = {
    ctx: null,
    master: null,
    pad: null,
    muted: loadNum(KEY_MUTE, 0) === 1,
    noise: null,
    last: {}
  };

  function audioUnlock() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audio.ctx) {
      var ctxA = new AC();
      var master = ctxA.createGain();
      master.gain.value = audio.muted ? 0 : 0.55;
      var comp = ctxA.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 5;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;
      master.connect(comp);
      comp.connect(ctxA.destination);

      var pad = ctxA.createGain();
      pad.gain.value = 0.0001;
      pad.connect(master);
      var o1 = ctxA.createOscillator();
      var o2 = ctxA.createOscillator();
      o1.type = "sine";
      o2.type = "sine";
      o1.frequency.value = 55;
      o2.frequency.value = 82.4;
      var g1 = ctxA.createGain();
      var g2 = ctxA.createGain();
      g1.gain.value = 0.5;
      g2.gain.value = 0.28;
      o1.connect(g1); g1.connect(pad);
      o2.connect(g2); g2.connect(pad);
      o1.start();
      o2.start();

      var samples = ctxA.sampleRate * 0.5;
      var buffer = ctxA.createBuffer(1, samples, ctxA.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;

      audio.ctx = ctxA;
      audio.master = master;
      audio.pad = pad;
      audio.noise = buffer;
    }
    if (audio.ctx.state === "suspended") audio.ctx.resume();
  }

  function allowSfx(name, gap) {
    var now = performance.now();
    if (audio.last[name] && now - audio.last[name] < gap) return false;
    audio.last[name] = now;
    return true;
  }

  function tone(type, freq, dur, gain, slide) {
    if (!audio.ctx || audio.muted) return;
    var t = audio.ctx.currentTime;
    var o = audio.ctx.createOscillator();
    var g = audio.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(40, freq), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(audio.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, gain, freq) {
    if (!audio.ctx || audio.muted || !audio.noise) return;
    var t = audio.ctx.currentTime;
    var src = audio.ctx.createBufferSource();
    src.buffer = audio.noise;
    var filter = audio.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq || 900, t);
    filter.frequency.exponentialRampToValueAtTime(180, t + dur);
    var g = audio.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(audio.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  var sfx = {
    shoot: function () {
      if (!allowSfx("shoot", 55)) return;
      tone("triangle", rand(680, 820), 0.06, 0.045, 240);
    },
    explode: function (big) {
      if (!allowSfx("boom", big ? 30 : 45)) return;
      noiseBurst(big ? 0.38 : 0.18, big ? 0.28 : 0.12, big ? 420 : 980);
      if (big) tone("sawtooth", 120, 0.28, 0.05, 45);
    },
    hurt: function () {
      tone("sawtooth", 240, 0.22, 0.08, 60);
      noiseBurst(0.16, 0.12, 600);
    },
    pickup: function () {
      tone("sine", 523, 0.08, 0.06, 523);
      tone("sine", 659, 0.1, 0.05, 659);
      tone("sine", 784, 0.14, 0.05, 1046);
    },
    shield: function () {
      tone("sine", 880, 0.12, 0.06, 440);
    },
    dash: function () {
      noiseBurst(0.12, 0.1, 1800);
      tone("triangle", 220, 0.12, 0.04, 660);
    },
    dart: function () {
      if (!allowSfx("dart", 80)) return;
      tone("square", 180, 0.09, 0.03, 90);
    },
    boss: function () {
      tone("sawtooth", 98, 0.45, 0.07, 42);
      noiseBurst(0.4, 0.16, 300);
    },
    graze: function () {
      if (!allowSfx("graze", 90)) return;
      tone("sine", 1480, 0.04, 0.025, 1760);
    },
    milestone: function () {
      tone("triangle", 523, 0.1, 0.05, 523);
      tone("triangle", 784, 0.16, 0.05, 988);
    },
    start: function () {
      tone("triangle", 330, 0.1, 0.05, 330);
      tone("triangle", 494, 0.16, 0.05, 740);
    },
    down: function () {
      tone("sawtooth", 311, 0.18, 0.05, 196);
      tone("triangle", 196, 0.4, 0.04, 82);
    },
    heart: function () {
      if (!allowSfx("heart", 200)) return;
      tone("sine", 78, 0.08, 0.06, 50);
    },
    tick: function () {
      tone("square", 620, 0.07, 0.04, 880);
    },
    go: function () {
      tone("triangle", 523, 0.08, 0.05, 784);
      tone("triangle", 784, 0.14, 0.05, 1046);
    }
  };

  function audioTick() {
    if (!audio.ctx || !audio.pad) return;
    var playing = G.state === "playing";
    var target = audio.muted ? 0 : (playing ? 0.05 : 0.015);
    if (playing && G.player && G.player.hp === 1) target = 0.07;
    audio.pad.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.08);
    if (audio.master) {
      audio.master.gain.setTargetAtTime(audio.muted ? 0 : 0.55, audio.ctx.currentTime, 0.03);
    }
  }

  /* ---------- input ---------- */

  var input = {
    keys: {},
    mx: 0,
    my: 0,
    seen: false,
    mouseDown: false,
    fireBuf: false
  };

  function pointerPos(e) {
    var rect = canvas.getBoundingClientRect();
    var rw = rect.width || 1;
    var rh = rect.height || 1;
    input.mx = (e.clientX - rect.left) * (G.w / rw);
    input.my = (e.clientY - rect.top) * (G.h / rh);
    input.seen = true;
  }

  /* ---------- state ---------- */

  var G = {
    w: 1280,
    h: 720,
    dpr: 1,
    scale: 1,
    state: "menu",
    time: 0,
    camX: 0,
    camY: 0,
    gridX: 0,
    gridY: 0,
    shake: 0,
    flashA: 0,
    flashC: "#ffffff",
    hitstop: 0,
    score: 0,
    shownScore: 0,
    best: loadNum(KEY_BEST, 0),
    bestAtStart: 0,
    kills: 0,
    combo: 0,
    maxCombo: 0,
    comboT: 0,
    wave: 1,
    waveT: 0,
    spawnAcc: 0,
    rockAcc: 0,
    quota: 4,
    quotaSpawned: 0,
    quotaKilled: 0,
    clearLock: false,
    countStep: 3,
    countT: 0,
    bossFallen: "",
    bgMix: 0,
    bgTarget: 0,
    boss: null,
    bossIntro: 0,
    bossLevel: 1,
    banner: "",
    bannerSub: "",
    bannerT: 0,
    toast: "",
    toastT: 0,
    grazePopup: 0,
    earlyDrop: false,
    announcedBest: false,
    deathT: 0,
    heartT: 0.8,
    stars: [],
    pbullets: [],
    ebullets: [],
    enemies: [],
    pickups: [],
    particles: [],
    soil: [],
    cracks: [],
    hooves: [],
    embers: [],
    picks: [],
    runT: 0,
    viewX: null,
    viewY: null,
    popups: [],
    ghosts: [],
    player: null
  };

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(320, window.innerWidth);
    var h = Math.max(240, window.innerHeight);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    G.w = w;
    G.h = h;
    G.dpr = dpr;
    G.scale = clamp(Math.min(w, h) / 820, 0.72, 1.35);
  }

  function announce(title, sub) {
    G.banner = title;
    G.bannerSub = sub || "";
    G.bannerT = 1.85;
  }

  function toast(text) {
    G.toast = text;
    G.toastT = 1.25;
  }

  function addShake(n) {
    var amount = reduceMotion ? n * 0.25 : n;
    G.shake = Math.min(28, G.shake + amount);
  }

  function flash(color, a) {
    G.flashC = color;
    G.flashA = Math.max(G.flashA, a);
  }

  function award(points) {
    G.score += points;
    if (G.score > G.best) {
      G.best = G.score;
      if (meta) meta.best = G.best;
      saveRaw(KEY_BEST, G.best);
      saveMeta();
      if (el.menuBest) el.menuBest.textContent = fmt(G.best);
    }
    if (!G.announcedBest && G.bestAtStart > 0 && G.score > G.bestAtStart) {
      G.announcedBest = true;
      toast("NEW BEST");
      sfx.milestone();
    }
  }

  function acquire(pool, cap) {
    for (var i = 0; i < pool.length; i++) {
      if (!pool[i].alive) return pool[i];
    }
    if (pool.length >= cap) return null;
    var obj = { alive: false };
    pool.push(obj);
    return obj;
  }

  function countAlive(pool) {
    var n = 0;
    for (var i = 0; i < pool.length; i++) if (pool[i].alive) n++;
    return n;
  }

  function burst(x, y, color, count, speed, life, size) {
    for (var i = 0; i < count; i++) {
      var p = acquire(G.particles, 420);
      if (!p) return;
      var a = Math.random() * Math.PI * 2;
      var s = speed * (0.25 + Math.random() * 0.75);
      p.alive = true;
      p.kind = "spark";
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.life = life * (0.55 + Math.random() * 0.7);
      p.max = p.life;
      p.size = size * (0.5 + Math.random());
      p.color = color;
      p.drag = 0.8 + Math.random() * 2.4;
    }
  }

  function ringFx(x, y, color, radius, life) {
    var p = acquire(G.particles, 420);
    if (!p) return;
    p.alive = true;
    p.kind = "ring";
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.life = life;
    p.max = life;
    p.size = radius;
    p.color = color;
    p.drag = 0;
  }

  function popup(x, y, text, color) {
    var p = acquire(G.popups, 36);
    if (!p) return;
    p.alive = true;
    p.x = x + rand(-6, 6);
    p.y = y;
    p.vy = -48;
    p.text = String(text);
    p.color = color || "#f4f7ff";
    p.life = 0.72;
    p.max = 0.72;
  }

  function gunById(id) {
    for (var i = 0; i < GUNS.length; i++) if (GUNS[i].id === id) return GUNS[i];
    return GUNS[0];
  }

  function gunImage(id) {
    return gunImgs[id] || gunImgs.pistol;
  }

  function gunDef() {
    return gunById(G.gun || "pistol");
  }

  function gunLevelOf(id) {
    if (!G.gunLvs) return 1;
    return G.gunLvs[id] || 1;
  }

  function gunLevel() {
    return gunLevelOf(G.gun || "pistol");
  }

  function fireInterval() {
    return gunDef().interval * Math.pow(0.9, gunLevel() - 1);
  }

  function shotDamage() {
    return gunDef().damage + gunLevel() - 1;
  }

  function gunPellets(g) {
    var lv = gunLevelOf(g.id);
    if (g.pellets > 1) return g.pellets + Math.floor((lv - 1) / 2);
    return 1;
  }

  function speedMul() {
    return 1 + 0.12 * (G.speedLv || 0);
  }

  function dashCooldown() {
    return BOOST_CD;
  }

  function gunStats(g) {
    var bits = ["DMG " + g.damage, g.interval.toFixed(2) + "s"];
    if (g.pellets > 1) bits.push(g.pellets + " PELLETS");
    else if (g.spread) bits.push("SPREAD");
    if (g.pierce) bits.push("PIERCE " + g.pierce);
    return bits.join(" · ");
  }

  function waveQuota(wave) {
    if (wave % 5 === 0) return 0;
    return Math.min(36, 4 + (wave - 1) * 2);
  }

  function threatCounts() {
    var alive = 0;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.alive && e.quota) alive++;
    }
    if (G.wave % 5 === 0) {
      if (G.bossIntro > 0 && !(G.boss && G.boss.alive)) alive += 1;
      var total = Math.max(1, alive + (G.quotaKilled || 0));
      return { left: Math.min(alive, total), total: total };
    }
    var pending = Math.max(0, (G.quota || 0) - (G.quotaSpawned || 0));
    return { left: alive + pending, total: G.quota || 0 };
  }

  function bossProfile() {
    return BOSSES[0];
  }


  function bossName() {
    return bossProfile().name;
  }

  function spawnPBullet(x, y, angle, opts) {
    opts = opts || {};
    var b = acquire(G.pbullets, 160);
    if (!b) return;
    var speed = (opts.speed || 760) * G.scale;
    b.alive = true;
    b.x = x;
    b.y = y;
    b.px = x;
    b.py = y;
    b.vx = Math.cos(angle) * speed;
    b.vy = Math.sin(angle) * speed;
    b.r = (opts.radius || 3.4) * G.scale * 1.5;
    b.life = 99;
    b.maxLife = 99;
    var vis = opts.bwid ? { bwid: opts.bwid, blen: opts.blen || 4 } : bulletVisual(opts.id ? opts : gunDef());
    if (opts.bwid) vis = { bwid: opts.bwid, blen: opts.blen || 4 };
    else if (opts.drawW) vis = bulletVisual(opts);
    else vis = { bwid: opts.bwid || 1.5, blen: opts.blen || 4 };
    b.bwid = opts.bwid ? vis.bwid * 1.5 : vis.bwid;
    b.blen = opts.bwid ? vis.blen * 1.5 : vis.blen;
    b.drone = !!opts.drone;
    b.pierce = b.drone ? 0 : (opts.pierce || 0);
    b.style = opts.style || "bolt";
    b.color = opts.color || "#d7fff8";
    b.dmg = opts.dmg != null ? opts.dmg : shotDamage();
    b.hits = 0;
    b.struck = [];
  }

  function spawnEBullet() {
    return;
  }


  function pickType(wave) {
    if (wave <= 1) return "bunny";
    var ham = wave === 2 ? 0.34 : wave === 3 ? 0.4 : 0.48;
    return Math.random() < ham ? "hamster" : "bunny";
  }


  function spawnEnemy(type, x, y, opts) {
    opts = opts || {};
    if (type !== "bunny" && type !== "hamster" && type !== "boss") type = "bunny";
    var e = acquire(G.enemies, 64);
    if (!e) return null;
    var sc = G.scale;
    var elite = !!opts.elite;
    e.alive = true;
    e.type = type;
    e.x = x;
    e.y = y;
    e.px = x;
    e.py = y;
    e.vx = 0;
    e.vy = 0;
    e.angle = rand(0, Math.PI * 2);
    e.spin = 0;
    e.t = Math.random() * 8;
    e.fireCd = 0;
    e.warning = 0;
    e.dashVx = 0;
    e.dashVy = 0;
    e.elite = elite;
    e.child = false;
    e.quota = type === "boss" || !!opts.quota;
    e.big = false;
    e.entered = false;
    e.armor = 0;
    e.hitFlash = 0;
    e.orbit = 0;
    e.orbitR = 0;
    e.orbitDir = 1;
    e.pattern = 0;
    e.attackT = 0;
    e.shape = null;
    e.color = "#f4d7c4";
    e.points = 100;
    e.br = 14 * ACTOR;
    e.deer = false;
    e.landT = 0;

    if (type === "bunny") {
      e.br = (elite ? 16 : 14) * ACTOR;
      e.color = "#ffd5e0";
      e.points = elite ? 200 : 90;
      e.hp = (elite ? 3 : 1) + (G.wave >= 4 ? 1 : 0);
      e.hop = "sit";
      e.hopDur = rand(0.5, 0.8);
      e.hopT = e.hopDur;
      e.face = (G.player && G.player.x < x) ? -1 : 1;
      e.gx = x;
      e.gy = y;
      e.hx0 = x;
      e.hy0 = y;
      e.hx1 = x;
      e.hy1 = y;
    } else if (type === "hamster") {
      e.br = 15 * ACTOR;
      e.color = "#e8c9a0";
      e.points = 170;
      e.hp = 4 + (G.wave >= 4 ? 2 : 0);
      e.burrow = "dig";
      e.burrowT = rand(0.05, 0.35);
      e.face = 1;
      e.swipeCd = 0.4;
      e.gy = y;
      e.farT = 0;
      e.wobble0 = rand(0, Math.PI * 2);
      e.digPhase = rand(0, 4);
      e.soilT = 0;
    } else if (type === "boss") {
      var diff = Math.pow(1.55, Math.max(0, (G.bossLevel || 1) - 1));
      e.deer = true;
      e.br = 34 * ACTOR;
      e.color = "#f0e2c8";
      e.points = Math.round(2500 * diff);
      e.hp = Math.round(380 * diff);
      e.armor = 0;
      e.deerState = "walk";
      e.deerT = 0.7;
      e.face = -1;
      e.chain = 0;
      e.phase = 1;
      e.chargeA = 0;
      e.chargeSp = 0;
      e.chargeHit = false;
      e.skid = 0;
      e.pawDur = 0.8;
      e.pawKick = -1;
      e.hoofT = 0;
      e.landT = 0;
    }

    e.maxHp = e.hp;
    e.r = e.br * sc;
    if (type !== "boss") ringFx(x, y, e.color, e.r * 2.4, 0.28);
    return e;
  }


  function edgePoint() {
    var m = 36;
    var side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: rand(0, G.w), y: -m };
    if (side === 1) return { x: G.w + m, y: rand(0, G.h) };
    if (side === 2) return { x: rand(0, G.w), y: G.h + m };
    return { x: -m, y: rand(0, G.h) };
  }

  function farPoint() {
    var p = G.player;
    var best = edgePoint();
    var bestD = 0;
    for (var i = 0; i < 8; i++) {
      var q = edgePoint();
      var d = len(q.x - p.x, q.y - p.y);
      if (d > bestD) {
        bestD = d;
        best = q;
      }
    }
    return best;
  }

  function spawnPickup(x, y, type) {
    if (!type) {
      var roll = Math.random();
      if (roll < 0.28) type = "shield";
      else if (roll < 0.56) type = "triple";
      else if (roll < 0.82) type = "slow";
      else type = "repair";
    }
    if (countAlive(G.pickups) >= 5) return;
    var p = acquire(G.pickups, 8);
    if (!p) return;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.type = type;
    p.t = 0;
    p.life = 12;
    p.r = 16 * G.scale;
    var tags = { shield: "SHIELD", triple: "TRIPLE", slow: "SLOW-MO", repair: "REPAIR" };
    popup(x, y - 22, tags[type] || "POWER", "#ffe7c2");
  }

  function maybeDrop() {}

  function registerKill(e) {
    if (G.comboT > 0) G.combo += 1;
    else G.combo = 1;
    G.comboT = 2.4;
    if (G.combo > G.maxCombo) G.maxCombo = G.combo;
    var player = G.player;
    var speed = len(player.vx, player.vy);
    var terminal = (ACCEL / DRAG) * G.scale;
    var drift = speed > terminal * 0.78;
    var pts = e.points * G.combo * (drift ? 2 : 1);
    award(pts);
    popup(e.x, e.y - 8, "+" + pts, drift ? "#ffc14a" : "#f4f7ff");
    if (drift) popup(e.x, e.y - 28, "DRIFT", "#ffc14a");
    var names = { 8: "RAMPAGE", 15: "UNSTOPPABLE", 25: "NEON GOD" };
    if (names[G.combo]) {
      toast(names[G.combo]);
      sfx.milestone();
    }
    G.kills += 1;
  }

  function killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    registerKill(e);
    if (e.quota) G.quotaKilled++;
    var big = e.type === "boss" || e.big;
    burst(e.x, e.y, e.color, big ? 46 : 16, big ? 280 : 180, big ? 0.7 : 0.4, big ? 4.5 : 2.6);
    ringFx(e.x, e.y, e.color, (big ? 90 : 28) * G.scale, big ? 0.45 : 0.28);
    sfx.explode(big || e.elite);
    addShake(big ? 18 : e.elite ? 5 : 2.2);
    if (e.type === "boss") {
      flash("#ff3b6b", 0.85);
      G.hitstop = 0.1;
      onBossDown(e.x, e.y);
      checkWaveClear();
      return;
    }
    maybeDrop(e);
    checkWaveClear();
  }

  function livingQuota() {
    var n = 0;
    for (var i = 0; i < G.enemies.length; i++) {
      if (G.enemies[i].alive && G.enemies[i].quota) n++;
    }
    return n;
  }

  function checkWaveClear() {
    if (G.clearLock || G.state !== "playing") return;
    if (G.wave % 5 === 0) {
      if (G.bossIntro > 0) return;
      if (G.boss && G.boss.alive) return;
      if (livingQuota() > 0) return;
    } else {
      if (G.quotaSpawned < G.quota) return;
      if (livingQuota() > 0) return;
    }
    if (G.wave >= MAX_WAVE) {
      G.clearLock = true;
      winGame();
      return;
    }
    G.clearLock = true;
    G.pendingWave = true;
    if (G.player) {
      G.player.hp = G.player.maxHp;
      G.player.shieldHits = G.armorMax || 0;
      G.player.heartShake = 0;
    }
    if (G.wave % 5 === 0) G.bgTarget = 0;
    beginCountdown();
  }

  function damageEnemy(e, dmg) {
    if (!e.alive) return;
    if (e.armor > 0) {
      burst(e.x, e.y, "#ffffff", 4, 80, 0.2, 2);
      return;
    }
    e.hp -= dmg;
    e.hitFlash = 0.07;
    if (e.hp <= 0) killEnemy(e);
    else burst(e.x, e.y, "#ffffff", 4, 90, 0.18, 1.6);
  }

  function setShieldHits(player, next) {
    if (next === player.shieldHits) return;
    player.shieldFlash = 0.26;
    player.shieldFlashLo = Math.min(player.shieldHits, next);
    player.shieldFlashHi = Math.max(player.shieldHits, next);
    player.shieldHits = next;
  }

  function applyPickup(type) {
    var player = G.player;
    sfx.pickup();
    if (type === "shield") {
      flash("#3dfff2", 0.45);
      var shieldCap = 3;
      if (player.shieldHits >= shieldCap) award(250);
      else if (player.shieldHits <= 0) setShieldHits(player, Math.min(3, shieldCap));
      else setShieldHits(player, Math.min(shieldCap, player.shieldHits + 1));
      popup(player.x, player.y - 20, "SHIELD", "#3dfff2");
    } else if (type === "triple") {
      flash("#ff2bd6", 0.4);
      player.tripleT = 8;
      popup(player.x, player.y - 20, "TRIPLE", "#ff2bd6");
    } else if (type === "slow") {
      flash("#ffc14a", 0.4);
      player.slowT = 5.2;
      popup(player.x, player.y - 20, "SLOW-MO", "#ffc14a");
    } else if (type === "repair") {
      flash("#7dffb3", 0.4);
      if (player.hp >= player.maxHp) award(250);
      else player.hp = Math.min(player.maxHp, player.hp + 2);
      popup(player.x, player.y - 20, "REPAIR", "#7dffb3");
    }
  }

  function strikeDamage(kind) {
    var w = G.wave || 1;
    if (kind === "boss") return 2;
    if (kind === "charge") return 3;
    if (kind === "shock") return 2;
    if (kind === "bunny" || kind === "hamster") return 1;
    if (w <= 4) return 1;
    return 2;
  }

  function hurtPlayer(fromX, fromY, dmg) {
    var player = G.player;
    if (G.state !== "playing" || !player.alive) return;
    if (player.iframes > 0) return;
    if (dmg == null) dmg = 1;
    if (player.shieldHits > 0) {
      if (player.shieldCd > 0) return;
      player.armorCrack = player.shieldHits - 1;
      player.armorCrackT = 0.34;
      setShieldHits(player, player.shieldHits - 1);
      player.hitFlash = 0.12;
      player.shieldCd = 0.38;
      player.iframes = Math.max(player.iframes, 0.28);
      sfx.shield();
      burst(player.x, player.y, "#d5dde4", 10, 140, 0.28, 2);
      addShake(5);
      return;
    }
    player.hitFlash = 0.12;
    player.heartShake = 0.32;
    player.hp = Math.max(0, player.hp - dmg);
    player.iframes = 0.75;
    sfx.hurt();
    burst(fromX, fromY, "#ff3b6b", 16, 200, 0.35, 2.2);
    addShake(15);
    flash("#ff3b6b", 0.55);
    if (player.hp <= 0) die();
  }

  function die() {
    var player = G.player;
    player.alive = false;
    player.hp = 0;
    G.state = "dying";
    G.deathT = 1.15;
    burst(player.x, player.y, "#3dfff2", 40, 320, 0.7, 3.5);
    burst(player.x, player.y, "#ff2bd6", 24, 260, 0.6, 3);
    ringFx(player.x, player.y, "#ffffff", 120 * G.scale, 0.5);
    sfx.explode(true);
    addShake(22);
  }

  function onBossDown(bx, by) {
    var fallen = bossName();
    G.bossFallen = fallen;
    var bonus = 1500 + G.bossLevel * 400;
    award(bonus);
    popup(bx, by - 24, "+" + bonus, "#ffc14a");
    G.boss = null;
    G.bossLevel += 1;
    if (livingQuota() > 0) announce("SUMMONS LEFT", "CLEAR THEM TO ADVANCE");
  }

  function beginBoss() {
    G.bossIntro = 1.7;
    announce(bossName(), "BOSS WAVE");
    sfx.boss();
    addShake(10);
  }

  function spawnBossNow() {
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (!e.alive) continue;
      burst(e.x, e.y, e.color, 6, 90, 0.25, 2);
      e.alive = false;
    }
    for (var j = 0; j < G.ebullets.length; j++) G.ebullets[j].alive = false;
    var boss = spawnEnemy("boss", G.w * 0.5, -40);
    if (!boss) return;
    boss.y = G.h * 0.28;
    G.boss = boss;
    ringFx(boss.x, boss.y, "#ff3b6b", 80 * G.scale, 0.5);
  }

  function thrustVector() {
    var k = input.keys;
    var x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    var y = (k.KeyS || k.ArrowDown ? 1 : 0) - (k.KeyW || k.ArrowUp ? 1 : 0);
    var l = len(x, y);
    if (l > 0) return { x: x / l, y: y / l };
    return { x: 0, y: 0 };
  }

  function tryBoost() {
    if (G.state !== "playing") return;
    var player = G.player;
    if (!player.alive || player.boostCd > 0 || player.boostT > 0) return;
    var v = thrustVector();
    var a = (v.x === 0 && v.y === 0) ? player.angle : Math.atan2(v.y, v.x);
    player.boostT = BOOST_DUR;
    player.boostDur = BOOST_DUR;
    player.boostCd = dashCooldown();
    player.iframes = Math.max(player.iframes, BOOST_DUR);
    player.rollA = a;
    player.rollX = player.x;
    player.rollY = player.y;
    player.rollDist = ROLL_DIST * G.scale;
    player.rollDust = 0;
    player.vx = Math.cos(a) * (player.rollDist / BOOST_DUR);
    player.vy = Math.sin(a) * (player.rollDist / BOOST_DUR);
    G.ghosts = [];
    sfx.dash();
    burst(player.x, player.y + 12 * G.scale, "#c4a574", 5, 50, 0.22, 2);
    addShake(2);
  }

  function hitSweep(x1, y1, x2, y2, cx, cy, rad) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len2 = dx * dx + dy * dy;
    var t = 0;
    if (len2 > 0.0001) {
      t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
    }
    var px = x1 + dx * t - cx;
    var py = y1 + dy * t - cy;
    return px * px + py * py <= rad * rad;
  }

  function resetRun() {
    G.pbullets = [];
    G.ebullets = [];
    G.enemies = [];
    G.pickups = [];
    G.particles = [];
    G.soil = [];
    G.popups = [];
    G.ghosts = [];
    G.score = 0;
    G.shownScore = 0;
    G.kills = 0;
    G.combo = 0;
    G.maxCombo = 0;
    G.comboT = 0;
    G.wave = 1;
    G.waveT = 0;
    G.spawnAcc = 0.75;
    G.rockAcc = 2;
    G.quota = waveQuota(1);
    G.quotaSpawned = 0;
    G.quotaKilled = 0;
    G.clearLock = false;
    G.countStep = 3;
    G.countT = 0;
    G.bossFallen = "";
    G.bgMix = 0;
    G.bgTarget = 0;
    G.boss = null;
    G.bossIntro = 0;
    G.bossLevel = 1;
    G.gun = "pistol";
    G.gunLvs = { pistol: 1, rifle: 1, sniper: 1, mg: 1 };
    G.speedLv = 0;
    G.armorMax = 0;
    G.pals = 0;
    G.palPos = [];
    G.palAng = 0;
    G.palCd = 0.4;
    G.offers = [];
    G.pendingWave = false;
    G.droneT = 0;
    G.droneAng = 0;
    G.dronePos = [];
    G.toast = "";
    G.toastT = 0;
    G.grazePopup = 0;
    G.earlyDrop = false;
    G.announcedBest = false;
    G.deathT = 0;
    G.hitstop = 0;
    G.shake = 0;
    G.flashA = 0;
    G.heartT = 1;
    G.bestAtStart = G.best;
    G.picks = [];
    G.runT = 0;
    G.cracks = [];
    G.hooves = [];
    G.embers = [];
    G.viewX = null;
    G.viewY = null;
    G.player = {
      x: G.w * 0.5,
      y: G.h * 0.62,
      vx: 0,
      vy: 0,
      angle: 0,
      face: 1,
      hitFlash: 0,
      r: 13 * ACTOR * G.scale,
      hp: MAX_HP,
      maxHp: MAX_HP,
      iframes: 1.35,
      fireCd: 0,
      stepMark: -1,
      heartShake: 0,
      armorCrack: -1,
      armorCrackT: 0,
      shieldHits: 0,
      shieldFlash: 0,
      shieldFlashLo: 0,
      shieldFlashHi: 0,
      shieldCd: 0,
      tripleT: 0,
      slowT: 0,
      boostT: 0,
      boostCd: 0.4,
      alive: true
    };
    announce("WAVE 1", waveSub(1));
    applyLoadout();
  }

  /* ---------- update ---------- */

  function updateParticles(dt) {
    for (var i = 0; i < G.particles.length; i++) {
      var p = G.particles[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      var drag = Math.exp(-(p.drag || 1) * dt);
      p.vx *= drag;
      p.vy *= drag;
    }
    if (G.soil) {
      for (var s = 0; s < G.soil.length; s++) {
        var mark = G.soil[s];
        if (!mark.alive) continue;
        mark.life -= dt;
        if (mark.life <= 0) mark.alive = false;
      }
    }
    for (var j = 0; j < G.popups.length; j++) {
      var pop = G.popups[j];
      if (!pop.alive) continue;
      pop.life -= dt;
      pop.y += pop.vy * dt;
      if (pop.life <= 0) pop.alive = false;
    }
  }

  function updatePlayer(dt) {
    var player = G.player;
    var sc = G.scale;
    player.r = 13 * ACTOR * sc;
    var v = thrustVector();
    var rolling = player.boostT > 0;
    if (rolling) {
      var dur = player.boostDur || BOOST_DUR;
      var u = 1 - player.boostT / dur;
      if (u < 0) u = 0;
      if (u > 1) u = 1;
      player.x = player.rollX + Math.cos(player.rollA) * player.rollDist * u;
      player.y = player.rollY + Math.sin(player.rollA) * player.rollDist * u;
      player.vx = Math.cos(player.rollA) * (player.rollDist / dur);
      player.vy = Math.sin(player.rollA) * (player.rollDist / dur);
      player.rollDust -= dt;
      if (player.rollDust <= 0) {
        player.rollDust = 0.05;
        burst(player.x, player.y + 16 * sc, "#c4a574", 2, 36, 0.18, 2);
      }
      player.wasRoll = true;
    } else {
      if (player.wasRoll) {
        player.wasRoll = false;
        player.squish = 0.16;
        burst(player.x, player.y + 14 * sc, "#c4a574", 7, 60, 0.24, 2);
      }
      var accel = ACCEL * sc * MOVE * speedMul();
      var holdFire = !!(input.mouseDown || input.keys.Space);
      var slow = gunDef().moveSlow;
      if (slow && holdFire) accel *= slow;
      player.vx += v.x * accel * dt;
      player.vy += v.y * accel * dt;
      var drag = Math.exp(-DRAG * dt);
      player.vx *= drag;
      player.vy *= drag;
      if (slow && holdFire) {
        var slowDrag = Math.exp(-0.55 * dt);
        player.vx *= slowDrag;
        player.vy *= slowDrag;
      }
      player.x += player.vx * dt;
      player.y += player.vy * dt;
    }
    var pad = player.r + 2;
    if (player.x < pad) { player.x = pad; player.vx *= -0.35; }
    if (player.y < pad) { player.y = pad; player.vy *= -0.35; }
    if (player.x > G.w - pad) { player.x = G.w - pad; player.vx *= -0.35; }
    if (player.y > G.h - pad) { player.y = G.h - pad; player.vy *= -0.35; }

    if (!input.seen) {
      input.mx = G.w * 0.5;
      input.my = G.h * 0.5 - 60;
    }
    var dx = input.mx - player.x;
    var dy = input.my - player.y;
    if (dx * dx + dy * dy > 36) {
      player.angle = Math.atan2(dy, dx);
      if (Math.abs(dx) > 6) player.face = dx < 0 ? -1 : 1;
    }

    player.fireCd = Math.max(0, player.fireCd - dt);
    var gunMode = gunDef().mode || "semi";
    var trigger = gunMode === "auto" ? (input.mouseDown || !!input.keys.Space) : input.fireBuf;
    if (trigger && player.fireCd <= 0) {
      firePlayerGun(player);
      player.fireCd = fireInterval();
      if (gunMode !== "auto") input.fireBuf = false;
    }
    if (player.boostT <= 0 && len(player.vx, player.vy) > 48) {
      var stepRate = 7.2 + Math.min(4.5, len(player.vx, player.vy) / 100);
      var stepMark = Math.floor(G.time * stepRate / Math.PI);
      if (player.stepMark !== stepMark) {
        player.stepMark = stepMark;
        burst(player.x, player.y + 18 * sc, "#efe6cf", 3, 26, 0.22, 1.3);
        burst(player.x + rand(-4, 4), player.y + 16 * sc, "#7dce55", 2, 22, 0.18, 1.4);
      }
    }
    updatePals(dt);

    if (player.iframes > 0) player.iframes -= dt;
    if (player.shieldCd > 0) player.shieldCd -= dt;
    if (player.shieldFlash > 0) player.shieldFlash = Math.max(0, player.shieldFlash - dt);
    if (player.hitFlash > 0) player.hitFlash = Math.max(0, player.hitFlash - dt);
    if (player.heartShake > 0) player.heartShake = Math.max(0, player.heartShake - dt);
    if (player.armorCrackT > 0) player.armorCrackT = Math.max(0, player.armorCrackT - dt);
    if (player.tripleT > 0) player.tripleT -= dt;
    if (player.slowT > 0) player.slowT -= dt;
    if (player.boostT > 0) player.boostT -= dt;
    if (player.boostCd > 0) player.boostCd -= dt;
    if (player.squish > 0) player.squish -= dt;

    var moving = len(player.vx, player.vy);
    if (!rolling && moving > 80) {
      var fx = Math.cos(player.angle);
      var fy = Math.sin(player.angle);
      var forward = player.vx * fx + player.vy * fy;
      var lx = player.vx - fx * forward;
      var ly = player.vy - fy * forward;
      if (len(lx, ly) > 90 * sc && Math.random() < 0.35) {
        burst(player.x, player.y + 10, "#c4a574", 2, 40, 0.16, 1.6);
      }
    }
  }

  function nearestEnemy() {
    var player = G.player;
    var best = null;
    var bestD = 1e9;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (!e.alive) continue;
      var d = len(e.x - player.x, e.y - player.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  function updatePals(dt) {
    var n = G.pals || 0;
    G.palPos = [];
    if (!n || !G.player || !G.player.alive) return;
    G.palAng = (G.palAng || 0) + dt * 1.7;
    G.palCd = (G.palCd || 0) - dt;
    var foe = nearestEnemy();
    var shoot = G.palCd <= 0 && foe;
    if (shoot) G.palCd = Math.max(0.45, 0.85 - n * 0.08);
    var i;
    for (i = 0; i < n; i++) {
      var ang = G.palAng + (i / n) * Math.PI * 2;
      var x = G.player.x + Math.cos(ang) * 34 * G.scale;
      var y = G.player.y + 18 * G.scale + Math.sin(ang) * 16 * G.scale;
      G.palPos.push({ x: x, y: y });
      if (shoot) {
        spawnPBullet(x, y, Math.atan2(foe.y - y, foe.x - x), {
          dmg: 1, pierce: 0, speed: 540, radius: 2.4, style: "bolt", color: "#b6f27a", bwid: 1.5, blen: 4, straight: true
        });
      }
    }
  }

  function faceBunny(e) {
    var dx = G.player.x - e.x;
    if (Math.abs(dx) > 3) e.face = dx < 0 ? -1 : 1;
  }

  function bunnyInMelee(e) {
    return len(G.player.x - e.x, G.player.y - e.y) < 50 * ACTOR * G.scale + G.player.r;
  }

  function beginBunnySit(e, lo, hi) {
    e.hop = "sit";
    e.hopDur = rand(lo, hi);
    e.hopT = e.hopDur;
    e.gx = e.x;
    e.gy = e.y;
    e.vx = 0;
    e.vy = 0;
  }

  function beginBunnyAttack(e) {
    faceBunny(e);
    e.hop = "atk";
    e.hopDur = 0.3;
    e.hopT = 0.3;
    e.gx = e.x;
    e.gy = e.y;
    e.vx = 0;
    e.vy = 0;
  }

  function beginBunnyHop(e) {
    var player = G.player;
    faceBunny(e);
    var dx = player.x - e.x;
    var dy = player.y - e.y;
    var d = len(dx, dy) || 1;
    if (bunnyInMelee(e)) {
      beginBunnyAttack(e);
      return;
    }
    var hop = rand(e.elite ? 90 : 80, e.elite ? 120 : 110) * ACTOR * G.scale;
    var travel = Math.min(hop, Math.max(18 * G.scale, d - 36 * G.scale));
    e.hx0 = e.x;
    e.hy0 = e.y;
    e.hx1 = clamp(e.x + (dx / d) * travel, 28, G.w - 28);
    e.hy1 = clamp(e.y + (dy / d) * travel, 28, G.h - 28);
    e.hop = "hop";
    var span = len(e.hx1 - e.hx0, e.hy1 - e.hy0);
    e.hopDur = clamp(0.22 + span / (420 * G.scale), 0.22, 0.42);
    e.hopT = e.hopDur;
    e.vx = 0;
    e.vy = 0;
  }

  function bunnySwipe(e) {
    var player = G.player;
    if (!player || !player.alive) return;
    faceBunny(e);
    var forward = e.face || -1;
    var ox = e.x + forward * 8 * G.scale;
    var oy = e.y;
    var dx = player.x - ox;
    var dy = player.y - oy;
    if (len(dx, dy) > 42 * ACTOR * G.scale + player.r) return;
    if (dx * forward < 0) return;
    if (Math.abs(Math.atan2(dy, dx * forward)) > 0.9) return;
    hurtPlayer(ox, oy, 1);
    burst(ox + forward * 18 * G.scale, oy, "#ffd0dc", 8, 110, 0.2, 2);
  }

  function updateBunny(e, sdt) {
    e.vx = 0;
    e.vy = 0;
    if (e.landT > 0) e.landT -= sdt;
    if (e.hop !== "hop") faceBunny(e);
    e.hopT -= sdt;
    if (e.hop === "hop") {
      var u = 1 - Math.max(0, e.hopT) / (e.hopDur || 0.3);
      if (u > 1) u = 1;
      var gx = e.hx0 + (e.hx1 - e.hx0) * u;
      var gy = e.hy0 + (e.hy1 - e.hy0) * u;
      var bounce = Math.sin(u * Math.PI) * 16 * G.scale;
      e.gx = gx;
      e.gy = gy;
      e.x = gx;
      e.y = gy - bounce;
      if (e.hopT <= 0) {
        e.x = e.hx1;
        e.y = e.hy1;
        e.gx = e.x;
        e.gy = e.y;
        e.landT = 0.14;
        burst(e.x, e.y + 6 * G.scale, "#c4a574", 5, 50, 0.22, 1.8);
        if (bunnyInMelee(e)) beginBunnyAttack(e);
        else beginBunnySit(e, 0.5, 0.8);
      }
      return;
    }
    if (e.hop === "atk") {
      if (e.hopT <= 0) {
        bunnySwipe(e);
        beginBunnySit(e, 0.55, 0.85);
      }
      return;
    }
    if (e.hopT <= 0) beginBunnyHop(e);
  }

  function faceHamster(e) {
    var dx = G.player.x - e.x;
    if (Math.abs(dx) > 3) e.face = dx < 0 ? -1 : 1;
  }

  function hamsterLeap(e) {
    var player = G.player;
    if (!player || !player.alive) return;
    if (len(player.x - e.x, player.y - e.y) < 40 * ACTOR * G.scale + player.r) {
      hurtPlayer(e.x, e.y, 1);
      burst(e.x, e.y - 8, "#e8c9a0", 8, 90, 0.2, 2);
    }
  }

  function hamsterSwipe(e) {
    var player = G.player;
    if (!player || !player.alive) return;
    faceHamster(e);
    var forward = e.face || -1;
    var ox = e.x + forward * 10 * G.scale;
    var dx = player.x - ox;
    var dy = player.y - e.y;
    if (len(dx, dy) > 40 * ACTOR * G.scale + player.r) return;
    if (dx * forward < 0) return;
    if (Math.abs(Math.atan2(dy, dx * forward)) > 0.95) return;
    hurtPlayer(ox, e.y, 1);
    burst(ox + forward * 14 * G.scale, e.y, "#f3ddb8", 6, 80, 0.16, 1.8);
  }

  function dropSoil(x, y, ang) {
    var mark = acquire(G.soil, 96);
    if (!mark) return;
    mark.alive = true;
    mark.x = x;
    mark.y = y;
    mark.life = 1.5;
    mark.max = 1.5;
    mark.ang = ang;
    mark.seed = Math.random() * 20;
  }

  function kickClods(x, y, ang) {
    var sc = G.scale;
    var offs = [-0.95, 0, 0.95];
    var colors = ["#5a3824", "#c4a06a", "#6b4428"];
    var i;
    for (i = 0; i < offs.length; i++) {
      var p = acquire(G.particles, 420);
      if (!p) return;
      var a = ang + offs[i] + (Math.random() - 0.5) * 0.25;
      var sp = (55 + Math.random() * 80) * sc;
      p.alive = true;
      p.kind = "spark";
      p.x = x + Math.cos(ang) * 10 * sc + Math.cos(a) * 4 * sc;
      p.y = y + Math.sin(ang) * 6 * sc;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = 0.22 + Math.random() * 0.16;
      p.max = p.life;
      p.size = 2 + Math.random() * 1.4;
      p.color = colors[i];
      p.drag = 2.4;
    }
  }

  function updateHamster(e, sdt) {
    var player = G.player;
    var sc = G.scale;
    e.vx = 0;
    e.vy = 0;
    faceHamster(e);
    if (e.swipeCd > 0) e.swipeCd -= sdt;
    if (e.burrow === "dig") {
      var dx = player.x - e.x;
      var dy = player.y - e.y;
      var d = len(dx, dy) || 1;
      var sp = (78 + Math.min(30, G.wave * 2)) * sc * MOVE;
      e.digPhase = (e.digPhase || 0) + sdt;
      if (e.wobble0 == null) e.wobble0 = Math.random() * Math.PI * 2;
      if (d > 90 * ACTOR * sc) {
        var nx = dx / d;
        var ny = dy / d;
        var wave = Math.cos(e.digPhase * 3.4 + e.wobble0) * 46 * ACTOR * sc;
        e.x += nx * sp * sdt - ny * wave * sdt;
        e.y += ny * sp * sdt + nx * wave * sdt;
        e.gy = e.y;
        e.soilT = (e.soilT || 0) - sdt;
        if (e.soilT <= 0) {
          e.soilT = 0.07;
          var heading = Math.atan2(ny, nx);
          dropSoil(e.x - nx * 12 * sc, e.y - ny * 8 * sc, heading + Math.PI);
          kickClods(e.x + nx * 6 * sc, e.y + ny * 4 * sc, heading);
        }
      } else {
        e.burrow = "warn";
        e.burrowT = 0.42;
        e.farT = 0;
        e.gy = e.y;
      }
      return;
    }
    if (e.burrow === "warn") {
      e.burrowT -= sdt;
      e.gy = e.y;
      if (e.burrowT <= 0) {
        e.burrow = "e1";
        e.burrowT = 0.35;
      }
      return;
    }
    e.burrowT -= sdt;
    if (e.burrow === "e1") {
      if (e.burrowT <= 0) { e.burrow = "e2"; e.burrowT = 0.3; }
      return;
    }
    if (e.burrow === "e2") {
      if (e.burrowT <= 0) {
        e.burrow = "e3";
        e.burrowT = 0.22;
        e.gy = e.y;
        hamsterLeap(e);
      }
      return;
    }
    if (e.burrow === "e3") {
      var u = 1 - Math.max(0, e.burrowT) / 0.22;
      e.y = e.gy - Math.sin(Math.min(1, u) * Math.PI) * 12 * sc;
      if (e.burrowT <= 0) {
        e.y = e.gy;
        e.burrow = "up";
        e.farT = 0;
        e.swipeCd = 0.2;
        burst(e.x, e.y, "#c4a574", 6, 50, 0.22, 1.6);
      }
      return;
    }
    var dx2 = player.x - e.x;
    var dy2 = player.y - e.y;
    var d2 = len(dx2, dy2) || 1;
    var chase = 68 * sc * MOVE;
    e.x += (dx2 / d2) * chase * sdt;
    e.y += (dy2 / d2) * chase * sdt;
    e.gy = e.y;
    if (e.swipeCd <= 0 && d2 < 46 * ACTOR * sc + player.r) {
      hamsterSwipe(e);
      e.swipeCd = 0.7;
    }
    if (d2 > 220 * ACTOR * sc) e.farT = (e.farT || 0) + sdt;
    else e.farT = 0;
    if (e.farT >= 1) {
      e.burrow = "dig";
      e.farT = 0;
      e.gy = e.y;
    }
  }

  function faceDeer(e) {
    var dx = G.player.x - e.x;
    if (Math.abs(dx) > 4) e.face = dx < 0 ? -1 : 1;
  }

  function deerSwipe(e) {
    var player = G.player;
    if (!player || !player.alive) return;
    faceDeer(e);
    var forward = e.face || -1;
    var dx = player.x - e.x;
    var dy = player.y - e.y;
    if (len(dx, dy) > 86 * ACTOR * G.scale + player.r) return;
    if (dx * forward < -8 * G.scale) return;
    if (Math.abs(Math.atan2(dy, dx * forward)) > 1.15) return;
    hurtPlayer(e.x + forward * 20 * G.scale, e.y, 2);
    burst(e.x + forward * 36 * G.scale, e.y - 10, "#ffffff", 10, 140, 0.22, 2.4);
  }

  function startDeerPaw(e, chained) {
    var phase2 = e.phase === 2;
    e.deerState = "paw";
    e.pawDur = 1.2;
    e.deerT = e.pawDur;
    e.chargeA = Math.atan2(G.player.y - e.y, G.player.x - e.x);
    e.pawKick = -1;
    e.chargeHit = false;
    if (!chained) e.chain = phase2 ? 1 : 0;
  }


  function updateDeer(e, sdt) {
    var player = G.player;
    var sc = G.scale;
    var phase2 = e.phase === 2;
    e.deerT -= sdt;
    if (e.landT > 0) e.landT -= sdt;
    if (e.deerState !== "dash" && e.deerState !== "land") faceDeer(e);
    if (e.deerState === "walk") {
      var dx = player.x - e.x;
      var dy = player.y - e.y;
      var d = len(dx, dy) || 1;
      var sp = (phase2 ? 96 : 72) * sc * MOVE;
      e.x += (dx / d) * sp * sdt;
      e.y += (dy / d) * sp * sdt;
      e.x = clamp(e.x, e.r, G.w - e.r);
      e.y = clamp(e.y, e.r, G.h - e.r);
      if (d < 150 * ACTOR * sc && e.deerT <= 0) {
        e.deerState = "swipe";
        e.deerT = 0.34;
      } else if (e.deerT <= 0) startDeerPaw(e, false);
      return;
    }
    if (e.deerState === "paw") {
      var pose = deerPawPose(e);
      if (pose.impact && e.pawKick !== pose.idx) {
        e.pawKick = pose.idx;
        var hoof = deerHoofScreen(e, pose.ang, pose.dip);
        burst(hoof.x, hoof.y, "#c4a574", 6, 55, 0.2, 2);
        burst(hoof.x, hoof.y, "#6b4a30", 3, 30, 0.16, 1.6);
        spawnPawCrack(hoof.x, hoof.y, e.chargeA || 0);
      }
      var lockAt = (e.chain > 0 && phase2) ? 0.18 : 0.28;
      if (e.deerT > lockAt) e.chargeA = Math.atan2(player.y - e.y, player.x - e.x);
      if (e.deerT <= 0) {
        e.deerState = "dash";
        e.deerT = phase2 ? 0.42 : 0.5;
        e.chargeSp = (phase2 ? 980 : 740) * sc * MOVE;
        e.chargeHit = false;
        e.hoofT = 0;
        sfx.dash();
      }
      return;
    }
    if (e.deerState === "dash") {
      e.x += Math.cos(e.chargeA) * e.chargeSp * sdt;
      e.y += Math.sin(e.chargeA) * e.chargeSp * sdt;
      e.hoofT = (e.hoofT || 0) - sdt;
      if (e.hoofT <= 0) {
        e.hoofT = 0.055;
        dropHoof(e.x, e.y + e.r * 0.25, e.chargeA);
        if (Math.random() < 0.45) burst(e.x, e.y + 6 * sc, "#c4a574", 2, 30, 0.12, 1.5);
      }
      var edge = e.x <= e.r + 2 || e.y <= e.r + 2 || e.x >= G.w - e.r - 2 || e.y >= G.h - e.r - 2;
      if (edge) {
        e.x = clamp(e.x, e.r, G.w - e.r);
        e.y = clamp(e.y, e.r, G.h - e.r);
        deerImpact(e, true);
        return;
      }
      if (e.deerT <= 0) {
        if (e.chain > 0) {
          e.chain -= 1;
          startDeerPaw(e, true);
        } else deerImpact(e, false);
      }
      return;
    }
    if (e.deerState === "land") {
      e.skid = (e.skid || 0) * Math.exp(-7 * sdt);
      e.x += Math.cos(e.chargeA) * e.skid * sdt;
      e.y += Math.sin(e.chargeA) * e.skid * sdt;
      e.x = clamp(e.x, e.r, G.w - e.r);
      e.y = clamp(e.y, e.r, G.h - e.r);
      if (e.deerT <= 0) {
        e.deerState = "stun";
        e.deerT = phase2 ? 0.36 : 0.5;
        e.skid = 0;
      }
      return;
    }
    if (e.deerState === "stun") {
      if (e.deerT <= 0) {
        e.deerState = "walk";
        e.deerT = phase2 ? 0.45 : 0.75;
      }
      return;
    }
    if (e.deerState === "swipe") {
      faceDeer(e);
      if (e.deerT <= 0) {
        deerSwipe(e);
        e.deerState = "walk";
        e.deerT = phase2 ? 0.5 : 0.8;
      }
    }
  }


  function updateEnemies(sdt) {
    var sc = G.scale;
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (!e.alive) continue;
      e.px = e.x;
      e.py = e.y;
      e.t += sdt;
      e.r = e.br * sc;
      if (e.hitFlash > 0) e.hitFlash -= sdt;
      if (e.type === "boss") {
        updateBoss(e, sdt);
        continue;
      }
      if (e.type === "bunny") updateBunny(e, sdt);
      else if (e.type === "hamster") updateHamster(e, sdt);
      else e.alive = false;
    }
  }


  function dodgeBullets(e, sc, sdt) {
    var best = null;
    var bestD = 78 * sc;
    for (var i = 0; i < G.pbullets.length; i++) {
      var b = G.pbullets[i];
      if (!b.alive) continue;
      var d = len(b.x - e.x, b.y - e.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (!best) return;
    var px = -(best.y - e.y);
    var py = best.x - e.x;
    var pl = len(px, py) || 1;
    e.vx += (px / pl) * 520 * sc * sdt;
    e.vy += (py / pl) * 520 * sc * sdt;
  }

  function distToRay(px, py, x, y, ang) {
    var ux = Math.cos(ang);
    var uy = Math.sin(ang);
    var along = (px - x) * ux + (py - y) * uy;
    if (along < 0) return 9999;
    var cx = x + ux * along;
    var cy = y + uy * along;
    return len(px - cx, py - cy);
  }

  function bossSummon(e, kind, n) {
    for (var i = 0; i < n; i++) {
      if (countAlive(G.enemies) >= 26) return;
      var a = rand(0, Math.PI * 2);
      spawnEnemy(kind, e.x + Math.cos(a) * 36, e.y + Math.sin(a) * 36, { quota: true });
    }
  }

  function beginBossTel(e) {
    var profile = bossProfile();
    var list = e.phase === 2 ? profile.phase2 : profile.patterns;
    var kind = list[e.pattern % list.length];
    e.pattern += 1;
    e.telKind = kind;
    e.telA = Math.atan2(G.player.y - e.y, G.player.x - e.x);
    e.telT = kind === "laser" ? 0.9 : kind === "charge" ? 0.72 : 0.55;
    e.telMax = e.telT;
  }

  function resolveBoss(e) {
    var kind = e.telKind;
    var sc = G.scale;
    var phase = e.phase === 2;
    var tier = 1 + (G.bossLevel - 1) * 0.12;
    e.telT = 0;
    if (kind === "radial") {
      var n = (phase ? 18 : 12) + Math.min(6, G.bossLevel);
      var sp = (150 + (phase ? 40 : 0)) * sc * tier;
      for (var i = 0; i < n; i++) {
        spawnEBullet(e.x, e.y, e.angle + (i / n) * Math.PI * 2, sp);
      }
      sfx.dart();
    } else if (kind === "aimed") {
      var shot = (250 + (phase ? 40 : 0)) * sc * tier;
      var fan = phase ? [-0.28, -0.14, 0, 0.14, 0.28] : [-0.18, 0, 0.18];
      for (var f = 0; f < fan.length; f++) spawnEBullet(e.x, e.y, e.telA + fan[f], shot);
      sfx.dart();
    } else if (kind === "summon") {
      var summonKind = G.bossLevel >= 3 ? "mite" : "wisp";
      bossSummon(e, summonKind, phase ? 4 : 3);
      sfx.boss();
    } else if (kind === "laser") {
      e.laserT = phase ? 0.72 : 0.55;
      e.laserA = e.telA;
      sfx.dart();
    } else if (kind === "charge") {
      e.charging = phase ? 0.5 : 0.4;
      e.chargeA = e.telA;
      e.chargeSp = (phase ? 980 : 820) * sc * tier;
      sfx.dash();
    } else if (kind === "shield") {
      e.armor = phase ? 2.6 : 2.1;
      bossSummon(e, "wisp", 2);
      ringFx(e.x, e.y, "#9b7bff", e.r * 2.2, 0.35);
      sfx.shield();
    }
    e.fireCd = (phase ? 0.38 : 0.62) / tier;
  }

  function updateBoss(e, sdt) {
    var profile = bossProfile();
    if (e.phase === 1 && e.hp < e.maxHp * (profile.threshold || 0.5)) {
      e.phase = 2;
      announce("PHASE TWO", profile.name);
      addShake(12);
      flash("#ff3b6b", 0.55);
      sfx.boss();
    }
    updateDeer(e, sdt);
  }


  function separateEnemies() {
    var list = G.enemies;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (!a.alive || a.type === "dart" || a.type === "boss" || a.type === "bunny" || a.type === "hamster") continue;
      for (var j = i + 1; j < list.length; j++) {
        var b = list[j];
        if (!b.alive || b.type === "dart" || b.type === "boss" || b.type === "bunny" || b.type === "hamster") continue;
        var dx = b.x - a.x;
        var dy = b.y - a.y;
        var d = len(dx, dy);
        var min = a.r + b.r;
        if (d > 0.001 && d < min) {
          var push = (min - d) * 0.5;
          var ux = dx / d;
          var uy = dy / d;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }
  }

  function updateBullets(dt, sdt) {
    var i;
    for (i = 0; i < G.pbullets.length; i++) {
      var b = G.pbullets[i];
      if (!b.alive) continue;
      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -48 || b.y < -48 || b.x > G.w + 48 || b.y > G.h + 48) b.alive = false;
    }
  }

  function updatePickups(dt) {
    var player = G.player;
    var sc = G.scale;
    for (var i = 0; i < G.pickups.length; i++) {
      var p = G.pickups[i];
      if (!p.alive) continue;
      p.t += dt;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      var dx = player.x - p.x;
      var dy = player.y - p.y;
      var d = len(dx, dy);
      var pull = 200 * sc;
      if (d < pull && d > 1) {
        var pullSpeed = 280 * sc;
        p.x += (dx / d) * pullSpeed * dt;
        p.y += (dy / d) * pullSpeed * dt;
      }
      if (d < player.r + p.r + 6) {
        p.alive = false;
        applyPickup(p.type);
      }
    }
  }

  function collide() {
    var player = G.player;
    var i, j;
    for (i = 0; i < G.pbullets.length; i++) {
      var b = G.pbullets[i];
      if (!b.alive) continue;
      for (j = 0; j < G.enemies.length; j++) {
        var e = G.enemies[j];
        if (!e.alive) continue;
        if (e.type === "hamster" && e.burrow !== "up") continue;
        if (b.struck && b.struck.indexOf(e) !== -1) continue;
        if (hitSweep(b.px, b.py, b.x, b.y, e.x, e.y, e.r + b.r)) {
          if (!b.struck) b.struck = [];
          b.struck.push(e);
          damageEnemy(e, b.dmg || shotDamage());
          b.hits = (b.hits || 0) + 1;
          if (b.hits > (b.pierce || 0)) {
            b.alive = false;
            break;
          }
        }
      }
    }

    if (!player.alive) return;
    for (i = 0; i < G.enemies.length; i++) {
      var en = G.enemies[i];
      if (!en.alive || !en.deer || en.deerState !== "dash" || en.chargeHit) continue;
      var rad = player.r + en.r * 0.72;
      if (len(en.x - player.x, en.y - player.y) < rad) {
        en.chargeHit = true;
        hurtPlayer(en.x, en.y, 3);
      }
    }
  }

  function countTyped(type) {
    var n = 0;
    for (var i = 0; i < G.enemies.length; i++) {
      if (G.enemies[i].alive && G.enemies[i].type === type) n++;
    }
    return n;
  }

  function spawnQuotaOne() {
    var spot = farPoint();
    var type = pickType(G.wave);
    var elite = G.wave >= 4 && Math.random() < Math.min(0.25, 0.05 + (G.wave - 4) * 0.018);
    var e = spawnEnemy(type, spot.x, spot.y, { elite: elite, quota: true });
    if (e) G.quotaSpawned++;
  }

  function updateDirector(sdt) {
    if (G.state !== "playing" || G.clearLock) return;
    if (G.bossIntro > 0) {
      G.bossIntro -= sdt;
      if (G.bossIntro <= 0 && !G.boss) spawnBossNow();
      return;
    }
    if (G.wave % 5 === 0) return;

    if (G.quotaSpawned >= G.quota) return;
    G.spawnAcc += sdt;
    var interval = Math.max(0.42, 0.95 - (G.wave - 1) * 0.035);
    if (G.spawnAcc < interval) return;
    G.spawnAcc = 0;
    var batch = 1;
    if (G.wave >= 12) batch = 2;
    else if (G.wave >= 7 && Math.random() < 0.4) batch = 2;
    var cap = G.wave <= 2 ? 4 : G.wave <= 6 ? 7 : G.wave <= 10 ? 10 : 13;
    for (var n = 0; n < batch; n++) {
      if (G.quotaSpawned >= G.quota) break;
      if (livingQuota() >= cap) break;
      spawnQuotaOne();
    }
  }

  function beginWave(wave) {
    G.wave = wave;
    G.waveT = 0;
    G.spawnAcc = 0.7;
    G.rockAcc = 1.5;
    G.quota = waveQuota(wave);
    G.quotaSpawned = 0;
    G.quotaKilled = 0;
    G.clearLock = false;
    G.boss = null;
    G.bossIntro = 0;
    if (G.player) G.player.iframes = Math.max(G.player.iframes, 0.65);
    G.bgTarget = wave % 5 === 0 ? 1 : 0;
    if (wave % 5 === 0) beginBoss();
    else announce("WAVE " + wave, waveSub(wave));
  }

  function advanceWave() {
    if (G.wave >= MAX_WAVE) return;
    beginWave(G.wave + 1);
  }

  function sweepField() {
    for (var i = 0; i < G.enemies.length; i++) G.enemies[i].alive = false;
    for (var b = 0; b < G.ebullets.length; b++) G.ebullets[b].alive = false;
    for (var p = 0; p < G.pbullets.length; p++) G.pbullets[p].alive = false;
  }

  function beginCountdown() {
    sweepField();
    G.state = "countdown";
    G.countStep = 3;
    G.countT = 0.9;
    G.bannerT = 0;
    sfx.tick();
    syncUI();
  }

  function updateCountdown(dt) {
    G.countT -= dt;
    if (G.countT > 0) return;
    if (G.countStep > 1) {
      G.countStep -= 1;
      G.countT = 0.9;
      sfx.tick();
      return;
    }
    if (G.countStep === 1) {
      G.countStep = 0;
      G.countT = 0.55;
      sfx.go();
      return;
    }
    G.state = "playing";
    syncUI();
    if (G.pendingWave) {
      G.pendingWave = false;
      advanceWave();
    }
  }

  function heldGunAnchor(player) {
    var box = heroDrawSize();
    var ang = player.angle || 0;
    if (player.boostT > 0) {
      var grid = bgPixelGrid();
      return {
        x: snapGrid(player.x + Math.cos(ang) * box.w * 0.22, grid.ox, grid.step),
        y: snapGrid(player.y + Math.sin(ang) * box.h * 0.08, grid.oy, grid.step),
        ang: ang,
        left: Math.cos(ang) < 0,
        gun: gunDef()
      };
    }
    var rect = heroMapRect(player);
    var u = HAND_U;
    var v = HAND_V;
    if ((player.face || 1) < 0) u = 1 - u;
    return {
      x: rect.left + u * rect.dw,
      y: rect.top + v * rect.dh,
      ang: ang,
      left: Math.cos(ang) < 0,
      gun: gunDef()
    };
  }
  function gunDrawBox(gun, img) {
    var dw = (gun.drawW || 32) * ACTOR * G.scale;
    var dh = dw * (img.naturalHeight / img.naturalWidth);
    var gx = gun.grip[0] * dw;
    var gy = gun.grip[1] * dh;
    return {
      dw: dw,
      dh: dh,
      gx: gx,
      gy: gy,
      mx: gun.muzzle[0] * dw - gx,
      my: gun.muzzle[1] * dh - gy
    };
  }

  function muzzlePoint(player) {
    var anchor = heldGunAnchor(player);
    var img = gunImage(anchor.gun.id);
    if (!img.complete || !img.naturalWidth) {
      var box = heroDrawSize();
      var face = player.face || 1;
      return {
        x: player.x + Math.cos(player.angle || 0) * box.w * 0.42 * (player.boostT > 0 ? 1 : face),
        y: player.y + (HAND_V - 0.5) * box.h
      };
    }
    var gbox = gunDrawBox(anchor.gun, img);
    var ly = anchor.left ? -gbox.my : gbox.my;
    var c = Math.cos(anchor.ang);
    var s = Math.sin(anchor.ang);
    return {
      x: anchor.x + c * gbox.mx - s * ly,
      y: anchor.y + s * gbox.mx + c * ly
    };
  }


  function drawHeldGun(player) {
    if (!player) return;
    var anchor = heldGunAnchor(player);
    var img = gunImage(anchor.gun.id);
    if (!img.complete || !img.naturalWidth) return;
    var box = gunDrawBox(anchor.gun, img);
    var art = worldSprite(img, box.dw, box.dh, "gun-" + anchor.gun.id);
    var diag = Math.ceil(Math.hypot(art.width, art.height)) + 2;
    var pc = takeCanvas(diag, diag);
    var g = pc.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, diag, diag);
    g.save();
    g.translate(diag / 2, diag / 2);
    g.rotate(anchor.ang);
    if (anchor.left) g.scale(1, -1);
    g.drawImage(art, Math.round(-anchor.gun.grip[0] * art.width), Math.round(-anchor.gun.grip[1] * art.height));
    g.restore();
    var grid = bgPixelGrid();
    var step = grid.step;
    var fire = campfirePos();
    var lit = lightArt(pc, fire.x - anchor.x, fire.y - anchor.y, false);
    var dw = diag * step;
    var dh = diag * step;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lit, snapGrid(anchor.x - dw / 2, grid.ox, step), snapGrid(anchor.y - dh / 2, grid.oy, step), dw, dh);
  }
  function drawHudGun(x, y, gun, ui) {
    var img = gunImage(gun.id);
    if (!img.complete || !img.naturalWidth) return x;
    var dh = Math.round((gun.id === "sniper" ? 12 : gun.id === "pistol" ? 16 : 14) * ui);
    var dw = dh * (img.naturalWidth / img.naturalHeight);
    var cap = gun.id === "pistol" ? 28 : 72;
    if (dw > cap) {
      dh = Math.max(8, Math.round(dh * cap / dw));
      dw = cap;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(x), Math.round(y - dh), Math.round(dw), dh);
    return x + dw + 8;
  }

  function requestShot() {
    if (G.state !== "playing" || !G.player || !G.player.alive) return;
    if ((gunDef().mode || "semi") === "auto") return;
    if (G.player.fireCd <= 0) {
      firePlayerGun(G.player);
      G.player.fireCd = fireInterval();
      input.fireBuf = false;
    } else input.fireBuf = true;
  }

  function firePlayerGun(player) {
    var gun = gunDef();
    var origin = muzzlePoint(player);
    var aimX = input.mx - origin.x;
    var aimY = input.my - origin.y;
    var base = aimX * aimX + aimY * aimY > 4 ? Math.atan2(aimY, aimX) : (player.angle || 0);
    var shots = [];
    var i;
    var pellets = gunPellets(gun);
    if (pellets <= 1) {
      var jitter = gun.spread ? (Math.random() - 0.5) * gun.spread * 2 : 0;
      shots.push(base + jitter);
    } else {
      for (i = 0; i < pellets; i++) {
        var t = (i / (pellets - 1)) * 2 - 1;
        shots.push(base + t * gun.spread * 0.5);
      }
    }
    if (player.tripleT > 0) {
      shots.push(base - 0.24);
      shots.push(base + 0.24);
    }
    for (i = 0; i < shots.length; i++) {
      spawnPBullet(origin.x, origin.y, shots[i], gun);
    }
    sfx.shoot();
    burst(origin.x, origin.y, gun.color, gun.pellets > 1 ? 6 : 2, 50, 0.08, 1.5);
  }

  function defaultAlloc() {
    return { speed: 0, weapon: 0, hp: 0, armor: 0, pals: 0, rifle: 0, sniper: 0, mg: 0 };
  }

  function defaultMeta() {
    return {
      earned: 0,
      creditedExternal: 0,
      ids: {},
      best: 0,
      runs: 0,
      wins: 0,
      gun: "pistol",
      alloc: defaultAlloc()
    };
  }

  function clampRank(n, max) {
    n = Math.floor(Number(n) || 0);
    if (n < 0) n = 0;
    if (n > max) n = max;
    return n;
  }

  function loadMeta() {
    var base = defaultMeta();
    var raw = null;
    try { raw = localStorage.getItem(KEY_META); } catch (err) { raw = null; }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          base.earned = Math.max(0, Math.floor(Number(parsed.earned) || 0));
          base.creditedExternal = Math.max(0, Math.floor(Number(parsed.creditedExternal) || 0));
          base.best = Math.max(0, Math.floor(Number(parsed.best) || 0));
          base.runs = Math.max(0, Math.floor(Number(parsed.runs) || 0));
          base.wins = Math.max(0, Math.floor(Number(parsed.wins) || 0));
          base.gun = parsed.gun || "pistol";
          if (parsed.ids && typeof parsed.ids === "object") base.ids = parsed.ids;
          if (parsed.alloc && typeof parsed.alloc === "object") {
            var blank = defaultAlloc();
            var key;
            for (key in blank) if (Object.prototype.hasOwnProperty.call(parsed.alloc, key)) blank[key] = parsed.alloc[key];
            base.alloc = blank;
          }
        }
      } catch (err2) { /* keep defaults */ }
    }
    var caps = { speed: 6, weapon: 5, hp: 5, armor: 5, pals: 4, rifle: 1, sniper: 1, mg: 1 };
    var id;
    for (id in caps) base.alloc[id] = clampRank(base.alloc[id], caps[id]);
    if (base.gun !== "pistol" && base.gun !== "rifle" && base.gun !== "sniper" && base.gun !== "mg") base.gun = "pistol";
    if (base.gun !== "pistol" && !base.alloc[base.gun]) base.gun = "pistol";
    var storedBest = loadNum(KEY_BEST, 0);
    if (storedBest > base.best) base.best = storedBest;
    return base;
  }

  function saveMeta() {
    if (!meta) return;
    if (G && G.best > meta.best) meta.best = G.best;
    saveRaw(KEY_META, JSON.stringify(meta));
    saveRaw(KEY_BEST, meta.best || 0);
  }

  function skillCost(id) {
    if (id === "rifle") return 2;
    if (id === "sniper" || id === "mg") return 3;
    return 1;
  }

  function pointsSpent() {
    var a = meta.alloc;
    return a.speed + a.weapon + a.hp + a.armor + a.pals + (a.rifle ? 2 : 0) + (a.sniper ? 3 : 0) + (a.mg ? 3 : 0);
  }

  function pointsAvailable() {
    return Math.max(0, (meta.earned || 0) - pointsSpent());
  }

  function escText(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;";
    });
  }

  function skillMax(id) {
    if (id === "speed") return 6;
    if (id === "weapon" || id === "hp" || id === "armor") return 5;
    if (id === "pals") return 4;
    return 1;
  }

  function skillLabel(id) {
    var a = meta.alloc;
    if (id === "speed") return a.speed + " / 6";
    if (id === "weapon") return "LV " + (1 + a.weapon);
    if (id === "hp") return (3 + a.hp) + " HEARTS";
    if (id === "armor") return a.armor + " / 5";
    if (id === "pals") return a.pals + " / 4";
    if (a[id]) return "ON";
    return skillCost(id) + " PTS";
  }

  function renderHome() {
    if (!meta) return;
    var spent = pointsSpent();
    var left = pointsAvailable();
    if (el.ptsAvailable) el.ptsAvailable.textContent = String(left);
    if (el.ptsEarned) el.ptsEarned.textContent = String(meta.earned || 0);
    if (el.ptsSpent) el.ptsSpent.textContent = String(spent);
    if (el.ptsLeft) el.ptsLeft.textContent = String(left);
    if (el.menuBest) el.menuBest.textContent = fmt(Math.max(G.best || 0, meta.best || 0));
    if (el.menuMeta) el.menuMeta.textContent = "RUNS " + (meta.runs || 0) + "  ·  WINS " + (meta.wins || 0);
    if (el.pointToast) {
      if (pointToast) {
        el.pointToast.textContent = pointToast;
        el.pointToast.classList.remove("hidden");
      } else el.pointToast.classList.add("hidden");
    }
    if (!el.skillTree) return;
    var rows = [
      { id: "speed", name: "Move Speed", hint: "+12% each rank, cap 6" },
      { id: "weapon", name: "Weapon Damage", hint: "This gun: +1 damage and a faster cycle, cap LV 6" },
      { id: "hp", name: "Max HP", hint: "+1 heart, cap 8" },
      { id: "armor", name: "Armor", hint: "One charge per rank. Refills every wave" },
      { id: "pals", name: "Companions", hint: "A sprout that shoots. Cap 4" }
    ];
    var guns = [
      { id: "rifle", name: "Assault Rifle", hint: "Unlock for 2. Full auto" },
      { id: "sniper", name: "Sniper", hint: "Unlock for 3. Slow, piercing" },
      { id: "mg", name: "Machine Gun", hint: "Unlock for 3. Very fast, wide" }
    ];
    var html = "";
    var i, row, cur, cost, plusOff, minusOff;
    for (i = 0; i < rows.length; i++) {
      row = rows[i];
      cur = meta.alloc[row.id];
      cost = skillCost(row.id);
      minusOff = cur <= 0 ? " disabled" : "";
      plusOff = (cur >= skillMax(row.id) || left < cost) ? " disabled" : "";
      html += '<div class="skill-row">';
      html += "<div><strong>" + row.name + "</strong><em>" + row.hint + "</em></div>";
      html += '<button type="button" class="step" data-id="' + row.id + '" data-dir="-1"' + minusOff + ">−</button>";
      html += '<span class="skill-val">' + skillLabel(row.id) + "</span>";
      html += '<button type="button" class="step" data-id="' + row.id + '" data-dir="1"' + plusOff + ">+</button>";
      html += "</div>";
    }
    html += '<p class="tree-label">STARTING GUN</p>';
    html += '<div class="gun-row' + (meta.gun === "pistol" ? " is-start" : "") + '">';
    html += "<div><strong>Pistol</strong><em>Free. Semi-auto</em></div>";
    html += "<span></span>";
    html += '<span class="skill-val">FREE</span>';
    html += "<span></span>";
    html += '<button type="button" class="use' + (meta.gun === "pistol" ? " is-on" : "") + '" data-gun="pistol">' + (meta.gun === "pistol" ? "READY" : "START") + "</button>";
    html += "</div>";
    for (i = 0; i < guns.length; i++) {
      row = guns[i];
      cur = meta.alloc[row.id];
      cost = skillCost(row.id);
      minusOff = cur <= 0 ? " disabled" : "";
      plusOff = (cur >= 1 || left < cost) ? " disabled" : "";
      html += '<div class="gun-row' + (meta.gun === row.id ? " is-start" : "") + '">';
      html += "<div><strong>" + row.name + "</strong><em>" + row.hint + "</em></div>";
      html += '<button type="button" class="step" data-id="' + row.id + '" data-dir="-1"' + minusOff + ">−</button>";
      html += '<span class="skill-val">' + skillLabel(row.id) + "</span>";
      html += '<button type="button" class="step" data-id="' + row.id + '" data-dir="1"' + plusOff + ">+</button>";
      html += '<button type="button" class="use' + (meta.gun === row.id ? " is-on" : "") + '" data-gun="' + row.id + '"' + (cur ? "" : " disabled") + ">" + (meta.gun === row.id ? "READY" : "START") + "</button>";
      html += "</div>";
    }
    el.skillTree.innerHTML = html;
  }

  function adjustSkill(id, dir) {
    if (!meta || G.state !== "menu") return;
    if (!Object.prototype.hasOwnProperty.call(meta.alloc, id)) return;
    var cur = meta.alloc[id];
    if (dir > 0) {
      if (cur >= skillMax(id)) return;
      if (pointsAvailable() < skillCost(id)) return;
      meta.alloc[id] = cur + 1;
    } else {
      if (cur <= 0) return;
      meta.alloc[id] = cur - 1;
      if (meta.gun === id) meta.gun = "pistol";
    }
    saveMeta();
    renderHome();
  }

  function selectGun(id) {
    if (!meta || G.state !== "menu") return;
    if (id !== "pistol" && id !== "rifle" && id !== "sniper" && id !== "mg") return;
    if (id !== "pistol" && !meta.alloc[id]) return;
    meta.gun = id;
    saveMeta();
    renderHome();
  }

  function onSkillClick(ev) {
    var node = ev.target;
    while (node && node !== el.skillTree) {
      if (node.getAttribute && node.getAttribute("data-gun")) {
        selectGun(node.getAttribute("data-gun"));
        return;
      }
      if (node.getAttribute && node.getAttribute("data-id")) {
        adjustSkill(node.getAttribute("data-id"), Number(node.getAttribute("data-dir")));
        return;
      }
      node = node.parentNode;
    }
  }

  function applyLoadout() {
    if (!meta || !G.player) return;
    var a = meta.alloc;
    var gun = meta.gun || "pistol";
    if (gun !== "pistol" && !a[gun]) gun = "pistol";
    G.speedLv = a.speed;
    G.armorMax = a.armor;
    G.pals = a.pals;
    G.gun = gun;
    G.gunLvs = { pistol: 1, rifle: 1, sniper: 1, mg: 1 };
    G.gunLvs[gun] = 1 + a.weapon;
    G.player.maxHp = Math.min(16, MAX_HP + a.hp * 2);
    G.player.hp = G.player.maxHp;
    G.player.shieldHits = G.armorMax || 0;
    G.picks = loadoutLines();
  }

  function loadoutLines() {
    var a = meta.alloc;
    var gun = gunById(meta.gun || "pistol");
    return [
      "Move Speed " + a.speed + "/6",
      gun.name + " LV " + (1 + a.weapon),
      (3 + a.hp) + " hearts",
      "Armor " + a.armor,
      "Companions " + a.pals
    ];
  }

  function notePointToast(amount) {
    pointToast = "You earned +" + amount + " skill points!";
  }

  function creditAward(amount, reason, id) {
    amount = Math.floor(Number(amount) || 0);
    if (!(amount > 0) || amount > 1000000) return false;
    if (!meta) meta = loadMeta();
    if (id != null && id !== "") {
      id = String(id).slice(0, 80);
      if (meta.ids[id]) return false;
      meta.ids[id] = { reason: reason ? String(reason).slice(0, 80) : "", time: Date.now() };
    }
    meta.earned += amount;
    saveMeta();
    notePointToast(amount);
    if (G && G.state === "menu") renderHome();
    return true;
  }

  function syncExternalPoints() {
    var ext = window.EXTERNAL_POINTS;
    if (!ext || typeof ext !== "object") return;
    var log = ext.log || [];
    var i, entry, id;
    for (i = 0; i < log.length; i++) {
      entry = log[i];
      if (!entry || entry.id == null || entry.id === "") continue;
      id = String(entry.id).slice(0, 80);
      if (!meta.ids[id]) {
        meta.ids[id] = {
          reason: entry.reason ? String(entry.reason).slice(0, 80) : "",
          time: entry.time || 0,
          file: 1
        };
      }
    }
    var total = Math.floor(Number(ext.total) || 0);
    if (total < 0) total = 0;
    var prev = meta.creditedExternal || 0;
    if (total > prev) {
      var delta = total - prev;
      meta.earned += delta;
      meta.creditedExternal = total;
      notePointToast(delta);
    }
    saveMeta();
  }

  function installPointApi() {
    window.NeonDrift = {
      awardPoints: function (n, reason, id) {
        return creditAward(n, reason, id);
      }
    };
    window.addEventListener("message", function (ev) {
      var data = ev.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "awardSkillPoint") return;
      creditAward(data.amount, data.reason, data.id);
    });
  }

  function updatePlaying(dt) {
    var player = G.player;
    if (G.hitstop > 0) {
      G.hitstop -= dt;
      updateParticles(dt * 0.35);
      G.shake *= Math.exp(-3 * dt);
      return;
    }
    var ts = player.slowT > 0 ? 0.4 : 1;
    var sdt = dt * ts;
    updatePlayer(dt);
    updateEnemies(sdt);
    updateBullets(dt, sdt);
    updatePickups(dt);
    collide();
    updateParticles(dt);
    if (G.state !== "playing") return;
    updateDirector(sdt);

    if (G.comboT > 0) {
      G.comboT -= dt;
      if (G.comboT <= 0) G.combo = 0;
    }
    if (G.bannerT > 0) G.bannerT -= dt;
    if (G.toastT > 0) G.toastT -= dt;
    if (G.grazePopup > 0) G.grazePopup -= dt;
    if (G.flashA > 0) G.flashA = Math.max(0, G.flashA - dt * 1.7);
    G.shake *= Math.exp(-3.4 * dt);

    var diff = G.score - G.shownScore;
    G.shownScore += diff * Math.min(1, dt * 9);
    if (Math.abs(diff) < 0.6) G.shownScore = G.score;

    if (player.alive && player.hp === 1) {
      G.heartT -= dt;
      if (G.heartT <= 0) {
        G.heartT = 0.82;
        sfx.heart();
      }
    }
  }

  function updateDying(dt) {
    G.deathT -= dt;
    updateParticles(dt);
    if (G.bannerT > 0) G.bannerT -= dt;
    if (G.flashA > 0) G.flashA = Math.max(0, G.flashA - dt * 1.2);
    G.shake *= Math.exp(-2.6 * dt);
    if (G.deathT <= 0) finishGame();
  }

  function ensureMenuBunnies() {
    var n = 0;
    var i;
    for (i = 0; i < G.enemies.length; i++) {
      if (G.enemies[i].alive && G.enemies[i].menu) n++;
    }
    if (n >= 3) return;
    var spots = [
      { x: 0.22, y: 0.78 },
      { x: 0.72, y: 0.8 },
      { x: 0.56, y: 0.9 }
    ];
    for (i = n; i < 3; i++) {
      var spot = spots[i];
      var e = spawnEnemy("bunny", G.w * spot.x, Math.min(G.h * spot.y, G.h - 48), { quota: false });
      if (!e) continue;
      e.menu = true;
      e.quota = false;
      e.hop = "sit";
      e.hopT = 0.15 + i * 0.22;
    }
  }

  function updateMenu(dt) {
    var player = G.player;
    if (!player) return;
    G.ghosts = [];
    player.x = G.w * 0.4;
    player.y = Math.min(G.h * 0.76, G.h - 78);
    player.angle = -0.15;
    player.face = 1;
    player.vx = 0;
    player.vy = 0;
    player.r = 13 * ACTOR * G.scale;
    player.boostT = 0;
    player.iframes = 0;
    player.alive = true;
    ensureMenuBunnies();
    for (var i = 0; i < G.enemies.length; i++) {
      var e = G.enemies[i];
      if (e.alive && e.menu && e.type === "bunny") updateBunny(e, dt);
    }
  }

  function update(dt) {
    G.time += dt;
    if (G.state === "playing" || G.state === "countdown" || G.state === "levelup") G.runT = (G.runT || 0) + dt;
    updateCampfire(dt);
    updateMarks(dt);
    if (G.bgMix !== G.bgTarget) {
      if (reduceMotion) G.bgMix = G.bgTarget;
      else {
        var step = dt;
        if (G.bgMix < G.bgTarget) G.bgMix = Math.min(G.bgTarget, G.bgMix + step);
        else G.bgMix = Math.max(G.bgTarget, G.bgMix - step);
      }
    }
    if (G.state === "menu") {
      updateMenu(dt);
      updateParticles(dt);
      return;
    }
    if (G.state === "paused" || G.state === "over" || G.state === "win" || G.state === "levelup") return;
    if (G.state === "countdown") {
      updateCountdown(dt);
      return;
    }
    if (G.state === "dying") {
      updateDying(dt);
      return;
    }
    updatePlaying(dt);
  }

  /* ---------- draw ---------- */

  function wrap(v, max) {
    var m = v % max;
    return m < 0 ? m + max : m;
  }


  var walkFrames = [];
  var idleFrame = null;
  var WALK_BOB = [0, 1, 2, 2, 1, 0, 1, 2, 2, 1];
  var knightBuilt = false;
  var HAND_U = 0.8;
  var HAND_V = 0.62;

  function heroDrawSize() {
    var h = 52 * ACTOR * G.scale;
    var aspect = 0.68;
    if (heroImg.complete && heroImg.naturalWidth) aspect = heroImg.naturalWidth / heroImg.naturalHeight;
    return { w: h * aspect, h: h };
  }

  function bulletVisual(gun) {
    var img = gunImage(gun.id);
    var iw = img && img.naturalWidth ? img.naturalWidth : 32;
    var bore = gun.bore || 3;
    return {
      bwid: (bore / iw) * (gun.drawW || 32) * ACTOR,
      blen: (gun.blen || 5) * ACTOR
    };
  }

  function coverPlacement(img) {
    var iw = img && img.naturalWidth ? img.naturalWidth : 1280;
    var ih = img && img.naturalHeight ? img.naturalHeight : 720;
    var sc = Math.max(G.w / iw, G.h / ih) * BG_ZOOM;
    var dw = iw * sc;
    var dh = ih * sc;
    return { ox: (G.w - dw) * 0.5, oy: (G.h - dh) * 0.5, dw: dw, dh: dh, sc: sc, iw: iw, ih: ih };
  }

  function campfirePos() {
    var c = coverPlacement(nightImg);
    return {
      x: c.ox + (630 / 1280) * c.iw * c.sc,
      y: c.oy + (371 / 720) * c.ih * c.sc
    };
  }

  function drawFootShadow(x, y, rx, ry, alpha) {
    if (!(rx > 0) || !(ry > 0)) return;
    if (alpha == null) alpha = 0.34;
    var mix = G.bgMix || 0;
    ctx.save();
    if (mix < 0.14) {
      ctx.fillStyle = "rgba(0,0,0," + alpha + ")";
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    var fire = campfirePos();
    var dx = x - fire.x;
    var dy = y - fire.y;
    var dist = Math.hypot(dx, dy) || 1;
    var ux = dx / dist;
    var uy = dy / dist;
    var reach = clamp(dist / (Math.min(G.w, G.h) * 0.62), 0.12, 1);
    var flick = 0.84 + 0.16 * Math.sin(G.time * 14 + x * 0.04 + y * 0.03);
    var len = Math.max(ry * 2.2, ry * (3.2 + reach * 10) * flick);
    var wid = Math.max(1.4, rx * (1.02 - reach * 0.28));
    var a = alpha * (1.15 - reach * 0.72) * (0.4 + 0.6 * mix) * flick;
    ctx.translate(x + ux * len * 0.45, y + uy * len * 0.45);
    ctx.rotate(Math.atan2(uy, ux));
    ctx.fillStyle = "rgba(24, 10, 6, " + clamp(a, 0.04, 0.5) + ")";
    ctx.beginPath();
    ctx.ellipse(0, 0, len, wid, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function updateCampfire(dt) {
    if (!G.embers) G.embers = [];
    var mix = G.bgMix || 0;
    var i;
    for (i = G.embers.length - 1; i >= 0; i--) {
      var p = G.embers[i];
      p.life -= dt;
      if (p.life <= 0) {
        G.embers.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-0.4 * dt);
      p.vy -= (p.smoke ? 8 : 18) * dt;
    }
    if (mix < 0.08) return;
    var fire = campfirePos();
    var n = reduceMotion ? 1 : 2;
    for (i = 0; i < n; i++) {
      if (G.embers.length > 70) break;
      G.embers.push({
        x: fire.x + rand(-6, 6) * G.scale,
        y: fire.y + rand(-2, 3) * G.scale,
        vx: rand(-10, 10) * G.scale,
        vy: rand(-46, -22) * G.scale,
        life: rand(0.45, 0.95),
        max: 0.95,
        smoke: Math.random() < 0.28,
        size: rand(1.4, 2.6)
      });
    }
  }

  function drawCampfire() {
    var mix = G.bgMix || 0;
    if (mix < 0.02) return;
    var fire = campfirePos();
    var flick = reduceMotion ? 0.9 : (0.72 + 0.28 * Math.sin(G.time * 15) * (0.7 + 0.3 * Math.sin(G.time * 7.3)));
    var rad = Math.min(G.w, G.h) * (0.13 + 0.025 * flick);
    var glow = ctx.createRadialGradient(fire.x, fire.y, rad * 0.05, fire.x, fire.y, rad);
    glow.addColorStop(0, "rgba(255, 186, 70, " + (0.42 * flick * mix) + ")");
    glow.addColorStop(0.35, "rgba(255, 110, 28, " + (0.16 * flick * mix) + ")");
    glow.addColorStop(0.7, "rgba(180, 50, 12, " + (0.05 * flick * mix) + ")");
    glow.addColorStop(1, "rgba(255, 80, 10, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(fire.x - rad, fire.y - rad, rad * 2, rad * 2);
    if (mix < 0.15) return;
    ctx.save();
    ctx.translate(fire.x, fire.y);
    ctx.imageSmoothingEnabled = false;
    var sc = Math.max(1, Math.round(G.scale));
    var frame = reduceMotion ? 0 : Math.floor(G.time * 12) % 4;
    var shapes = [
      [1, 3, 5, 3, 2, 4],
      [2, 4, 3, 6, 2, 3],
      [1, 5, 4, 2, 5, 2],
      [2, 3, 6, 4, 3, 4]
    ];
    var cols = shapes[frame];
    var colors = ["#ff3a1a", "#ff7a18", "#ffd24a", "#fff2b0", "#ff5a12", "#ffb03a"];
    var c;
    ctx.globalAlpha = mix;
    for (c = 0; c < cols.length; c++) {
      var h = cols[c] * 3 * sc;
      var x = (c - cols.length / 2) * 3 * sc;
      ctx.fillStyle = "#4a1208";
      ctx.fillRect(x - sc, -sc, 3 * sc, 2 * sc);
      ctx.fillStyle = colors[c % colors.length];
      ctx.fillRect(x, -h, 2 * sc, h);
      ctx.fillStyle = "#fff6c8";
      ctx.fillRect(x, -h, sc, Math.max(sc, Math.round(h * 0.35)));
    }
    ctx.restore();
    var i;
    for (i = 0; i < G.embers.length; i++) {
      var p = G.embers[i];
      var a = Math.max(0, p.life / p.max) * mix;
      var sz = Math.max(1, Math.round((p.smoke ? p.size + 2 : p.size) * G.scale));
      ctx.globalAlpha = p.smoke ? a * 0.35 : a;
      ctx.fillStyle = p.smoke ? "#c8c2b4" : (a > 0.5 ? "#ffe27a" : "#ff6a2a");
      ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function drawSceneryShadows() {
    if ((G.bgMix || 0) < 0.22) return;
    var c = coverPlacement(nightImg);
    var spots = [
      [0.06, 0.30, 22, 7],
      [0.14, 0.16, 16, 5],
      [0.90, 0.20, 20, 6],
      [0.95, 0.78, 18, 6],
      [0.08, 0.84, 18, 6],
      [0.86, 0.90, 16, 5],
      [0.20, 0.74, 10, 4],
      [0.80, 0.32, 11, 4]
    ];
    var i;
    for (i = 0; i < spots.length; i++) {
      var s = spots[i];
      var x = c.ox + s[0] * c.iw * c.sc;
      var y = c.oy + s[1] * c.ih * c.sc;
      drawFootShadow(x, y, s[2] * G.scale, s[3] * G.scale, 0.32);
    }
  }

  function updateMarks(dt) {
    var i;
    if (G.cracks) {
      for (i = G.cracks.length - 1; i >= 0; i--) {
        G.cracks[i].life -= dt;
        if (G.cracks[i].life <= 0) G.cracks.splice(i, 1);
      }
    }
    if (G.hooves) {
      for (i = G.hooves.length - 1; i >= 0; i--) {
        G.hooves[i].life -= dt;
        if (G.hooves[i].life <= 0) G.hooves.splice(i, 1);
      }
    }
  }

  function dropHoof(x, y, ang) {
    if (!G.hooves) G.hooves = [];
    G.hooves.push({ x: x, y: y, ang: ang, life: 2.8, max: 2.8 });
    if (G.hooves.length > 90) G.hooves.shift();
  }

  function spawnPawCrack(x, y, ang) {
    if (!G.cracks) G.cracks = [];
    var i;
    for (i = -1; i <= 1; i++) {
      G.cracks.push({
        x: x,
        y: y,
        ang: (ang || 0) + 1.2 + i * 0.4,
        len: (8 + Math.abs(i) * 5) * G.scale,
        life: 1.15,
        max: 1.15
      });
    }
  }

  function spawnCracks(x, y) {
    if (!G.cracks) G.cracks = [];
    var i;
    for (i = 0; i < 8; i++) {
      G.cracks.push({
        x: x,
        y: y,
        ang: (i / 8) * Math.PI * 2 + rand(-0.2, 0.2),
        len: rand(28, 74) * G.scale,
        life: 4.8,
        max: 4.8
      });
    }
    if (G.cracks.length > 48) G.cracks.splice(0, G.cracks.length - 48);
  }

  function drawMarks() {
    var i, s, steps, t, px, py, fade;
    ctx.imageSmoothingEnabled = false;
    if (G.hooves) {
      for (i = 0; i < G.hooves.length; i++) {
        var h = G.hooves[i];
        fade = Math.max(0, h.life / h.max);
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.rotate(h.ang);
        ctx.globalAlpha = 0.55 * fade;
        ctx.fillStyle = "#2a160e";
        ctx.fillRect(-7 * G.scale, -2 * G.scale, 4 * G.scale, 3 * G.scale);
        ctx.fillRect(3 * G.scale, -1 * G.scale, 4 * G.scale, 3 * G.scale);
        ctx.restore();
      }
    }
    if (G.cracks) {
      for (i = 0; i < G.cracks.length; i++) {
        var c = G.cracks[i];
        fade = Math.max(0, c.life / c.max);
        steps = 7;
        for (s = 1; s <= steps; s++) {
          t = s / steps;
          px = c.x + Math.cos(c.ang) * c.len * t + Math.sin(c.ang) * Math.sin(s * 2.1) * 2.5 * G.scale;
          py = c.y + Math.sin(c.ang) * c.len * t * 0.72 + Math.cos(c.ang) * Math.sin(s * 1.7) * 1.5 * G.scale;
          ctx.globalAlpha = fade * (1.05 - t * 0.45);
          ctx.fillStyle = s % 2 ? "#1a0e08" : "#4a3020";
          ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
          if (s % 2 === 0) ctx.fillRect(Math.round(px + 2), Math.round(py + 1), 2, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function deerDustCloud(x, y) {
    var i, p, a, sp;
    for (i = 0; i < 18; i++) {
      p = acquire(G.particles, 420);
      if (!p) break;
      a = Math.random() * Math.PI * 2;
      sp = rand(24, 120) * G.scale;
      p.alive = true;
      p.kind = "puff";
      p.x = x + Math.cos(a) * rand(0, 16) * G.scale;
      p.y = y + Math.sin(a) * rand(0, 8) * G.scale;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp * 0.4 - rand(10, 36) * G.scale;
      p.life = rand(0.75, 1.45);
      p.max = p.life;
      p.size = rand(8, 20) * G.scale;
      p.color = i % 3 === 0 ? "#efe4d0" : (i % 3 === 1 ? "#b9a48a" : "#7a6552");
      p.drag = 1.35;
    }
    for (i = 0; i < 8; i++) {
      p = acquire(G.particles, 420);
      if (!p) break;
      a = rand(-0.8, 0.8) - Math.PI / 2;
      p.alive = true;
      p.kind = "spark";
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * rand(60, 180) * G.scale;
      p.vy = Math.sin(a) * rand(40, 160) * G.scale;
      p.life = rand(0.3, 0.55);
      p.max = p.life;
      p.size = rand(2, 3.4);
      p.color = i % 2 ? "#6b4a32" : "#d7c4a2";
      p.drag = 2.2;
    }
  }

  function deerShockwave(e) {
    var player = G.player;
    if (!player || !player.alive) return;
    var rad = 58 * ACTOR * G.scale + player.r;
    if (len(player.x - e.x, player.y - e.y) < rad) hurtPlayer(e.x, e.y, 2);
  }

  function deerImpact(e, heavy) {
    e.deerState = "land";
    e.deerT = heavy ? 0.48 : 0.36;
    e.skid = (heavy ? 240 : 150) * G.scale * MOVE;
    e.landT = 0.22;
    e.chargeHit = true;
    addShake(heavy ? 16 : 11);
    deerShockwave(e);
    deerDustCloud(e.x, e.y);
    spawnCracks(e.x, e.y);
    sfx.explode(false);
  }

  function drawTracer(b) {
    var ang = Math.atan2(b.vy, b.vx);
    var len = Math.max(3, (b.blen || 5) * G.scale);
    var wid = Math.max(1, (b.bwid || 1.8) * G.scale);
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(ang);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = b.color || "#fff";
    ctx.fillRect(-len * 0.95, -wid * 0.35, len * 0.5, Math.max(1, wid * 0.7));
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(-len * 0.15 - 1, -wid * 0.5 - 0.5, len + 1, wid + 1);
    ctx.fillStyle = b.color || "#d7fff8";
    ctx.fillRect(-len * 0.15, -wid * 0.5, len, wid);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(len * 0.42, -Math.max(0.5, wid * 0.25), Math.max(1, len * 0.22), Math.max(1, wid * 0.5));
    ctx.restore();
  }

  function fmtTime(t) {
    t = Math.max(0, Math.floor(t || 0));
    var m = Math.floor(t / 60);
    var s = t % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function winGame() {
    if (G.state === "win" || G.state === "over" || G.state === "dying") return;
    G.state = "win";
    G.clearLock = true;
    meta.wins = (meta.wins || 0) + 1;
    if (G.score > G.best) {
      G.best = G.score;
      meta.best = G.best;
      saveRaw(KEY_BEST, G.best);
    }
    saveMeta();
    if (el.winScore) el.winScore.textContent = fmt(G.score);
    if (el.winTime) el.winTime.textContent = fmtTime(G.runT);
    if (el.winKills) el.winKills.textContent = String(G.kills);
    if (el.winUps) {
      var list = G.picks || [];
      if (!list.length) el.winUps.innerHTML = "<li>Pistol</li>";
      else {
        var html = "";
        var i;
        for (i = 0; i < list.length; i++) html += "<li>" + list[i] + "</li>";
        el.winUps.innerHTML = html;
      }
    }
    if (el.menuBest) el.menuBest.textContent = fmt(G.best);
    syncUI();
    sfx.milestone();
    if (el.winAgain) el.winAgain.focus();
  }

  function knightGreen(r, g, b, a) {
    return a > 40 && g > r + 18 && g > b + 10 && g > 60;
  }

  function knightStroke(ctx, x0, y0, x1, y1, rad, color) {
    var steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    ctx.fillStyle = color;
    var s;
    for (s = 0; s <= steps; s++) {
      var t = s / steps;
      var x = Math.round(x0 + (x1 - x0) * t - rad);
      var y = Math.round(y0 + (y1 - y0) * t - rad);
      ctx.fillRect(x, y, rad * 2 + 1, rad * 2 + 1);
    }
  }

  function knightLegPose(u) {
    u = ((u % 1) + 1) % 1;
    if (u < 0.5) {
      var p = u / 0.5;
      return { x: 1 - p * 2, lift: 0 };
    }
    var q = (u - 0.5) / 0.5;
    return { x: -1 + q * 2, lift: Math.sin(q * Math.PI) };
  }

  function knightPaintLeg(ctx, hx, hy, swing, lift) {
    var reach = swing * 13;
    var up = lift * 10;
    var kx = hx + reach * 0.45;
    var ky = hy + 7 - up * 0.3;
    var fx = hx + reach;
    var fy = hy + 16 - up;
    knightStroke(ctx, hx, hy, kx, ky, 4, "#16141c");
    knightStroke(ctx, kx, ky, fx, fy, 3, "#16141c");
    knightStroke(ctx, hx, hy, kx, ky, 3, "#9a9aa8");
    knightStroke(ctx, kx, ky, fx, fy - 1, 2, "#d8d8e2");
    knightStroke(ctx, hx, hy + 1, kx, ky, 1, "#f4f4f8");
    var px = Math.round(kx);
    var py = Math.round(ky);
    ctx.fillStyle = "#16141c";
    ctx.fillRect(px - 3, py - 2, 7, 6);
    ctx.fillStyle = "#ececf4";
    ctx.fillRect(px - 2, py - 1, 5, 4);
    var footx = Math.round(fx);
    var footy = Math.round(fy);
    var toe = swing >= 0 ? 5 : -5;
    ctx.fillStyle = "#100e16";
    ctx.fillRect(footx - 5 + Math.min(0, toe), footy - 1, 10 + Math.abs(toe), 6);
    ctx.fillStyle = "#3c3848";
    ctx.fillRect(footx - 4 + Math.min(0, toe), footy, 8 + Math.abs(toe) - 1, 3);
  }

  function knightCompose(body, W, H, swingA, liftA, swingB, liftB, sway) {
    var c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    var cx = c.getContext("2d");
    cx.imageSmoothingEnabled = false;
    cx.drawImage(body, sway, 0);
    knightPaintLeg(cx, 46 + sway, 160, swingB, liftB);
    knightPaintLeg(cx, 86 + sway, 159, swingA, liftA);
    cx.fillStyle = "#141218";
    cx.fillRect(52 + sway, 154, 48, 12);
    cx.fillStyle = "#b4b4c0";
    cx.fillRect(54 + sway, 155, 44, 9);
    cx.fillStyle = "#f0f0f6";
    cx.fillRect(66 + sway, 156, 20, 4);
    return c;
  }

  function buildKnightFrames() {
    if (!heroImg.complete || !heroImg.naturalWidth || knightBuilt) return;
    var H = 180;
    var W = Math.max(1, Math.round(heroImg.naturalWidth * (H / heroImg.naturalHeight)));
    var base = document.createElement("canvas");
    base.width = W;
    base.height = H;
    var bx = base.getContext("2d");
    bx.imageSmoothingEnabled = false;
    bx.clearRect(0, 0, W, H);
    bx.drawImage(heroImg, 0, 0, W, H);
    var img = bx.getImageData(0, 0, W, H);
    var d = img.data;
    var y, x, i;
    for (y = 166; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = (y * W + x) * 4;
        if (d[i + 3] < 40) continue;
        if (knightGreen(d[i], d[i + 1], d[i + 2], d[i + 3]) && x < W * 0.48) continue;
        if (x < 32) continue;
        d[i + 3] = 0;
      }
    }
    bx.putImageData(img, 0, 0);
    walkFrames = [];
    for (i = 0; i < 10; i++) {
      var t = i / 10;
      var A = knightLegPose(t);
      var B = knightLegPose(t + 0.5);
      var sway = Math.round(-A.x * 2);
      walkFrames.push(knightCompose(base, W, H, A.x, A.lift, B.x, B.lift, sway));
    }
    idleFrame = knightCompose(base, W, H, 0, 0, 0, 0, 0);
    knightBuilt = true;
  }

  function ensureKnightFrames() {
    if (!knightBuilt) buildKnightFrames();
  }

  function knightFrameFlash(canvas, key) {
    if (!canvas) return null;
    if (spriteFlash[key]) return spriteFlash[key];
    var w = canvas.width || canvas.naturalWidth;
    var h = canvas.height || canvas.naturalHeight;
    if (!w || !h) return canvas;
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var hx = c.getContext("2d");
    hx.imageSmoothingEnabled = false;
    hx.drawImage(canvas, 0, 0);
    hx.globalCompositeOperation = "source-atop";
    hx.fillStyle = "#ffffff";
    hx.fillRect(0, 0, c.width, c.height);
    spriteFlash[key] = c;
    return c;
  }

  function currentHeroFrame(player) {
    ensureKnightFrames();
    if (player && player.boostT > 0 && rollImgs[0] && rollImgs[0].complete && rollImgs[0].naturalWidth) {
      var dur = player.boostDur || BOOST_DUR;
      var u = 1 - player.boostT / dur;
      if (u < 0) u = 0;
      if (u > 1) u = 1;
      var fi = Math.min(3, Math.floor(u * 4));
      return { img: rollImgs[fi], key: "roll" + fi, roll: true };
    }
    if (player && player.boostT <= 0 && len(player.vx, player.vy) > 48 && walkFrames.length === 10) {
      var step = Math.floor(G.time * 12) % 10;
      return { img: walkFrames[step], key: "walk" + step, roll: false };
    }
    if (idleFrame) return { img: idleFrame, key: "idle", roll: false };
    return { img: heroImg, key: "hero", roll: false };
  }

  function drawCover(img) {
    if (!img.complete || !img.naturalWidth) return false;
    var place = coverPlacement(img);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, place.ox, place.oy, place.dw, place.dh);
    return true;
  }


  function drawBackground() {
    var w = G.w;
    var h = G.h;
    ctx.fillStyle = "#1d3a18";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (!drawCover(dayImg)) {
      ctx.fillStyle = "#2f6a28";
      ctx.fillRect(0, 0, w, h);
    }
    if (G.bgMix > 0.001) {
      ctx.globalAlpha = G.bgMix;
      if (!drawCover(nightImg)) {
        ctx.fillStyle = "#0c1a14";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    drawCampfire();
    drawSceneryShadows();
  }

  function drawShip(x, y, angle, alpha, radius) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(radius * 1.7, 0);
    ctx.lineTo(-radius * 1.05, radius * 0.82);
    ctx.lineTo(-radius * 0.55, 0);
    ctx.lineTo(-radius * 1.05, -radius * 0.82);
    ctx.closePath();
    ctx.fillStyle = "#e9ffff";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = G.player && G.player.tripleT > 0 ? "#ff2bd6" : "#3dfff2";
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function heroFlashImage() {
    if (heroFlashCanvas || !heroImg.complete || !heroImg.naturalWidth) return heroFlashCanvas;
    heroFlashCanvas = document.createElement("canvas");
    heroFlashCanvas.width = heroImg.width;
    heroFlashCanvas.height = heroImg.height;
    var hx = heroFlashCanvas.getContext("2d");
    hx.imageSmoothingEnabled = false;
    hx.clearRect(0, 0, heroFlashCanvas.width, heroFlashCanvas.height);
    hx.drawImage(heroImg, 0, 0);
    hx.globalCompositeOperation = "source-atop";
    hx.fillStyle = "#ffffff";
    hx.fillRect(0, 0, heroFlashCanvas.width, heroFlashCanvas.height);
    return heroFlashCanvas;
  }

  function heroPose(player) {
    if (!player) return { bob: 0, tilt: 0, sx: 1, sy: 1, spin: 0 };
    var sx = 1;
    var sy = 1;
    if (player.squish > 0) {
      var u = clamp(player.squish / 0.16, 0, 1);
      sy = 1 - 0.22 * u;
      sx = 1 + 0.16 * u;
    }
    var bob = Math.sin(G.time * 1.65) * 1.35;
    if (player.boostT > 0) bob = 0;
    else if (len(player.vx, player.vy) > 48 && walkFrames.length === 10) {
      bob = -(WALK_BOB[Math.floor(G.time * 12) % 10] || 0);
    }
    return { bob: bob, tilt: 0, sx: sx, sy: sy, spin: 0 };
  }



  var pixCache = {};
  var canvasPool = {};
  var OUTLINE_R = 31;
  var OUTLINE_G = 58;
  var OUTLINE_B = 0;
  var SHADOW_R = 65;
  var SHADOW_G = 114;
  var SHADOW_B = 40;
  var worldProps = null;
  var bgPixels = null;
  var bgW = 0;
  var bgH = 0;

  function bgPixelGrid() {
    var img = dayImg.naturalWidth ? dayImg : nightImg;
    var place = coverPlacement(img);
    return { step: place.sc, ox: place.ox, oy: place.oy };
  }

  function snapGrid(v, origin, step) {
    return origin + Math.round((v - origin) / step) * step;
  }

  function takeCanvas(w, h) {
    w = Math.max(1, w | 0);
    h = Math.max(1, h | 0);
    var key = w + "x" + h;
    var c = canvasPool[key];
    if (!c) {
      c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      canvasPool[key] = c;
    }
    return c;
  }

  function quantizeVivid(d, maxColors) {
    var idx = [];
    var i, boxes, bi, best, info, box, ch, mid, k, p, rs, gs, bs, n, rr, gg, bb;
    for (i = 0; i < d.length; i += 4) {
      if (d[i + 3] >= 128) idx.push(i);
      else d[i + 3] = 0;
    }
    if (!idx.length) return;
    function rangeOf(arr) {
      var r0 = 255, r1 = 0, g0 = 255, g1 = 0, b0 = 255, b1 = 0, t, q;
      for (t = 0; t < arr.length; t++) {
        q = arr[t];
        if (d[q] < r0) r0 = d[q];
        if (d[q] > r1) r1 = d[q];
        if (d[q + 1] < g0) g0 = d[q + 1];
        if (d[q + 1] > g1) g1 = d[q + 1];
        if (d[q + 2] < b0) b0 = d[q + 2];
        if (d[q + 2] > b1) b1 = d[q + 2];
      }
      var span = r1 - r0;
      var channel = 0;
      if (g1 - g0 >= span) { channel = 1; span = g1 - g0; }
      if (b1 - b0 >= span) { channel = 2; span = b1 - b0; }
      return { ch: channel, span: span };
    }
    boxes = [idx];
    while (boxes.length < maxColors) {
      bi = -1;
      best = 0;
      for (i = 0; i < boxes.length; i++) {
        if (boxes[i].length < 2) continue;
        info = rangeOf(boxes[i]);
        if (info.span > best) {
          best = info.span;
          bi = i;
        }
      }
      if (bi < 0 || best < 10) break;
      info = rangeOf(boxes[bi]);
      box = boxes[bi];
      ch = info.ch;
      box.sort(function (a, b) { return d[a + ch] - d[b + ch]; });
      mid = box.length >> 1;
      boxes[bi] = box.slice(0, mid);
      boxes.push(box.slice(mid));
    }
    for (i = 0; i < boxes.length; i++) {
      box = boxes[i];
      rs = 0;
      gs = 0;
      bs = 0;
      for (k = 0; k < box.length; k++) {
        p = box[k];
        rs += d[p];
        gs += d[p + 1];
        bs += d[p + 2];
      }
      n = box.length || 1;
      rr = Math.round(rs / n);
      gg = Math.round(gs / n);
      bb = Math.round(bs / n);
      for (k = 0; k < box.length; k++) {
        p = box[k];
        d[p] = rr;
        d[p + 1] = gg;
        d[p + 2] = bb;
        d[p + 3] = 255;
      }
    }
  }

  function worldSprite(src, screenW, screenH, cacheKey) {
    var step = bgPixelGrid().step;
    if (!(step > 0)) step = 1;
    var tw = Math.max(1, Math.round(screenW / step));
    var th = Math.max(1, Math.round(screenH / step));
    var id = cacheKey + "@" + tw + "x" + th + "@v5";
    if (pixCache[id]) return pixCache[id];
    var c = document.createElement("canvas");
    c.width = tw;
    c.height = th;
    var g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, tw, th);
    g.drawImage(src, 0, 0, tw, th);
    var image = g.getImageData(0, 0, tw, th);
    var d = image.data;
    quantizeVivid(d, 16);
    g.putImageData(image, 0, 0);
    pixCache[id] = c;
    return c;
  }

  function poseArt(art, pw, ph, face, tilt) {
    var pad = Math.abs(tilt) > 0.01 ? Math.ceil(Math.max(pw, ph) * 0.42) + 1 : 0;
    var w = Math.max(1, pw + pad * 2);
    var h = Math.max(1, ph + pad * 2);
    var c = takeCanvas(w, h);
    var g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, h / 2);
    if (tilt) g.rotate(tilt);
    if (face < 0) g.scale(-1, 1);
    g.drawImage(art, Math.round(-pw / 2), Math.round(-ph / 2), pw, ph);
    g.restore();
    return c;
  }

  var litCanvas = null;

  function hardenAlpha(d) {
    var i, a;
    for (i = 0; i < d.length; i += 4) {
      a = d[i + 3];
      if (a < 128) {
        d[i] = 0;
        d[i + 1] = 0;
        d[i + 2] = 0;
        d[i + 3] = 0;
      } else d[i + 3] = 255;
    }
  }

  function stampOutline(d, tw, th) {
    var x, y, i, edge;
    for (y = 0; y < th; y++) {
      for (x = 0; x < tw; x++) {
        i = (y * tw + x) * 4;
        if (d[i + 3] === 0) continue;
        edge = x === 0 || y === 0 || x === tw - 1 || y === th - 1;
        if (!edge && d[i - 4 + 3] === 0) edge = true;
        if (!edge && d[i + 4 + 3] === 0) edge = true;
        if (!edge && d[i - tw * 4 + 3] === 0) edge = true;
        if (!edge && d[i + tw * 4 + 3] === 0) edge = true;
        if (edge) {
          d[i] = OUTLINE_R;
          d[i + 1] = OUTLINE_G;
          d[i + 2] = OUTLINE_B;
          d[i + 3] = 255;
        }
      }
    }
  }

  function stampFireRim(d, tw, th, dirx, diry, mix) {
    if (mix < 0.12) return;
    var len = Math.hypot(dirx, diry) || 1;
    var sx = dirx / len;
    var sy = diry / len;
    var ox = sx > 0.28 ? 1 : sx < -0.28 ? -1 : 0;
    var oy = sy > 0.28 ? 1 : sy < -0.28 ? -1 : 0;
    if (!ox && !oy) ox = sx >= 0 ? 1 : -1;
    var amt = 0.38 * mix;
    var x, y, i, nx, ny, ni, outside;
    for (y = 0; y < th; y++) {
      for (x = 0; x < tw; x++) {
        i = (y * tw + x) * 4;
        if (d[i + 3] === 0) continue;
        nx = x + ox;
        ny = y + oy;
        outside = nx < 0 || ny < 0 || nx >= tw || ny >= th;
        if (!outside) {
          ni = (ny * tw + nx) * 4;
          outside = d[ni + 3] === 0;
        }
        if (!outside) continue;
        d[i] = Math.round(d[i] * (1 - amt) + 255 * amt);
        d[i + 1] = Math.round(d[i + 1] * (1 - amt) + 186 * amt);
        d[i + 2] = Math.round(d[i + 2] * (1 - amt) + 110 * amt);
        d[i + 3] = 255;
      }
    }
  }

  function stampHighlight(d, tw, th, mix) {
    if (mix > 0.72) return;
    var hr = 255;
    var hg = 246;
    var hb = 214;
    var amt = 0.32 * (1 - mix);
    var x, y, i, up, left, touch;
    for (y = 0; y < th; y++) {
      for (x = 0; x < tw; x++) {
        i = (y * tw + x) * 4;
        if (d[i + 3] === 0) continue;
        if (d[i] === OUTLINE_R && d[i + 1] === OUTLINE_G && d[i + 2] === OUTLINE_B) continue;
        up = y > 0 ? i - tw * 4 : -1;
        left = x > 0 ? i - 4 : -1;
        touch = up < 0 || d[up + 3] === 0 || (d[up] === OUTLINE_R && d[up + 1] === OUTLINE_G && d[up + 2] === OUTLINE_B);
        if (!touch) {
          touch = left < 0 || d[left + 3] === 0 || (d[left] === OUTLINE_R && d[left + 1] === OUTLINE_G && d[left + 2] === OUTLINE_B);
        }
        if (!touch) continue;
        d[i] = Math.round(d[i] * (1 - amt) + hr * amt);
        d[i + 1] = Math.round(d[i + 1] * (1 - amt) + hg * amt);
        d[i + 2] = Math.round(d[i + 2] * (1 - amt) + hb * amt);
        d[i + 3] = 255;
      }
    }
  }

  function lightArt(art, dirx, diry, flash) {
    var w = art.width;
    var h = art.height;
    if (!litCanvas || litCanvas.width !== w || litCanvas.height !== h) {
      litCanvas = document.createElement("canvas");
      litCanvas.width = w;
      litCanvas.height = h;
    }
    var hx = litCanvas.getContext("2d");
    var mix = G.bgMix || 0;
    var tr = Math.round(255 * (1 - mix) + 214 * mix);
    var tg = Math.round(244 * (1 - mix) + 222 * mix);
    var tb = Math.round(230 * (1 - mix) + 236 * mix);
    var image, d;
    hx.imageSmoothingEnabled = false;
    hx.setTransform(1, 0, 0, 1, 0, 0);
    hx.globalAlpha = 1;
    hx.globalCompositeOperation = "source-over";
    hx.clearRect(0, 0, w, h);
    hx.drawImage(art, 0, 0);
    if (flash) {
      hx.globalCompositeOperation = "source-atop";
      hx.fillStyle = "#ffffff";
      hx.fillRect(0, 0, w, h);
    } else {
      hx.globalCompositeOperation = "multiply";
      hx.fillStyle = "rgb(" + tr + "," + tg + "," + tb + ")";
      hx.fillRect(0, 0, w, h);
      hx.globalCompositeOperation = "destination-in";
      hx.drawImage(art, 0, 0);
    }
    hx.globalAlpha = 1;
    hx.globalCompositeOperation = "source-over";
    image = hx.getImageData(0, 0, w, h);
    d = image.data;
    hardenAlpha(d);
    if (!flash) {
      stampHighlight(d, w, h, mix);
      stampFireRim(d, w, h, dirx, diry, mix);
    }
    hx.putImageData(image, 0, 0);
    return litCanvas;
  }

  function isGrassColor(r, g, b) {
    var luma = r * 0.3 + g * 0.59 + b * 0.11;
    return g > r + 10 && g > b && luma > 90 && luma < 190;
  }

  function sampleGround(sx, sy) {
    if (!bgPixels) return null;
    var place = coverPlacement(dayImg);
    var ix = Math.round((sx - place.ox) / place.sc);
    var iy = Math.round((sy - place.oy) / place.sc);
    if (ix < 0 || iy < 0 || ix >= bgW || iy >= bgH) return null;
    var i = (iy * bgW + ix) * 4;
    return [bgPixels[i], bgPixels[i + 1], bgPixels[i + 2]];
  }

  function drawContactShadow(x, feetY, width, alpha) {
    if (alpha != null && alpha < 0.08) return;
    var grid = bgPixelGrid();
    var step = grid.step;
    var cols = Math.max(3, Math.round(width / step));
    if (alpha != null && alpha < 0.22) cols = Math.max(3, Math.round(cols * 0.62));
    if (cols % 2 === 0) cols++;
    var left = snapGrid(x - cols * step * 0.5, grid.ox, step);
    var top = snapGrid(feetY - step, grid.oy, step);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgb(" + SHADOW_R + "," + SHADOW_G + "," + SHADOW_B + ")";
    ctx.fillRect(left + step, top + step, Math.max(step, (cols - 2) * step), step);
    ctx.fillStyle = "rgb(49,88,30)";
    ctx.fillRect(left + step, top, Math.max(step, (cols - 2) * step), step);
    ctx.fillStyle = "rgb(" + SHADOW_R + "," + SHADOW_G + "," + SHADOW_B + ")";
    ctx.fillRect(left, top, step, step);
    ctx.fillRect(left + (cols - 1) * step, top, step, step);
  }

  function drawGrassTufts(cx, feetY) {
    var grid = bgPixelGrid();
    var step = grid.step;
    if (!(step > 0)) return;
    var sample = sampleGround(cx, feetY + step * 0.35);
    if (!sample || !isGrassColor(sample[0], sample[1], sample[2])) return;
    var tipR = Math.min(255, sample[0] + 22);
    var tipG = Math.min(255, sample[1] + 26);
    var tipB = Math.max(0, sample[2] - 6);
    var seeds = [-2, 1, 3];
    var i, gx, top;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = false;
    for (i = 0; i < seeds.length; i++) {
      gx = snapGrid(cx + seeds[i] * step, grid.ox, step);
      top = snapGrid(feetY - step * (i === 1 ? 0 : 1), grid.oy, step);
      ctx.fillStyle = "rgb(" + sample[0] + "," + sample[1] + "," + sample[2] + ")";
      ctx.fillRect(gx, top + step, step, step * 2);
      ctx.fillStyle = "rgb(" + tipR + "," + tipG + "," + tipB + ")";
      ctx.fillRect(gx, top, step, step);
    }
  }

  function cutProp(mask, day, night, x0, y0, x1, y1) {
    var cw = x1 - x0;
    var ch = y1 - y0;
    if (cw < 2 || ch < 2) return null;
    var dayC = document.createElement("canvas");
    var nightC = document.createElement("canvas");
    dayC.width = cw;
    dayC.height = ch;
    nightC.width = cw;
    nightC.height = ch;
    var dd = dayC.getContext("2d").createImageData(cw, ch);
    var nn = nightC.getContext("2d").createImageData(cw, ch);
    var py, px, si, di, spx, kept = 0;
    for (py = 0; py < ch; py++) {
      for (px = 0; px < cw; px++) {
        si = (y0 + py) * bgW + (x0 + px);
        if (!mask[si]) continue;
        di = (py * cw + px) * 4;
        spx = si * 4;
        dd.data[di] = day[spx];
        dd.data[di + 1] = day[spx + 1];
        dd.data[di + 2] = day[spx + 2];
        dd.data[di + 3] = 255;
        nn.data[di] = night[spx];
        nn.data[di + 1] = night[spx + 1];
        nn.data[di + 2] = night[spx + 2];
        nn.data[di + 3] = 255;
        kept++;
      }
    }
    if (kept < 80) return null;
    dayC.getContext("2d").putImageData(dd, 0, 0);
    nightC.getContext("2d").putImageData(nn, 0, 0);
    return { day: dayC, night: nightC, x: x0, y: y0, w: cw, h: ch };
  }

  function ensureWorldProps() {
    if (worldProps) return worldProps;
    if (!(dayImg.complete && dayImg.naturalWidth && nightImg.complete && nightImg.naturalWidth)) return null;
    try {
      var w = dayImg.naturalWidth;
      var h = dayImg.naturalHeight;
      var grab = document.createElement("canvas");
      grab.width = w;
      grab.height = h;
      var gg = grab.getContext("2d");
      gg.drawImage(dayImg, 0, 0);
      var day = gg.getImageData(0, 0, w, h).data;
      gg.clearRect(0, 0, w, h);
      gg.drawImage(nightImg, 0, 0, w, h);
      var night = gg.getImageData(0, 0, w, h).data;
      bgPixels = day;
      bgW = w;
      bgH = h;
      var mask = new Uint8Array(w * h);
      var x, y, i, p, r, g, b, luma, u, v, canopy, brown, edge;
      for (y = 0; y < h; y++) {
        v = y / h;
        for (x = 0; x < w; x++) {
          i = y * w + x;
          p = i * 4;
          r = day[p];
          g = day[p + 1];
          b = day[p + 2];
          luma = r * 0.3 + g * 0.59 + b * 0.11;
          u = x / w;
          canopy = g > r + 6 && g > b && luma < 78;
          brown = r > g - 5 && r > b && luma < 105 && r > 45 && g > 25 && g < 160;
          edge = u < 0.22 || u > 0.78 || v < 0.2 || v > 0.8;
          if (canopy || (brown && edge)) mask[i] = 1;
        }
      }
      var seen = new Uint8Array(w * h);
      var blobs = [];
      var stack, n, x0, y0, x1, y1, pi, qx, qy, ni;
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          i = y * w + x;
          if (!mask[i] || seen[i]) continue;
          stack = [i];
          seen[i] = 1;
          n = 0;
          x0 = x;
          y0 = y;
          x1 = x;
          y1 = y;
          while (stack.length) {
            pi = stack.pop();
            n++;
            qx = pi % w;
            qy = (pi / w) | 0;
            if (qx < x0) x0 = qx;
            if (qy < y0) y0 = qy;
            if (qx > x1) x1 = qx;
            if (qy > y1) y1 = qy;
            if (qx > 0) {
              ni = pi - 1;
              if (mask[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); }
            }
            if (qx + 1 < w) {
              ni = pi + 1;
              if (mask[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); }
            }
            if (qy > 0) {
              ni = pi - w;
              if (mask[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); }
            }
            if (qy + 1 < h) {
              ni = pi + w;
              if (mask[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); }
            }
          }
          if (n > 500) blobs.push({ n: n, x0: x0, y0: y0, x1: x1 + 1, y1: y1 + 1 });
        }
      }
      blobs.sort(function (a, b) { return b.n - a.n; });
      if (blobs.length > 18) blobs.length = 18;
      var props = [];
      var bi, blob, bh, split, base, canopy, one;
      for (bi = 0; bi < blobs.length; bi++) {
        blob = blobs[bi];
        bh = blob.y1 - blob.y0;
        if (bh > 70) {
          split = blob.y0 + Math.round(bh * 0.58);
          canopy = cutProp(mask, day, night, blob.x0, blob.y0, blob.x1, split);
          base = cutProp(mask, day, night, blob.x0, split, blob.x1, blob.y1);
          if (base) {
            base.sortY = blob.y1 - 8;
            props.push(base);
          }
          if (canopy) {
            canopy.sortY = blob.y1 + 4;
            props.push(canopy);
          }
        } else {
          one = cutProp(mask, day, night, blob.x0, blob.y0, blob.x1, blob.y1);
          if (one) {
            one.sortY = blob.y1;
            props.push(one);
          }
        }
      }
      worldProps = props;
    } catch (err) {
      worldProps = [];
    }
    return worldProps;
  }

  function drawProp(prop) {
    var place = coverPlacement(dayImg);
    var x = place.ox + prop.x * place.sc;
    var y = place.oy + prop.y * place.sc;
    var w = prop.w * place.sc;
    var h = prop.h * place.sc;
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(prop.day, x, y, w, h);
    if ((G.bgMix || 0) > 0.001 && prop.night) {
      ctx.globalAlpha = G.bgMix;
      ctx.drawImage(prop.night, x, y, w, h);
    }
    ctx.globalAlpha = 1;
  }

  function heroSortY(player) {
    var box = heroDrawSize();
    var pose = heroPose(player);
    var step = bgPixelGrid().step || 1;
    var th = Math.max(1, Math.round((box.h * (pose.sy || 1)) / step));
    var bob = Math.round((pose.bob || 0) / step) * step;
    return player.y + bob + th * step * 0.5;
  }

  function enemySortY(e) {
    if (e.type === "bunny") {
      var dh = (e.elite ? 58 : 52) * ACTOR * G.scale;
      var ground = e.hop === "hop" ? (e.gy || e.y) : e.y;
      return ground + dh * 0.5;
    }
    if (e.type === "hamster") return e.y;
    if (e.type === "boss" && e.deer) return e.y + 158 * ACTOR * G.scale * 0.45;
    return e.y;
  }

  function paintOnMap(src, cacheKey, cx, cy, screenW, screenH, opt) {
    opt = opt || {};
    var ready = src && ((src.complete && src.naturalWidth) || src.width);
    if (!ready || !(screenW > 0) || !(screenH > 0)) return null;
    var art = worldSprite(src, screenW, screenH, cacheKey);
    var grid = bgPixelGrid();
    var step = grid.step;
    var sx = opt.sx || 1;
    var sy = opt.sy || 1;
    var pw = Math.max(1, Math.round(art.width * sx));
    var ph = Math.max(1, Math.round(art.height * sy));
    var tilt = opt.tilt || 0;
    var face = opt.face == null ? 1 : opt.face;
    var posed = art;
    if (face < 0 || Math.abs(sx - 1) > 0.04 || Math.abs(sy - 1) > 0.04 || Math.abs(tilt) > 0.01) {
      posed = poseArt(art, pw, ph, face, tilt);
    }
    var bob = Math.round((opt.bob || 0) / step) * step;
    var anchorY = opt.anchorY == null ? 0.5 : opt.anchorY;
    var dw = posed.width * step;
    var dh = posed.height * step;
    var left = snapGrid(cx - dw / 2, grid.ox, step);
    var top = snapGrid(cy + bob - dh * anchorY, grid.oy, step);
    var feet = top + dh;
    if (opt.shadow !== false) {
      var shadowW = opt.shadowW || dw * 0.5;
      drawContactShadow(cx, feet, Math.max(shadowW, step * 5), opt.shadowA == null ? 0.55 : opt.shadowA);
    }
    var fire = campfirePos();
    var lit = lightArt(posed, fire.x - cx, fire.y - cy, !!opt.flash);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lit, left, top, dw, dh);
    if (opt.grass !== false) drawGrassTufts(cx, feet);
    return { left: left, top: top, dw: dw, dh: dh, step: step };
  }

  function heroMapRect(player) {
    ensureKnightFrames();
    var box = heroDrawSize();
    var frame = currentHeroFrame(player);
    var img = frame.img;
    var sh = box.h;
    var sw = box.w;
    if (frame.roll && img && (img.naturalWidth || img.width)) {
      var iw = img.naturalWidth || img.width;
      var ih = img.naturalHeight || img.height;
      sw = sh * (iw / ih);
    }
    var pose = heroPose(player);
    var grid = bgPixelGrid();
    var step = grid.step;
    var tw = Math.max(1, Math.round(sw / step));
    var th = Math.max(1, Math.round(sh / step));
    var pw = Math.max(1, Math.round(tw * (pose.sx || 1)));
    var ph = Math.max(1, Math.round(th * (pose.sy || 1)));
    var dw = pw * step;
    var dh = ph * step;
    var bob = Math.round((pose.bob || 0) / step) * step;
    return {
      left: snapGrid(player.x - dw / 2, grid.ox, step),
      top: snapGrid(player.y + bob - dh * 0.5, grid.oy, step),
      dw: dw,
      dh: dh,
      step: step
    };
  }


  function drawHero(x, y, face, alpha, flash, pose) {
    pose = pose || { bob: 0, tilt: 0, sx: 1, sy: 1, spin: 0 };
    ensureKnightFrames();
    var box = heroDrawSize();
    var frame = currentHeroFrame(G.player);
    var img = frame.img;
    var ready = img && ((img.complete && img.naturalWidth) || img.width);
    if (!ready) return;
    var sh = box.h;
    var sw = box.w;
    if (frame.roll && (img.naturalWidth || img.width)) {
      sw = sh * ((img.naturalWidth || img.width) / (img.naturalHeight || img.height));
    }
    ctx.save();
    ctx.globalAlpha = 1;
    paintOnMap(img, frame.key, x, y, sw, sh, {
      face: face || 1,
      sx: pose.sx || 1,
      sy: pose.sy || 1,
      bob: pose.bob || 0,
      anchorY: 0.5,
      flash: flash,
      shadowA: 0.46
    });
    ctx.restore();
  }
  function drawPlayer() {
    var player = G.player;
    if (!player) return;
    if (G.state !== "menu" && player.iframes > 0.22 && Math.floor(G.time * 16) % 2 === 0 && player.alive) {
      /* blink while recovering from a hit */
    } else if (player.alive || G.state === "menu") {
      drawHero(player.x, player.y, player.face || 1, 1, player.hitFlash > 0, heroPose(player));
      drawHeldGun(player);
    }
  }


  function drawSprout(x, y) {
    var grid = bgPixelGrid();
    var s = grid.step;
    var ox = snapGrid(x, grid.ox, s);
    var oy = snapGrid(y, grid.oy, s);
    ctx.imageSmoothingEnabled = false;
    drawContactShadow(ox, oy + s, 5 * s, 0.36);
    ctx.fillStyle = "#1a2e08";
    ctx.fillRect(ox - s, oy - 4 * s, 2 * s, 6 * s);
    ctx.fillStyle = "#5c7040";
    ctx.fillRect(ox - s, oy - 3 * s, s, 4 * s);
    ctx.fillStyle = "#1a2e08";
    ctx.fillRect(ox - 3 * s, oy - 5 * s, 3 * s, 3 * s);
    ctx.fillRect(ox, oy - 6 * s, 3 * s, 3 * s);
    ctx.fillStyle = "#8aa84a";
    ctx.fillRect(ox - 2 * s, oy - 4 * s, 2 * s, 2 * s);
    ctx.fillStyle = "#c6c07a";
    ctx.fillRect(ox + s, oy - 5 * s, 2 * s, 2 * s);
  }
  function drawBossFx() {
    return;
  }

  function bunnySheet(e) {
    if (e.hop === "hop") return bunnyJumpImg;
    if (e.hop === "atk") return bunnyAtkImg;
    return bunnySitImg;
  }

  function bunnyFlashOf(img, key) {
    if (bunnyFlash[key] || !img.complete || !img.naturalWidth) return bunnyFlash[key];
    var c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    var hx = c.getContext("2d");
    hx.imageSmoothingEnabled = false;
    hx.drawImage(img, 0, 0);
    hx.globalCompositeOperation = "source-atop";
    hx.fillStyle = "#ffffff";
    hx.fillRect(0, 0, c.width, c.height);
    bunnyFlash[key] = c;
    return c;
  }

  function drawBunnySprite(e) {
    var img = bunnySheet(e);
    var ready = img && img.complete && img.naturalWidth;
    var dh = (e.elite ? 58 : 52) * ACTOR * G.scale;
    var dw = ready ? dh * (img.naturalWidth / img.naturalHeight) : dh * 0.72;
    var ground = e.hop === "hop" ? e.gy : e.y;
    var lift = Math.max(0, ground - e.y);
    var air = clamp(lift / (22 * G.scale), 0, 1);
    var squash = 1;
    var stretch = 1;
    if (e.landT > 0) {
      var u = clamp(e.landT / 0.14, 0, 1);
      squash = 1 - 0.26 * u;
      stretch = 1 + 0.14 * u;
    }
    if (!ready) return;
    if (air < 0.98) {
      drawContactShadow(e.x, ground + dh * 0.46, dw * 0.4 * (1 - air * 0.45), 0.42 * (1 - air * 0.75));
    }
    var flip = (e.face || -1) > 0 ? -1 : 1;
    var key = e.hop === "hop" ? "jump" : e.hop === "atk" ? "atk" : "sit";
    paintOnMap(img, "bunny-" + key + (e.elite ? "-e" : ""), e.x, e.y, dw, dh, {
      face: flip,
      sx: stretch,
      sy: squash,
      anchorY: 0.5,
      flash: e.hitFlash > 0,
      shadow: false,
      grass: air < 0.2
    });
  }
  function flashOf(img, key) {
    if (spriteFlash[key] || !img || !img.complete || !img.naturalWidth) return spriteFlash[key];
    var c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    var hx = c.getContext("2d");
    hx.imageSmoothingEnabled = false;
    hx.drawImage(img, 0, 0);
    hx.globalCompositeOperation = "source-atop";
    hx.fillStyle = "#ffffff";
    hx.fillRect(0, 0, c.width, c.height);
    spriteFlash[key] = c;
    return c;
  }

  function drawGrounded(img, key, e, dh, hit) {
    var ready = img && img.complete && img.naturalWidth;
    if (!ready) return;
    var dw = dh * (img.naturalWidth / img.naturalHeight);
    var flip = (e.face || -1) > 0 ? -1 : 1;
    paintOnMap(img, "ground-" + key, e.x, e.y, dw, dh, {
      face: flip,
      anchorY: 1,
      flash: hit,
      shadow: false
    });
  }
  function drawSoil() {
    if (!G.soil) return;
    var s = Math.max(2, Math.round(2 * G.scale));
    var i;
    ctx.imageSmoothingEnabled = false;
    for (i = 0; i < G.soil.length; i++) {
      var mark = G.soil[i];
      if (!mark.alive) continue;
      var fade = Math.max(0, mark.life / mark.max);
      var ox = Math.round(mark.x);
      var oy = Math.round(mark.y);
      var n = mark.seed || 0;
      ctx.globalAlpha = 0.35 + 0.65 * fade;
      ctx.fillStyle = "#3d2818";
      ctx.fillRect(ox - 3 * s, oy - s, 6 * s, 2 * s);
      ctx.fillStyle = "#6a4630";
      ctx.fillRect(ox - 2 * s + Math.round(Math.sin(n) * s), oy - 2 * s, 3 * s, s);
      ctx.fillStyle = "#2a160c";
      ctx.fillRect(ox - 2 * s, oy, s, s);
      ctx.fillRect(ox - s, oy - s, s, s);
      ctx.fillRect(ox + s, oy, 2 * s, s);
      ctx.fillRect(ox + Math.round(Math.cos(n) * s), oy + s, s, s);
      ctx.fillStyle = "#c4a06a";
      ctx.globalAlpha = 0.45 * fade;
      ctx.fillRect(ox + 2 * s, oy - s, s, s);
      ctx.fillRect(ox - 3 * s, oy + s, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function drawDirtMound(e) {
    var sc = G.scale;
    var s = Math.max(2, Math.round(2 * sc));
    var warn = e.burrow === "warn";
    var phase = e.digPhase || 0;
    var pulse = warn ? Math.sin(G.time * 28) : Math.sin(phase * 11);
    var rise = (warn ? Math.abs(Math.sin(G.time * 26)) : (0.35 + 0.65 * (0.5 + 0.5 * pulse))) * 5 * sc;
    var shake = warn ? Math.round(Math.sin(G.time * 46) * 2.4 * sc) : 0;
    var wide = warn ? 1 : (pulse > 0 ? 0.82 : 1.12);
    ctx.save();
    ctx.translate(Math.round(e.x + shake), Math.round(e.y - rise));
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "rgba(30, 18, 10, 0.4)";
    ctx.fillRect(Math.round(-6 * s * wide), Math.round(rise + s), Math.round(12 * s * wide), s);
    ctx.fillStyle = "#4a301c";
    ctx.fillRect(Math.round(-5 * s * wide), -s, Math.round(10 * s * wide), 3 * s);
    ctx.fillStyle = "#6a4630";
    ctx.fillRect(Math.round(-4 * s * wide), -3 * s, Math.round(8 * s * wide), 3 * s);
    ctx.fillStyle = "#8b5a38";
    ctx.fillRect(Math.round(-2 * s * wide), -5 * s, Math.round(4 * s * wide), 3 * s);
    ctx.fillStyle = "#c4a06a";
    ctx.fillRect(-s, -6 * s, 2 * s, s);
    ctx.fillStyle = "#3a2416";
    ctx.fillRect(Math.round(-3 * s * wide), -s, s, s);
    ctx.fillRect(Math.round(2 * s * wide), 0, s, s);
    ctx.restore();
  }

  function drawHamster(e) {
    if (e.burrow === "dig" || e.burrow === "warn") {
      drawDirtMound(e);
      return;
    }
    var img = e.burrow === "e1" ? hamE1 : e.burrow === "e2" ? hamE2 : e.burrow === "e3" ? hamE3 : hamImg;
    var key = e.burrow === "up" ? "ham" : e.burrow;
    var dh = (e.burrow === "e1" ? 30 : e.burrow === "e2" ? 42 : 52) * ACTOR * G.scale;
    if (e.burrow === "up" || e.burrow === "e3") {
      drawContactShadow(e.x, e.y, dh * 0.46, e.burrow === "up" ? 0.46 : 0.28);
    }
    drawGrounded(img, key, e, dh, e.hitFlash > 0 && e.burrow === "up");
  }


  function deerPawPose(e) {
    var dur = e.pawDur || 1.2;
    var u = 1 - Math.max(0, e.deerT) / dur;
    if (u < 0) u = 0;
    if (u > 0.999) u = 0.999;
    var kicks = 3;
    var local = (u * kicks) % 1;
    var raising = local < 0.5;
    var t = raising ? local / 0.5 : (local - 0.5) / 0.5;
    var lift = raising ? t * t : 1 - t * t;
    return {
      ang: -0.73 * lift,
      dip: !raising && t > 0.72 ? 2 : 0,
      idx: Math.min(kicks - 1, Math.floor(u * kicks)),
      impact: !raising && t > 0.84
    };
  }

  function buildDeerParts() {
    if (deerParts) return deerParts;
    if (!(deerImg.complete && deerImg.naturalWidth)) return null;
    var w = deerImg.naturalWidth;
    var h = deerImg.naturalHeight;
    var grab = document.createElement("canvas");
    grab.width = w;
    grab.height = h;
    var gg = grab.getContext("2d");
    gg.drawImage(deerImg, 0, 0);
    var src = gg.getImageData(0, 0, w, h);
    var d = src.data;
    var yCut = Math.round(h * 468 / 636);
    var xCut = Math.round(w * 630 / 730);
    var yNarrow = Math.round(h * 500 / 636);
    var xNarrow = Math.round(w * 648 / 730);
    var ySeed = Math.round(h * 560 / 636);
    function ok(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      if (d[(y * w + x) * 4 + 3] < 128) return false;
      if (y < yCut || x < xCut) return false;
      if (y < yNarrow && x < xNarrow) return false;
      return true;
    }
    var mask = new Uint8Array(w * h);
    var stack = [];
    var x, y, i;
    for (y = ySeed; y < h; y++) {
      for (x = xCut; x < w; x++) {
        if (!ok(x, y)) continue;
        i = y * w + x;
        if (mask[i]) continue;
        mask[i] = 1;
        stack.push(x, y);
      }
    }
    var nbs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (stack.length) {
      y = stack.pop();
      x = stack.pop();
      var n;
      for (n = 0; n < nbs.length; n++) {
        var nx = x + nbs[n][0];
        var ny = y + nbs[n][1];
        if (!ok(nx, ny)) continue;
        i = ny * w + nx;
        if (mask[i]) continue;
        mask[i] = 1;
        stack.push(nx, ny);
      }
    }
    var count = 0;
    var maxY = 0;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        count++;
        if (y > maxY) maxY = y;
      }
    }
    if (count < 40) {
      deerParts = { empty: true };
      return deerParts;
    }
    var pxSum = 0;
    var pySum = 0;
    var hn = 0;
    var hxSum = 0;
    var hySum = 0;
    var hoofN = 0;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        if (y < yCut + 12) {
          pxSum += x;
          pySum += y;
          hn++;
        }
      }
    }
    for (y = maxY - 16; y <= maxY; y++) {
      if (y < 0) continue;
      for (x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        hxSum += x;
        hySum += y;
        hoofN++;
      }
    }
    var pivotN = hn || 1;
    var pivotX = pxSum / pivotN;
    var pivotY = pySum / pivotN;
    var hoofX = hoofN ? hxSum / hoofN : pivotX;
    var hoofY = hoofN ? hySum / hoofN : h - 4;
    function nearbyBody(x, y) {
      var dist, nx, ny;
      for (dist = 1; dist < 40; dist++) {
        ny = y - dist;
        nx = x;
        if (ny >= 0 && !mask[ny * w + nx] && d[(ny * w + nx) * 4 + 3] > 200) return (ny * w + nx) * 4;
        nx = x - dist;
        ny = y;
        if (nx >= 0 && !mask[ny * w + nx] && d[(ny * w + nx) * 4 + 3] > 200) return (ny * w + nx) * 4;
        nx = x - dist;
        ny = y - dist;
        if (nx >= 0 && ny >= 0 && !mask[ny * w + nx] && d[(ny * w + nx) * 4 + 3] > 200) return (ny * w + nx) * 4;
      }
      return -1;
    }
    var pad = 56;
    var cw = w + pad * 2;
    var ch = h;
    var yFill = yCut + 22;
    var body = document.createElement("canvas");
    var leg = document.createElement("canvas");
    body.width = cw;
    body.height = ch;
    leg.width = cw;
    leg.height = ch;
    var bd = body.getContext("2d").createImageData(cw, ch);
    var ld = leg.getContext("2d").createImageData(cw, ch);
    var di, bi;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        i = (y * w + x) * 4;
        di = (y * cw + (x + pad)) * 4;
        if (mask[y * w + x]) {
          ld.data[di] = d[i];
          ld.data[di + 1] = d[i + 1];
          ld.data[di + 2] = d[i + 2];
          ld.data[di + 3] = 255;
          if (y < yFill) {
            bi = nearbyBody(x, y);
            if (bi >= 0) {
              bd.data[di] = d[bi];
              bd.data[di + 1] = d[bi + 1];
              bd.data[di + 2] = d[bi + 2];
              bd.data[di + 3] = 255;
            }
          }
        } else {
          bd.data[di] = d[i];
          bd.data[di + 1] = d[i + 1];
          bd.data[di + 2] = d[i + 2];
          bd.data[di + 3] = d[i + 3];
        }
      }
    }
    body.getContext("2d").putImageData(bd, 0, 0);
    leg.getContext("2d").putImageData(ld, 0, 0);
    deerParts = {
      empty: false,
      body: body,
      leg: leg,
      legData: ld.data,
      w: cw,
      h: ch,
      natW: w,
      natH: h,
      pad: pad,
      pivotX: pivotX + pad,
      pivotY: pivotY,
      hoofX: hoofX + pad,
      hoofY: hoofY,
      cache: {}
    };
    return deerParts;
  }

  function deerLegCanvas(ang) {
    var parts = buildDeerParts();
    if (!parts || parts.empty) return null;
    var bucket = Math.round(ang * 57.3);
    if (parts.cache[bucket]) return parts.cache[bucket];
    var sw = parts.w;
    var sh = parts.h;
    var c = document.createElement("canvas");
    c.width = sw;
    c.height = sh;
    var g = c.getContext("2d");
    var image = g.createImageData(sw, sh);
    var dst = image.data;
    var src = parts.legData;
    var cos = Math.cos(ang);
    var sin = Math.sin(ang);
    var px0 = parts.pivotX;
    var py0 = parts.pivotY;
    var x, y, dx, dy, sx, sy, si, di;
    for (y = 0; y < sh; y++) {
      for (x = 0; x < sw; x++) {
        dx = x - px0;
        dy = y - py0;
        sx = Math.round(px0 + dx * cos + dy * sin);
        sy = Math.round(py0 - dx * sin + dy * cos);
        if (sx < 0 || sy < 0 || sx >= sw || sy >= sh) continue;
        si = (sy * sw + sx) * 4;
        if (src[si + 3] < 128) continue;
        di = (y * sw + x) * 4;
        dst[di] = src[si];
        dst[di + 1] = src[si + 1];
        dst[di + 2] = src[si + 2];
        dst[di + 3] = 255;
      }
    }
    g.putImageData(image, 0, 0);
    parts.cache[bucket] = c;
    return c;
  }

  function deerDrawSize(parts) {
    var dh = 158 * ACTOR * G.scale;
    var natW = deerImg.naturalWidth || 320;
    var natH = deerImg.naturalHeight || 279;
    if (!parts || parts.empty) return { dw: dh * (natW / natH), dh: dh };
    return { dw: dh * (parts.w / parts.h), dh: dh };
  }

  function deerHoofScreen(e, ang, dip) {
    var parts = buildDeerParts();
    var grid = bgPixelGrid();
    var step = grid.step || 1;
    var bob = Math.round((dip || 0) * step);
    var size = deerDrawSize(parts);
    var tw = Math.max(1, Math.round(size.dw / step));
    var th = Math.max(1, Math.round(size.dh / step));
    var dw = tw * step;
    var dh = th * step;
    var left = snapGrid(e.x - dw / 2, grid.ox, step);
    var top = snapGrid(e.y + bob - dh * 0.55, grid.oy, step);
    if (!parts || parts.empty) return { x: e.x, y: top + dh };
    var dx = parts.hoofX - parts.pivotX;
    var dy = parts.hoofY - parts.pivotY;
    var c = Math.cos(ang);
    var s = Math.sin(ang);
    var ix = parts.pivotX + dx * c - dy * s;
    var iy = parts.pivotY + dx * s + dy * c;
    var flip = (e.face || -1) > 0 ? -1 : 1;
    var u = ix / parts.w;
    if (flip < 0) u = 1 - u;
    return { x: left + u * dw, y: top + (iy / parts.h) * dh };
  }

  function drawDeer(e) {
    var dh = 158 * ACTOR * G.scale;
    var ready = deerImg.complete && deerImg.naturalWidth;
    if (!ready) return;
    var dw = dh * (deerImg.naturalWidth / deerImg.naturalHeight);
    var flip = (e.face || -1) > 0 ? -1 : 1;
    var sx = 1;
    var sy = 1;
    var ox = 0;
    var oy = 0;
    var tilt = 0;
    var sc = G.scale;
    if (e.deerState === "paw") {
      var paw = deerPawPose(e);
      var parts = buildDeerParts();
      var grid = bgPixelGrid();
      var bob = paw.dip * (grid.step || 1);
      if (parts && !parts.empty) {
        var box = deerDrawSize(parts);
        var leg = deerLegCanvas(paw.ang);
        var contentW = box.dh * ((parts.natW || deerImg.naturalWidth) / (parts.natH || deerImg.naturalHeight));
        paintOnMap(parts.body, "deer-body", e.x, e.y, box.dw, box.dh, {
          face: flip,
          anchorY: 0.55,
          bob: bob,
          flash: e.hitFlash > 0,
          shadowA: 0.5,
          shadowW: contentW * 0.5
        });
        if (leg) {
          paintOnMap(leg, "deer-leg" + Math.round(paw.ang * 57.3), e.x, e.y, box.dw, box.dh, {
            face: flip,
            anchorY: 0.55,
            bob: bob,
            flash: e.hitFlash > 0,
            shadow: false,
            grass: false
          });
        }
        return;
      }
    }
    if (e.deerState === "dash") {
      sx = 1.16;
      sy = 0.84;
      tilt = 0.18 * flip;
    } else if (e.deerState === "swipe") {
      tilt = 0.22 * flip;
      sy = 0.92;
      sx = 1.06;
    } else if (e.deerState === "land") {
      var u = clamp((e.landT || 0) / 0.22, 0, 1);
      sy = 1 - 0.28 * u;
      sx = 1 + 0.2 * u;
      oy = 6 * sc * u;
    } else if (e.deerState === "stun") {
      sy = 0.9;
      sx = 1.06;
    }
    paintOnMap(deerImg, "deer", e.x + ox, e.y + oy, dw, dh, {
      face: flip,
      sx: sx,
      sy: sy,
      tilt: tilt,
      anchorY: 0.55,
      flash: e.hitFlash > 0,
      shadowA: 0.5
    });
  }
  function drawEnemy(e) {
    if (e.type === "bunny") drawBunnySprite(e);
    else if (e.type === "hamster") drawHamster(e);
    else if (e.type === "boss" && e.deer) drawDeer(e);
    else return;
    if (e.maxHp > 2 && e.hp < e.maxHp && e.type !== "boss") {
      var bw = e.r * 2;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 8, bw, 3);
      ctx.fillStyle = e.elite ? "#ffd56a" : "#ffffff";
      ctx.fillRect(e.x - bw / 2, e.y - e.r - 8, bw * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
  }


  function traceCapsule(hw, hh) {
    var cap = Math.min(hw, hh);
    var cy = Math.max(0, hh - cap);
    ctx.beginPath();
    ctx.arc(0, -cy, cap, Math.PI, 0);
    ctx.arc(0, cy, cap, 0, Math.PI);
    ctx.closePath();
  }

  function drawPickup(p) {
    if (p.life < 2.5 && Math.floor(G.time * 8) % 2 === 0) return;
    var mark = p.type === "shield" ? "S" : p.type === "triple" ? "3" : p.type === "slow" ? "T" : "+";
    var name = p.type === "shield" ? "SHIELD" : p.type === "triple" ? "TRIPLE" : p.type === "slow" ? "SLOW" : "REPAIR";
    var pulse = reduceMotion ? 1 : 0.94 + 0.06 * Math.sin(p.t * 5);
    var bob = reduceMotion ? 0 : Math.sin(p.t * 3.1) * 7;
    var hw = p.r * 0.78 * pulse;
    var hh = p.r * 1.22 * pulse;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255, 154, 46, 0.38)";
    traceCapsule(hw * 1.7, hh * 1.45);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#fff4df";
    traceCapsule(hw, hh);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ff8a1e";
    ctx.stroke();
    ctx.fillStyle = "#241406";
    ctx.font = "800 " + Math.max(12, Math.round(hh * 0.95)) + "px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(mark, 0, 1);
    ctx.restore();
    if (p.t < 1.8) {
      var fade = p.t < 1.25 ? 1 : (1.8 - p.t) / 0.55;
      ctx.globalAlpha = fade;
      text(name, p.x, p.y + bob - hh - 10, "#ffe7c2", 12, "center", 800);
      ctx.globalAlpha = 1;
    }
  }

  function drawWorld() {
    var i;
    drawSoil();
    drawMarks();
    var queue = [];
    var props = ensureWorldProps();
    var place = dayImg.complete && dayImg.naturalWidth ? coverPlacement(dayImg) : null;
    if (props && place) {
      for (i = 0; i < props.length; i++) {
        queue.push({ y: place.oy + props[i].sortY * place.sc, kind: "prop", prop: props[i] });
      }
    }
    for (i = 0; i < G.enemies.length; i++) {
      if (G.enemies[i].alive && G.enemies[i].type !== "asteroid") {
        queue.push({ y: enemySortY(G.enemies[i]), kind: "enemy", e: G.enemies[i] });
      }
    }
    if (G.player) queue.push({ y: heroSortY(G.player), kind: "hero" });
    if (G.state !== "menu" && G.palPos) {
      for (i = 0; i < G.palPos.length; i++) {
        queue.push({ y: G.palPos[i].y, kind: "sprout", s: G.palPos[i] });
      }
    }
    queue.sort(function (a, b) { return a.y - b.y; });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    for (i = 0; i < queue.length; i++) {
      var item = queue[i];
      if (item.kind === "prop") drawProp(item.prop);
      else if (item.kind === "enemy") drawEnemy(item.e);
      else if (item.kind === "hero") drawPlayer();
      else drawSprout(item.s.x, item.s.y);
    }
    for (i = 0; i < G.pickups.length; i++) {
      if (G.pickups[i].alive) drawPickup(G.pickups[i]);
    }

    ctx.lineCap = "round";
    for (i = 0; i < G.pbullets.length; i++) {
      if (G.pbullets[i].alive) drawTracer(G.pbullets[i]);
    }

    for (i = 0; i < G.particles.length; i++) {
      var p = G.particles[i];
      if (!p.alive) continue;
      var alpha = Math.max(0, p.life / p.max);
      ctx.globalAlpha = alpha;
      if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - alpha), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "puff") {
        var grow = 1 + (1 - alpha) * 1.1;
        var psz = Math.max(2, Math.round(p.size * grow));
        ctx.globalAlpha = alpha * 0.42;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - psz / 2), Math.round(p.y - psz / 2), psz, psz);
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillRect(Math.round(p.x - psz / 4), Math.round(p.y - psz / 4), Math.max(2, Math.round(psz / 3)), Math.max(2, Math.round(psz / 3)));
      } else {
        var sz = Math.max(2, Math.round(p.size * alpha));
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    for (i = 0; i < G.popups.length; i++) {
      var pop = G.popups[i];
      if (!pop.alive) continue;
      ctx.globalAlpha = Math.max(0, pop.life / pop.max);
      ctx.fillStyle = pop.color;
      ctx.font = "700 13px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;
  }

  function text(str, x, y, color, size, align, weight) {
    var px = Math.max(8, Math.round(size));
    ctx.font = "700 " + px + "px ui-monospace, 'Courier New', monospace";
    ctx.textAlign = align || "left";
    ctx.textBaseline = "alphabetic";
    ctx.imageSmoothingEnabled = false;
    var ox = Math.round(x);
    var oy = Math.round(y);
    ctx.fillStyle = "#1a120c";
    ctx.fillText(str, ox + 1, oy);
    ctx.fillText(str, ox - 1, oy);
    ctx.fillText(str, ox, oy + 1);
    ctx.fillText(str, ox, oy - 1);
    ctx.fillStyle = color;
    ctx.fillText(str, ox, oy);
  }

  var HEART_ROWS = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
  var PLATE_ROWS = ["0111110", "1111111", "1100011", "1111111", "0111110", "0011100"];
  var PLATE_CRACK = ["0111110", "1101011", "1010101", "1110111", "0111010", "0011100"];

  function blitMask(x, y, s, rows, color, pred) {
    ctx.fillStyle = color;
    var r;
    var c;
    for (r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (c = 0; c < row.length; c++) {
        if (row.charAt(c) !== "1") continue;
        if (pred && !pred(c, r)) continue;
        ctx.fillRect(x + c * s, y + r * s, s, s);
      }
    }
  }

  function drawOutlinedMask(x, y, s, rows, body) {
    var ox = Math.round(x);
    var oy = Math.round(y);
    var offs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    var k;
    for (k = 0; k < offs.length; k++) blitMask(ox + offs[k][0], oy + offs[k][1], s, rows, "#1a120c");
    blitMask(ox, oy, s, rows, body);
  }

  function drawHeartIcon(x, y, s, fill) {
    drawOutlinedMask(x, y, s, HEART_ROWS, "#3a2a24");
    if (fill === 2) blitMask(Math.round(x), Math.round(y), s, HEART_ROWS, "#e23d32");
    else if (fill === 1) blitMask(Math.round(x), Math.round(y), s, HEART_ROWS, "#e23d32", function (c) { return c < 3; });
    if (fill > 0) blitMask(Math.round(x), Math.round(y), s, HEART_ROWS, "#ffb4a8", function (c, r) {
      if (r !== 1 || (c !== 1 && c !== 4)) return false;
      if (fill === 1 && c >= 3) return false;
      return true;
    });
  }

  function drawPlateIcon(x, y, s, cracked, flash) {
    var rows = cracked ? PLATE_CRACK : PLATE_ROWS;
    drawOutlinedMask(x, y, s, rows, flash ? "#f7fbff" : "#9aa6b2");
    if (!cracked) {
      blitMask(Math.round(x), Math.round(y), s, rows, flash ? "#ffffff" : "#e8eef5", function (c, r) { return r === 1 && c > 0 && c < 3; });
      if (!flash) blitMask(Math.round(x), Math.round(y), s, rows, "#5c6773", function (c, r) { return r >= 4; });
    }
  }

  function drawArmorShatter(x, y, s, t) {
    var u = 1 - t / 0.34;
    if (u < 0) u = 0;
    if (u > 1) u = 1;
    var bits = [[0, -1], [2, 0], [-1, 1], [1, 2], [3, -2], [-2, 0]];
    var i;
    ctx.fillStyle = "#d5dde6";
    for (i = 0; i < bits.length; i++) {
      ctx.globalAlpha = 1 - u;
      ctx.fillRect(
        Math.round(x + 3 * s + bits[i][0] * s * (1 + u * 3)),
        Math.round(y + 2 * s + bits[i][1] * s + u * (8 + i * 3)),
        s,
        s
      );
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    if (G.state !== "playing" && G.state !== "dying" && G.state !== "paused" && G.state !== "countdown") return;
    var w = G.w;
    var h = G.h;
    var ui = clamp(G.scale, 0.85, 1.15);
    text("SCORE", 20, 22, "#9aa6c8", Math.round(11 * ui), "left", 700);
    text(fmt(G.shownScore), 20, 44, "#f4f7ff", Math.round(22 * ui), "left", 800);
    var right = w - 108;
    text("BEST", right, 22, "#9aa6c8", Math.round(11 * ui), "right", 700);
    text(fmt(Math.max(G.best, G.score)), right, 44, "#ffc14a", Math.round(16 * ui), "right", 800);
    var threats = threatCounts();
    var waveLabel = "WAVE " + G.wave + "/" + MAX_WAVE + "  ENEMIES " + threats.left + "/" + threats.total;
    text(waveLabel, w * 0.5, 28, "#f3d7a1", Math.round(w < 720 ? 13 : 16) * (w < 720 ? 1 : ui), "center", 800);
    var held = gunDef();
    var gunLabelX = drawHudGun(18, h - 62, held, ui);
    text(held.name.toUpperCase() + "  LV " + gunLevel() + "  " + (held.mode === "auto" ? "AUTO" : "SEMI"), gunLabelX, h - 64, "#f6e7c1", Math.round(12 * ui), "left", 800);

    var player = G.player;
    var ps = Math.max(2, Math.round(3 * ui));
    var shake = player.heartShake > 0 ? Math.round(Math.sin(G.time * 46) * 2) : 0;
    var hearts = Math.ceil(player.maxHp / 2);
    var heartW = HEART_ROWS[0].length * ps + 4;
    var hy = h - 16 - HEART_ROWS.length * ps;
    var hi;
    for (hi = 0; hi < hearts; hi++) {
      var have = player.hp - hi * 2;
      var fill = have >= 2 ? 2 : have === 1 ? 1 : 0;
      drawHeartIcon(18 + hi * heartW + shake, hy, ps, fill);
    }
    var ax = 18 + hearts * heartW + 8;
    var plateW = PLATE_ROWS[0].length * ps + 4;
    var shownArmor = player.shieldHits;
    if (player.armorCrackT > 0 && player.armorCrack >= 0) shownArmor = Math.max(shownArmor, player.armorCrack + 1);
    var ai;
    for (ai = 0; ai < shownArmor; ai++) {
      var cracking = player.armorCrackT > 0 && ai === player.armorCrack;
      var flashing = player.shieldFlash > 0 && ai >= player.shieldFlashLo && ai < player.shieldFlashHi;
      var apx = ax + ai * plateW;
      if (cracking) {
        ctx.globalAlpha = Math.max(0.2, player.armorCrackT / 0.34);
        drawPlateIcon(apx, hy, ps, true, false);
        ctx.globalAlpha = 1;
        drawArmorShatter(apx, hy, ps, player.armorCrackT);
      } else if (ai < player.shieldHits) {
        drawPlateIcon(apx, hy, ps, false, flashing);
      }
    }

    if (G.boss && G.boss.alive) {
      var bw = Math.min(460, w * 0.46);
      var bx = (w - bw) / 2;
      var by = 62;
      var label = bossName();
      if (G.boss.phase === 2) label += "  PHASE 2";
      text(label, w / 2, by - 6, "#ff9bb4", Math.round(11 * ui), "center", 800);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(bx, by, bw, 8);
      ctx.fillStyle = "#ff3b6b";
      ctx.fillRect(bx, by, bw * clamp(G.boss.hp / G.boss.maxHp, 0, 1), 8);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.strokeRect(bx, by, bw, 8);
    }

    if (G.combo >= 2 && G.comboT > 0) {
      ctx.globalAlpha = clamp(G.comboT / 0.35, 0, 1);
      text("x" + G.combo, w / 2, G.boss ? 96 : 72, "#ffc14a", Math.round(28 * ui), "center", 800);
      ctx.globalAlpha = 1;
    }

    if (G.bannerT > 0) {
      var ba = G.bannerT > 0.4 ? 1 : G.bannerT / 0.4;
      ctx.globalAlpha = ba;
      text(G.banner, w / 2, h * 0.3, "#f4ffff", Math.round(42 * ui), "center", 800);
      if (G.bannerSub) text(G.bannerSub, w / 2, h * 0.3 + 28, "#9aa6c8", Math.round(14 * ui), "center", 700);
      ctx.globalAlpha = 1;
    }
    if (G.toastT > 0) {
      ctx.globalAlpha = G.toastT > 0.3 ? 1 : G.toastT / 0.3;
      text(G.toast, w / 2, h * 0.38, "#f3d7a1", Math.round(18 * ui), "center", 800);
      ctx.globalAlpha = 1;
    }

    var chips = [];
    if (player.tripleT > 0) chips.push({ t: "3 TRIPLE " + player.tripleT.toFixed(1), c: "#ffe7c2" });
    if (player.slowT > 0) chips.push({ t: "T SLOW " + player.slowT.toFixed(1), c: "#ffe7c2" });
    var chipW = 108;
    var total = chips.length * chipW;
    for (var c = 0; c < chips.length; c++) {
      text(chips[c].t, w / 2 - total / 2 + c * chipW + chipW / 2, h - 18, chips[c].c, Math.round(12 * ui), "center", 800);
    }

    var boostLabel = player.boostCd > 0 ? "ROLL" : "ROLL READY";
    text(boostLabel, w - 20, h - 18, player.boostCd > 0 ? "#6d7694" : "#ffffff", Math.round(12 * ui), "right", 800);

    if (G.state === "playing") {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      var rx = input.seen ? input.mx : w * 0.5;
      var ry = input.seen ? input.my : h * 0.5 - 60;
      ctx.beginPath();
      ctx.arc(rx, ry, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rx - 12, ry); ctx.lineTo(rx - 5, ry);
      ctx.moveTo(rx + 5, ry); ctx.lineTo(rx + 12, ry);
      ctx.moveTo(rx, ry - 12); ctx.lineTo(rx, ry - 5);
      ctx.moveTo(rx, ry + 5); ctx.lineTo(rx, ry + 12);
      ctx.stroke();
    }
  }

  function drawVignette() {
    var w = G.w;
    var h = G.h;
    var g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.16)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    var player = G.player;
    if (player && player.alive && player.hp === 1 && G.state === "playing") {
      var pulse = 0.16 + 0.1 * Math.sin(G.time * 8);
      var rg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
      rg.addColorStop(0, "rgba(0,0,0,0)");
      rg.addColorStop(1, "rgba(255, 30, 70, " + pulse + ")");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }
    if (player && player.slowT > 0 && G.state === "playing") {
      ctx.fillStyle = "rgba(40, 70, 160, 0.08)";
      ctx.fillRect(0, 0, w, h);
    }
    if (G.flashA > 0) {
      ctx.fillStyle = G.flashC;
      ctx.globalAlpha = Math.min(0.45, G.flashA * 0.35);
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    var dpr = G.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#1d3a18";
    ctx.fillRect(0, 0, G.w, G.h);
    drawBackground();
    drawWorld();
    drawVignette();
    drawHUD();
    drawCountdown();
  }

  function drawCountdown() {
    if (G.state !== "countdown") return;
    var word = G.countStep === 0 ? "GO!" : String(G.countStep);
    var pop = G.countStep === 0 ? 1 : 0.84 + 0.16 * clamp(G.countT / 0.9, 0, 1);
    ctx.save();
    ctx.translate(G.w * 0.5, G.h * 0.44);
    ctx.scale(pop, pop);
    ctx.globalAlpha = G.countStep === 0 ? clamp(G.countT / 0.55, 0.4, 1) : 1;
    text(word, 0, 0, G.countStep === 0 ? "#ffc14a" : "#f7ffff", G.countStep === 0 ? 92 : 128, "center", 800);
    ctx.restore();
  }

  /* ---------- flow ---------- */

  function syncUI() {
    el.start.classList.toggle("hidden", G.state !== "menu");
    el.pause.classList.toggle("hidden", G.state !== "paused");
    el.over.classList.toggle("hidden", G.state !== "over");
    if (el.win) el.win.classList.toggle("hidden", G.state !== "win");
    document.body.classList.toggle("playing", G.state === "playing");
  }

  function syncMute() {
    el.mute.textContent = audio.muted ? "SFX OFF" : "SFX ON";
    el.mute.setAttribute("aria-pressed", audio.muted ? "true" : "false");
    el.mute.classList.toggle("is-off", audio.muted);
  }

  function toggleMute() {
    audioUnlock();
    audio.muted = !audio.muted;
    saveRaw(KEY_MUTE, audio.muted ? 1 : 0);
    syncMute();
  }

  function startGame() {
    audioUnlock();
    sfx.start();
    pointToast = "";
    meta.runs = (meta.runs || 0) + 1;
    saveMeta();
    resetRun();
    G.state = "playing";
    input.keys = {};
    syncUI();
    if (el.play) el.play.blur();
  }

  function pauseGame() {
    if (G.state !== "playing") return;
    G.state = "paused";
    input.keys = {};
    syncUI();
    el.resume.focus();
  }

  function resumeGame() {
    if (G.state !== "paused") return;
    audioUnlock();
    G.state = "playing";
    syncUI();
  }

  function finishGame() {
    G.state = "over";
    el.overScore.textContent = fmt(G.score);
    el.overBest.textContent = fmt(G.best);
    el.overWave.textContent = String(G.wave);
    el.overKills.textContent = String(G.kills);
    el.overCombo.textContent = "x" + G.maxCombo;
    var isNew = G.score > G.bestAtStart && G.score > 0;
    el.ribbon.classList.toggle("hidden", !isNew);
    el.menuBest.textContent = fmt(G.best);
    syncUI();
    sfx.down();
  }

  function gotoMenu() {
    G.pbullets = [];
    G.ebullets = [];
    G.enemies = [];
    G.pickups = [];
    G.popups = [];
    G.particles = [];
    G.soil = [];
    G.cracks = [];
    G.hooves = [];
    G.embers = [];
    G.ghosts = [];
    G.boss = null;
    G.shake = 0;
    G.bannerT = 0;
    G.state = "menu";
    syncUI();
    renderHome();
    el.play.focus();
  }

  function onEnter() {
    if (G.state === "menu") startGame();
    else if (G.state === "paused") resumeGame();
    else if (G.state === "over" || G.state === "win") startGame();
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", pointerPos);
  window.addEventListener("keydown", function (e) {
    if (e.code === "Space" || e.code.indexOf("Arrow") === 0) e.preventDefault();
    input.keys[e.code] = true;
    if (e.repeat && (e.code === "KeyP" || e.code === "Escape" || e.code === "KeyM" || e.code === "Enter" || e.code === "ShiftLeft" || e.code === "ShiftRight")) {
      return;
    }
    if (e.code === "KeyM") {
      e.preventDefault();
      toggleMute();
      return;
    }
    if (e.code === "Enter") {
      e.preventDefault();
      onEnter();
      return;
    }
    if (e.code === "KeyP" || e.code === "Escape") {
      e.preventDefault();
      if (G.state === "playing") pauseGame();
      else if (G.state === "paused") resumeGame();
      else if ((G.state === "over" || G.state === "win") && e.code === "Escape") gotoMenu();
      return;
    }
    if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && G.state === "playing") {
      tryBoost();
    }
    if (e.code === "Space" && !e.repeat) requestShot();
    if (e.code === "KeyR" && (G.state === "over" || G.state === "win")) startGame();
  });
  window.addEventListener("keyup", function (e) {
    input.keys[e.code] = false;
  });
  window.addEventListener("blur", function () {
    input.keys = {};
    input.mouseDown = false;
    input.fireBuf = false;
    if (G.state === "playing") pauseGame();
  });
  canvas.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    pointerPos(e);
    input.mouseDown = true;
    requestShot();
  });
  window.addEventListener("mouseup", function (e) {
    if (e.button !== 0) return;
    input.mouseDown = false;
  });

  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  el.play.addEventListener("click", startGame);
  el.resume.addEventListener("click", resumeGame);
  el.restart.addEventListener("click", startGame);
  el.menu.addEventListener("click", gotoMenu);
  if (el.winAgain) el.winAgain.addEventListener("click", startGame);
  if (el.winMenu) el.winMenu.addEventListener("click", gotoMenu);
  el.mute.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleMute();
  });

  meta = loadMeta();
  G.best = meta.best;
  if (el.skillTree) el.skillTree.addEventListener("click", onSkillClick);
  installPointApi();
  syncExternalPoints();
  resize();
  resetRun();
  G.state = "menu";
  syncMute();
  syncUI();
  renderHome();

  var last = performance.now();
  function frame(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt < 0) dt = 0;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    audioTick();
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

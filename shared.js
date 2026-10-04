const PLAN_KEY = "full-range-plans-v1";
const AUTH_KEY = "full-range-clinician-auth-v1";
const SESSION_KEY = "full-range-clinician-session";
const AUTH_OFF = true;

// Ankle set drawn from published rehab programs: AAOS Foot and Ankle Conditioning
// Program, Alberta Health Services ankle-sprain exercises, and the Brigham and
// Women's ankle sprain standard of care. Doses stay small and pain-free.
const EX = {
  pump: {
    id: "pump", name: "Ankle pumps", focus: "Ankle motion",
    cue: "Point the toes down, pause, then pull them up toward you. Keep the knee quiet.",
    why: "Dorsiflexion and plantarflexion are the first ankle motions used after a sprain.",
    reps: 8, period: 5000, type: "match", body: "ankle"
  },
  toe: {
    id: "toe", name: "Toe raises", focus: "Shin",
    cue: "Keep the heels on the floor and lift the toes toward the shins, then lower them.",
    why: "Works the front of the shin so the foot can clear the ground in walking.",
    reps: 8, period: 4600, type: "match", body: "ankle"
  },
  ever: {
    id: "ever", name: "Ankle eversion", focus: "Outer ankle",
    cue: "Turn the soles outward, pause, then return. The knees stay still.",
    why: "The outside-of-ankle muscles are the ones that resist a typical sprain.",
    reps: 8, period: 4800, type: "match", body: "ankle"
  },
  invert: {
    id: "invert", name: "Ankle inversion", focus: "Inner ankle",
    cue: "Turn the soles inward a small way, pause, then return. The knees stay still.",
    why: "Practises the other ankle tilt, kept inside a comfortable range.",
    reps: 8, period: 4800, type: "match", body: "ankle"
  },
  heel: {
    id: "heel", name: "Heel raises", focus: "Calf and ankle",
    cue: "Rise onto the balls of both feet, pause, then lower the heels slowly. Knees stay tall.",
    why: "Calf strength for walking and stairs. A chair can be nearby.",
    reps: 8, period: 4600, type: "match", body: "ankle"
  },
  squat: {
    id: "squat", name: "Heels-down squat", focus: "Ankle and knee",
    cue: "Sit the hips back a short way, then stand. Both heels stay on the floor.",
    why: "A small squat loads the ankle in standing, which later-stage sprain rehab uses.",
    reps: 6, period: 5400, type: "match", body: "ankle"
  },
  balance: {
    id: "balance", name: "Single-leg balance", focus: "Ankle steadiness",
    cue: "Stand on one leg with that knee tall. A chair can be within reach. Hold, then switch.",
    why: "Single-leg stance is a standard balance step after an ankle sprain.",
    reps: 4, period: 8000, type: "sustain", body: "ankle"
  },
  alphabet: {
    id: "alphabet", name: "Ankle alphabet", focus: "Ankle range",
    cue: "Keep the knee quiet and trace letters in the air with the big toe.",
    why: "Moves the ankle through its comfortable range without putting weight through it.",
    reps: 3, period: 8000, type: "sustain", body: "ankle"
  }
};

const TEACH = {
  pump: { yt: "KxfFzSOAT7g", by: "Michigan Medicine", title: "Ankle pumps" },
  toe: { yt: "ohvR3shCV90", by: "Ask Doctor Jo", title: "Heel and toe raises" },
  ever: { yt: "xfrncpP5ONQ", by: "Ask Doctor Jo", title: "Ankle eversion" },
  invert: { yt: "50YDq8_OA_w", by: "Ask Doctor Jo", title: "Ankle inversion" },
  heel: { yt: "-IqeI-mMQLQ", by: "Ask Doctor Jo", title: "Heel raises" },
  squat: { yt: "0YAFlev6AYg", by: "MGH Orthopaedics", title: "Mini squats" },
  balance: { yt: "Dtgh2_LFkBQ", by: "Ask Doctor Jo", title: "Single-leg balance" },
  alphabet: { yt: "YTVZUMuEKPA", by: "Ask Doctor Jo", title: "Ankle alphabet" }
};

function isAnkleEx(id) {
  const base = EX[id];
  return !!(base && base.body === "ankle");
}
function ankleExercises(list) {
  return (list || []).filter((item) => isAnkleEx(item.pattern));
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function loadPlans() {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAN_KEY) || "{}");
    return { active: raw.active || "", plans: raw.plans && typeof raw.plans === "object" ? raw.plans : {} };
  } catch {
    return { active: "", plans: {} };
  }
}
function savePlans(data) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(data));
  if (typeof schedulePushElakStore === "function") schedulePushElakStore();
}
const CLINICIANS_KEY = "full-range-clinicians-v1";
const PATIENT_SESSION_KEY = "full-range-patient-session";
const PATIENT_REMEMBER_KEY = "full-range-patient-remember";
const CLINIC_REMEMBER_KEY = "full-range-clinic-remember";

const AVATAR_CHOICES = {
  skin: ["#f3d2b5", "#e0ac84", "#c68642", "#8d5524", "#4a3124"],
  hair: ["#2a211c", "#1a1a1a", "#6b3e2e", "#c4a15a", "#d9d0c4"],
  hairStyle: ["short", "bob", "long"],
  shirt: ["#6f5840", "#5f7d62", "#7d8ea3", "#a67c52", "#8d6b45"],
  shorts: ["#c4b49a", "#5c4632", "#5f7d62", "#efe6d6", "#3f342c"]
};
const DEFAULT_AVATAR = {
  skin: AVATAR_CHOICES.skin[0],
  hair: AVATAR_CHOICES.hair[0],
  hairStyle: "short",
  shirt: AVATAR_CHOICES.shirt[0],
  shorts: AVATAR_CHOICES.shorts[0]
};

function normalizeUsername(raw) {
  return (raw || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function validUsername(raw) {
  const key = normalizeUsername(raw);
  return key.length >= 3 && key.length <= 24 && /^[a-z0-9][a-z0-9._\- ]*$/.test(key);
}
function patientRemembered() {
  return localStorage.getItem(PATIENT_REMEMBER_KEY) === "1";
}
function patientSessionName() {
  const lasting = patientRemembered() ? (localStorage.getItem(PATIENT_SESSION_KEY) || "") : "";
  return normalizeUsername(lasting || sessionStorage.getItem(PATIENT_SESSION_KEY) || "");
}
function rememberPatient(username, code, persist) {
  const name = normalizeUsername(username);
  if (name) sessionStorage.setItem(PATIENT_SESSION_KEY, name);
  sessionStorage.setItem("full-range-patient-ui", "1");
  if (persist && name) {
    localStorage.setItem(PATIENT_SESSION_KEY, name);
    localStorage.setItem(PATIENT_REMEMBER_KEY, "1");
    localStorage.setItem("full-range-patient-last-user", name);
  } else {
    localStorage.removeItem(PATIENT_SESSION_KEY);
    localStorage.removeItem(PATIENT_REMEMBER_KEY);
  }
  if (code) {
    const data = loadPlans();
    data.active = code;
    savePlans(data);
  }
}
function activePlan() {
  const who = patientSessionName();
  if (!who) return null;
  const named = planByUsername(who);
  if (!named || !named.hash || !named.salt) return null;
  const data = loadPlans();
  if (data.active !== named.code) {
    data.active = named.code;
    savePlans(data);
  }
  return named;
}
function planByUsername(username) {
  const key = normalizeUsername(username);
  if (!key) return null;
  return Object.values(loadPlans().plans).find((plan) => normalizeUsername(plan.username) === key) || null;
}
function normalizePlanCode(raw) {
  return String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function planByCode(code) {
  const key = normalizePlanCode(code);
  if (key.length !== 6) return null;
  const data = loadPlans();
  return data.plans[key] || Object.values(data.plans).find((plan) => normalizePlanCode(plan.code) === key) || null;
}
async function enrollPatientOnThisPhone(username, password, code) {
  const key = normalizePlanCode(code);
  if (!/^[A-Z0-9]{6}$/.test(key)) return { ok: false, reason: "need-code" };
  const user = normalizeUsername(username);
  if (!validUsername(user) || String(password || "").length < 8) return { ok: false, reason: "bad-pass" };
  const data = loadPlans();
  let plan = data.plans[key] || Object.values(data.plans).find((item) => normalizePlanCode(item.code) === key) || null;
  if (plan && plan.username && normalizeUsername(plan.username) !== user) {
    return { ok: false, reason: "code-mismatch" };
  }
  if (plan && plan.hash && plan.salt) {
    const hash = await hashPassword(password, plan.salt);
    if (hash !== plan.hash) return { ok: false, reason: "bad-pass" };
    if (!plan.username) {
      plan.username = user;
      plan.updated = new Date().toISOString();
      data.plans[plan.code] = plan;
      savePlans(data);
    }
    return { ok: true, plan };
  }
  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  if (!plan) {
    plan = {
      code: key,
      patient: user,
      username: user,
      salt,
      hash,
      visits: [],
      rewards: [],
      calendar: [],
      phoneDays: {},
      updated: new Date().toISOString()
    };
  } else {
    plan.username = user;
    plan.salt = salt;
    plan.hash = hash;
    plan.updated = new Date().toISOString();
  }
  data.plans[plan.code || key] = plan;
  savePlans(data);
  return { ok: true, plan };
}
function clearStalePatientSession() {
  if (!patientRemembered()) localStorage.removeItem(PATIENT_SESSION_KEY);
  const who = patientSessionName();
  if (!who) return;
  const plan = planByUsername(who);
  if (!plan || !plan.hash || !plan.salt) signOutPatient();
}
function playerAvatar() {
  const plan = activePlan();
  return { ...DEFAULT_AVATAR, ...(plan && plan.avatar) };
}
function saveAvatar(avatar) {
  const plan = activePlan();
  if (!plan) return;
  const data = loadPlans();
  data.plans[plan.code].avatar = { ...DEFAULT_AVATAR, ...avatar };
  savePlans(data);
}
function setPatientCalendarConsent(username, on) {
  const plan = planByUsername(username);
  if (!plan) return;
  const data = loadPlans();
  if (!data.plans[plan.code]) return;
  data.plans[plan.code].calendarConsent = !!on;
  savePlans(data);
}
function setClinicianCalendarConsent(on) {
  const rec = authRecord();
  if (!rec) return;
  const data = loadClinicians();
  const found = data.accounts.find((account) => account.id === rec.id);
  if (!found) return;
  found.calendarConsent = !!on;
  saveClinicians(data);
}
function calendarConsentOn(role) {
  const who = role || (typeof pageCalendarRole === "function" ? pageCalendarRole() : "");
  if (who === "clinician" || (!who && typeof document !== "undefined" && /clinician\.html/i.test(location.pathname))) {
    const rec = typeof authRecord === "function" ? authRecord() : null;
    return !!(rec && rec.calendarConsent);
  }
  const plan = typeof activePlan === "function" ? activePlan() : null;
  return !!(plan && plan.calendarConsent);
}
async function signInPatient(username, password, persist, calendarConsent, code) {
  if (typeof pullElakStore === "function") await pullElakStore();
  let plan = planByUsername(username);
  if (!plan) {
    const enrolled = await enrollPatientOnThisPhone(username, password, code);
    if (!enrolled.ok) return enrolled;
    plan = enrolled.plan;
  } else {
    if (!plan.hash || !plan.salt) return { ok: false, reason: "no-pass" };
    const hash = await hashPassword(password, plan.salt);
    if (hash !== plan.hash) return { ok: false, reason: "bad-pass" };
  }
  rememberPatient(plan.username, plan.code, persist);
  setPatientCalendarConsent(plan.username, !!calendarConsent);
  return { ok: true };
}
function signOutPatient() {
  sessionStorage.removeItem(PATIENT_SESSION_KEY);
  sessionStorage.removeItem("full-range-patient-ui");
  localStorage.removeItem(PATIENT_SESSION_KEY);
  localStorage.removeItem(PATIENT_REMEMBER_KEY);
  const data = loadPlans();
  data.active = "";
  savePlans(data);
}
function markPatientIn() {
  sessionStorage.setItem("full-range-patient-ui", "1");
}
function patientUiOn() {
  return !!activePlan();
}
function clinicRemembered() {
  return localStorage.getItem(CLINIC_REMEMBER_KEY) === "1";
}
function persistClinicianSession(id, persist) {
  if (id) sessionStorage.setItem(SESSION_KEY, id);
  sessionStorage.setItem("full-range-clinic-ui", "1");
  if (persist) {
    if (id) localStorage.setItem(SESSION_KEY, id);
    localStorage.setItem("full-range-clinic-ui", "1");
    localStorage.setItem(CLINIC_REMEMBER_KEY, "1");
  } else {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem("full-range-clinic-ui");
    localStorage.removeItem(CLINIC_REMEMBER_KEY);
  }
}
function markClinicIn(persist) {
  persistClinicianSession(clinicianSessionId(), persist);
}
function clinicUiOn() {
  if (sessionStorage.getItem("full-range-clinic-ui") === "1") return true;
  if (clinicRemembered() && localStorage.getItem("full-range-clinic-ui") === "1") return true;
  return !AUTH_OFF && sessionOn();
}
function latestVisit(plan) {
  if (!plan || !Array.isArray(plan.visits) || !plan.visits.length) return null;
  return plan.visits[plan.visits.length - 1];
}
function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function loadClinicians() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(CLINICIANS_KEY) || "null"); }
  catch { data = null; }
  if (!data || !Array.isArray(data.accounts)) {
    data = { accounts: [] };
    try {
      const old = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
      if (old && old.hash && old.salt) {
        data.accounts.push({
          id: "clinic-1",
          name: (old.name || "Clinician").trim(),
          salt: old.salt,
          hash: old.hash
        });
      }
    } catch { /* keep an empty list */ }
    localStorage.setItem(CLINICIANS_KEY, JSON.stringify(data));
  }
  return data;
}
function saveClinicians(data) {
  localStorage.setItem(CLINICIANS_KEY, JSON.stringify(data));
  if (typeof schedulePushElakStore === "function") schedulePushElakStore();
}
function clinicianSessionId() {
  const lasting = clinicRemembered() ? (localStorage.getItem(SESSION_KEY) || "") : "";
  const id = sessionStorage.getItem(SESSION_KEY) || lasting || "";
  if (id === "ok") {
    const first = loadClinicians().accounts[0];
    if (!first) return "";
    sessionStorage.setItem(SESSION_KEY, first.id);
    if (clinicRemembered()) localStorage.setItem(SESSION_KEY, first.id);
    return first.id;
  }
  return id;
}
function authRecord() {
  const id = clinicianSessionId();
  if (!id) return null;
  return loadClinicians().accounts.find((account) => account.id === id) || null;
}
function sessionOn() { return !!authRecord(); }
function signOutClinician() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem("full-range-clinic-ui");
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("full-range-clinic-ui");
  localStorage.removeItem(CLINIC_REMEMBER_KEY);
}
function claimLegacyPlans(clinicianId) {
  if (!clinicianId) return;
  const data = loadPlans();
  let changed = false;
  for (const plan of Object.values(data.plans)) {
    if (!plan.clinicianId) {
      plan.clinicianId = clinicianId;
      changed = true;
    }
  }
  if (changed) savePlans(data);
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function sha256hex(text) {
  const msg = new TextEncoder().encode(String(text || ""));
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const bytes = [];
  for (let i = 0; i < msg.length; i++) bytes.push(msg[i]);
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const bitLen = msg.length * 8;
  for (let i = 7; i >= 0; i--) bytes.push((Math.floor(bitLen / Math.pow(2, i * 8)) & 0xff));
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Array(64);
  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = (bytes[i + t * 4] << 24) | (bytes[i + t * 4 + 1] << 16) | (bytes[i + t * 4 + 2] << 8) | bytes[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((n) => n.toString(16).padStart(8, "0")).join("");
}
async function hashPassword(password, salt) {
  const text = salt + "\n" + password;
  try {
    if (crypto.subtle && crypto.subtle.digest) {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (err) { /* use fallback on HTTP phones */ }
  return sha256hex(text);
}
function clinicianId() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function createClinician(name, password) {
  const trimmed = name.trim();
  const data = loadClinicians();
  if (data.accounts.some((account) => account.name.toLowerCase() === trimmed.toLowerCase())) {
    return { ok: false, error: "That name already has a sign-in. Log in instead." };
  }
  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  const account = { id: clinicianId(), name: trimmed, salt, hash, calendarConsent: false };
  data.accounts.push(account);
  saveClinicians(data);
  persistClinicianSession(account.id, false);
  claimLegacyPlans(account.id);
  return { ok: true, id: account.id };
}
async function signInClinician(name, password) {
  if (typeof pullElakStore === "function") await pullElakStore();
  const data = loadClinicians();
  const account = data.accounts.find((item) => item.name.toLowerCase() === name.trim().toLowerCase());
  if (!account) return false;
  const hash = await hashPassword(password, account.salt);
  if (hash !== account.hash) return false;
  persistClinicianSession(account.id, false);
  claimLegacyPlans(account.id);
  return true;
}

function elakStorePoint(url) {
  const raw = String(url || "").replace(/\/$/, "");
  if (!raw) return "";
  if (/\/store$|jsonblob|elak-live|raw\.githubusercontent/i.test(raw)) return raw;
  return raw + "/store";
}
function elakStoreUrls() {
  const urls = [];
  const custom = (typeof window !== "undefined" && (window.ELAK_STORE_URL || window.ELAK_KALE_URL))
    ? String(window.ELAK_STORE_URL || window.ELAK_KALE_URL).replace(/\/$/, "")
    : "";
  const pointed = elakStorePoint(custom);
  if (pointed) urls.push(pointed);
  try {
    if (typeof location !== "undefined" && location.protocol !== "file:") {
      urls.push(new URL("data/elak-live.json", location.href).href);
    }
  } catch (err) { /* skip */ }
  urls.push("https://raw.githubusercontent.com/vicky-angel/ELAK-web/main/data/elak-live.json");
  let origin = "";
  try { origin = typeof location !== "undefined" ? location.origin : ""; } catch (err) { origin = ""; }
  const onLaptop = !origin || origin === "null" || /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin);
  if (onLaptop) {
    urls.push("http://127.0.0.1:8767/store");
    urls.push("http://localhost:8767/store");
  }
  return urls.filter((url, i) => url && urls.indexOf(url) === i);
}

function elakLocalSlice() {
  let inbox = { clinic: [], patients: {} };
  let buddy = { threads: {} };
  let reports = {};
  try { inbox = JSON.parse(localStorage.getItem("elak-inbox-v1") || '{"clinic":[],"patients":{}}'); } catch (err) { /* keep */ }
  try { buddy = JSON.parse(localStorage.getItem("elak-buddy-v1") || '{"threads":{}}'); } catch (err) { /* keep */ }
  try { reports = JSON.parse(localStorage.getItem("elak-health-reports-v1") || "{}"); } catch (err) { /* keep */ }
  return {
    plans: loadPlans().plans,
    clinicians: loadClinicians(),
    inbox: inbox,
    buddy: buddy,
    reports: reports
  };
}

function mergeElakPlans(localPlans, remotePlans) {
  const out = Object.assign({}, localPlans || {});
  Object.keys(remotePlans || {}).forEach((code) => {
    const remote = remotePlans[code];
    const local = out[code];
    if (!local) out[code] = remote;
    else if (String((remote && remote.updated) || "") >= String((local && local.updated) || "")) out[code] = remote;
  });
  return out;
}

function applyElakStore(remote) {
  if (!remote || typeof remote !== "object") return false;
  const plans = loadPlans();
  plans.plans = mergeElakPlans(plans.plans, remote.plans);
  localStorage.setItem(PLAN_KEY, JSON.stringify(plans));
  const clinic = loadClinicians();
  const seen = {};
  (clinic.accounts || []).concat(((remote.clinicians || {}).accounts) || []).forEach((row) => {
    if (row && row.id) seen[row.id] = row;
  });
  clinic.accounts = Object.values(seen);
  localStorage.setItem(CLINICIANS_KEY, JSON.stringify(clinic));
  if (remote.inbox) {
    try {
      const inbox = JSON.parse(localStorage.getItem("elak-inbox-v1") || '{"clinic":[],"patients":{}}');
      const mergeList = (a, b) => {
        const ids = new Set();
        return [].concat(a || [], b || []).filter((item) => {
          const id = item && item.id;
          if (!id) return true;
          if (ids.has(id)) return false;
          ids.add(id);
          return true;
        });
      };
      inbox.clinic = mergeList(inbox.clinic, remote.inbox.clinic);
      inbox.patients = inbox.patients || {};
      Object.keys(remote.inbox.patients || {}).forEach((key) => {
        inbox.patients[key] = mergeList(inbox.patients[key], remote.inbox.patients[key]);
      });
      localStorage.setItem("elak-inbox-v1", JSON.stringify(inbox));
    } catch (err) { /* keep local inbox */ }
  }
  if (remote.buddy && remote.buddy.threads) {
    try {
      const buddy = JSON.parse(localStorage.getItem("elak-buddy-v1") || '{"threads":{}}');
      buddy.threads = Object.assign({}, remote.buddy.threads, buddy.threads);
      localStorage.setItem("elak-buddy-v1", JSON.stringify(buddy));
    } catch (err) { /* keep */ }
  }
  if (remote.reports) {
    try {
      const reports = Object.assign({}, remote.reports, JSON.parse(localStorage.getItem("elak-health-reports-v1") || "{}"));
      localStorage.setItem("elak-health-reports-v1", JSON.stringify(reports));
    } catch (err) { /* keep */ }
  }
  return true;
}

let elakStoreTimer = 0;
let elakStoreUrl = "";

async function pullElakStore() {
  for (const url of elakStoreUrls()) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      const remote = data && (data.store || data);
      if (!remote || typeof remote !== "object") continue;
      elakStoreUrl = url;
      applyElakStore(remote);
      schedulePushElakStore();
      return true;
    } catch (err) { /* try next */ }
  }
  return false;
}

function schedulePushElakStore() {
  if (elakStoreTimer) clearTimeout(elakStoreTimer);
  elakStoreTimer = setTimeout(pushElakStore, 350);
}

async function pushElakStore() {
  elakStoreTimer = 0;
  const slice = elakLocalSlice();
  const body = JSON.stringify(slice);
  const urls = elakStoreUrl ? [elakStoreUrl].concat(elakStoreUrls()) : elakStoreUrls();
  for (const url of urls.filter((item, i, all) => all.indexOf(item) === i)) {
    if (/elak-live\.json|raw\.githubusercontent/i.test(url)) continue;
    try {
      const res = await fetch(url, {
        method: /jsonblob/i.test(url) ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      if (!res.ok) continue;
      elakStoreUrl = url;
      return true;
    } catch (err) { /* try next */ }
  }
  return false;
}

const DEVICE_CAL_BRIDGES = [
  "/api/device-calendar",
  "http://127.0.0.1:8766/calendar",
  "http://localhost:8766/calendar",
  "data/elak-calendar.json",
  "data/device-calendar-live.json",
  "https://raw.githubusercontent.com/vicky-angel/ELAK-web/main/data/elak-calendar.json"
];
const DEVICE_CAL_HANDLE_DB = "elak-device-cal-v1";

function unfoldIcs(text) {
  return String(text || "").replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}
function icsUnescape(value) {
  return String(value || "").replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}
function parseIcsDate(value, params) {
  const raw = String(value || "").trim();
  const tz = (params.TZID || "").toUpperCase();
  if (!raw) return { iso: "", allDay: false };
  if (/^\d{8}$/.test(raw) || params.VALUE === "DATE") {
    const y = Number(raw.slice(0, 4));
    const m = Number(raw.slice(4, 6));
    const d = Number(raw.slice(6, 8));
    return { iso: new Date(y, m - 1, d, 0, 0, 0, 0).toISOString(), allDay: true };
  }
  const stamp = raw.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/, "$1-$2-$3T$4:$5:$6$7");
  if (raw.endsWith("Z") || tz === "UTC") {
    const dt = new Date(stamp.endsWith("Z") ? stamp : stamp + "Z");
    return { iso: Number.isNaN(dt.getTime()) ? "" : dt.toISOString(), allDay: false };
  }
  const bits = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!bits) {
    const dt = new Date(raw);
    return { iso: Number.isNaN(dt.getTime()) ? "" : dt.toISOString(), allDay: false };
  }
  const dt = new Date(
    Number(bits[1]),
    Number(bits[2]) - 1,
    Number(bits[3]),
    Number(bits[4]),
    Number(bits[5]),
    Number(bits[6])
  );
  return { iso: Number.isNaN(dt.getTime()) ? "" : dt.toISOString(), allDay: false };
}
function parseDurationMs(value) {
  const match = String(value || "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return 60 * 60 * 1000;
  return ((Number(match[1]) || 0) * 86400 + (Number(match[2]) || 0) * 3600 + (Number(match[3]) || 0) * 60 + (Number(match[4]) || 0)) * 1000;
}
function parseIcsParams(nameChunk) {
  const params = {};
  String(nameChunk || "").split(";").slice(1).forEach((part) => {
    const eq = part.indexOf("=");
    if (eq < 0) return;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  });
  return params;
}
function parseIcsText(text) {
  const events = [];
  let current = null;
  unfoldIcs(text).split("\n").forEach((line) => {
    const cut = line.indexOf(":");
    if (cut < 0) return;
    const left = line.slice(0, cut);
    const value = line.slice(cut + 1);
    const name = left.split(";")[0].toUpperCase();
    const params = parseIcsParams(left);
    if (name === "BEGIN" && value === "VEVENT") {
      current = { title: "Busy", start: "", end: "", rrule: "", uid: "", allDay: false, cancelled: false };
      return;
    }
    if (!current) return;
    if (name === "END" && value === "VEVENT") {
      if (current.start && !current.cancelled) {
        if (!current.end) current.end = new Date(new Date(current.start).getTime() + 60 * 60000).toISOString();
        events.push(current);
      }
      current = null;
      return;
    }
    if (name === "SUMMARY") current.title = icsUnescape(value) || "Busy";
    if (name === "UID") current.uid = value;
    if (name === "STATUS" && /CANCELLED/i.test(value)) current.cancelled = true;
    if (name === "RRULE") current.rrule = value;
    if (name === "DTSTART") {
      const parsed = parseIcsDate(value, params);
      current.start = parsed.iso;
      current.allDay = parsed.allDay;
    }
    if (name === "DTEND") {
      const parsed = parseIcsDate(value, params);
      current.end = parsed.iso;
      if (parsed.allDay && current.start) {
        const end = new Date(parsed.iso);
        end.setMilliseconds(end.getMilliseconds() - 1);
        current.end = end.toISOString();
      }
    }
    if (name === "DURATION" && current.start) {
      current.end = new Date(new Date(current.start).getTime() + parseDurationMs(value)).toISOString();
    }
  });
  return events;
}
function parseRrule(rule) {
  const out = { FREQ: "", INTERVAL: 1, COUNT: 0, UNTIL: "", BYDAY: [] };
  String(rule || "").split(";").forEach((part) => {
    const eq = part.indexOf("=");
    if (eq < 0) return;
    const key = part.slice(0, eq).toUpperCase();
    const value = part.slice(eq + 1);
    if (key === "FREQ") out.FREQ = value.toUpperCase();
    if (key === "INTERVAL") out.INTERVAL = Math.max(1, Number(value) || 1);
    if (key === "COUNT") out.COUNT = Math.max(0, Number(value) || 0);
    if (key === "UNTIL") {
      const parsed = parseIcsDate(value, /T/.test(value) ? {} : { VALUE: "DATE" });
      out.UNTIL = parsed.iso;
    }
    if (key === "BYDAY") out.BYDAY = value.split(",").map((day) => day.replace(/[^A-Z]/g, ""));
  });
  return out;
}
const ICS_DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
function nextByDay(from, byDays, intervalWeeks) {
  const wanted = byDays.map((day) => ICS_DOW[day]).filter((n) => n !== undefined);
  if (!wanted.length) {
    const next = new Date(from);
    next.setDate(next.getDate() + 7 * intervalWeeks);
    return next;
  }
  const cursor = new Date(from);
  cursor.setDate(cursor.getDate() + 1);
  for (let i = 0; i < 14 * intervalWeeks + 8; i++) {
    const weekGap = Math.floor((cursor - from) / (7 * 86400000));
    if (wanted.indexOf(cursor.getDay()) >= 0 && weekGap % intervalWeeks === 0) return cursor;
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}
function expandDeviceEvents(raw, startISO, endISO) {
  const winStart = new Date(startISO);
  const winEnd = new Date(endISO);
  if (Number.isNaN(winStart.getTime()) || Number.isNaN(winEnd.getTime())) return [];
  const out = [];
  (raw || []).forEach((event) => {
    const start = new Date(event.start);
    const end = new Date(event.end || event.start);
    if (Number.isNaN(start.getTime())) return;
    const span = Math.max(60 * 1000, (Number.isNaN(end.getTime()) ? start.getTime() + 3600000 : end.getTime()) - start.getTime());
    const push = (when) => {
      const from = new Date(when);
      const to = new Date(from.getTime() + span);
      if (to < winStart || from > winEnd) return;
      out.push({
        title: event.title || "Busy",
        start: isoLocal(from),
        end: isoLocal(to),
        allDay: !!event.allDay
      });
    };
    if (!event.rrule) {
      push(start);
      return;
    }
    const rule = parseRrule(event.rrule);
    const until = rule.UNTIL ? new Date(rule.UNTIL) : winEnd;
    let count = 0;
    const max = rule.COUNT || 400;
    if (rule.FREQ === "DAILY") {
      const cursor = new Date(start);
      while (cursor <= until && cursor <= winEnd && count < max) {
        if (cursor >= winStart) push(cursor);
        cursor.setDate(cursor.getDate() + rule.INTERVAL);
        count += 1;
      }
      return;
    }
    if (rule.FREQ === "WEEKLY") {
      if (rule.BYDAY.length) {
        const cursor = new Date(start);
        while (cursor <= until && cursor <= winEnd && count < max) {
          if (cursor >= start && cursor >= winStart) push(cursor);
          const next = nextByDay(cursor, rule.BYDAY, rule.INTERVAL);
          if (!next) break;
          cursor.setTime(next.getTime());
          count += 1;
        }
      } else {
        const cursor = new Date(start);
        while (cursor <= until && cursor <= winEnd && count < max) {
          if (cursor >= winStart) push(cursor);
          cursor.setDate(cursor.getDate() + 7 * rule.INTERVAL);
          count += 1;
        }
      }
      return;
    }
    push(start);
  });
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
const DEVICE_CAL_CACHE_KEY = "elak-device-calendar-live-v1";
function scheduleWindowForPlan(plan) {
  if (typeof scheduleWindow === "function") return scheduleWindow(plan);
  const cycle = plan && plan.cycle;
  if (cycle && cycle.periodStart && cycle.periodEnd) {
    return { start: cycle.periodStart, end: cycle.periodEnd };
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 14);
  return { start: start.toISOString(), end: end.toISOString() };
}
function displayWindowForPlan(plan) {
  const cycle = scheduleWindowForPlan(plan);
  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 90);
  const cycleStart = new Date(cycle.start);
  const cycleEnd = new Date(cycle.end);
  if (!Number.isNaN(cycleStart.getTime()) && cycleStart < start) start.setTime(cycleStart.getTime());
  if (!Number.isNaN(cycleEnd.getTime()) && cycleEnd > end) end.setTime(cycleEnd.getTime());
  return { start: start.toISOString(), end: end.toISOString() };
}
function pageCalendarRole() {
  return document.getElementById("clinic-form") ? "clinician" : "patient";
}
function roleCacheKey(role) {
  return role === "clinician" ? "elak-clinician-calendar-v1" : "elak-patient-calendar-v1";
}
function loadRoleCalendar(role) {
  try {
    const pack = JSON.parse(localStorage.getItem(roleCacheKey(role || pageCalendarRole())) || "null");
    if (pack && Array.isArray(pack.events)) return pack;
  } catch (err) { /* keep going */ }
  return null;
}
function saveRoleCalendar(role, pack) {
  if (!pack || !Array.isArray(pack.events)) return pack;
  const stamped = {
    syncedAt: pack.syncedAt || new Date().toISOString(),
    source: pack.source || "device",
    events: pack.events
  };
  localStorage.setItem(roleCacheKey(role), JSON.stringify(stamped));
  return stamped;
}
function loadDeviceCalendarCache() {
  return loadRoleCalendar(pageCalendarRole());
}
function saveDeviceCalendarCache(pack) {
  saveRoleCalendar(pageCalendarRole(), pack);
}
function patientCalendarOf(plan) {
  return (plan && (plan.patientCalendar || plan.deviceCalendar)) || loadRoleCalendar("patient");
}
function clinicianCalendarOf(plan) {
  return (plan && plan.clinicianCalendar) || loadRoleCalendar("clinician");
}
function calendarPackStatus(pack) {
  if (!pack || !pack.syncedAt) return "";
  const count = (pack.events || []).length;
  const when = new Date(pack.syncedAt);
  const stamp = Number.isNaN(when.getTime())
    ? ""
    : when.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return count + (count === 1 ? " event" : " events") + (stamp ? " · " + stamp : "");
}
function hasDeviceEvents(plan) {
  const pack = patientCalendarOf(plan);
  return !!(pack && Array.isArray(pack.events) && pack.events.length);
}
function applyDeviceCalendar(plan, startISO, endISO) {
  return applyRoleCalendarsToPlan(plan, startISO, endISO);
}
function applyRoleCalendarsToPlan(plan, startISO, endISO) {
  if (!plan) return [];
  const window = startISO && endISO ? { start: startISO, end: endISO } : displayWindowForPlan(plan);
  const kept = (plan.calendar || []).filter((event) => event.source === "elak" || event.source === "busy");
  const patient = expandDeviceEvents((patientCalendarOf(plan) || {}).events || [], window.start, window.end)
    .filter((event) => belongsToPlan(event, plan))
    .map((event) => ({
      source: "calendar",
      who: "patient",
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: !!event.allDay
    }));
  const clinician = expandDeviceEvents((clinicianCalendarOf(plan) || {}).events || [], window.start, window.end).map((event) => ({
    source: "clinic",
    who: "clinician",
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: !!event.allDay
  }));
  plan.calendar = kept.concat(patient, clinician);
  return plan.calendar;
}
function deviceCalStatus(plan) {
  return calendarPackStatus(pageCalendarRole() === "clinician" ? clinicianCalendarOf(plan) : patientCalendarOf(plan));
}
function findJointAppointment(plan, days, minutes) {
  const lead = Math.max(1, Number(days) || 14);
  const length = Math.max(15, Number(minutes) || 30);
  const begin = new Date();
  begin.setHours(8, 0, 0, 0);
  begin.setDate(begin.getDate() + lead);
  if (begin.getDay() === 0) begin.setDate(begin.getDate() + 1);
  const close = new Date(begin);
  close.setDate(close.getDate() + 6);
  close.setHours(21, 0, 0, 0);
  const win = { start: begin.toISOString(), end: close.toISOString() };
  const otherVisits = typeof clinicVisitEvents === "function"
    ? clinicVisitEvents().filter((event) => !plan || String(event.title || "").indexOf(plan.patient || "\0") < 0)
    : [];
  const busy = expandDeviceEvents((patientCalendarOf(plan) || {}).events || [], win.start, win.end)
    .concat(expandDeviceEvents((clinicianCalendarOf(plan) || {}).events || [], win.start, win.end))
    .concat(otherVisits)
    .filter((event) => !event.allDay);
  for (let day = new Date(begin.getFullYear(), begin.getMonth(), begin.getDate()); day < close; day.setDate(day.getDate() + 1)) {
    if (day.getDay() === 0) continue;
    for (let hour = 8; hour < 18; hour++) {
      for (let mins = 0; mins < 60; mins += 30) {
        const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, mins, 0, 0);
        if (slot < begin || slot >= close) continue;
        if (!overlaps(slot.toISOString(), length, busy)) {
          return {
            start: slot.toISOString(),
            end: new Date(slot.getTime() + length * 60000).toISOString()
          };
        }
      }
    }
  }
  return null;
}
function bookJointAppointment(plan, days, minutes) {
  if (plan && !plan.calendarConsent) return null;
  const slot = findJointAppointment(plan, days, minutes);
  if (!slot) return null;
  plan.appointment = {
    start: slot.start,
    end: slot.end,
    days: Math.max(1, Number(days) || 14),
    bookedAt: new Date().toISOString(),
    patientSeen: false,
    clinicianSeen: false
  };
  plan.calendar = (plan.calendar || []).filter((event) => !(event.source === "elak" && (event.who === "both" || event.title === "Next visit")));
  plan.calendar.push({
    source: "elak",
    who: "both",
    title: "Next visit" + (plan.patient ? " · " + plan.patient : ""),
    start: slot.start,
    end: slot.end
  });
  return plan.appointment;
}
function formatAppointmentWhen(appt) {
  if (!appt || !appt.start) return "";
  const start = new Date(appt.start);
  const end = new Date(appt.end || appt.start);
  if (Number.isNaN(start.getTime())) return "";
  return start.toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }) + " – " + end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function sendDesktopNotice(title, body) {
  if (!("Notification" in window)) return;
  const fire = () => new Notification(title, { body: body || "" });
  if (Notification.permission === "granted") fire();
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => { if (perm === "granted") fire(); });
  }
}
function showAppointmentNotice(appt, role) {
  notifyAppointment(planForCalendarSync(), appt);
}
function markAppointmentSeen(plan, role) {
  if (!plan || !plan.code || !plan.appointment) return;
  const data = loadPlans();
  const cur = data.plans[plan.code];
  if (!cur || !cur.appointment) return;
  if (role === "clinician") cur.appointment.clinicianSeen = true;
  else cur.appointment.patientSeen = true;
  savePlans(data);
}
function openDeviceCalDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DEVICE_CAL_HANDLE_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("handles")) req.result.createObjectStore("handles");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveCalFileHandle(handle) {
  if (!handle) return;
  try {
    const db = await openDeviceCalDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(handle, "ics");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) { /* file handle is optional */ }
}
async function loadCalFileHandle() {
  try {
    const db = await openDeviceCalDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get("ics");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return null;
  }
}
async function readPersistedIcs() {
  const handle = await loadCalFileHandle();
  if (!handle || !handle.getFile) return null;
  if (handle.queryPermission) {
    let perm = await handle.queryPermission({ mode: "read" });
    if (perm !== "granted" && handle.requestPermission) {
      perm = await handle.requestPermission({ mode: "read" });
    }
    if (perm !== "granted") return null;
  }
  const file = await handle.getFile();
  return file ? file.text() : null;
}
async function pickIcsFromDevice() {
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: "Calendar", accept: { "text/calendar": [".ics", ".ifb"] } }]
    });
    if (handle) {
      await saveCalFileHandle(handle);
      const file = await handle.getFile();
      return file.text();
    }
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ics,.ifb,text/calendar";
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) {
        reject(new Error("cancelled"));
        return;
      }
      resolve(file.text());
    }, { once: true });
    input.click();
  });
}
async function fetchCalendarJson(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || 4000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
function calendarBridgeUrls() {
  const https = typeof location !== "undefined" && location.protocol === "https:";
  const urls = [];
  if (!https) {
    urls.push("http://127.0.0.1:8766/calendar", "http://localhost:8766/calendar");
  }
  DEVICE_CAL_BRIDGES.forEach((url) => {
    if (https && /^https?:\/\/(127\.0\.0\.1|localhost)/i.test(url)) return;
    urls.push(url);
  });
  try {
    if (typeof location !== "undefined" && location.protocol !== "file:") {
      urls.push(new URL("data/elak-calendar.json", location.href).href);
    }
  } catch (err) { /* keep listed urls */ }
  return urls.filter((url, i) => url && urls.indexOf(url) === i);
}
function isSharedCalendarPack(pack, url) {
  const source = String((pack && pack.source) || "");
  return source === "elak-shared" || source === "elak" || /elak-calendar\.json|raw\.githubusercontent/i.test(String(url || ""));
}
function clinicianCalendarPlans() {
  if (typeof listedPlans === "function" && typeof clinic !== "undefined") {
    const prev = clinic.listMode;
    clinic.listMode = "current";
    const rows = listedPlans();
    clinic.listMode = prev;
    return rows.filter((plan) => plan && !plan.archived);
  }
  const data = typeof loadPlans === "function" ? loadPlans() : { plans: {} };
  const mine = typeof authRecord === "function" && authRecord() ? authRecord().id : "";
  return Object.values(data.plans || {}).filter((plan) => {
    if (!plan || plan.archived) return false;
    if (!mine) return true;
    return !plan.clinicianId || plan.clinicianId === mine;
  });
}
function clinicianPatientNeedles() {
  const needles = [];
  clinicianCalendarPlans().forEach((plan) => {
    [plan.patient, plan.username].forEach((value) => {
      const n = String(value || "").toLowerCase().trim();
      if (n.length >= 2 && needles.indexOf(n) < 0) needles.push(n);
    });
  });
  return needles;
}
function stripGhostCalendarCaches() {
  ["clinician", "patient"].forEach((role) => {
    const pack = typeof loadRoleCalendar === "function" ? loadRoleCalendar(role) : null;
    if (!pack || !Array.isArray(pack.events)) return;
    const next = pack.events.filter((event) => !isGhostCalendarPerson(event));
    if (next.length !== pack.events.length) saveRoleCalendar(role, Object.assign({}, pack, { events: next }));
  });
  if (window.ELAK_SHARED_CAL && Array.isArray(window.ELAK_SHARED_CAL.events)) {
    window.ELAK_SHARED_CAL.events = window.ELAK_SHARED_CAL.events.filter((event) => !isGhostCalendarPerson(event));
  }
}
async function loadSharedElakCalendar() {
  stripGhostCalendarCaches();
  if (window.ELAK_SHARED_CAL && Array.isArray(window.ELAK_SHARED_CAL.events)) return window.ELAK_SHARED_CAL;
  try {
    const res = await fetch("data/elak-calendar.json?v=visit", { cache: "no-store" });
    const data = await res.json();
    if (data && Array.isArray(data.events)) {
      data.events = data.events.filter((event) => !isGhostCalendarPerson(event));
      window.ELAK_SHARED_CAL = data;
      stripGhostCalendarCaches();
      return data;
    }
  } catch (err) { /* keep going */ }
  return { events: [] };
}
function eventMatchesPatient(event, plan) {
  const names = [plan && plan.patient, plan && plan.username]
    .map((value) => String(value || "").toLowerCase().trim())
    .filter((value) => value.length >= 2);
  if (!names.length) return false;
  const title = String((event && event.title) || "").toLowerCase();
  const person = eventPerson(event);
  return names.some((n) => title.includes(n) || person === n || (person && (person.includes(n) || n.includes(person))));
}
function ensureCurrentPatientVisits() {
  const shared = ((window.ELAK_SHARED_CAL || {}).events) || [];
  const data = typeof loadPlans === "function" ? loadPlans() : { plans: {} };
  let changed = false;
  clinicianCalendarPlans().forEach((plan) => {
    if (!plan || (plan.appointment && plan.appointment.start)) return;
    const hit = shared.find((event) => /next visit/i.test(event.title || "") && eventMatchesPatient(event, plan));
    if (!hit || !hit.start) return;
    const cur = (plan.code && data.plans[plan.code]) || plan;
    cur.appointment = {
      start: hit.start,
      end: hit.end || hit.start,
      patientSeen: false,
      clinicianSeen: false
    };
    if (typeof keepVisitOnCalendar === "function") keepVisitOnCalendar(cur);
    if (cur.code && data.plans[cur.code]) data.plans[cur.code] = cur;
    changed = true;
  });
  if (changed && typeof savePlans === "function") savePlans(data);
}
function clinicNextVisitEvents() {
  ensureCurrentPatientVisits();
  const out = [];
  const seen = {};
  function add(event, fallbackName, owned) {
    if (!event || !event.start) return;
    const title = String(event.title || "");
    const isVisit = calendarEventKind(event) === "visit" || /next visit/i.test(title);
    if (!isVisit) return;
    const named = title.indexOf("Next visit") === 0 ? title : ("Next visit" + (fallbackName ? " · " + fallbackName : (eventPerson(event) ? " · " + eventPerson(event) : "")));
    const row = { source: "elak", who: "both", title: named, start: event.start, end: event.end || event.start };
    if (!owned && typeof eventBelongsToClinician === "function" && !eventBelongsToClinician(row)) return;
    const key = calendarStartKey(row) + "|" + (eventPerson(row) || fallbackName || "");
    if (seen[key]) return;
    seen[key] = true;
    out.push(row);
  }
  (typeof clinicianCalendarPlans === "function" ? clinicianCalendarPlans() : []).forEach((plan) => {
    if (plan && plan.appointment && plan.appointment.start) {
      add({ title: "Next visit · " + (plan.patient || "Patient"), start: plan.appointment.start, end: plan.appointment.end }, plan.patient, true);
    }
    ((plan && plan.calendar) || []).forEach((event) => add(event, plan && plan.patient, true));
  });
  return out;
}
const GHOST_CAL_PEOPLE = [
  "sebastian korda", "longsha", "taylor fritz", "elsa", "nofear", "life",
  "tab check", "cycle check", "alex test", "injury check", "calendar two"
];
function isGhostCalendarPerson(event) {
  const blob = (eventPerson(event) + " " + String((event && event.title) || "")).toLowerCase();
  return GHOST_CAL_PEOPLE.some((name) => blob.indexOf(name) >= 0);
}
function eventBelongsToClinician(event) {
  if (isGhostCalendarPerson(event)) return false;
  const kind = calendarEventKind(event);
  if (kind === "other") return !/elak|next visit|ankle practice/i.test(String((event && event.title) || ""));
  const needles = clinicianPatientNeedles();
  const plans = clinicianCalendarPlans();
  if (!needles.length && !plans.length) return false;
  const title = String((event && event.title) || "").toLowerCase();
  const person = eventPerson(event);
  if (needles.some((n) => title.includes(n) || person === n || (person && (person.includes(n) || n.includes(person))))) return true;
  if ((kind === "visit" || kind === "practice") && needles.length === 1 && !person) return true;
  if (kind === "visit") {
    return plans.some((plan) => plan && plan.appointment && calendarStartKey({ start: plan.appointment.start }) === calendarStartKey(event));
  }
  return false;
}
function isoLocal(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value || "");
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + "T" + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0");
}
function filterSharedEvents(events, plan, role) {
  const list = Array.isArray(events) ? events : [];
  if (role === "clinician") return list.filter((event) => eventBelongsToClinician(event));
  const needles = [plan && plan.patient, plan && plan.username]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim())
    .filter((s) => s.length >= 2);
  if (!needles.length) return [];
  return list.filter((event) => {
    const title = String(event.title || "").toLowerCase();
    const person = eventPerson(event);
    if (/next visit/.test(title)) return !person || needles.some((n) => person.includes(n) || n.includes(person) || title.includes(n));
    return needles.some((n) => title.includes(n));
  });
}
function calendarEventKind(event) {
  const title = String((event && event.title) || "").toLowerCase();
  if (/next visit/.test(title)) return "visit";
  if (/elak|ankle practice/.test(title) || (event && event.source === "elak")) return "practice";
  return "other";
}
function calendarStartKey(event) {
  const d = new Date(event && event.start);
  if (Number.isNaN(d.getTime())) return String((event && event.start) || "");
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + "T" + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function belongsToPlan(event, plan) {
  const needles = [plan && plan.patient, plan && plan.username]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase().trim())
    .filter((s) => s.length >= 2);
  const kind = calendarEventKind(event);
  if (kind === "other") return true;
  const named = String((event && event.title) || "").split(/[·•]/).slice(1).map((part) => part.trim().toLowerCase()).filter(Boolean);
  if (!named.length || !needles.length) return true;
  return named.some((part) => needles.some((n) => part.includes(n) || n.includes(part)));
}
function eventPerson(event) {
  const named = String((event && event.title) || "").split(/[·•]/).slice(1).map((part) => part.trim().toLowerCase()).filter(Boolean);
  return named[0] || "";
}
function calendarDayKey(value) {
  const raw = String(value || "").trim();
  const naive = raw.match(/^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}/);
  if (naive && !/[zZ]|[+\-]\d{2}:?\d{2}$/.test(raw)) return naive[1];
  return typeof dayKey === "function" ? dayKey(value) : raw.slice(0, 10);
}
function collapseTzTwins(events) {
  const rows = events || [];
  const drop = [];
  rows.forEach((a) => {
    if (drop.indexOf(a) >= 0) return;
    const kind = calendarEventKind(a);
    if (kind !== "practice" && kind !== "visit") return;
    rows.forEach((b) => {
      if (a === b || drop.indexOf(b) >= 0) return;
      if (calendarEventKind(b) !== kind || eventPerson(a) !== eventPerson(b)) return;
      if (calendarDayKey(a.start) !== calendarDayKey(b.start)) return;
      const diff = Math.abs(new Date(a.start) - new Date(b.start));
      if (diff !== 7 * 3600000 && diff !== 8 * 3600000) return;
      const aZ = /[zZ]|[+\-]\d{2}:?\d{2}/.test(String(a.start || ""));
      const bZ = /[zZ]|[+\-]\d{2}:?\d{2}/.test(String(b.start || ""));
      drop.push(aZ && !bZ ? a : (!aZ && bZ ? b : (String(a.start) < String(b.start) ? a : b)));
    });
  });
  return rows.filter((event) => drop.indexOf(event) < 0);
}
function dedupeCalendarEvents(events, plan, role) {
  const rows = (events || []).filter((event) => {
    if (role === "clinician") return eventBelongsToClinician(event);
    return belongsToPlan(event, plan);
  });
  const seen = {};
  const out = [];
  rows.forEach((event) => {
    const kind = calendarEventKind(event);
    const person = role === "clinician" ? eventPerson(event) : "";
    const key = (kind === "practice" || kind === "visit")
      ? kind + "|" + calendarStartKey(event) + "|" + person
      : String(event.title || "") + "|" + calendarStartKey(event);
    if (seen[key]) return;
    seen[key] = true;
    if (kind === "practice" && role !== "clinician" && plan && plan.patient) {
      out.push(Object.assign({}, event, { title: "ELAK ankle practice · " + plan.patient }));
    } else {
      out.push(event);
    }
  });
  const namedStarts = {};
  out.forEach((event) => {
    const kind = calendarEventKind(event);
    if ((kind === "practice" || kind === "visit") && eventPerson(event)) {
      namedStarts[kind + "|" + calendarStartKey(event)] = true;
    }
  });
  return collapseTzTwins(out.filter((event) => {
    const kind = calendarEventKind(event);
    if ((kind === "practice" || kind === "visit") && !eventPerson(event) && namedStarts[kind + "|" + calendarStartKey(event)]) return false;
    return true;
  }));
}
function elakPlanEvents(plan) {
  const out = [];
  const who = (plan && plan.patient) || "";
  const cycle = plan && plan.cycle;
  const minutes = Math.max(5, Number(cycle && cycle.minutes) || 10);
  if (cycle && Array.isArray(cycle.slots)) {
    cycle.slots.forEach((slot) => {
      if (!slot || !slot.start) return;
      if (typeof isPracticeDay === "function" && slot.date && !isPracticeDay(plan, slot.date)) return;
      const start = new Date(slot.start);
      if (Number.isNaN(start.getTime())) return;
      const visit = typeof nextVisitDayKey === "function" ? nextVisitDayKey(plan) : "";
      const slotDay = slot.date || (typeof dayKey === "function" ? dayKey(start) : "");
      if (visit && slotDay && slotDay >= visit) return;
      out.push({
        source: "elak",
        who: "patient",
        title: "ELAK ankle practice" + (who ? " · " + who : ""),
        start: isoLocal(start),
        end: isoLocal(new Date(start.getTime() + minutes * 60000))
      });
    });
  }
  if (plan && plan.appointment && plan.appointment.start) {
    const start = new Date(plan.appointment.start);
    if (!Number.isNaN(start.getTime())) {
      out.push({
        source: "elak",
        who: "both",
        title: "Next visit" + (who ? " · " + who : ""),
        start: isoLocal(start),
        end: plan.appointment.end ? isoLocal(plan.appointment.end) : isoLocal(new Date(start.getTime() + 30 * 60000))
      });
    }
  }
  const visitDay = typeof nextVisitDayKey === "function" ? nextVisitDayKey(plan) : "";
  (plan && plan.calendar || []).forEach((event) => {
    if (!event || event.source !== "elak" || !event.start) return;
    if (visitDay && calendarEventKind(event) === "practice") {
      const key = calendarDayKey(event.start) || (typeof dayKey === "function" ? dayKey(event.start) : "");
      if (key && key >= visitDay) return;
    }
    out.push({
      source: "elak",
      who: event.who || "patient",
      title: event.title || "ELAK",
      start: event.start,
      end: event.end || event.start
    });
  });
  const seen = {};
  return out.filter((event) => {
    const key = (event.title || "") + "|" + (event.start || "");
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}
function nearestEventDay(events, preferred) {
  const keys = [];
  (events || []).forEach((event) => {
    const key = typeof dayKey === "function" ? dayKey(event.start) : String(event.start || "").slice(0, 10);
    if (key && keys.indexOf(key) < 0) keys.push(key);
  });
  keys.sort();
  if (!keys.length) return preferred;
  if (keys.indexOf(preferred) >= 0) return preferred;
  const upcoming = keys.find((key) => key >= preferred);
  return upcoming || keys[keys.length - 1];
}
function icsStamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function downloadElakIcs(plan, events) {
  const rows = (events || []).filter((event) => event && event.start);
  if (!rows.length) return false;
  const stamp = icsStamp(new Date().toISOString());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ELAK//Practice//EN"];
  rows.forEach((event, i) => {
    const start = icsStamp(event.start);
    const end = icsStamp(event.end || event.start);
    if (!start) return;
    lines.push("BEGIN:VEVENT");
    lines.push("UID:elak-" + ((plan && plan.code) || "plan") + "-" + i + "@elak");
    lines.push("DTSTAMP:" + stamp);
    lines.push("DTSTART:" + start);
    if (end) lines.push("DTEND:" + end);
    lines.push("SUMMARY:" + String(event.title || "ELAK").replace(/[,;\\]/g, " "));
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "elak-practice.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
async function readDeviceCalendarBridge() {
  let shared = null;
  for (const url of calendarBridgeUrls()) {
    const live = /127\.0\.0\.1|localhost|:8766|\/api\/device-calendar/i.test(url);
    const data = await fetchCalendarJson(url, live ? 8000 : 2500);
    if (!data || !Array.isArray(data.events)) continue;
    if (isSharedCalendarPack(data, url)) {
      if (!shared) shared = { data, url };
      continue;
    }
    return {
      source: data.source || "device",
      syncedAt: data.syncedAt || new Date().toISOString(),
      events: data.events
    };
  }
  if (shared) {
    return {
      source: "elak-shared",
      syncedAt: shared.data.syncedAt || new Date().toISOString(),
      events: shared.data.events
    };
  }
  return loadRoleCalendar(pageCalendarRole());
}
async function readDeviceCalendar(pickFile, fresh) {
  const live = await readDeviceCalendarBridge();
  if (live && live.events && live.events.length) return live;
  if (pickFile) {
    const picked = await pickIcsFromDevice();
    return { source: "ics", events: parseIcsText(picked) };
  }
  return live;
}
function refreshPlanOffers(plan) {
  const cycle = plan && plan.cycle;
  if (!cycle || !cycle.slots) return;
  cycle.slots.forEach((slot) => {
    if (typeof slotNeedsPick === "function" && !slotNeedsPick(slot)) return;
    if (typeof twoOffers === "function") {
      slot.offers = twoOffers(slot.date, cycle.timeOfDay, practiceCalendar(plan), cycle.minutes);
    }
  });
}
function planForCalendarSync() {
  if (typeof activePlan === "function") {
    const plan = activePlan();
    if (plan) return plan;
  }
  if (typeof clinic !== "undefined" && clinic && clinic.code) {
    const data = loadPlans();
    return (data.plans && data.plans[clinic.code]) || null;
  }
  return null;
}
function adoptSharedVisits(events) {
  if (typeof loadPlans !== "function" || typeof savePlans !== "function") return;
  const data = loadPlans();
  let changed = false;
  Object.values(data.plans || {}).forEach((plan) => {
    if (!plan || plan.archived || (plan.appointment && plan.appointment.start)) return;
    const names = [plan.patient, plan.username].map((value) => String(value || "").toLowerCase().trim()).filter(Boolean);
    const hit = (events || []).find((event) => {
      if (calendarEventKind(event) !== "visit" || !event.start) return false;
      const person = eventPerson(event);
      if (person) return names.some((n) => person.includes(n) || n.includes(person));
      return names.length === 1;
    });
    if (!hit) return;
    plan.appointment = {
      start: hit.start,
      end: hit.end || hit.start,
      patientSeen: false,
      clinicianSeen: false
    };
    if (typeof keepVisitOnCalendar === "function") keepVisitOnCalendar(plan);
    changed = true;
  });
  if (changed) savePlans(data);
}
function writeDeviceCalendarToPlan(plan, pack, role) {
  const who = role || pageCalendarRole();
  const raw = pack || { events: [] };
  const events = who === "clinician" || isSharedCalendarPack(raw)
    ? filterSharedEvents(raw.events, plan, who)
    : (raw.events || []);
  adoptSharedVisits(events);
  const stamped = saveRoleCalendar(who, {
    source: raw.source || "device",
    syncedAt: raw.syncedAt || new Date().toISOString(),
    events
  });
  if (!plan) {
    return who === "clinician" ? { clinicianCalendar: stamped } : { patientCalendar: stamped, deviceCalendar: stamped };
  }
  const data = loadPlans();
  const cur = (plan.code && data.plans[plan.code]) || plan;
  if (who === "clinician") cur.clinicianCalendar = stamped;
  else {
    cur.patientCalendar = stamped;
    cur.deviceCalendar = stamped;
  }
  const window = displayWindowForPlan(cur);
  applyRoleCalendarsToPlan(cur, window.start, window.end);
  refreshPlanOffers(cur);
  if (cur.code && data.plans[cur.code]) {
    data.plans[cur.code] = cur;
    savePlans(data);
  }
  return cur;
}
async function syncDeviceCalendarToPlan(plan, pickFile, role, fresh) {
  const who = role || pageCalendarRole();
  const pack = await readDeviceCalendar(!!pickFile, !!fresh);
  if (!pack || !Array.isArray(pack.events) || !pack.events.length) {
    throw new Error("No calendar");
  }
  return writeDeviceCalendarToPlan(plan, pack, who);
}
function calendarEventStamp(events) {
  return JSON.stringify((events || []).map((event) => (event.title || "") + "|" + (event.start || "")));
}
function paintRoleCalendar(root, status, role, plan) {
  const who = role || pageCalendarRole();
  const fake = plan || {
    calendar: [],
    clinicianCalendar: loadRoleCalendar("clinician"),
    patientCalendar: loadRoleCalendar("patient")
  };
  applyRoleCalendarsToPlan(fake);
  fake.calendar = (fake.calendar || []).concat(elakPlanEvents(plan || fake));
  if (who === "clinician" && typeof clinicVisitEvents === "function") {
    fake.calendar = (fake.calendar || []).concat(clinicVisitEvents());
  }
  if (who === "clinician") fake.calendar = (fake.calendar || []).concat(clinicNextVisitEvents());
  fake.calendar = dedupeCalendarEvents(fake.calendar, plan || fake, who);
  let visible = typeof calendarSummary === "function"
    ? dedupeCalendarEvents(calendarSummary(fake, who), plan || fake, who)
    : fake.calendar;
  if (who === "clinician") {
    clinicNextVisitEvents().forEach((event) => visible.push(event));
    const seen = {};
    visible = visible.filter((event) => {
      const key = String(event.title || "") + "|" + calendarStartKey(event);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  if (status) {
    const n = visible.length;
    const visit = visible.filter((event) => calendarEventKind(event) === "visit").sort((a, b) => String(a.start).localeCompare(String(b.start)))[0];
    let text = n ? (n + (n === 1 ? " event" : " events")) : "No calendar events yet.";
    if (visit && visit.start) {
      const when = new Date(visit.start);
      if (!Number.isNaN(when.getTime())) {
        text += ". Next visit " + when.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      }
    }
    status.textContent = text;
  }
  if (!window.ELAK_CAL_DAY) {
    const today = typeof dayKey === "function" ? dayKey(new Date()) : new Date().toISOString().slice(0, 10);
    window.ELAK_CAL_DAY = today;
  }
  if (root && typeof calendarSummary === "function") {
    const events = visible;
    const stamp = (window.ELAK_CAL_DAY || "") + "|" + calendarEventStamp(events);
    if (root.dataset.calStamp === stamp) return;
    root.dataset.calStamp = stamp;
    renderDayCalendar(root, events, window.ELAK_CAL_DAY, (next) => {
      window.ELAK_CAL_DAY = next;
      delete root.dataset.calStamp;
      paintRoleCalendar(root, status, role, plan);
    });
  }
}
async function pullLiveCalendar(fresh) {
  if (window.ELAK_CAL_READING) return null;
  if (!fresh && typeof document !== "undefined" && document.hidden) return null;
  const who = pageCalendarRole();
  const plan = planForCalendarSync();
  window.ELAK_CAL_READING = true;
  try {
    const pack = await readDeviceCalendar(false, false);
    if (!pack || !Array.isArray(pack.events) || !pack.events.length) {
      window.ELAK_CAL_READING = false;
      return plan;
    }
    const stamp = calendarEventStamp(pack.events);
    if (stamp && stamp === window.ELAK_CAL_STAMP) {
      window.ELAK_CAL_READING = false;
      return plan;
    }
    const next = writeDeviceCalendarToPlan(plan, pack, who);
    window.ELAK_CAL_STAMP = stamp;
    window.ELAK_CAL_READING = false;
    if (who === "patient" && typeof S !== "undefined") {
      if (S.screen === "title" && typeof renderHomeCalendar === "function") renderHomeCalendar(next || plan);
      if (S.screen === "book" && typeof renderBusy === "function") renderBusy();
    }
    if (who === "clinician" && typeof renderClinicOwnCalendar === "function") renderClinicOwnCalendar();
    return next;
  } catch (err) {
    window.ELAK_CAL_READING = false;
    if (typeof renderHomeCalendar === "function" && who === "patient" && typeof S !== "undefined" && S.screen === "title") {
      renderHomeCalendar(plan);
    }
    throw err;
  }
}
const INBOX_KEY = "elak-inbox-v1";
function loadInbox() {
  try {
    return JSON.parse(localStorage.getItem(INBOX_KEY) || '{"clinic":[],"patients":{}}');
  } catch (err) {
    return { clinic: [], patients: {} };
  }
}
function saveInbox(box) {
  localStorage.setItem(INBOX_KEY, JSON.stringify(box));
  if (typeof schedulePushElakStore === "function") schedulePushElakStore();
}
function pushInbox(side, username, note) {
  const box = loadInbox();
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    patient: (note && note.patient) || "",
    username: username || "",
    type: (note && note.type) || "note",
    subject: (note && note.subject) || "",
    body: (note && note.body) || "",
    report: (note && note.report) || null,
    requestId: (note && note.requestId) || "",
    request: (note && note.request) || null,
    status: (note && note.status) || "",
    read: false
  };
  if (side === "clinic") box.clinic.unshift(item);
  else {
    const key = username || "patient";
    if (!box.patients[key]) box.patients[key] = [];
    box.patients[key].unshift(item);
  }
  saveInbox(box);
  if (typeof paintNotesDot === "function") paintNotesDot();
  return item;
}
function unreadCount(side, username) {
  return inboxFor(side, username).filter((item) => !item.read).length;
}
function markInboxReadAll(side, username) {
  const box = loadInbox();
  const list = side === "clinic" ? (box.clinic || []) : ((box.patients && box.patients[username]) || []);
  list.forEach((item) => { item.read = true; });
  saveInbox(box);
  paintNotesDot();
}
function paintNotesDot() {
  const clinicDot = document.getElementById("clinic-notes-dot");
  if (clinicDot) clinicDot.hidden = unreadCount("clinic") === 0;
  const patientDot = document.getElementById("patient-notes-dot");
  if (patientDot) {
    const plan = typeof activePlan === "function" ? activePlan() : null;
    patientDot.hidden = !plan || unreadCount("patient", plan.username) === 0;
  }
}
function inboxFor(side, username) {
  const box = loadInbox();
  return side === "clinic" ? (box.clinic || []) : ((box.patients && box.patients[username]) || []);
}
function markInboxRead(side, username, id) {
  const box = loadInbox();
  const list = side === "clinic" ? (box.clinic || []) : ((box.patients && box.patients[username]) || []);
  const item = list.find((note) => note.id === id);
  if (item) item.read = true;
  saveInbox(box);
  paintNotesDot();
}
function reportLines(plan) {
  if (typeof draftReport !== "function" || !plan) return "";
  const report = draftReport(plan);
  return [
    "Days done: " + (report.daysDone.length ? report.daysDone.join("; ") : "none yet"),
    "Days not done: " + (report.daysNotDone.length ? report.daysNotDone.join("; ") : "none yet"),
    "Days with no phone: " + (report.noPhoneDays.length ? report.noPhoneDays.join(", ") : "none yet"),
    "Pain stops: " + (report.painStops.length ? report.painStops.join(", ") : "none")
  ].join("\n");
}
function laptopCalendarUrls() {
  return ["http://127.0.0.1:8766/calendar", "http://localhost:8766/calendar", "/api/device-calendar"];
}
function laptopCalendarTag(plan) {
  return "elak:" + ((plan && (plan.username || plan.code)) || "plan");
}
function laptopCalendarEvents(plan) {
  const who = (plan && plan.patient) || "";
  const rows = [];
  (typeof elakPlanEvents === "function" ? elakPlanEvents(plan) : ((plan && plan.calendar) || [])).forEach((event) => {
    if (!event || !event.start) return;
    const title = /elak|next visit/i.test(event.title || "")
      ? event.title
      : ((event.title || "ELAK ankle practice") + (who ? " · " + who : ""));
    rows.push({
      title: title,
      start: event.start,
      end: event.end || event.start,
      notes: laptopCalendarTag(plan)
    });
  });
  return typeof dedupeCalendarEvents === "function"
    ? dedupeCalendarEvents(rows.map((row) => Object.assign({ source: "elak" }, row)), plan, "clinician")
      .map((row) => ({ title: row.title, start: row.start, end: row.end, notes: laptopCalendarTag(plan) }))
    : rows;
}
function clinicLaptopCalendarEvents() {
  const seen = {};
  const out = [];
  function add(event) {
    if (!event || !event.start) return;
    if (calendarEventKind(event) === "other") return;
    if (!eventBelongsToClinician(event)) return;
    const title = event.title || "ELAK ankle practice";
    const key = title + "|" + calendarStartKey(event);
    if (seen[key]) return;
    seen[key] = true;
    out.push({
      title: title,
      start: event.start,
      end: event.end || event.start,
      notes: "elak:clinic"
    });
  }
  clinicianCalendarPlans().forEach((plan) => laptopCalendarEvents(plan).forEach(add));
  if (typeof clinicVisitEvents === "function") clinicVisitEvents().forEach(add);
  const pack = typeof loadRoleCalendar === "function" ? (loadRoleCalendar("clinician") || {}) : {};
  (pack.events || []).forEach(add);
  return typeof dedupeCalendarEvents === "function" ? dedupeCalendarEvents(out, null, "clinician") : out;
}
function laptopEventsStamp(events, purge) {
  return (purge ? "purge|" : "") + (events || []).map((event) => (event.title || "") + "|" + (event.start || "") + "|" + (event.end || "")).join("\n");
}
async function pushLaptopCalendarNow(plan) {
  const clinicAll = !plan || plan === true || (plan && plan._all) || (typeof pageCalendarRole === "function" && pageCalendarRole() === "clinician");
  const events = clinicAll ? clinicLaptopCalendarEvents() : laptopCalendarEvents(plan);
  if (!events.length && !(plan && plan._purge)) return null;
  const stamp = laptopEventsStamp(events, !!(plan && plan._purge));
  if (!(plan && plan._purge) && stamp && stamp === window.ELAK_CAL_WRITE_STAMP) {
    return { ok: true, skipped: "unchanged" };
  }
  if (window.ELAK_CAL_WRITING) {
    window.ELAK_CAL_WRITE_AGAIN = plan;
    return null;
  }
  window.ELAK_CAL_WRITING = true;
  const payload = {
    tag: clinicAll ? "elak:clinic" : laptopCalendarTag(plan),
    events: events,
    replaceElak: true,
    purgeIfEmpty: !!(plan && plan._purge)
  };
  try {
    for (const url of laptopCalendarUrls()) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data && data.ok) {
          window.ELAK_CAL_WRITE_STAMP = stamp;
          return data;
        }
      } catch (err) {
        /* try the next calendar API */
      }
    }
    return null;
  } finally {
    window.ELAK_CAL_WRITING = false;
    const again = window.ELAK_CAL_WRITE_AGAIN;
    window.ELAK_CAL_WRITE_AGAIN = null;
    if (again) pushLaptopCalendarNow(again).catch(() => {});
  }
}
function pushLaptopCalendar(plan) {
  if (plan && plan._purge) return pushLaptopCalendarNow(plan);
  window.ELAK_CAL_PUSH_PLAN = plan;
  if (window.ELAK_CAL_PUSH_TIMER) return Promise.resolve(null);
  return new Promise((resolve) => {
    window.ELAK_CAL_PUSH_TIMER = setTimeout(() => {
      window.ELAK_CAL_PUSH_TIMER = 0;
      const pending = window.ELAK_CAL_PUSH_PLAN;
      window.ELAK_CAL_PUSH_PLAN = null;
      pushLaptopCalendarNow(pending).then(resolve).catch(() => resolve(null));
    }, 400);
  });
}
function eventIsForPlan(event, plan) {
  return eventMatchesPatient(event, plan);
}
function removePatientFromCalendars(plan) {
  if (!plan) return;
  ["clinician", "patient"].forEach((role) => {
    const pack = typeof loadRoleCalendar === "function" ? loadRoleCalendar(role) : null;
    if (!pack || !Array.isArray(pack.events)) return;
    pack.events = pack.events.filter((event) => !eventIsForPlan(event, plan));
    saveRoleCalendar(role, pack);
  });
  plan.calendar = (plan.calendar || []).filter((event) => event.source !== "elak");
  plan.appointment = null;
  if (plan.cycle && Array.isArray(plan.cycle.slots)) {
    plan.cycle.slots = plan.cycle.slots.map((slot) => Object.assign({}, slot, { start: "", status: "offer" }));
  }
  if (typeof loadPlans === "function" && plan.code) {
    const data = loadPlans();
    if (data.plans[plan.code]) {
      data.plans[plan.code] = plan;
      savePlans(data);
    }
  }
  pushLaptopCalendar({ _all: true, _purge: true }).catch(() => {});
}
function syncLaptopCalendar(plan) {
  if (typeof pageCalendarRole === "function" && pageCalendarRole() === "clinician") {
    pushLaptopCalendar({ _all: true }).catch(() => {});
    return;
  }
  if (!plan) return;
  pushLaptopCalendar(plan).catch(() => {});
}
function notifyAppointment(plan, appt) {
  if (!plan || !appt) return;
  const when = formatAppointmentWhen(appt);
  const note = { type: "appointment", patient: plan.patient, subject: "Next visit booked", body: when };
  const clinicHas = inboxFor("clinic").some((item) => item.type === "appointment" && item.username === plan.username && item.body === when);
  const patientHas = inboxFor("patient", plan.username).some((item) => item.type === "appointment" && item.body === when);
  if (!clinicHas) pushInbox("clinic", plan.username, note);
  if (!patientHas) pushInbox("patient", plan.username, note);
  sendDesktopNotice("Next visit booked", (plan.patient || "") + " · " + when);
  syncLaptopCalendar(plan);
}
function notifyPatientReport(plan) {
  if (!plan) return;
  pushInbox("clinic", plan.username, {
    type: "report",
    patient: plan.patient,
    subject: "Practice report",
    body: reportLines(plan),
    report: typeof draftReport === "function" ? draftReport(plan) : null
  });
}
function notifyPracticePlan(plan) {
  const cycle = typeof cycleOf === "function" ? cycleOf(plan) : (plan && plan.cycle);
  if (!plan || !cycle || !cycle.slots) return;
  const lines = cycle.slots.filter((slot) => slot.start).map((slot) => {
    return new Date(slot.start).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  });
  if (!lines.length) return;
  const body = lines.join("\n");
  const note = { type: "plan", patient: plan.patient, subject: "This week's practice", body };
  const clinicHas = inboxFor("clinic").some((item) => item.type === "plan" && item.username === plan.username && item.body === body);
  const patientHas = inboxFor("patient", plan.username).some((item) => item.type === "plan" && item.body === body);
  if (!clinicHas) pushInbox("clinic", plan.username, note);
  if (!patientHas) pushInbox("patient", plan.username, note);
}
function eventsOnDay(events, key) {
  return (events || []).filter((event) => {
    if (calendarDayKey(event.start) === key) return true;
    return String(event.start || "").slice(0, 10) === key;
  }).sort((a, b) => String(a.start).localeCompare(String(b.start)));
}
function shiftDay(key, delta) {
  const parts = String(key || "").split("-").map(Number);
  const dt = new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
  dt.setDate(dt.getDate() + delta);
  return typeof dayKey === "function" ? dayKey(dt) : dt.toISOString().slice(0, 10);
}
function renderDayCalendar(root, events, day, onChange) {
  if (!root) return;
  root.replaceChildren();
  const nav = document.createElement("div");
  nav.className = "spread";
  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "ghost";
  prev.textContent = "Previous day";
  const label = document.createElement("strong");
  const shown = new Date(day + "T12:00:00");
  label.textContent = Number.isNaN(shown.getTime())
    ? day
    : shown.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const next = document.createElement("button");
  next.type = "button";
  next.className = "ghost";
  next.textContent = "Next day";
  prev.addEventListener("click", () => onChange(shiftDay(day, -1)));
  next.addEventListener("click", () => onChange(shiftDay(day, 1)));
  nav.append(prev, label, next);
  root.appendChild(nav);
  (events || []).filter((event) => calendarEventKind(event) === "visit" && event.start)
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
    .forEach((event) => {
      const line = document.createElement("p");
      line.className = "note";
      const when = new Date(event.start);
      line.textContent = (event.title || "Next visit") + " · " + (Number.isNaN(when.getTime())
        ? String(event.start)
        : when.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));
      root.appendChild(line);
    });
  const rows = eventsOnDay(events, day);
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "note";
    empty.textContent = "Nothing on this day.";
    root.appendChild(empty);
    return;
  }
  const table = document.createElement("table");
  table.className = "cal-table";
  const head = document.createElement("thead");
  const hr = document.createElement("tr");
  ["Time", "Busy with"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    hr.appendChild(th);
  });
  head.appendChild(hr);
  const body = document.createElement("tbody");
  rows.forEach((event) => {
    const tr = document.createElement("tr");
    const time = document.createElement("td");
    time.textContent = event.allDay ? "All day" : (typeof clockOf === "function" ? clockOf(event.start) + "–" + clockOf(event.end) : "");
    const title = document.createElement("td");
    title.textContent = event.title || "Busy";
    tr.append(time, title);
    body.appendChild(tr);
  });
  table.append(head, body);
  const wrap = document.createElement("div");
  wrap.className = "cal-wrap";
  wrap.appendChild(table);
  root.appendChild(wrap);
}
function renderInboxList(root, items, onOpen, showName) {
  if (!root) return;
  root.replaceChildren();
  if (!items.length) {
    root.textContent = "No notifications yet.";
    return;
  }
  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mail-row" + (item.read ? " read" : "");
    const dot = document.createElement("span");
    dot.className = "notes-dot";
    dot.hidden = !!item.read;
    const copy = document.createElement("div");
    copy.className = "mail-copy";
    if (showName) {
      const name = document.createElement("strong");
      name.textContent = item.patient || "Patient";
      copy.appendChild(name);
    }
    const sub = document.createElement(showName ? "span" : "strong");
    sub.textContent = item.subject || "Notification";
    copy.appendChild(sub);
    const when = document.createElement("small");
    when.textContent = new Date(item.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    const inner = document.createElement("span");
    inner.className = "mail-row-inner";
    inner.append(dot, copy, when);
    btn.appendChild(inner);
    btn.addEventListener("click", () => onOpen(item));
    root.appendChild(btn);
  });
}
function fillMailView(item) {
  if (!item) return;
  window.ELAK_MAIL = item;
  const from = document.getElementById("mail-from");
  if (from) {
    from.replaceChildren();
    const name = document.createElement("strong");
    name.textContent = "ELAK assistant";
    from.appendChild(name);
  }
  if (document.getElementById("mail-subject")) document.getElementById("mail-subject").textContent = item.subject || "";
  if (document.getElementById("mail-when")) document.getElementById("mail-when").textContent = new Date(item.at).toLocaleString();
  if (document.getElementById("mail-body")) document.getElementById("mail-body").textContent = item.body || "";
  const box = document.getElementById("mail-negotiate");
  const msg = document.getElementById("mail-negotiate-msg");
  const input = document.getElementById("mail-new-time");
  if (box) box.hidden = item.type !== "appointment";
  if (msg) msg.textContent = "";
  if (input) {
    const plan = planForInboxItem(item);
    input.value = plan && plan.appointment && plan.appointment.start
      ? toLocalDateTime(plan.appointment.start)
      : "";
  }
  paintMailKale(item);
  const openReport = document.getElementById("mail-open-report");
  if (openReport) openReport.hidden = item.type !== "health-report";
  const overlay = document.getElementById("overlay-mail");
  if (overlay) overlay.hidden = false;
}

function mailIsClinic() {
  return !!(document.getElementById("clinic-home") || document.getElementById("clinic-form") || document.getElementById("editor"));
}

function kaleRequestOf(item) {
  const plan = planForInboxItem(item);
  const id = (item && (item.requestId || (item.request && item.request.id))) || "";
  const list = (plan && plan.kaleRequests) || [];
  if (id) {
    const found = list.find((row) => row.id === id);
    if (found) return { plan, req: found };
  }
  const open = list.find((row) => row.status === "pending");
  if (open) return { plan, req: open };
  if (item && item.request) return { plan, req: item.request };
  return { plan, req: null };
}

function kaleReasonValue() {
  const input = document.getElementById("mail-kale-reason");
  return input ? String(input.value || "").trim() : "";
}

function paintMailKale(item) {
  wireMailKaleBox();
  const box = document.getElementById("mail-kale");
  const msg = document.getElementById("mail-kale-msg");
  const wrap = document.getElementById("mail-kale-reason-wrap");
  const label = document.getElementById("mail-kale-reason-label");
  const input = document.getElementById("mail-kale-reason");
  const agree = document.getElementById("mail-kale-agree");
  const disagree = document.getElementById("mail-kale-disagree");
  const appeal = document.getElementById("mail-kale-appeal");
  const { req } = kaleRequestOf(item);
  const status = (req && req.status) || item.status || "";
  const clinicPending = mailIsClinic() && item && item.type === "kale-request" && req && status === "pending";
  const patientAppeal = !mailIsClinic() && item && (item.type === "kale-decision" || item.type === "kale-request") && req && status === "declined";
  const show = clinicPending || patientAppeal;
  if (box) box.hidden = !show;
  if (wrap) wrap.hidden = !show;
  if (agree) agree.hidden = !clinicPending;
  if (disagree) disagree.hidden = !clinicPending;
  if (appeal) appeal.hidden = !patientAppeal;
  if (label) label.textContent = clinicPending ? "Reason if you disagree" : "Why should they look again?";
  if (input && window.ELAK_MAIL_KALE_ID !== (item && item.id)) {
    input.value = "";
    window.ELAK_MAIL_KALE_ID = item && item.id;
  }
  if (msg) {
    msg.textContent = clinicPending
      ? "Agree to apply this change, or write a reason and disagree. The patient sees that reason."
      : (patientAppeal ? "If you still want this change, write why and reappeal. Your clinician sees it on the same request." : "");
  }
}

function wireMailKaleBox() {
  const agree = document.getElementById("mail-kale-agree");
  const disagree = document.getElementById("mail-kale-disagree");
  const appeal = document.getElementById("mail-kale-appeal");
  if (!agree || !disagree) return;
  if (!agree.dataset.kaleWired) {
    agree.dataset.kaleWired = "1";
    agree.addEventListener("click", () => decideKaleRequest(true));
  }
  if (!disagree.dataset.kaleWired) {
    disagree.dataset.kaleWired = "1";
    disagree.addEventListener("click", () => decideKaleRequest(false));
  }
  if (appeal && !appeal.dataset.kaleWired) {
    appeal.dataset.kaleWired = "1";
    appeal.addEventListener("click", () => appealKaleRequest());
  }
}

function kaleInboxBody(plan, req) {
  let out = (plan.patient || "Patient") + " asked Kale to change home practice.\n\n" +
    (req.summary || "Home exercise change") + "\n\nThey wrote: " + (req.patientNote || req.reason || "");
  (req.appeals || []).forEach((row, index) => {
    out += "\n\nReappeal " + (index + 1) + ": " + (row.note || "");
  });
  if (req.clinicNote) out += "\n\nClinician reason: " + req.clinicNote;
  return out;
}

function upsertInbox(side, username, match, note) {
  const box = loadInbox();
  const list = side === "clinic" ? (box.clinic || []) : (((box.patients || {})[username || "patient"]) || []);
  const found = (list || []).find(match);
  if (found) {
    if (note.subject != null) found.subject = note.subject;
    if (note.body != null) found.body = note.body;
    if (note.status != null) found.status = note.status;
    if (note.request != null) found.request = note.request;
    if (note.requestId) found.requestId = note.requestId;
    if (note.type) found.type = note.type;
    found.at = new Date().toISOString();
    found.read = false;
    saveInbox(box);
    if (typeof paintNotesDot === "function") paintNotesDot();
    return found;
  }
  return pushInbox(side, username, note);
}

function ensureKaleInbox(plan, req) {
  if (!plan || !req) return null;
  return upsertInbox("clinic", plan.username, (row) => row.type === "kale-request" && row.requestId === req.id, {
    type: "kale-request",
    patient: plan.patient,
    subject: "Home exercise change request",
    body: kaleInboxBody(plan, req),
    requestId: req.id,
    request: req,
    status: req.status || "pending"
  });
}

function stripClinicKaleDecisions() {
  const box = loadInbox();
  const before = (box.clinic || []).length;
  box.clinic = (box.clinic || []).filter((item) => item && item.type !== "kale-decision");
  if (box.clinic.length !== before) {
    saveInbox(box);
    if (typeof paintNotesDot === "function") paintNotesDot();
  }
}

function syncPendingKaleInbox() {
  if (typeof loadPlans !== "function") return;
  stripClinicKaleDecisions();
  Object.values(loadPlans().plans || {}).forEach((plan) => {
    (plan.kaleRequests || []).forEach((req) => {
      if (!req || req.status !== "pending") return;
      const has = inboxFor("clinic").some((item) => item.requestId === req.id);
      if (!has) ensureKaleInbox(plan, req);
    });
  });
}

function patchInboxItem(id, patch) {
  if (!id) return;
  const box = loadInbox();
  const lists = [box.clinic || []].concat(Object.values(box.patients || {}));
  lists.forEach((list) => {
    const found = (list || []).find((row) => row.id === id);
    if (found) Object.assign(found, patch);
  });
  saveInbox(box);
}

function kaleApplyApproved(plan, req) {
  if (!plan || !req) return "No change to apply.";
  const visit = typeof latestVisit === "function" ? latestVisit(plan) : null;
  const cycle = typeof cycleOf === "function" ? cycleOf(plan) : plan.cycle;
  if (!visit || !cycle) return "There is no home plan to edit yet.";
  if (req.kind === "shift_week" || req.kind === "shift_days" || Number(req.shiftDays) > 0) {
    const days = Number(req.shiftDays) > 0 ? Number(req.shiftDays) : 7;
    const today = typeof dayKey === "function" ? dayKey(new Date()) : "";
    const visit = typeof nextVisitDayKey === "function" ? nextVisitDayKey(plan) : "";
    (cycle.slots || []).forEach((slot) => {
      if (!slot || (slot.status && String(slot.status).startsWith("done"))) return;
      if (today && slot.date < today) return;
      if (typeof shiftDay === "function") slot.date = shiftDay(slot.date, days);
      slot.start = "";
      slot.status = "rebook";
    });
    cycle.slots = (cycle.slots || []).filter((slot) => {
      if (!slot || !slot.date) return false;
      if (visit && slot.date >= visit && !(slot.status && String(slot.status).startsWith("done"))) return false;
      return true;
    });
    if (typeof clipCycleToVisit === "function") clipCycleToVisit(plan, cycle);
    if (cycle.periodEnd && typeof dayKey === "function" && typeof shiftDay === "function") {
      const last = (cycle.slots || []).reduce((max, slot) => (slot.date > max ? slot.date : max), dayKey(cycle.periodEnd));
      if (last > dayKey(cycle.periodEnd)) cycle.periodEnd = last + "T12:00:00";
    }
    const data = loadPlans();
    data.plans[plan.code] = plan;
    savePlans(data);
    if (typeof autoBookCycle === "function") autoBookCycle(loadPlans().plans[plan.code] || plan);
    const live = loadPlans().plans[plan.code] || plan;
    if (typeof notifyPracticePlan === "function") notifyPracticePlan(live);
    if (typeof refreshMeta === "function") refreshMeta();
    if (days === 1) return "Home practice was moved by 1 day.";
    if (days % 7 === 0) {
      const weeks = days / 7;
      return "Home practice was moved by " + weeks + " week" + (weeks === 1 ? "" : "s") + ".";
    }
    return "Home practice was moved by " + days + " days.";
  }
  if ((req.kind === "reduce_days" || req.daysPerWeek != null) && typeof buddySetDays === "function") {
    return buddySetDays(plan, Number(req.daysPerWeek));
  }
  if (req.kind === "reduce_set") {
    cycle.minBout = 1;
    const data = loadPlans();
    data.plans[plan.code] = plan;
    savePlans(data);
    if (typeof notifyPracticePlan === "function") notifyPracticePlan(plan);
    if (typeof refreshMeta === "function") refreshMeta();
    return "The daily set was reduced to the lightest count that still counts.";
  }
  return "The request had no change I could apply.";
}

function saveKaleRequest(plan, req) {
  if (!plan || !plan.code || !req) return plan;
  const data = loadPlans();
  const cur = data.plans[plan.code] || plan;
  cur.kaleRequests = cur.kaleRequests || [];
  const idx = cur.kaleRequests.findIndex((row) => row.id === req.id);
  if (idx >= 0) cur.kaleRequests[idx] = req;
  else cur.kaleRequests.push(req);
  data.plans[cur.code] = cur;
  savePlans(data);
  return data.plans[cur.code] || cur;
}

function finishKaleMail(item, req, extraBody, note) {
  const msg = document.getElementById("mail-kale-msg");
  patchInboxItem(item && item.id, { status: req.status, request: req, body: extraBody || item.body });
  if (item) {
    item.status = req.status;
    item.request = req;
    if (extraBody) item.body = extraBody;
  }
  if (document.getElementById("mail-body") && extraBody) document.getElementById("mail-body").textContent = extraBody;
  if (msg) msg.textContent = note || "";
  paintMailKale(item || window.ELAK_MAIL);
  if (typeof renderClinicInbox === "function") renderClinicInbox();
  if (typeof renderPatientInbox === "function") renderPatientInbox();
  if (typeof paintNotesDot === "function") paintNotesDot();
  if (typeof refreshMeta === "function") refreshMeta();
}

function decideKaleRequest(agree) {
  const item = window.ELAK_MAIL;
  const msg = document.getElementById("mail-kale-msg");
  const found = kaleRequestOf(item);
  const plan = found.plan;
  const req = found.req;
  if (!plan || !req || req.status !== "pending") {
    if (msg) msg.textContent = "This request cannot be decided.";
    return false;
  }
  if (!agree) {
    const reason = kaleReasonValue();
    if (!reason) {
      if (msg) msg.textContent = "Write why you disagree. That reason is sent to the patient.";
      return false;
    }
    req.clinicNote = reason;
  }
  req.clinicAt = new Date().toISOString();
  if (agree) {
    const live = saveKaleRequest(plan, req);
    const applied = kaleApplyApproved(live, req);
    req.status = "approved";
    saveKaleRequest(live, req);
    upsertInbox("patient", plan.username, (row) => row.type === "kale-decision" && row.requestId === req.id, {
      type: "kale-decision",
      patient: plan.patient,
      subject: "Home exercise change agreed",
      body: "Your clinician agreed. The home plan was updated.\n\n" + (req.summary || applied),
      requestId: req.id,
      request: req,
      status: req.status
    });
    finishKaleMail(item, req, kaleInboxBody(plan, req) + "\n\nAgreed. The home plan was updated.", "Agreed. Saved on this request.");
    return true;
  }
  req.status = "declined";
  saveKaleRequest(plan, req);
  upsertInbox("patient", plan.username, (row) => row.type === "kale-decision" && row.requestId === req.id, {
    type: "kale-decision",
    patient: plan.patient,
    subject: "Home exercise change not approved",
    body: "Your clinician did not approve this change. The home plan was not edited.\n\n" +
      (req.summary || "") + "\n\nClinician reason: " + (req.clinicNote || "") +
      "\n\nYou can open this note and reappeal with a written reason.",
    requestId: req.id,
    request: req,
    status: req.status
  });
  finishKaleMail(item, req, kaleInboxBody(plan, req), "Disagreed. The patient was sent your reason.");
  return true;
}

function appealKaleRequest() {
  const item = window.ELAK_MAIL;
  const msg = document.getElementById("mail-kale-msg");
  const reason = kaleReasonValue();
  const found = kaleRequestOf(item);
  const plan = found.plan;
  const req = found.req;
  if (!plan || !req || req.status !== "declined") {
    if (msg) msg.textContent = "This decision cannot be appealed.";
    return false;
  }
  if (!reason) {
    if (msg) msg.textContent = "Write why you want another look.";
    return false;
  }
  req.status = "pending";
  req.appeals = req.appeals || [];
  req.appeals.push({ note: reason, at: new Date().toISOString() });
  req.appealAt = new Date().toISOString();
  saveKaleRequest(plan, req);
  upsertInbox("clinic", plan.username, (row) => row.type === "kale-request" && row.requestId === req.id, {
    type: "kale-request",
    patient: plan.patient,
    subject: "Home exercise change request",
    body: kaleInboxBody(plan, req),
    requestId: req.id,
    request: req,
    status: "pending"
  });
  upsertInbox("patient", plan.username, (row) => row.type === "kale-decision" && row.requestId === req.id, {
    type: "kale-decision",
    patient: plan.patient,
    subject: "Home exercise change — waiting",
    body: "You asked your clinician to look again.\n\n" + reason + "\n\nWaiting for their decision.",
    requestId: req.id,
    request: req,
    status: "pending"
  });
  if (item) {
    item.status = "pending";
    item.request = req;
  }
  finishKaleMail(item, req, item && item.body ? item.body : "You asked your clinician to look again.\n\n" + reason, "Sent on the same request.");
  return true;
}
function toLocalDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
}
function planForInboxItem(item) {
  if (item && item.username && typeof planByUsername === "function") {
    const found = planByUsername(item.username);
    if (found) return found;
  }
  return typeof planForCalendarSync === "function" ? planForCalendarSync() : null;
}
function clinicianFreeAt(plan, startISO, minutes) {
  const length = Math.max(15, Number(minutes) || 30);
  const start = new Date(startISO);
  if (Number.isNaN(start.getTime())) return false;
  const end = new Date(start.getTime() + length * 60000);
  const win = { start: start.toISOString(), end: end.toISOString() };
  const extra = typeof clinicVisitEvents === "function"
    ? clinicVisitEvents().filter((event) => !plan || String(event.title || "").indexOf(plan.patient || "\0") < 0)
    : [];
  const busy = expandDeviceEvents((clinicianCalendarOf(plan) || {}).events || [], win.start, win.end)
    .concat(extra)
    .filter((event) => !event.allDay);
  return !overlaps(start.toISOString(), length, busy);
}
function notifyVisitChanged(plan) {
  if (!plan || !plan.appointment) return;
  const when = formatAppointmentWhen(plan.appointment);
  const note = { type: "changed", patient: plan.patient, subject: "Visit time changed", body: when };
  pushInbox("clinic", plan.username, note);
  pushInbox("patient", plan.username, note);
  sendDesktopNotice("Visit time changed", (plan.patient || "") + " · " + when);
  syncLaptopCalendar(plan);
}
function submitVisitNegotiate() {
  const item = window.ELAK_MAIL;
  const input = document.getElementById("mail-new-time");
  const msg = document.getElementById("mail-negotiate-msg");
  const plan = planForInboxItem(item);
  if (!item || item.type !== "appointment" || !plan || !plan.code) {
    if (msg) msg.textContent = "This visit cannot be changed.";
    return false;
  }
  const stamp = input && input.value ? new Date(input.value) : null;
  if (!stamp || Number.isNaN(stamp.getTime())) {
    if (msg) msg.textContent = "Choose a new time.";
    return false;
  }
  if (stamp.getTime() < Date.now()) {
    if (msg) msg.textContent = "Choose a time in the future.";
    return false;
  }
  const startISO = stamp.toISOString();
  if (!clinicianFreeAt(plan, startISO, 30)) {
    if (msg) msg.textContent = "Unable to change. The clinician is not free at that time.";
    return false;
  }
  const data = loadPlans();
  const cur = data.plans[plan.code] || plan;
  cur.appointment = cur.appointment || {};
  cur.appointment.start = startISO;
  cur.appointment.end = new Date(stamp.getTime() + 30 * 60000).toISOString();
  cur.appointment.patientSeen = false;
  cur.appointment.clinicianSeen = false;
  keepVisitOnCalendar(cur);
  data.plans[cur.code] = cur;
  savePlans(data);
  notifyVisitChanged(cur);
  if (msg) msg.textContent = "Visit moved to " + formatAppointmentWhen(cur.appointment) + ".";
  if (document.getElementById("mail-body")) document.getElementById("mail-body").textContent = formatAppointmentWhen(cur.appointment);
  if (typeof renderClinicOwnCalendar === "function") renderClinicOwnCalendar();
  if (typeof renderPatientInbox === "function" && typeof S !== "undefined" && S.screen === "notes") renderPatientInbox();
  if (typeof renderClinicInbox === "function" && typeof clinic !== "undefined" && clinic.page === "notes") renderClinicInbox();
  if (typeof paintNotesDot === "function") paintNotesDot();
  return true;
}
function startCalendarWatch() {
  if (window.ELAK_CAL_TIMER) return;
  pullLiveCalendar(false).then(() => {
    const who = typeof pageCalendarRole === "function" ? pageCalendarRole() : "";
    syncLaptopCalendar(who === "clinician" ? { _all: true } : planForCalendarSync());
  }).catch(() => {
    const who = typeof pageCalendarRole === "function" ? pageCalendarRole() : "";
    syncLaptopCalendar(who === "clinician" ? { _all: true } : planForCalendarSync());
  });
  window.ELAK_CAL_TIMER = setInterval(() => {
    if (window.ELAK_CAL_READING) return;
    if (typeof document !== "undefined" && document.hidden) return;
    pullLiveCalendar(false).catch(() => {});
  }, 30000);
}
function wireCalendarSync(button, status, after) {
  if (!button) return;
  button.addEventListener("click", async () => {
    const who = pageCalendarRole();
    const plan = planForCalendarSync();
    if (typeof calendarConsentOn === "function" && !calendarConsentOn(who)) {
      if (status) status.textContent = "Calendar access is off for this sign-in.";
      return;
    }
    if (who === "patient" && !plan) {
      if (status) status.textContent = "Sign in first.";
      return;
    }
    button.disabled = true;
    if (status) status.textContent = "Reading this device…";
    try {
      const next = await pullLiveCalendar(true);
      if (status) status.textContent = calendarPackStatus(who === "clinician" ? clinicianCalendarOf(next || plan) : patientCalendarOf(next || plan));
      if (after) after(next || plan);
    } catch (err) {
      if (status) status.textContent = "Could not read this device's calendar.";
    }
    button.disabled = false;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  try { wireMailKaleBox(); } catch (_) { /* overlay not ready */ }
});

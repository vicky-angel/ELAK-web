ObjC.import("EventKit");
ObjC.import("Foundation");

function two(n) {
  n = Number(n) || 0;
  return (n < 10 ? "0" : "") + String(n);
}

function unwrap(value) {
  if (value == null) return "";
  try {
    const text = ObjC.unwrap(value);
    return text == null ? "" : String(text);
  } catch (err) {
    return String(value);
  }
}

function argvList() {
  return (ObjC.deepUnwrap($.NSProcessInfo.processInfo.arguments) || []).map(String);
}

function isoFromDate(date) {
  if (!date) return "";
  const cal = $.NSCalendar.currentCalendar;
  const units = $.NSCalendarUnitYear | $.NSCalendarUnitMonth | $.NSCalendarUnitDay |
    $.NSCalendarUnitHour | $.NSCalendarUnitMinute | $.NSCalendarUnitSecond;
  const c = cal.componentsFromDate(units, date);
  return Number(c.year) + "-" + two(c.month) + "-" + two(c.day) + "T" +
    two(c.hour) + ":" + two(c.minute) + ":" + two(c.second);
}

function dateFromParts(y, mo, d, h, mi) {
  const comps = $.NSDateComponents.alloc.init;
  comps.year = y;
  comps.month = mo;
  comps.day = d;
  comps.hour = h;
  comps.minute = mi;
  comps.second = 0;
  return $.NSCalendar.currentCalendar.dateFromComponents(comps);
}

function ensureAccess(store) {
  const status = Number($.EKEventStore.authorizationStatusForEntityType($.EKEntityTypeEvent));
  if (status === 3 || status === 5) return true;
  let done = false;
  try {
    store.requestFullAccessToEventsWithCompletion($(function () { done = true; }));
  } catch (err) {
    try {
      store.requestAccessToEntityTypeCompletion($.EKEntityTypeEvent, $(function () { done = true; }));
    } catch (err2) {
      return status >= 3;
    }
  }
  const deadline = Date.now() + 4000;
  while (!done && Date.now() < deadline) {
    $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.15));
  }
  const after = Number($.EKEventStore.authorizationStatusForEntityType($.EKEntityTypeEvent));
  return after === 3 || after === 4 || after === 5;
}

function eventCals(store) {
  const all = store.calendarsForEntityType($.EKEntityTypeEvent);
  const kept = $.NSMutableArray.alloc.init;
  const n = Number(all.count);
  for (let i = 0; i < n; i++) {
    const cal = all.objectAtIndex(i);
    const name = unwrap(cal.title);
    if (/birthday|holiday/i.test(name)) continue;
    try {
      if (Number(cal.type) === Number($.EKCalendarTypeBirthday)) continue;
    } catch (err) { /* older EventKit builds omit type */ }
    kept.addObject(cal);
  }
  return kept;
}

function destCalendars(store) {
  const cals = eventCals(store);
  function hidden(cal) {
    return /^ELAK$/i.test(unwrap(cal && cal.title));
  }
  const found = [];
  const seen = {};
  const start = $.NSDate.dateWithTimeIntervalSinceNow(-21 * 86400);
  const end = $.NSDate.dateWithTimeIntervalSinceNow(21 * 86400);
  if (Number(cals.count)) {
    const pred = store.predicateForEventsWithStartDateEndDateCalendars(start, end, cals);
    const evs = store.eventsMatchingPredicate(pred);
    const hits = [];
    for (let i = 0; i < Number(evs.count); i++) {
      const ev = evs.objectAtIndex(i);
      const title = unwrap(ev.title);
      const notes = unwrap(ev.notes);
      const uid = unwrap(ev.eventIdentifier);
      const cal = ev.calendar;
      if (!cal || hidden(cal)) continue;
      if (/ELAK|next visit/i.test(title) || /elak:/i.test(notes) || /elak-/i.test(uid)) continue;
      if (!/^life(\b|[.\s]|$)/i.test(title)) continue;
      let at = 0;
      try { at = Number(ev.startDate.timeIntervalSince1970); } catch (err) { at = 0; }
      hits.push({ cal: cal, at: at, id: unwrap(cal.calendarIdentifier) });
    }
    hits.sort(function (a, b) { return b.at - a.at; });
    for (let i = 0; i < hits.length; i++) {
      if (!hits[i].id || seen[hits[i].id]) continue;
      seen[hits[i].id] = true;
      found.push(hits[i].cal);
    }
  }
  if (found.length) return found;
  const def = store.defaultCalendarForNewEvents;
  if (def && !hidden(def)) return [def];
  for (let i = 0; i < Number(cals.count); i++) {
    const cal = cals.objectAtIndex(i);
    if (!hidden(cal)) return [cal];
  }
  return def ? [def] : [];
}

function destCalendar(store) {
  const dests = destCalendars(store);
  return dests.length ? dests[0] : null;
}

function readEvents() {
  const store = $.EKEventStore.alloc.init;
  ensureAccess(store);
  const start = $.NSDate.dateWithTimeIntervalSinceNow(-7 * 86400);
  const end = $.NSDate.dateWithTimeIntervalSinceNow(60 * 86400);
  const cals = eventCals(store);
  if (!Number(cals.count)) return { ok: true, source: "eventkit", events: [] };
  const pred = store.predicateForEventsWithStartDateEndDateCalendars(start, end, cals);
  const evs = store.eventsMatchingPredicate(pred);
  const rows = [];
  const n = Number(evs.count);
  for (let i = 0; i < n; i++) {
    const ev = evs.objectAtIndex(i);
    rows.push({
      title: unwrap(ev.title) || "Busy",
      start: isoFromDate(ev.startDate),
      end: isoFromDate(ev.endDate),
      allDay: !!ev.isAllDay,
      uid: unwrap(ev.eventIdentifier),
      rrule: ""
    });
  }
  rows.sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); });
  return { ok: true, source: "eventkit", events: rows };
}

function loadPayload(raw) {
  const text = String(raw || "").trim();
  if (!text) return { tag: "elak", events: [] };
  if (text.charAt(0) === "{") return JSON.parse(text);
  const file = $.NSString.stringWithContentsOfFileEncodingError(text, $.NSUTF8StringEncoding, null);
  return JSON.parse(unwrap(file) || "{}");
}

function writeEvents(payload) {
  const store = $.EKEventStore.alloc.init;
  ensureAccess(store);
  const tag = String((payload && payload.tag) || "elak");
  const rawEvents = (payload && payload.events) || [];
  const events = [];
  const seen = {};
  for (let i = 0; i < rawEvents.length; i++) {
    const item = rawEvents[i] || {};
    const key = String(item.title || "").toLowerCase() + "|" + String(item.start || "").slice(0, 16);
    if (!item.start || seen[key]) continue;
    seen[key] = true;
    events.push(item);
  }
  const dests = destCalendars(store);
  if (!dests.length) return { ok: false, reason: "no-calendar", written: 0 };
  const start = $.NSDate.dateWithTimeIntervalSinceNow(-90 * 86400);
  const end = $.NSDate.dateWithTimeIntervalSinceNow(180 * 86400);
  const scan = eventCals(store);
  const pred = store.predicateForEventsWithStartDateEndDateCalendars(start, end, scan);
  const existing = store.eventsMatchingPredicate(pred);
  const n = Number(existing.count);
  for (let i = 0; i < n; i++) {
    const ev = existing.objectAtIndex(i);
    const notes = unwrap(ev.notes) || "";
    const title = unwrap(ev.title) || "";
    if (notes.indexOf("elak:") >= 0 || notes.indexOf(tag) >= 0 || /ELAK/i.test(title) || /next visit/i.test(title)) {
      store.removeEventSpanCommitError(ev, $.EKSpanThisEvent, false, null);
    }
  }
  store.commit(null);
  function localParts(stamp) {
    const raw = String(stamp || "");
    if (/[zZ]|[+\-]\d{2}:?\d{2}/.test(raw)) {
      const dt = new Date(raw);
      if (!Number.isNaN(dt.getTime())) {
        return [dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), dt.getHours(), dt.getMinutes()];
      }
    }
    const sm = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    return sm ? [Number(sm[1]), Number(sm[2]), Number(sm[3]), Number(sm[4]), Number(sm[5])] : null;
  }
  let written = 0;
  for (let i = 0; i < events.length; i++) {
    const item = events[i] || {};
    const sm = localParts(item.start);
    if (!sm) continue;
    const em = localParts(item.end || item.start) || sm;
    const ev = $.EKEvent.eventWithEventStore(store);
    ev.title = item.title || "ELAK";
    ev.startDate = dateFromParts(sm[0], sm[1], sm[2], sm[3], sm[4]);
    ev.endDate = dateFromParts(em[0], em[1], em[2], em[3], em[4]);
    ev.notes = ((item.notes || "") + "\n" + tag).trim();
    ev.calendar = dests[0];
    if (store.saveEventSpanCommitError(ev, $.EKSpanThisEvent, false, null)) written += 1;
  }
  store.commit(null);
  return { ok: true, source: "eventkit", written: written, tag: tag };
}

const args = argvList();
const writeAt = args.lastIndexOf("write");
const cmd = writeAt >= 0 && writeAt < args.length - 1 ? "write" : "read";

try {
  if (cmd === "write") {
    console.log(JSON.stringify(writeEvents(loadPayload(args[writeAt + 1]))));
  } else {
    console.log(JSON.stringify(readEvents()));
  }
} catch (err) {
  console.log(JSON.stringify({ ok: false, reason: "eventkit", detail: String(err) }));
}

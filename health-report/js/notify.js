const REPORTS_KEY = "elak-health-reports-v1";
const INBOX_KEY = "elak-inbox-v1";

export function reportKey(plan) {
  return (plan && (plan.username || plan.code)) || "";
}

export function readHealthReports() {
  try {
    return JSON.parse(localStorage.getItem(REPORTS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function reportItems(entry) {
  if (!entry) return [];
  if (Array.isArray(entry)) return entry.filter((item) => item && item.text);
  if (Array.isArray(entry.items)) return entry.items.filter((item) => item && item.text);
  if (entry.text) return [entry];
  return [];
}

export function readSavedReports(plan) {
  const key = reportKey(plan);
  if (!key) return [];
  return reportItems(readHealthReports()[key]).slice().sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}

export function readSavedReport(plan) {
  return readSavedReports(plan)[0] || null;
}

function writeInboxDirect(plan, note) {
  let box;
  try {
    box = JSON.parse(localStorage.getItem(INBOX_KEY) || '{"clinic":[],"patients":{}}');
  } catch {
    box = { clinic: [], patients: {} };
  }
  if (!box.clinic) box.clinic = [];
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    patient: note.patient || "",
    username: (plan && plan.username) || "",
    type: "health-report",
    subject: note.subject || "",
    body: note.body || "",
    healthId: note.healthId || "",
    read: false
  };
  box.clinic.unshift(item);
  localStorage.setItem(INBOX_KEY, JSON.stringify(box));
  return item;
}

export function notifyHealthReport(plan, text, health) {
  const key = reportKey(plan);
  if (!key || !text) return null;
  const reports = readHealthReports();
  const items = reportItems(reports[key]);
  const next = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    at: new Date().toISOString(),
    healthId: (health && health.patient_id) || "",
    patient: (plan && plan.patient) || ""
  };
  const latest = items[0];
  const fresh = latest && latest.at && (Date.now() - new Date(latest.at).getTime()) < 120000;
  const list = fresh ? [Object.assign({}, latest, next, { id: latest.id || next.id }), ...items.slice(1)] : [next, ...items];
  reports[key] = {
    patient: (plan && plan.patient) || (list[0] && list[0].patient) || "",
    items: list
  };
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));

  const note = {
    type: "health-report",
    patient: (plan && plan.patient) || "",
    subject: "Health report · " + ((plan && plan.patient) || "Patient"),
    body: text,
    healthId: (health && health.patient_id) || ""
  };

  let item = null;
  if (!fresh) {
    if (typeof pushInbox === "function") {
      item = pushInbox("clinic", (plan && plan.username) || "", note);
    } else {
      item = writeInboxDirect(plan, note);
    }
  }

  try {
    window.parent.postMessage({
      type: "elak-health-report",
      username: (plan && plan.username) || "",
      patient: note.patient
    }, "*");
  } catch {
    /* ignore */
  }
  if (typeof paintNotesDot === "function") paintNotesDot();
  if (typeof sendDesktopNotice === "function" && !fresh) {
    sendDesktopNotice(note.subject, ((plan && plan.patient) || "") + " · new health report");
  }
  return item;
}

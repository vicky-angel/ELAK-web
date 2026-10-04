import { getConfig } from "./config.js?v=1";
import { loadPatients, loadClinicPlan, matchHealthPatient, rememberHealthId, bindClinicName } from "./data.js?v=1";
import { lineChart, scatterChart, sparkline, disposeCharts, hexToRgba } from "./charts.js?v=1";
import { generateHealthReport, readSavedReport, englishRecord } from "./engine.js?v=5";

const detailEl = document.getElementById("detail");
let patients = [];

const genderLabel = (g) => g || "—";

/* ── 指标定义 ─────────────────────────────── */
const M = (label, color, unit, dec, get, betterDown = false) => ({
  label, color, unit, dec, get, betterDown,
});

const METRICS = {
  accuracy: M("Exercise accuracy", "#34c759", "%", 1, (d) => d.rehab?.exercise_accuracy_pct),
  pain: M("Pain (VAS)", "#ff3b30", "", 1, (d) => d.rehab?.pain_vas, true),
  rating: M("Self rating", "#ff9500", "/5", 1, (d) => d.rehab?.patient_self_rating),
  asymmetry: M("Gait asymmetry", "#007aff", "%", 2, (d) => d.gait?.walking_asymmetry_pct, true),
  speed: M("Walking speed", "#34c759", "m/s", 2, (d) => d.gait?.walking_speed_mps),
  cadence: M("Cadence", "#ff9500", "steps/min", 1, (d) => d.gait?.cadence_steps_per_min),
  double_support: M("Double support", "#af52de", "%", 1, (d) => d.gait?.double_support_pct, true),
  resting_hr: M("Resting heart rate", "#ff3b30", "bpm", 0, (d) => d.cardiac?.resting_hr_bpm, true),
  walking_hr: M("Walking heart rate", "#ff2d55", "bpm", 0, (d) => d.cardiac?.walking_hr_bpm, true),
  hrv: M("HRV", "#af52de", "ms", 1, (d) => d.cardiac?.hrv_ms),
  sleep: M("Sleep duration", "#5856d6", "h", 1, (d) => d.sleep?.total_sleep_hours),
  spo2: M("Blood oxygen", "#5ac8fa", "%", 0, (d) => d.respiratory_metabolic?.oxygen_saturation_pct),
  body_mass: M("Weight", "#ff9500", "kg", 1, (d) => d.body_measurements?.body_mass_kg),
  steps: M("Steps", "#34c759", "", 0, (d) => d.activity_rings?.step_count),
  move_kcal: M("Active energy", "#ff3b30", "kcal", 0, (d) => d.activity_rings?.move_kcal),
};

const HIGHLIGHT_KEYS = ["pain", "accuracy", "asymmetry", "speed", "resting_hr", "sleep"];

const CHART_SECTIONS = [
  { title: "Rehab training", keys: ["accuracy", "pain", "rating"] },
  { title: "Gait", keys: ["asymmetry", "speed", "cadence", "double_support"] },
  { title: "Heart", keys: ["resting_hr", "walking_hr", "hrv"] },
  { title: "Sleep and vitals", keys: ["sleep", "spo2", "body_mass"] },
  { title: "Activity", keys: ["steps", "move_kcal"] },
];

/* ── 工具 ─────────────────────────────────── */
const isNum = (v) => typeof v === "number" && !isNaN(v);
const fmt = (v, dec) => (isNum(v) ? v.toFixed(dec) : "—");

function series(p, key) {
  return p.daily_records.map((d) => METRICS[key].get(d));
}

function hasData(vals) {
  return vals.some(isNum);
}

/* 图表注册表（每次渲染重置） */
let chartSpecs = {};
let chartSeq = 0;

/* ── 处方动作：聚合出该患者开过哪些动作 ── */
function buildExerciseData(p) {
  const map = new Map();
  for (const d of p.daily_records) {
    for (const e of d.assigned_exercises || []) {
      let o = map.get(e.exercise_name);
      if (!o) {
        o = {
          name: e.exercise_name,
          target_area: e.target_area,
          category: e.category,
          difficulty: e.difficulty_level,
          prescribed_reps: e.prescribed_reps,
          prescribed_sets: e.prescribed_sets,
          days: 0,
          doneDays: 0,
        };
        map.set(e.exercise_name, o);
      }
      o.days++;
      if (e.completed_reps > 0) o.doneDays++;
    }
  }
  return [...map.values()];
}

/* 动作专属量化字段的显示元数据 */
const EX_METRIC_META = {
  inversion_rom_deg: { label: "Inversion range", unit: "°", dec: 1 },
  eversion_rom_deg: { label: "Eversion range", unit: "°", dec: 1 },
  ankle_rom_deg: { label: "Ankle range", unit: "°", dec: 1 },
  rom_3d_deg: { label: "3D range", unit: "°", dec: 1 },
  resistance_torque_nm: { label: "Resistance torque", unit: "N·m", dec: 1 },
  angular_velocity_deg_s: { label: "Angular velocity", unit: "°/s", dec: 1 },
  completion_time_sec: { label: "Completion time", unit: "s", dec: 2 },
  trajectory_smoothness: { label: "Trajectory smoothness", unit: "", dec: 2 },
  smoothness_score: { label: "Smoothness score", unit: "", dec: 1 },
  safety_control_score: { label: "Safety control score", unit: "", dec: 1 },
  peroneal_emg_uv: { label: "Peroneal EMG", unit: "µV", dec: 1 },
  tibialis_anterior_emg_uv: { label: "Tibialis anterior EMG", unit: "µV", dec: 1 },
  dorsiflexion_hold_time_sec: { label: "Dorsiflexion hold", unit: "s", dec: 2 },
  compensation_flag: { label: "Compensation", unit: "", dec: 0 },
  vgrf_newton: { label: "Vertical ground reaction", unit: "N", dec: 0 },
  plantar_pressure_pct: { label: "Plantar pressure share", unit: "%", dec: 1 },
  fatigue_decay_pct: { label: "Fatigue decay", unit: "%", dec: 1 },
  symmetry_index_pct: { label: "Symmetry index", unit: "%", dec: 1 },
};

const EX_PALETTE = ["#5ac8fa", "#af52de", "#ff9500", "#ff2d55", "#5856d6", "#34c759"];

const prettyKey = (k) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/* 收集某动作出现过的专属量化字段 */
function exMetricKeys(days, name) {
  const seen = new Set();
  for (const d of days) {
    for (const e of d.assigned_exercises || []) {
      if (e.exercise_name === name && e.metrics) {
        for (const k of Object.keys(e.metrics)) seen.add(k);
      }
    }
  }
  return [...seen];
}

/* 每个动作各自的量化指标（通用 + 动作专属） */
function exerciseSpecs(ex, days) {
  const find = (d) =>
    (d.assigned_exercises || []).find((x) => x.exercise_name === ex.name) || null;

  const generic = [
    {
      label: "Accuracy", color: "#34c759", unit: "%", dec: 1, type: "line",
      get: (d) => {
        const e = find(d);
        // 未做（完成 0）或准确率 0 视为该天不存在
        return e && e.completed_reps > 0 && isNum(e.accuracy_pct) && e.accuracy_pct > 0
          ? e.accuracy_pct
          : null;
      },
    },
    {
      label: "Completion rate", color: "#007aff", unit: "%", dec: 1, type: "scatter",
      get: (d) => {
        const e = find(d);
        return e && e.prescribed_reps ? (e.completed_reps / e.prescribed_reps) * 100 : null;
      },
    },
    {
      label: "Completed reps", color: "#5856d6", unit: "", dec: 0, type: "scatter",
      get: (d) => {
        const e = find(d);
        return e ? e.completed_reps : null;
      },
    },
    {
      label: "Pain during exercise", color: "#ff3b30", unit: "", dec: 1, type: "line",
      get: (d) => {
        const e = find(d);
        return e && isNum(e.pain_during_exercise) ? e.pain_during_exercise : null;
      },
    },
  ];

  const specific = exMetricKeys(days, ex.name).map((k, i) => {
    const meta = EX_METRIC_META[k] || { label: prettyKey(k), unit: "", dec: 1 };
    const isFlag = k === "compensation_flag";
    return {
      label: meta.label,
      color: EX_PALETTE[i % EX_PALETTE.length],
      unit: meta.unit,
      dec: meta.dec,
      type: isFlag ? "scatter" : "line",
      get: (d) => {
        const e = find(d);
        const m = e && e.metrics;
        if (!m || !(k in m)) return null;
        const v = m[k];
        if (isFlag) return v === true ? 1 : v === false ? 0 : null;
        return isNum(v) ? v : null;
      },
    };
  });

  return [...generic, ...specific];
}

function ringSVG(rings) {
  const radii = [52, 38, 24];
  const width = 11;
  const arcs = rings
    .map((r, i) => {
      const frac = Math.max(0, Math.min(1, r.value / r.goal));
      return `
        <circle cx="70" cy="70" r="${radii[i]}" fill="none"
          stroke="${hexToRgba(r.color, 0.16)}" stroke-width="${width}"/>
        <circle cx="70" cy="70" r="${radii[i]}" fill="none"
          stroke="${r.color}" stroke-width="${width}" stroke-linecap="round"
          pathLength="100" stroke-dasharray="${(frac * 100).toFixed(1)} 100"
          transform="rotate(-90 70 70)"/>`;
    })
    .join("");
  return `<svg class="rings" viewBox="0 0 140 140">${arcs}</svg>`;
}

/* ── 详情渲染 ─────────────────────────────── */
function highlightCard(p, key) {
  const m = METRICS[key];
  const vals = series(p, key);
  const last = vals[vals.length - 1];
  const first = vals.find((v) => typeof v === "number" && !isNaN(v));
  const delta = typeof last === "number" && typeof first === "number" ? last - first : null;

  let deltaHtml = "";
  if (delta != null && Math.abs(delta) > 1e-9) {
    const good = m.betterDown ? delta < 0 : delta > 0;
    const arrow = delta > 0 ? "▲" : "▼";
    deltaHtml = `<div class="hl__foot">
      <span class="hl__delta" style="color:${good ? "#34c759" : "#ff3b30"}">
        ${arrow} ${fmt(Math.abs(delta), m.dec)}${m.unit}
      </span></div>`;
  }

  return `<div class="hl">
    <div class="hl__label" style="color:${m.color}">${m.label}</div>
    <div class="hl__value">${fmt(last, m.dec)}<span class="hl__unit">${m.unit}</span></div>
    ${deltaHtml || `<div class="hl__foot"></div>`}
    ${sparkline(vals, m.color)}
  </div>`;
}

function metricRow(label, value, extra = "") {
  if (value === null || value === undefined || String(value).includes("—")) return "";
  return `<div class="metric-row"><span class="k">${label}</span>
    <span class="v">${value}${extra}</span></div>`;
}

function valueTable(days, m) {
  const rows = days
    .map((d) => ({ date: d.date, v: m.get(d) }))
    .filter((r) => isNum(r.v));
  return `<div class="table-wrap">
    <table class="dtable">
      <thead><tr><th>Date</th><th>${m.label}${m.unit ? ` (${m.unit})` : ""}</th></tr></thead>
      <tbody>
        ${rows
          .map((r) => `<tr><td>${r.date}</td><td>${fmt(r.v, m.dec)}</td></tr>`)
          .join("")}
      </tbody>
    </table>
  </div>`;
}

function metricPanel(days, m, type = "line") {
  const values = days.map((d) => m.get(d));
  if (!hasData(values)) return "";
  const id = `c${chartSeq++}`;
  chartSpecs[id] = { dates: days.map((d) => d.date), values, color: m.color, unit: m.unit, type };
  return `<div class="card metric-panel">
    <h3><span class="dot" style="background:${m.color}"></span>${m.label}</h3>
    <div class="metric-panel__body">
      ${valueTable(days, m)}
      <div class="chart" data-chart="${id}"></div>
    </div>
  </div>`;
}

/* ── AI 临床分析 ─────────────────────────── */
const AI_METRIC_KEYS = [
  "pain", "accuracy", "rating", "asymmetry", "speed", "cadence", "double_support",
  "resting_hr", "walking_hr", "hrv", "sleep", "spo2", "body_mass", "steps", "move_kcal",
];


function seriesPoints(p, get) {
  const pts = [];
  p.daily_records.forEach((d) => {
    const v = get(d);
    if (isNum(v)) pts.push({ date: d.date, v });
  });
  return pts;
}

function stats(pts) {
  if (!pts.length) return null;
  const vals = pts.map((x) => x.v);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  return {
    n: vals.length, mean, sd,
    min: Math.min(...vals), max: Math.max(...vals),
    first: vals[0], last: vals[vals.length - 1],
  };
}

function outliers(pts, k = 1.8) {
  const s = stats(pts);
  if (!s || s.sd === 0 || pts.length < 5) return [];
  return pts.filter((x) => Math.abs(x.v - s.mean) > k * s.sd);
}

function trendOf(pts) {
  const s = stats(pts);
  if (!s || pts.length < 2) return null;
  const delta = s.last - s.first;
  const pct = s.first !== 0 ? delta / Math.abs(s.first) : 0;
  const dir = Math.abs(pct) < 0.05 ? "stable" : delta > 0 ? "up" : "down";
  return { dir, s };
}

function alignByDate(p, getA, getB) {
  const A = [], B = [];
  for (const d of p.daily_records) {
    const a = getA(d), b = getB(d);
    if (isNum(a) && isNum(b)) { A.push(a); B.push(b); }
  }
  return [A, B];
}

function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 4) return null;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  if (!da || !db) return null;
  return num / Math.sqrt(da * db);
}

function exerciseAdherence(p) {
  return buildExerciseData(p).map((ex) => {
    let accSum = 0, accN = 0, rateSum = 0, rateN = 0, painSum = 0, painN = 0;
    for (const d of p.daily_records) {
      const e = (d.assigned_exercises || []).find((x) => x.exercise_name === ex.name);
      if (!e) continue;
      if (e.completed_reps > 0 && isNum(e.accuracy_pct)) { accSum += e.accuracy_pct; accN++; }
      if (e.prescribed_reps) { rateSum += (e.completed_reps / e.prescribed_reps) * 100; rateN++; }
      if (isNum(e.pain_during_exercise)) { painSum += e.pain_during_exercise; painN++; }
    }
    return {
      name: ex.name, category: ex.category,
      prescribedDays: ex.days, doneDays: ex.doneDays,
      avgAccuracy: accN ? accSum / accN : null,
      avgCompletion: rateN ? rateSum / rateN : null,
      avgPain: painN ? painSum / painN : null,
    };
  });
}

function buildAIContext(p) {
  const L = [];
  L.push(`Patient ${p.name} (${p.patient_id} / ${p.medical_record_number}), age ${p.age}, ${genderLabel(p.gender)}, BMI ${p.bmi}, foot posture ${p.foot_posture}, condition ${p.condition}, rehab path ${p.rehab_trajectory}, Apple Watch: ${p.has_apple_watch ? "yes" : "no"}.`);
  const rec = englishRecord(p, p.latest_medical_record);
  if (rec) {
    L.push(`\n[Latest record ${rec.visit_date}]`);
    L.push(`S subjective: ${rec.subjective}`);
    L.push(`O objective: ${rec.objective}`);
    L.push(`A assessment: ${rec.assessment}`);
    L.push(`P plan: ${rec.plan}`);
    L.push(`Prescribed exercises: ` + (rec.prescribed_exercises || [])
      .map((e) => `${e.name} (${e.target_area}, ${e.category}, difficulty ${e.difficulty}, ${e.base_reps}×${e.base_sets})`)
      .join("; "));
  }
  L.push(`\n[Exercise adherence, 30 days]`);
  for (const a of exerciseAdherence(p)) {
    L.push(
      `- ${a.name}: prescribed ${a.prescribedDays} days, completed ${a.doneDays} days; ` +
      `mean accuracy ${a.avgAccuracy != null ? a.avgAccuracy.toFixed(1) + "%" : "—"}, ` +
      `mean completion ${a.avgCompletion != null ? a.avgCompletion.toFixed(1) + "%" : "—"}, ` +
      `mean pain during exercise ${a.avgPain != null ? a.avgPain.toFixed(1) : "—"}`
    );
  }
  L.push(`\n[Daily metric series (date:value)]`);
  for (const k of AI_METRIC_KEYS) {
    const m = METRICS[k];
    const pts = seriesPoints(p, m.get);
    if (!pts.length) continue;
    const s = stats(pts);
    L.push(
      `- ${m.label}${m.unit ? `(${m.unit})` : ""}: mean ${s.mean.toFixed(2)}, first ${s.first.toFixed(2)}→last ${s.last.toFixed(2)}, range ${s.min.toFixed(2)}-${s.max.toFixed(2)}; series ` +
      pts.map((x) => `${x.date.slice(5)}:${x.v.toFixed(1)}`).join(" ")
    );
  }
  return L.join("\n");
}

function buildAIMessages(p) {
  const sys =
    "You are a rehabilitation clinician writing a short evidence-based report for a physiotherapist.\n" +
    "1. Use the SOAP note and prescribed exercises first to judge whether rehab goals and adherence were met.\n" +
    "2. Do not list every metric. Group related measures that should move together.\n" +
    "3. Explain what up, down, or worse trends mean.\n" +
    "4. Flag outliers or unusual periods and give a likely reason.\n" +
    "5. Check pairs that should move together (pain down with accuracy and walking speed up and gait asymmetry down; more sleep with lower resting heart rate and higher HRV; more steps with more active energy). If they diverge, say why.\n" +
    "6. Interpret findings with the patient's age and sex in mind.\n" +
    "7. Write in English with short sections: Conclusion / Trends / Outliers / Linked metrics / Advice. Keep it 200–350 words. Output the report only.";
  return [
    { role: "system", content: sys },
    { role: "user", content: buildAIContext(p) },
  ];
}

function localAnalysis(p) {
  const out = [];
  const rec = englishRecord(p, p.latest_medical_record);
  const adh = exerciseAdherence(p);
  const totalPres = adh.reduce((a, x) => a + x.prescribedDays, 0);
  const totalDone = adh.reduce((a, x) => a + x.doneDays, 0);
  const overall = totalPres ? Math.round((totalDone / totalPres) * 100) : 0;

  out.push("Conclusion");
  out.push(`Over 30 days, ${totalPres} prescribed exercise-days were set and ${totalDone} were completed (about ${overall}% adherence).`);
  const ranked = adh.filter((x) => x.prescribedDays >= 3)
    .sort((a, b) => a.doneDays / a.prescribedDays - b.doneDays / b.prescribedDays);
  if (ranked[0] && ranked[0].doneDays === 0) {
    out.push(`${ranked[0].name} was not completed on any of those days, so the plan was not met.`);
  } else if (ranked[0]) {
    out.push(`The weakest completion was ${ranked[0].name} (${ranked[0].doneDays}/${ranked[0].prescribedDays} days).`);
  }
  if (rec) out.push(`Assessment from the record: ${rec.assessment}`);

  out.push("\nTrends");
  for (const k of ["pain", "accuracy", "asymmetry", "speed", "resting_hr", "sleep"]) {
    const m = METRICS[k];
    const pts = seriesPoints(p, m.get);
    const t = trendOf(pts);
    if (!t) continue;
    const good = m.betterDown ? t.dir === "down" : t.dir === "up";
    const tag = t.dir === "stable" ? ", staying steady" : good ? ", a helpful direction" : ", an unhelpful direction";
    out.push(`- ${m.label}: ${t.s.first.toFixed(1)} → ${t.s.last.toFixed(1)} (${t.dir})${tag}`);
  }

  out.push("\nOutliers");
  let anyOut = false;
  for (const k of ["pain", "asymmetry", "resting_hr", "sleep", "speed"]) {
    const m = METRICS[k];
    const pts = seriesPoints(p, m.get);
    const os = outliers(pts);
    if (os.length) {
      anyOut = true;
      out.push(`- ${m.label} outliers: ` + os.map((o) => `${o.date.slice(5)} (${o.v.toFixed(1)})`).join(", "));
    }
  }
  if (!anyOut) out.push("- No clear points beyond ±1.8σ.");

  out.push("\nLinked metrics");
  const pairs = [
    { a: "pain", b: "accuracy", expect: "inverse", expectSign: -1, note: "higher pain usually means lower accuracy" },
    { a: "asymmetry", b: "speed", expect: "inverse", expectSign: -1, note: "less gait asymmetry usually means faster walking" },
    { a: "sleep", b: "resting_hr", expect: "inverse", expectSign: -1, note: "more sleep usually means a lower resting heart rate" },
    { a: "steps", b: "move_kcal", expect: "together", expectSign: 1, note: "steps and active energy should rise together" },
  ];
  let anyCorr = false;
  for (const pr of pairs) {
    const [A, B] = alignByDate(p, METRICS[pr.a].get, METRICS[pr.b].get);
    const r = pearson(A, B);
    if (r == null) continue;
    const ok = Math.sign(r) === pr.expectSign;
    if (!ok && Math.abs(r) >= 0.3) {
      anyCorr = true;
      out.push(`- ${METRICS[pr.a].label} and ${METRICS[pr.b].label} should move ${pr.expect}; measured r=${r.toFixed(2)} diverges (${pr.note}).`);
    }
  }
  if (!anyCorr) out.push("- Main metric pairs moved in the expected direction.");

  out.push("\nAdvice");
  out.push("Review the least-completed exercises and the unusual days above, then adjust dose with pain scores and book follow-up.");
  return out.join("\n");
}

function aiBoxHtml() {
  return `<div class="ai-box" id="ai-box">
    <div class="ai-box__head">
      <span class="ai-box__badge">AI</span>
      <span class="ai-box__title">Health report</span>
      <span class="ai-box__status" id="ai-status"></span>
      <button class="ai-box__btn" id="ai-run" type="button">Regenerate</button>
    </div>
    <div class="ai-box__body" id="ai-output"></div>
  </div>`;
}

function renderMD(text) {
  if (window.marked && typeof window.marked.parse === "function") {
    window.marked.setOptions({ breaks: true, gfm: true });
    try {
      return window.marked.parse(text);
    } catch {
      /* fall through */
    }
  }
  return String(text)
    .replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))
    .replace(/\n/g, "<br>");
}

function clinicPlanFor(health) {
  const q = new URLSearchParams(location.search);
  const user = q.get("user") || q.get("username");
  if (user) return loadClinicPlan(user);
  const plans = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem("full-range-plans-v1") || "{}");
      return Object.values(raw.plans || {});
    } catch {
      return [];
    }
  })();
  return plans.find((plan) => plan.healthId === health.patient_id)
    || plans.find((plan) => String(plan.patient || "").toLowerCase() === String(health.name || "").toLowerCase())
    || {
      code: health.patient_id,
      username: health.patient_id,
      patient: health.name || health.patient_id
    };
}

function runAI(p, plan) {
  const out = document.getElementById("ai-output");
  const btn = document.getElementById("ai-run");
  const statusEl = document.getElementById("ai-status");
  if (!out) return;

  let busy = false;
  const generate = async (force) => {
    if (busy) return;
    busy = true;
    if (btn) btn.disabled = true;
    if (!force) {
      const saved = readSavedReport(plan);
      if (saved && saved.text && !/[\u4e00-\u9fff]/.test(saved.text)) {
        out.innerHTML = renderMD(saved.text);
        if (statusEl) statusEl.textContent = "Saved";
        busy = false;
        if (btn) btn.disabled = false;
        return;
      }
    }
    if (statusEl) statusEl.textContent = "Generating…";
    out.innerHTML = `<span class="ai-loading">Writing the health report…</span>`;
    try {
      const result = await generateHealthReport(plan, {
        force,
        onToken: (_delta, full) => {
          out.innerHTML = renderMD(full);
          out.scrollTop = out.scrollHeight;
        }
      });
      out.innerHTML = renderMD(result.text);
      if (statusEl) statusEl.textContent = result.reused ? "Saved" : "Sent to Notifications";
    } catch (err) {
      if (err && err.name === "AbortError") return;
      out.textContent = (err && err.message) || "The health report could not be written.";
      if (statusEl) statusEl.textContent = "Could not generate";
    } finally {
      busy = false;
      if (btn) btn.disabled = false;
    }
  };

  if (btn) btn.onclick = () => generate(true);
  generate(false);
}

function renderDetail(p) {
  disposeCharts();
  chartSpecs = {};
  chartSeq = 0;

  const days = p.daily_records;
  const latest = days.at(-1);
  const hasRehab = days.some((d) => d.rehab);
  const completed = days.filter((d) => d.rehab?.exercise_completed).length;
  const adherence = days.length ? Math.round((completed / days.length) * 100) : 0;
  const rr = latest.activity_rings || {};

  const rings = [
    { label: "Active energy", value: rr.move_kcal, goal: rr.move_goal_kcal, color: "#ff3b30", unit: "kcal" },
    { label: "Exercise", value: rr.exercise_minutes, goal: rr.exercise_goal_minutes, color: "#34c759", unit: "min" },
    { label: "Stand", value: rr.stand_hours, goal: rr.stand_goal_hours, color: "#007aff", unit: "h" },
  ];

  const infoRows = [
    metricRow("Record number (MRN)", p.medical_record_number),
    metricRow("Condition", p.condition),
    metricRow("Age / sex", `${p.age} / ${genderLabel(p.gender)}`),
    metricRow("BMI", p.bmi),
    metricRow("Foot posture", p.foot_posture),
    metricRow("Device", p.has_apple_watch ? "Apple Watch" : "None (no heart or sleep data)"),
    metricRow("Rehab path", p.rehab_trajectory),
    p.baseline ? metricRow("Baseline pain", `${p.baseline.pain_vas}`) : "",
    p.baseline ? metricRow("Baseline walking speed", `${p.baseline.walking_speed_mps}`) : "",
  ];

  const statusRows = [
    hasRehab
      ? metricRow(
          "Today's exercise",
          latest.rehab.exercise_completed
            ? `<span class="pill pill--ok">Done</span>`
            : `<span class="pill pill--no">Not done</span>`
        )
      : "",
    hasRehab ? metricRow("Today's pain", `${fmt(latest.rehab.pain_vas, 1)} VAS`) : "",
    metricRow("Fatigue", `${fmt(latest.symptoms?.fatigue_level, 1)} / 10`),
    metricRow("Dizziness", latest.symptoms?.dizziness_reported ? "Yes" : "No"),
    metricRow("Resting heart rate", `${fmt(latest.cardiac?.resting_hr_bpm, 0)} bpm`),
    metricRow("Blood oxygen", `${fmt(latest.respiratory_metabolic?.oxygen_saturation_pct, 0)} %`),
    metricRow("Sleep", `${fmt(latest.sleep?.total_sleep_hours, 1)} h`),
    metricRow("Steps", `${fmt(latest.activity_rings?.step_count, 0)}`),
  ];

  const rec = englishRecord(p, p.latest_medical_record);
  const prescribed = (rec && rec.prescribed_exercises) || [];
  const prescribedCard = prescribed.length
    ? `<div class="card">
        <h3>This visit's exercises</h3>
        <div class="table-wrap">
          <table class="dtable">
            <thead><tr><th>Exercise</th><th>Area</th><th>Type</th><th>Level</th><th>Dose</th></tr></thead>
            <tbody>
              ${prescribed
                .map(
                  (pe) => `<tr>
                <td class="td-name">${pe.name}</td>
                <td>${pe.target_area}</td>
                <td>${pe.category}</td>
                <td>${"●".repeat(pe.difficulty)}${"○".repeat(Math.max(0, 3 - pe.difficulty))}</td>
                <td>${pe.base_reps} × ${pe.base_sets}</td>
              </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>`
    : "";
  const medicalBlock = rec
    ? `
    <div class="section-title">Medical record · last visit (${rec.visit_date})</div>
    <div class="grid">
      <div class="card">
        <h3>SOAP note</h3>
        <div class="soap">
          <div class="soap__row"><span class="soap__k">S subjective</span><p>${rec.subjective}</p></div>
          <div class="soap__row"><span class="soap__k">O objective</span><p>${rec.objective}</p></div>
          <div class="soap__row"><span class="soap__k">A assessment</span><p>${rec.assessment}</p></div>
          <div class="soap__row"><span class="soap__k">P plan</span><p>${rec.plan}</p></div>
        </div>
      </div>
      ${prescribedCard}
    </div>`
    : "";

  const exs = buildExerciseData(p);
  const exBlock = exs.length
    ? `
    <div class="section-title">Rehab measures</div>
    <div class="card">
      <h3>Prescribed exercises</h3>
      <div class="table-wrap">
        <table class="dtable">
          <thead>
            <tr><th>Exercise</th><th>Area</th><th>Type</th><th>Level</th><th>Dose</th><th>Days set</th><th>Days done</th></tr>
          </thead>
          <tbody>
            ${exs
              .map(
                (ex) => `<tr>
              <td class="td-name">${ex.name}</td>
              <td>${ex.target_area}</td>
              <td>${ex.category}</td>
              <td>${"●".repeat(ex.difficulty)}${"○".repeat(Math.max(0, 3 - ex.difficulty))}</td>
              <td>${ex.prescribed_reps} × ${ex.prescribed_sets}</td>
              <td>${ex.days}</td>
              <td>${ex.doneDays}</td>
            </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
    ${exs
      .map(
        (ex) => `
      <div class="exercise-head">
        <span class="ex-title">${ex.name}</span>
        <span class="ex-meta">${ex.target_area} · ${ex.category} · level ${"●".repeat(ex.difficulty)}${"○".repeat(Math.max(0, 3 - ex.difficulty))} · dose ${ex.prescribed_reps}×${ex.prescribed_sets}</span>
      </div>
      <div class="panel-row">
        ${exerciseSpecs(ex, days).map((m) => metricPanel(days, m, m.type)).join("")}
      </div>`
      )
      .join("")}`
    : "";

  const trendHtml = CHART_SECTIONS.map((s) => {
    const panels = s.keys
      .map((k) => metricPanel(days, METRICS[k], "line"))
      .filter(Boolean);
    if (panels.length === 0) return "";
    return `
    <div class="section-title">${s.title}</div>
    <div class="panel-row">
      ${panels.join("")}
    </div>`;
  }).join("");

  detailEl.innerHTML = `
    <div class="patient-head">
      <h2>${p.name}</h2>
      <div class="meta">
        ${p.condition} · age ${p.age} · ${genderLabel(p.gender)} · BMI ${p.bmi}
        <span class="mrn">${p.medical_record_number}</span>
      </div>
    </div>

    ${aiBoxHtml()}

    <div class="section-title">Overview · latest day (${latest.date})</div>
    <div class="highlights">
      ${HIGHLIGHT_KEYS.filter((k) => hasData(series(p, k)))
        .map((k) => highlightCard(p, k))
        .join("")}
    </div>

    <div class="grid" style="margin-top:16px">
      <div class="card rings-card">
        ${ringSVG(rings)}
        <div class="rings__legend">
          ${rings
            .map(
              (r) => `<div class="rings__row">
              <span class="rings__k" style="color:${r.color}">${r.label}</span>
              <span class="rings__v">${r.value}<small> / ${r.goal} ${r.unit}</small></span>
            </div>`
            )
            .join("")}
        </div>
      </div>
      ${
        hasRehab
          ? `<div class="card">
        <h3>Rehab adherence</h3>
        <div class="rings__v" style="font-size:32px;margin:4px 0 8px">${adherence}%</div>
        ${metricRow("Days completed", `${completed} / ${days.length}`)}
        ${metricRow("Last 7 days", `${days.slice(-7).filter((d) => d.rehab?.exercise_completed).length} / 7`)}
        ${metricRow(
          "Mean accuracy",
          `${fmt(
            days.filter((d) => isNum(d.rehab?.exercise_accuracy_pct)).reduce((a, d) => a + d.rehab.exercise_accuracy_pct, 0) /
              Math.max(1, days.filter((d) => isNum(d.rehab?.exercise_accuracy_pct)).length),
            1
          )} %`
        )}
      </div>`
          : ""
      }
      <div class="card">
        <h3>Today's status</h3>
        <div class="metric-list">${statusRows.join("")}</div>
      </div>
      <div class="card">
        <h3>Patient information</h3>
        <div class="metric-list">${infoRows.join("")}</div>
      </div>
    </div>

    ${medicalBlock}

    ${exBlock}

    ${trendHtml}
  `;

  detailEl.querySelectorAll("[data-chart]").forEach((el) => {
    const spec = chartSpecs[el.dataset.chart];
    if (!spec) return;
    (spec.type === "scatter" ? scatterChart : lineChart)(el, spec);
  });

  runAI(p, clinicPlanFor(p));
}

async function init() {
  patients = await loadPatients();
  const q = new URLSearchParams(location.search);
  const user = q.get("user") || q.get("username");
  const id = q.get("id");
  const plan = user ? loadClinicPlan(user) : null;
  let patient = id ? patients.find((p) => p.patient_id === id) : null;
  if (!patient && plan) patient = matchHealthPatient(plan, patients);
  if (patient && plan) {
    rememberHealthId(plan, patient.patient_id);
    patient = bindClinicName(patient, plan);
  }
  if (!patient) patient = patients[0];
  if (patient) renderDetail(patient);
  else detailEl.innerHTML = `<div class="placeholder">No health records found.</div>`;
}

init().catch((err) => {
  detailEl.innerHTML = `<div class="placeholder">${
    location.protocol === "file:"
      ? "Open this page through the ELAK local server."
      : "Could not load the health report: " + err.message
  }</div>`;
  console.error(`[ELAK] ${getConfig().appName}`, err);
});

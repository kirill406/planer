// Landing: segment variants, live demo on the real engine, funnel events
// and the waitlist form.
import { overdueMessage, startMessage } from "./coach.js";
import * as E from "./engine.js";
import { fmtClock, fmtSpan, fmtTimer, startOfDay } from "./format.js";
import { sessionId } from "./store.js";
import { S } from "./strings.js";
import { track } from "./track.js";

const L = S.landing;
const params = new URLSearchParams(location.search);
const segment = params.get("s") ?? "";

// ---------- segment variants (?s=events | ?s=adhd) ----------

const variant = L.hero[segment];
if (variant) {
  document.getElementById("hero-pill").textContent = variant.pill;
  document.getElementById("hero-title").textContent = variant.title;
  document.getElementById("hero-lead").textContent = variant.lead;
  const select = document.querySelector('#lead-form [name="segment"]');
  if (select?.querySelector(`option[value="${segment}"]`)) select.value = segment;
}

let referrer = "";
try {
  referrer = document.referrer ? new URL(document.referrer).host : "";
} catch {
  referrer = "";
}
track("landing_view", { s: segment || "none", ref: referrer || "direct" });

// ---------- funnel events ----------

document.addEventListener("click", (event) => {
  const cta = event.target.closest("[data-cta]");
  if (cta) track("cta_click", { place: cta.dataset.cta });

  const tierButton = event.target.closest("[data-tier]");
  if (!tierButton) return;
  const tier = tierButton.dataset.tier;
  track("pricing_click", { tier });
  if (tier === "free") return; // plain link to /app
  event.preventDefault();
  openSignup(tier);
});

function openSignup(tier) {
  const form = document.getElementById("lead-form");
  form.elements.tier.value = tier;
  const note = document.getElementById("tier-note");
  note.textContent = L.tierNote[tier] ?? "";
  note.hidden = !note.textContent;
  if (tier === "team" && form.elements.segment.value === "personal") {
    form.elements.segment.value = "events";
  }
  track("lead_form_open", { tier });
  document.getElementById("signup").scrollIntoView({ behavior: "smooth" });
  setTimeout(() => form.elements.email.focus({ preventScroll: true }), 500);
}

// ---------- waitlist form ----------

const form = document.getElementById("lead-form");
const statusEl = document.getElementById("form-status");
let formOpened = false;

form.addEventListener("focusin", () => {
  if (formOpened) return;
  formOpened = true;
  if (form.elements.tier.value === "none") track("lead_form_open", { tier: "none" });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = form.elements.email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showStatus(L.badEmail, "error");
    form.elements.email.focus();
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  showStatus(L.sending, "");
  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        segment: form.elements.segment.value,
        tier: form.elements.tier.value,
        comment: form.elements.comment.value.trim(),
        website: form.elements.website.value,
        session_id: sessionId(),
      }),
    });
    if (response.status === 422) {
      showStatus(L.badEmail, "error");
      return;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const card = form.closest(".signup");
    card.classList.add("done");
    document.getElementById("signup-title").textContent = L.sentTitle;
    document.getElementById("signup-sub").textContent = L.sent;
    document.getElementById("tier-note").hidden = true;
  } catch (error) {
    console.error("lead submit failed", error);
    showStatus(L.failed, "error");
  } finally {
    button.disabled = false;
  }
});

function showStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = `form-status ${kind}`;
}

// ---------- live demo: the real engine on a simulated morning ----------

const DEMO_PLANS = {
  default: {
    id: "demo",
    title: "Утро",
    anchor: "finish",
    time: "08:30",
    maxCompression: 0.5,
    items: [
      { id: "d1", title: "Душ", minutes: 10, fixed: false },
      { id: "d2", title: "Завтрак", minutes: 15, fixed: false },
      { id: "d3", title: "Сборы", minutes: 10, fixed: false },
      { id: "d4", title: "Дорога 🔒", minutes: 15, fixed: true },
    ],
  },
  events: {
    id: "demo-events",
    title: "Конференция",
    anchor: "start",
    time: "10:00",
    maxCompression: 0.25,
    items: [
      { id: "e1", title: "Открытие", minutes: 10, fixed: false },
      { id: "e2", title: "Доклад 1", minutes: 30, fixed: false },
      { id: "e3", title: "Кофе-брейк 🔒", minutes: 20, fixed: true },
      { id: "e4", title: "Доклад 2", minutes: 30, fixed: false },
    ],
  },
};
const DEMO_PLAN = DEMO_PLANS[segment] ?? DEMO_PLANS.default;
if (DEMO_PLANS[segment]) {
  document.querySelector(".demo-caption").textContent = L.demoCaption[segment];
}
const LATE_START = 6 * E.MINUTE;
const PACE = [0.95, 1.15, 0.8, 1]; // actual / allotted per item
const SPEED = 240; // virtual ms per real ms: a minute passes in 0.25 s
const TICK = 100;
const PAUSE_AT_END = 3500;

const demoEls = {
  status: document.getElementById("demo-status"),
  current: document.getElementById("demo-current"),
  meta: document.getElementById("demo-meta"),
  timer: document.getElementById("demo-timer"),
  coach: document.getElementById("demo-coach"),
  list: document.getElementById("demo-list"),
  finish: document.getElementById("demo-finish"),
};

let demo = null;

function resetDemo() {
  const todayBase = startOfDay(Date.now());
  const schedule = E.planSchedule(DEMO_PLAN, todayBase);
  const t0 = schedule.start + LATE_START;
  const run = E.createRun(DEMO_PLAN, { now: t0, todayBase, id: "demo" });
  demo = { run, now: t0, message: startMessage(run), doneAt: null };
}

function stepDemo() {
  if (demo.doneAt !== null) {
    if (Date.now() - demo.doneAt > PAUSE_AT_END) resetDemo();
    return;
  }
  demo.now += TICK * SPEED;
  let run = demo.run;
  const item = run.items[run.current];
  const finishAt = item.startedAt + item.allotted * PACE[run.current];
  if (demo.now >= finishAt) {
    run = E.finishItem(run, finishAt);
    demo.message = run.status === "running" ? startMessage(run) : demo.message;
  } else if (E.needsNotification(run, demo.now)) {
    run = E.markNotified(run);
    demo.message = overdueMessage(run);
  }
  demo.run = run;
  if (run.status !== "running") demo.doneAt = Date.now();
}

function renderDemo() {
  const { run } = demo;
  const finished = run.status !== "running";
  const t = finished ? run.finishedAt : demo.now;
  const status = finished ? null : E.runStatus(run, t);

  demoEls.status.className = `phone-status level-${finished ? "good" : status.level}`;
  demoEls.current.textContent = finished ? L.demoDone : status.item.title;
  if (finished) {
    demoEls.meta.textContent = S.status.finishAt(fmtClock(run.finishedAt));
    demoEls.timer.textContent = "✓";
    demoEls.timer.classList.remove("overdue");
  } else {
    const behind = status.scheduleDelta;
    demoEls.meta.textContent = behind > E.ONTIME_TOLERANCE
      ? S.status.behind(fmtSpan(behind))
      : behind < -E.ONTIME_TOLERANCE
        ? S.status.ahead(fmtSpan(-behind))
        : S.status.onSchedule;
    demoEls.timer.textContent = status.overdue ? `+${fmtTimer(status.overtime)}` : fmtTimer(status.remaining);
    demoEls.timer.classList.toggle("overdue", status.overdue);
  }

  const message = finished ? { tone: "good", title: L.demoDone, text: "" } : demo.message;
  demoEls.coach.className = `phone-coach tone-${message.tone}`;
  demoEls.coach.innerHTML = "";
  const title = document.createElement("b");
  title.textContent = message.title;
  const text = document.createElement("span");
  text.textContent = message.text;
  demoEls.coach.append(title, text);

  let cursor = finished ? 0 : t + Math.max(status.remaining, 0);
  const rows = run.items.map((item, index) => {
    const li = document.createElement("li");
    let startAt;
    let duration;
    if (item.finishedAt !== null) {
      li.className = "done";
      startAt = item.startedAt;
      duration = item.finishedAt - item.startedAt;
    } else if (index === run.current && !finished) {
      li.className = "active";
      startAt = item.startedAt;
      duration = item.allotted;
    } else {
      duration = status.forecast[index - run.current - 1] ?? item.nominal;
      startAt = cursor;
      cursor += duration;
    }
    const time = document.createElement("span");
    time.className = "num";
    time.textContent = fmtClock(startAt);
    const name = document.createElement("span");
    name.textContent = item.title;
    const dur = document.createElement("span");
    dur.className = "num";
    const compressed = item.finishedAt === null && duration < item.nominal;
    if (compressed) {
      const strike = document.createElement("s");
      strike.textContent = fmtSpan(item.nominal);
      dur.append(strike);
      dur.classList.add("tone-warn");
    }
    dur.append(fmtSpan(duration));
    li.append(time, name, dur);
    return li;
  });
  demoEls.list.replaceChildren(...rows);

  const projected = finished ? run.finishedAt : status.projectedFinish;
  demoEls.finish.textContent = L.demoFinishPlan(fmtClock(run.plannedFinish), fmtClock(projected));
}

if (demoEls.list) {
  resetDemo();
  renderDemo();
  setInterval(() => {
    if (document.hidden) return;
    stepDemo();
    renderDemo();
  }, TICK);
}

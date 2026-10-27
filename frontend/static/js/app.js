// UI controller of /app: the only module that touches the DOM.
// Logic of time lives in engine.js, texts in strings.js.
import * as E from "./engine.js";
import { SPEEDS, clockNow, makeClock } from "./clock.js";
import { itemName, overdueMessage, startMessage } from "./coach.js";
import { fmtClock, fmtSpan, fmtTimer, startOfDay } from "./format.js";
import * as notify from "./notify.js";
import * as store from "./store.js";
import { S } from "./strings.js";
import { TEMPLATES, planFromTemplate } from "./templates.js";
import { track } from "./track.js";

const TOL = E.ONTIME_TOLERANCE;
const FAR_DELTA = 3 * E.HOUR;
const TICK_MS = 250;
const RING_LENGTH = 2 * Math.PI * 52;

const state = {
  plans: store.loadPlans(),
  run: store.loadRun(),
  runs: store.loadRuns(),
  settings: store.loadSettings(),
  split: null, // { runId, itemId, parts: [{ title, minutes }] }
  renderedKey: "",
  lastRoute: "",
};

const $app = document.getElementById("app");
const $status = document.getElementById("statusbar");
const $toast = document.getElementById("toast");
const BASE_TITLE = document.title;

// ---------- helpers ----------

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

const now = () => clockNow(state.run?.clock ?? null);

const ICONS = {
  lock: '<path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="2"/>',
  unlock: '<path d="M7 11V8a5 5 0 0 1 9.6-2"/><rect x="5" y="11" width="14" height="10" rx="2"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

function toast(text) {
  $toast.textContent = text;
  $toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $toast.classList.remove("show"), 2600);
}

function findPlan(id) {
  return state.plans.find((plan) => plan.id === id);
}

function savePlan(plan) {
  const updated = { ...plan, updatedAt: Date.now() };
  const exists = state.plans.some((candidate) => candidate.id === plan.id);
  state.plans = exists
    ? state.plans.map((candidate) => (candidate.id === plan.id ? updated : candidate))
    : [updated, ...state.plans];
  store.savePlans(state.plans);
  return updated;
}

function setRun(run) {
  state.run = run;
  store.saveRun(run);
}

function scheduleOf(plan, at = now()) {
  return E.planSchedule(plan, E.nearestDayBase(plan, at, startOfDay(at)));
}

function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { name: parts[0] ?? "home", id: parts[1] };
}

function go(path) {
  if (location.hash === `#${path}`) render();
  else location.hash = path;
}

// ---------- messages ----------

function withMessage(run, message) {
  return { ...run, ui: message };
}

// ---------- views ----------

function viewHome() {
  const run = state.run;
  const runBanner = run
    ? `<section class="card run-banner">
        <div><div class="eyebrow">${S.activeRun}</div><div class="h3">${esc(run.title || S.untitled)}</div></div>
        <button class="btn btn-primary" data-action="open-run">${S.openRun}</button>
      </section>`
    : "";

  const plans = state.plans.length
    ? state.plans.map(planCard).join("")
    : `<p class="empty">${S.noPlans}</p>`;

  const templates = TEMPLATES.map(
    (template) => `
      <button class="template-card" data-action="use-template" data-id="${template.id}">
        <span class="template-icon" aria-hidden="true">${template.icon}</span>
        <span class="template-text"><b>${esc(template.title)}</b><span>${esc(template.description)}</span></span>
      </button>`,
  ).join("");

  return `
    ${runBanner}
    <section class="section">
      <div class="section-head">
        <h1>${S.myPlans}</h1>
        <button class="btn btn-primary" data-action="new-plan">+ ${S.newPlan}</button>
      </div>
      <div class="plan-list">${plans}</div>
    </section>
    <section class="section">
      <div class="section-head"><h2>${S.templates}</h2><span class="muted small">${S.templatesHint}</span></div>
      <div class="template-grid">${templates}</div>
    </section>
    ${viewSettings()}
    ${viewHistory()}`;
}

function planCard(plan) {
  const total = E.totalMinutes(plan);
  const schedule = scheduleOf(plan);
  const meta = [
    `${fmtClock(schedule.start)} → ${fmtClock(schedule.finish)}`,
    S.items(plan.items.length),
    fmtSpan(total * E.MINUTE),
  ].join(" · ");
  return `
    <article class="card plan-card" data-action="edit-plan" data-id="${plan.id}">
      <div class="plan-card-main">
        <h3>${esc(plan.title || S.untitled)}</h3>
        <div class="muted small num">${meta}</div>
      </div>
      <button class="btn btn-primary btn-sm" data-action="start-plan" data-id="${plan.id}" ${plan.items.length ? "" : "disabled"}>
        ${icon("play")} ${S.start}
      </button>
    </article>`;
}

function viewSettings() {
  const locked = Boolean(state.run);
  const speeds = SPEEDS.map(
    (speed) => `<button class="seg-btn ${state.settings.speed === speed ? "active" : ""}"
        data-action="set-speed" data-speed="${speed}" ${locked ? "disabled" : ""}>
        ${speed === 1 ? S.speedNormal : `×${speed}`}</button>`,
  ).join("");
  const permission = notify.permission();
  const notifyLabel = {
    granted: S.notifyOn,
    denied: S.notifyDenied,
    unsupported: S.notifyUnsupported,
  }[permission] ?? S.notifyOff;
  return `
    <section class="section">
      <h2>${S.settings}</h2>
      <div class="card settings">
        <div class="setting">
          <div><b>${S.speed}</b><div class="muted small">${locked ? S.speedLocked : S.speedHint}</div></div>
          <div class="seg">${speeds}</div>
        </div>
        <div class="setting">
          <b>${S.notifications}</b>
          <button class="btn btn-sm ${permission === "granted" ? "btn-ghost" : ""}" data-action="enable-notify"
            ${permission === "default" ? "" : "disabled"}>${notifyLabel}</button>
        </div>
        <div class="setting">
          <b>${S.sound}</b>
          <button class="btn btn-sm btn-ghost" data-action="toggle-sound">${state.settings.sound ? S.soundOn : S.soundOff}</button>
        </div>
        <p class="muted small">${S.browserNote}</p>
        <button class="btn btn-sm btn-danger" data-action="reset">${S.resetData}</button>
      </div>
    </section>`;
}

function viewHistory() {
  if (!state.runs.length) return "";
  const rows = state.runs
    .slice(0, 5)
    .map((record) => {
      const delta = record.summary.finishDelta;
      const tone = delta < -TOL ? "bad" : "good";
      return `<a class="history-row" href="#/summary/${record.id}">
        <span>${esc(record.title || S.untitled)}</span>
        <span class="num tone-${tone}">${fmtClock(record.summary.finishedAt)}</span></a>`;
    })
    .join("");
  return `<section class="section"><h2>${S.history}</h2><div class="card history">${rows}</div></section>`;
}

function viewEditor(id) {
  const plan = findPlan(id);
  if (!plan) {
    go("/");
    return null;
  }
  const anchorButton = (anchor, label) =>
    `<button class="seg-btn ${plan.anchor === anchor ? "active" : ""}" data-action="set-anchor" data-anchor="${anchor}">${label}</button>`;
  const compression = S.compressionOptions
    .map(([value, label]) => `<option value="${value}" ${plan.maxCompression === value ? "selected" : ""}>${label}</option>`)
    .join("");
  const items = plan.items
    .map(
      (item, index) => `
      <div class="item-row">
        <div class="item-time num" data-slot="time-${index}"></div>
        <input class="input item-title" data-field="item-title" data-index="${index}"
          value="${esc(item.title)}" placeholder="${S.itemTitle}" maxlength="80" aria-label="${S.itemTitle}">
        <label class="item-min">
          <input class="input num" type="number" inputmode="numeric" min="1" max="600"
            data-field="item-minutes" data-index="${index}" value="${item.minutes}" aria-label="${S.minutesShort}">
          <span>${S.minutesShort}</span>
        </label>
        <div class="item-tools">
          <button class="icon-btn ${item.fixed ? "on" : ""}" data-action="toggle-fixed" data-index="${index}"
            title="${item.fixed ? S.fixed : S.flexible}" aria-label="${item.fixed ? S.fixed : S.flexible}">${icon(item.fixed ? "lock" : "unlock")}</button>
          <button class="icon-btn" data-action="start-from" data-index="${index}" title="${S.startFromHere}" aria-label="${S.startFromHere}">${icon("play")}</button>
          <button class="icon-btn" data-action="move-item" data-index="${index}" data-dir="-1" title="${S.moveUp}" aria-label="${S.moveUp}" ${index === 0 ? "disabled" : ""}>${icon("up")}</button>
          <button class="icon-btn" data-action="move-item" data-index="${index}" data-dir="1" title="${S.moveDown}" aria-label="${S.moveDown}" ${index === plan.items.length - 1 ? "disabled" : ""}>${icon("down")}</button>
          <button class="icon-btn danger" data-action="remove-item" data-index="${index}" title="${S.removeItem}" aria-label="${S.removeItem}">${icon("close")}</button>
        </div>
      </div>`,
    )
    .join("");

  return `
    <a class="back" href="#/">${S.back}</a>
    <input class="input title-input" data-field="title" value="${esc(plan.title)}"
      placeholder="${S.planTitle}" maxlength="80" aria-label="${S.planTitle}">
    <div class="card editor-settings">
      <div class="seg">${anchorButton("start", S.anchorStart)}${anchorButton("finish", S.anchorFinish)}</div>
      <input class="input time-input num" type="time" data-field="time" value="${esc(plan.time)}" aria-label="${S.begin}">
      <label class="compression">
        <span><b>${S.compression}</b><span class="muted small">${S.compressionHint}</span></span>
        <select class="input" data-field="maxCompression">${compression}</select>
      </label>
    </div>
    <div class="items">${items || `<p class="empty">${S.emptyPlan}</p>`}</div>
    <button class="btn btn-ghost add-item" data-action="add-item">${S.addItem}</button>
    <div class="card editor-footer" id="editor-footer"></div>
    <div class="editor-extra">
      <button class="btn btn-sm btn-ghost" data-action="duplicate-plan">${S.duplicate}</button>
      <button class="btn btn-sm btn-danger" data-action="delete-plan">${S.deletePlan}</button>
    </div>`;
}

function refreshEditor(plan) {
  const schedule = scheduleOf(plan);
  schedule.items.forEach((slot, index) => {
    const el = $app.querySelector(`[data-slot="time-${index}"]`);
    if (el) el.textContent = fmtClock(slot.at);
  });
  const footer = document.getElementById("editor-footer");
  if (!footer) return;
  const start = E.classifyStart(now(), schedule.start);
  let preview = S.previewOntime;
  if (Math.abs(start.delta) > FAR_DELTA) preview = S.previewFar;
  else if (start.kind === "early") preview = S.previewEarly(fmtSpan(-start.delta));
  else if (start.kind === "late") preview = S.previewLate(fmtSpan(start.delta));
  const tone = start.kind === "late" && Math.abs(start.delta) <= FAR_DELTA ? "warn" : "good";
  footer.innerHTML = `
    <div class="footer-stats num">
      <div><span class="muted small">${S.begin}</span><b>${fmtClock(schedule.start)}</b></div>
      <div><span class="muted small">${S.finish}</span><b>${fmtClock(schedule.finish)}</b></div>
      <div><span class="muted small">${S.total}</span><b>${fmtSpan(E.totalMinutes(plan) * E.MINUTE)}</b></div>
    </div>
    <p class="preview tone-${tone}">${plan.items.length ? preview : S.emptyPlan}</p>
    <button class="btn btn-primary btn-lg btn-block" data-action="start-plan" data-id="${plan.id}"
      ${plan.items.length ? "" : "disabled"}>${icon("play")} ${S.startPlan}</button>`;
}

function viewRun() {
  const run = state.run;
  if (!run) {
    return `<div class="empty-run card"><p>${S.noRun}</p><a class="btn btn-primary" href="#/">${S.toPlans}</a></div>`;
  }
  const status = E.runStatus(run, now());
  const item = run.items[run.current];
  const name = itemName(item.title, run.current);
  const message = run.ui
    ? `<div class="coach tone-${run.ui.tone}" id="coach"><b>${esc(run.ui.title)}</b><span>${esc(run.ui.text)}</span></div>`
    : "";

  const main = status.waiting
    ? `<div class="waiting">
        <div class="eyebrow">${S.waitingNext}</div>
        <h2 class="run-item-title">${esc(name)}</h2>
        <p class="muted">${S.plannedAt(fmtClock(item.plannedAt))}</p>
        <button class="btn btn-primary btn-lg btn-block" data-action="begin-next">${icon("play")} ${esc(S.beginItem(name))}</button>
      </div>`
    : `<div class="ring-wrap">
        <svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-bg" cx="60" cy="60" r="52"/>
          <circle class="ring-fg" id="ring-fg" cx="60" cy="60" r="52"
            stroke-dasharray="${RING_LENGTH.toFixed(1)}" stroke-dashoffset="0"/>
        </svg>
        <div class="ring-center">
          <div class="ring-label" id="ring-label"></div>
          <div class="ring-time num" id="ring-time"></div>
          <div class="ring-sub num" id="ring-sub"></div>
        </div>
      </div>
      <h2 class="run-item-title">${esc(name)}${item.fixed ? ` <span class="badge">${icon("lock")} ${S.lock}</span>` : ""}</h2>
      <button class="btn btn-primary btn-lg btn-block btn-finish" data-action="finish-item">${S.finishItem}</button>`;

  const done = run.items
    .slice(0, run.current)
    .map((doneItem, index) => {
      const actual = doneItem.skipped || doneItem.finishedAt === null
        ? `<span class="muted">${S.skipped}</span>`
        : `<span class="num">${fmtTimer(doneItem.finishedAt - doneItem.startedAt)}</span>`;
      return `<li class="list-row done"><span>${esc(itemName(doneItem.title, index))}</span>${actual}</li>`;
    })
    .join("");

  return `
    <div class="run-head">
      <a class="back" href="#/">${S.back}</a>
      <span class="muted small">${S.itemOf(run.current + 1, run.items.length)}</span>
    </div>
    <h1 class="run-plan-title">${esc(run.title || S.untitled)}</h1>
    ${message}
    <section class="card run-main ${status.waiting ? "" : "level-" + status.level}" id="run-main">${main}
      <div class="run-secondary">
        <button class="btn btn-sm btn-ghost" data-action="skip-item">${S.skip}</button>
        <button class="btn btn-sm btn-ghost" data-action="stop-run">${S.stop}</button>
      </div>
    </section>
    <label class="switch"><input type="checkbox" data-field="autoNext" ${run.autoNext ? "checked" : ""}> <span>${S.autoNext}</span></label>
    <section class="section"><h2>${S.next}</h2><ul class="list" id="upcoming"></ul></section>
    ${done ? `<section class="section"><h2>${S.done}</h2><ul class="list">${done}</ul></section>` : ""}`;
}

function updateRunLive() {
  const run = state.run;
  const key = run ? `${run.id}:${run.current}:${run.waiting}:${run.ui?.title ?? ""}` : "none";
  if (key !== state.renderedKey) {
    render();
    return;
  }
  if (!run) return;
  const t = now();
  const status = E.runStatus(run, t);
  const item = status.item;

  const main = document.getElementById("run-main");
  if (main && !status.waiting) main.className = `card run-main level-${status.level}`;

  const label = document.getElementById("ring-label");
  if (label) {
    label.textContent = status.overdue ? S.overtime : S.remaining;
    document.getElementById("ring-time").textContent =
      (status.overdue ? "+" : "") + fmtTimer(status.overdue ? status.overtime : status.remaining);
    document.getElementById("ring-time").classList.toggle("overdue", status.overdue);
    const compressed = item.allotted < item.nominal ? ` · ${S.compressedFrom(fmtTimer(item.nominal))}` : "";
    document.getElementById("ring-sub").textContent = `${S.of} ${fmtTimer(item.allotted)}${compressed}`;
    const ring = document.getElementById("ring-fg");
    // Overdue: a full red ring instead of an empty one.
    const progress = status.overdue ? 0 : status.progress;
    ring.style.strokeDashoffset = String(RING_LENGTH * progress);
  }

  const upcoming = document.getElementById("upcoming");
  if (upcoming) {
    const offset = status.waiting ? run.current : run.current + 1;
    let cursor = t + (status.waiting ? 0 : Math.max(status.remaining, 0));
    upcoming.innerHTML =
      run.items
        .slice(offset)
        .map((next, i) => {
          const allotted = status.forecast[i];
          const startAt = cursor;
          cursor += allotted;
          const strike = allotted < next.nominal ? `<s>${fmtTimer(next.nominal)}</s> ` : "";
          const lock = next.fixed ? ` <span class="badge">${icon("lock")}</span>` : "";
          return `<li class="list-row">
            <span class="num muted">${fmtClock(startAt)}</span>
            <span class="grow">${esc(itemName(next.title, offset + i))}${lock}</span>
            <span class="num ${allotted < next.nominal ? "tone-warn" : ""}">${strike}${fmtTimer(allotted)}</span></li>`;
        })
        .join("") || `<li class="list-row muted">—</li>`;
  }
}

function viewSummary(id) {
  const record = state.runs.find((candidate) => candidate.id === id);
  if (!record) {
    go("/");
    return null;
  }
  const { summary } = record;
  const end = fmtClock(summary.finishedAt);
  let headline;
  let tone = "good";
  if (record.status === "stopped") {
    headline = S.stoppedAt(end);
    tone = "warn";
  } else if (summary.finishDelta > TOL) {
    headline = S.finishedEarly(end, fmtSpan(summary.finishDelta));
  } else if (summary.finishDelta >= -TOL) {
    headline = S.finishedOntime(end);
  } else {
    headline = S.finishedLate(end, fmtSpan(-summary.finishDelta));
    tone = "bad";
  }

  const rows = summary.rows
    .map((row, index) => {
      const diff = row.diff === null
        ? `<span class="muted">${row.skipped ? S.skipped : "—"}</span>`
        : `<span class="tone-${row.diff > 0 ? "bad" : "good"}">${row.diff > 0 ? "+" : "−"}${fmtTimer(row.diff)}</span>`;
      return `<tr>
        <td>${esc(itemName(row.title, index))}</td>
        <td class="num">${fmtTimer(row.nominal)}</td>
        <td class="num">${row.allotted === null ? "—" : fmtTimer(row.allotted)}</td>
        <td class="num">${row.actual === null ? "—" : fmtTimer(row.actual)}</td>
        <td class="num">${diff}</td></tr>`;
    })
    .join("");

  const suggestions = record.suggestions.length
    ? record.suggestions.map((suggestion) => suggestionCard(record, suggestion)).join("")
    : `<p class="muted">${S.noSuggestions}</p>`;

  return `
    <a class="back" href="#/">${S.back}</a>
    <div class="eyebrow">${S.summary} · ${esc(record.title || S.untitled)}</div>
    <h1 class="summary-head tone-${tone}">${headline}</h1>
    <div class="card table-scroll">
      <table class="table">
        <thead><tr><th>${S.colItem}</th><th>${S.colPlan}</th><th>${S.colAllotted}</th><th>${S.colActual}</th><th>${S.colDiff}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <section class="section"><h2>${S.suggestions}</h2><div class="suggestions">${suggestions}</div></section>
    <a class="btn btn-primary btn-block" href="#/">${S.toPlans}</a>`;
}

function suggestionCard(record, suggestion) {
  const basis = suggestion.basis === "median" ? S.basisMedian(suggestion.samples) : S.basisLast;
  const data = `data-run="${record.id}" data-item="${suggestion.itemId}"`;
  const text = suggestion.type === "shorten"
    ? S.shortenText(suggestion.title, suggestion.to, suggestion.from)
    : S.extendText(suggestion.title, suggestion.to, suggestion.from);
  let actions;
  if (suggestion.state === "accepted") actions = `<span class="tone-good">✓ ${S.accepted}</span>`;
  else if (suggestion.state === "split") actions = `<span class="tone-good">✓ ${S.splitDone}</span>`;
  else if (suggestion.state === "declined") actions = `<span class="muted">${S.declined}</span>`;
  else if (suggestion.type === "shorten") {
    actions = `<button class="btn btn-sm btn-primary" data-action="accept-suggestion" ${data}>${S.saveShorter(suggestion.to)}</button>
      <button class="btn btn-sm btn-ghost" data-action="decline-suggestion" ${data}>${S.keep}</button>`;
  } else {
    actions = `<button class="btn btn-sm btn-primary" data-action="accept-suggestion" ${data}>${S.extendTo(suggestion.to)}</button>
      <button class="btn btn-sm" data-action="open-split" ${data}>${S.splitAction}</button>
      <button class="btn btn-sm btn-ghost" data-action="decline-suggestion" ${data}>${S.keep}</button>`;
  }
  const split = state.split?.runId === record.id && state.split.itemId === suggestion.itemId && !suggestion.state.match(/accepted|split|declined/)
    ? splitForm(data)
    : "";
  return `<div class="card suggestion tone-border-${suggestion.type === "shorten" ? "good" : "warn"}">
      <p>${esc(text)}</p>
      <p class="muted small">${basis}</p>
      <div class="suggestion-actions">${actions}</div>
      ${split}
    </div>`;
}

function splitForm(data) {
  const parts = state.split.parts
    .map(
      (part, index) => `<div class="split-row">
        <input class="input" data-field="split-title" data-index="${index}" value="${esc(part.title)}" maxlength="80">
        <label class="item-min"><input class="input num" type="number" min="1" max="600" data-field="split-minutes"
          data-index="${index}" value="${part.minutes}"><span>${S.minutesShort}</span></label>
      </div>`,
    )
    .join("");
  return `<div class="split-form">
      <b>${S.splitTitle}</b>
      ${parts}
      <div class="suggestion-actions">
        <button class="btn btn-sm btn-ghost" data-action="split-add">${S.splitAddPart}</button>
        <button class="btn btn-sm btn-primary" data-action="split-apply" ${data}>${S.splitApply}</button>
        <button class="btn btn-sm btn-ghost" data-action="split-cancel">${S.cancel}</button>
      </div>
    </div>`;
}

// ---------- render ----------

function render() {
  const current = route();
  let html;
  if (current.name === "plan") html = viewEditor(current.id);
  else if (current.name === "run") html = viewRun();
  else if (current.name === "summary") html = viewSummary(current.id);
  else html = viewHome();
  if (html === null) return;

  $app.innerHTML = html;
  const routeKey = `${current.name}/${current.id ?? ""}`;
  if (routeKey !== state.lastRoute) window.scrollTo(0, 0);
  state.lastRoute = routeKey;

  if (current.name === "plan") refreshEditor(findPlan(current.id));
  if (current.name === "run") {
    const run = state.run;
    state.renderedKey = run ? `${run.id}:${run.current}:${run.waiting}:${run.ui?.title ?? ""}` : "none";
    updateRunLive();
  }
  renderStatus();
}

function renderStatus() {
  const run = state.run;
  document.body.classList.toggle("has-status", Boolean(run));
  if (!run) {
    $status.hidden = true;
    document.title = BASE_TITLE;
    return;
  }
  $status.hidden = false;
  const status = E.runStatus(run, now());
  const name = itemName(status.item.title, run.current);
  $status.className = `statusbar level-${status.level}`;

  const scheduleText = status.scheduleDelta > TOL
    ? S.status.behind(fmtSpan(status.scheduleDelta))
    : status.scheduleDelta < -TOL
      ? S.status.ahead(fmtSpan(-status.scheduleDelta))
      : S.status.onSchedule;
  const finishText = status.finishDelta > TOL
    ? S.status.finishEarly(fmtSpan(status.finishDelta))
    : status.finishDelta < -TOL
      ? S.status.finishLate(fmtSpan(-status.finishDelta))
      : S.status.finishOntime;

  const timer = status.waiting
    ? ""
    : status.overdue
      ? `+${fmtTimer(status.overtime)}`
      : fmtTimer(status.remaining);

  document.getElementById("st-title").textContent = status.waiting ? S.status.waiting(name) : name;
  document.getElementById("st-meta").textContent =
    `${scheduleText} · ${S.status.finishAt(fmtClock(status.projectedFinish))} (${finishText})`;
  const $time = document.getElementById("st-time");
  $time.textContent = timer;
  $time.classList.toggle("overdue", status.overdue);

  document.title = status.waiting
    ? `⏸ ${name} — ${S.appName}`
    : `${status.overdue ? "⚠" : "▶"} ${timer} · ${name} — ${S.appName}`;
}

// ---------- run lifecycle ----------

function startPlan(plan, fromIndex = 0) {
  if (state.run) {
    toast(S.runActiveBlock);
    go("/run");
    return;
  }
  if (!plan?.items.length) {
    toast(S.emptyPlan);
    return;
  }
  notify.unlockAudio();
  notify.requestPermission();
  const clock = makeClock(state.settings.speed);
  const t = clockNow(clock);
  let run = E.createRun(plan, {
    now: t,
    todayBase: startOfDay(t),
    clock,
    id: store.newId(),
    fromIndex,
  });
  run = withMessage(run, startMessage(run));
  setRun(run);
  track("run_started", {
    kind: run.startKind,
    items: run.items.length,
    speed: clock.speed,
  });
  go("/run");
}

function applyRunStep(next) {
  if (next === state.run) return;
  if (next.status !== "running") {
    completeRun(next);
    return;
  }
  const started = next.current !== state.run.current || (state.run.waiting && !next.waiting);
  setRun(started && !next.waiting ? withMessage(next, startMessage(next)) : next);
  render();
}

function completeRun(run) {
  const summary = E.summarize(run);
  let plan = findPlan(run.planId);
  let suggestions = [];
  if (plan) {
    plan = savePlan(E.recordHistory(plan, summary));
    suggestions = E.suggest(plan, summary).map((suggestion) => ({ ...suggestion, state: "pending" }));
  }
  const record = {
    id: run.id,
    planId: run.planId,
    title: run.title,
    status: run.status,
    summary,
    suggestions,
    speed: run.clock?.speed ?? 1,
  };
  state.runs = [record, ...state.runs];
  store.saveRuns(state.runs);
  setRun(null);
  track("run_finished", {
    status: run.status,
    delta_min: Math.round(summary.finishDelta / E.MINUTE),
    items: run.items.length,
  });
  go(`/summary/${run.id}`);
}

function handleOverdue() {
  const run = E.markNotified(state.run);
  const message = overdueMessage(run);
  setRun(withMessage(run, message));
  notify.showNotification(message.title, message.text);
  if (state.settings.sound) {
    notify.beep();
    notify.vibrate();
  }
}

function tick() {
  if (!state.run) return;
  if (E.needsNotification(state.run, now())) handleOverdue();
  renderStatus();
  if (route().name === "run") updateRunLive();
}

// ---------- actions ----------

function findSuggestion(runId, itemId) {
  const record = state.runs.find((candidate) => candidate.id === runId);
  return { record, suggestion: record?.suggestions.find((s) => s.itemId === itemId) };
}

function resolveSuggestion(runId, itemId, newState) {
  const { suggestion } = findSuggestion(runId, itemId);
  if (suggestion) suggestion.state = newState;
  store.saveRuns(state.runs);
}

function editingPlan() {
  const current = route();
  return current.name === "plan" ? findPlan(current.id) : null;
}

const actions = {
  "open-run": () => go("/run"),
  "new-plan": () => {
    const t = Date.now();
    const plan = savePlan({
      id: store.newId(),
      title: "",
      anchor: "start",
      time: fmtClock(Math.ceil(t / (5 * E.MINUTE)) * 5 * E.MINUTE),
      maxCompression: E.DEFAULT_MAX_COMPRESSION,
      items: [{ id: store.newId(), title: "", minutes: 10, fixed: false }],
      history: {},
      source: "blank",
      createdAt: t,
    });
    track("plan_created", { source: "blank" });
    go(`/plan/${plan.id}`);
  },
  "use-template": ({ id }) => {
    const template = TEMPLATES.find((candidate) => candidate.id === id);
    if (!template) return;
    const plan = savePlan(planFromTemplate(template, Date.now(), store.newId));
    track("plan_created", { source: template.id });
    if (template.demoSpeed && !state.run) {
      state.settings.speed = template.demoSpeed;
      store.saveSettings(state.settings);
      toast(`${S.templateAdded(plan.title)} · ${S.speedSet(template.demoSpeed)}`);
    } else {
      toast(S.templateAdded(plan.title));
    }
    go(`/plan/${plan.id}`);
  },
  "edit-plan": ({ id }) => go(`/plan/${id}`),
  "start-plan": ({ id }) => startPlan(findPlan(id)),
  "start-from": ({ index }) => startPlan(editingPlan(), Number(index)),
  "set-speed": ({ speed }) => {
    if (state.run) return toast(S.speedLocked);
    state.settings.speed = Number(speed);
    store.saveSettings(state.settings);
    toast(S.speedSet(speed));
    render();
  },
  "enable-notify": async () => {
    await notify.requestPermission();
    render();
  },
  "toggle-sound": () => {
    state.settings.sound = !state.settings.sound;
    store.saveSettings(state.settings);
    render();
  },
  reset: () => {
    if (!confirm(S.resetConfirm)) return;
    store.clearAll();
    Object.assign(state, {
      plans: [],
      run: null,
      runs: [],
      settings: store.loadSettings(),
    });
    render();
  },
  "set-anchor": ({ anchor }) => {
    const plan = editingPlan();
    if (!plan) return;
    savePlan({ ...plan, anchor });
    render();
  },
  "toggle-fixed": ({ index }) => {
    const plan = editingPlan();
    const items = plan.items.map((item, i) => (i === Number(index) ? { ...item, fixed: !item.fixed } : item));
    savePlan({ ...plan, items });
    render();
  },
  "move-item": ({ index, dir }) => {
    const plan = editingPlan();
    const from = Number(index);
    const to = from + Number(dir);
    if (to < 0 || to >= plan.items.length) return;
    const items = [...plan.items];
    [items[from], items[to]] = [items[to], items[from]];
    savePlan({ ...plan, items });
    render();
  },
  "remove-item": ({ index }) => {
    const plan = editingPlan();
    savePlan({ ...plan, items: plan.items.filter((_, i) => i !== Number(index)) });
    render();
  },
  "add-item": () => {
    const plan = editingPlan();
    savePlan({
      ...plan,
      items: [...plan.items, { id: store.newId(), title: "", minutes: 10, fixed: false }],
    });
    render();
    const inputs = $app.querySelectorAll('[data-field="item-title"]');
    inputs[inputs.length - 1]?.focus();
  },
  "duplicate-plan": () => {
    const plan = editingPlan();
    const copy = savePlan({
      ...structuredClone(plan),
      id: store.newId(),
      title: `${plan.title || S.untitled}${S.copySuffix}`,
      createdAt: Date.now(),
    });
    toast(S.copied);
    go(`/plan/${copy.id}`);
  },
  "delete-plan": () => {
    const plan = editingPlan();
    if (!confirm(S.deleteConfirm)) return;
    state.plans = state.plans.filter((candidate) => candidate.id !== plan.id);
    store.savePlans(state.plans);
    go("/");
  },
  "finish-item": () => applyRunStep(E.finishItem(state.run, now())),
  "skip-item": () => applyRunStep(E.skipItem(state.run, now())),
  "begin-next": () => applyRunStep(E.beginWaiting(state.run, now())),
  "stop-run": () => {
    if (confirm(S.stopConfirm)) applyRunStep(E.stopRun(state.run, now()));
  },
  "accept-suggestion": ({ run, item }) => {
    const { record, suggestion } = findSuggestion(run, item);
    const plan = findPlan(record?.planId);
    if (!plan) return toast(S.planGone);
    savePlan(E.setItemMinutes(plan, item, suggestion.to));
    resolveSuggestion(run, item, "accepted");
    track("suggestion_accepted", { type: suggestion.type });
    render();
  },
  "decline-suggestion": ({ run, item }) => {
    resolveSuggestion(run, item, "declined");
    render();
  },
  "open-split": ({ run, item }) => {
    const { suggestion } = findSuggestion(run, item);
    const first = Math.ceil(suggestion.to / 2);
    state.split = {
      runId: run,
      itemId: item,
      parts: [
        { title: S.splitPart(suggestion.title, 1), minutes: first },
        { title: S.splitPart(suggestion.title, 2), minutes: Math.max(1, suggestion.to - first) },
      ],
    };
    render();
  },
  "split-add": () => {
    state.split.parts.push({ title: "", minutes: 5 });
    render();
  },
  "split-cancel": () => {
    state.split = null;
    render();
  },
  "split-apply": ({ run, item }) => {
    const { record } = findSuggestion(run, item);
    const plan = findPlan(record?.planId);
    if (!plan) return toast(S.planGone);
    savePlan(E.splitItem(plan, item, state.split.parts, store.newId));
    resolveSuggestion(run, item, "split");
    state.split = null;
    track("suggestion_accepted", { type: "split" });
    render();
  },
};

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target || target.disabled) return;
  const handler = actions[target.dataset.action];
  if (!handler) return;
  event.preventDefault();
  notify.unlockAudio();
  handler(target.dataset, target);
});

function onField(event) {
  const field = event.target.dataset?.field;
  if (!field) return;
  const value = event.target.value;
  const index = Number(event.target.dataset.index);

  if (field === "autoNext" && state.run) {
    setRun({ ...state.run, autoNext: event.target.checked });
    return;
  }
  if (field === "split-title" && state.split) {
    state.split.parts[index].title = value;
    return;
  }
  if (field === "split-minutes" && state.split) {
    state.split.parts[index].minutes = Number(value) || 0;
    return;
  }

  const plan = editingPlan();
  if (!plan) return;
  let updated = plan;
  if (field === "title") updated = { ...plan, title: value };
  if (field === "time") {
    if (E.parseTime(value) === null) return;
    updated = { ...plan, time: value };
  }
  if (field === "maxCompression") updated = { ...plan, maxCompression: Number(value) };
  if (field === "item-title" || field === "item-minutes") {
    const minutes = Math.round(Number(value));
    if (field === "item-minutes" && !(minutes >= 1 && minutes <= 600)) return;
    updated = {
      ...plan,
      items: plan.items.map((item, i) => {
        if (i !== index) return item;
        return field === "item-title" ? { ...item, title: value } : { ...item, minutes };
      }),
    };
  }
  refreshEditor(savePlan(updated));
}

document.addEventListener("input", onField);
document.addEventListener("change", (event) => {
  // Normalize invalid minutes on blur so the field never stays empty.
  if (event.target.dataset?.field === "item-minutes") {
    const plan = editingPlan();
    const item = plan?.items[Number(event.target.dataset.index)];
    if (item) event.target.value = item.minutes;
    return;
  }
  if (event.target.tagName === "SELECT" || event.target.type === "checkbox") return;
  onField(event);
});

// Presentation clickers send PageDown / ArrowRight: finish the item.
document.addEventListener("keydown", (event) => {
  if (route().name !== "run" || !state.run || event.target.closest("input, select, textarea")) return;
  if (["PageDown", "ArrowRight"].includes(event.key) || (event.key === "Enter" && !event.target.closest("button, a"))) {
    event.preventDefault();
    if (state.run.waiting) actions["begin-next"]();
    else actions["finish-item"]();
  }
});

window.addEventListener("hashchange", render);
document.addEventListener("visibilitychange", tick);
window.addEventListener("storage", () => {
  // Another tab changed data: reload state so tabs do not overwrite it.
  Object.assign(state, {
    plans: store.loadPlans(),
    run: store.loadRun(),
    runs: store.loadRuns(),
    settings: store.loadSettings(),
  });
  render();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("sw failed", error));
}

render();
setInterval(tick, TICK_MS);
track("app_open", { speed: state.settings.speed });

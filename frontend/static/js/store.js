// localStorage persistence. Every access is guarded: private mode or a full
// quota must not break the timer, the app keeps working in memory.

const PREFIX = "planer.v1.";
const RUNS_LIMIT = 20;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (error) {
    console.error(`store: cannot read ${key}`, error);
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (error) {
    console.error(`store: cannot write ${key}`, error);
  }
}

export const loadPlans = () => read("plans", []);
export const savePlans = (plans) => write("plans", plans);

export const loadRun = () => read("run", null);
export const saveRun = (run) => write("run", run);

export const loadRuns = () => read("runs", []);
export const saveRuns = (runs) => write("runs", runs.slice(0, RUNS_LIMIT));

export const loadSettings = () => ({ speed: 1, sound: true, ...read("settings", {}) });
export const saveSettings = (settings) => write("settings", settings);

export function sessionId() {
  let id = read("sid", null);
  if (!id) {
    id = newId();
    write("sid", id);
  }
  return id;
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replaceAll("-", "").slice(0, 16);
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function clearAll() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX) && key !== `${PREFIX}sid`)
      .forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error("store: cannot clear", error);
  }
}

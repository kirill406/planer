// Formatting helpers (locale-dependent, so kept out of engine.js).
import { plural } from "./strings.js";

const pad = (n) => String(n).padStart(2, "0");

// 04:12, 1:02:05
export function fmtTimer(ms) {
  const total = Math.max(0, Math.round(Math.abs(ms) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

// "8 мин", "1 ч 05 мин", "40 сек"
export function fmtSpan(ms) {
  const abs = Math.abs(ms);
  if (abs < 60_000) {
    const seconds = Math.round(abs / 1000);
    return `${seconds} сек`;
  }
  const totalMinutes = Math.round(abs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} мин`;
  return minutes ? `${hours} ч ${pad(minutes)} мин` : `${hours} ч`;
}

export function fmtMinutes(minutes) {
  return fmtSpan(minutes * 60_000);
}

export function fmtClock(ms) {
  const date = new Date(ms);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function startOfDay(ms) {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function fmtCount(n, forms) {
  return `${n} ${plural(n, forms)}`;
}

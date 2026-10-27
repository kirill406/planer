// Ready-made plans. `time(now)` returns HH:MM; demo templates start
// relative to "now" so a presentation always shows the intended case.
import { fmtClock } from "./format.js";

const MINUTE = 60_000;
const roundUp = (ms) => Math.ceil(ms / MINUTE) * MINUTE;

export const TEMPLATES = [
  {
    id: "demo",
    icon: "⚡",
    title: "Демо: утро за минуту",
    description: "Старт вовремя, ×60. Для презентации",
    demoSpeed: 60,
    anchor: "start",
    time: (now) => fmtClock(roundUp(now + MINUTE)),
    maxCompression: 0.5,
    items: [
      ["Душ", 10],
      ["Завтрак", 15],
      ["Одеться и собраться", 10],
      ["Дорога до метро", 15, true],
    ],
  },
  {
    id: "demo-late",
    icon: "🏃",
    title: "Демо: проспали на 10 минут",
    description: "Опоздание и сжатие, ×60",
    demoSpeed: 60,
    anchor: "start",
    time: (now) => fmtClock(now - 10 * MINUTE),
    maxCompression: 0.5,
    items: [
      ["Душ", 10],
      ["Завтрак", 15],
      ["Одеться и собраться", 10],
      ["Дорога до метро", 15, true],
    ],
  },
  {
    id: "morning",
    icon: "☀️",
    title: "Утро перед работой",
    description: "Рутина со сборами и дорогой",
    anchor: "finish",
    time: () => "08:30",
    maxCompression: 0.5,
    items: [
      ["Проснуться, стакан воды", 5],
      ["Зарядка", 10],
      ["Душ", 10],
      ["Завтрак", 15],
      ["Одеться и собраться", 10],
      ["Дорога до метро", 15, true],
    ],
  },
  {
    id: "conference",
    icon: "🎤",
    title: "Программа конференции",
    description: "Кофе-брейк и регистрация фиксированы",
    anchor: "start",
    time: () => "10:00",
    maxCompression: 0.25,
    items: [
      ["Регистрация и кофе", 30, true],
      ["Открытие", 10],
      ["Доклад 1", 30],
      ["Доклад 2", 30],
      ["Кофе-брейк", 20, true],
      ["Панельная дискуссия", 45],
      ["Вопросы из зала", 15],
      ["Закрытие", 10],
    ],
  },
  {
    id: "meeting",
    icon: "👥",
    title: "Встреча команды",
    description: "Повестка на 45 минут",
    anchor: "start",
    time: () => "11:00",
    maxCompression: 0.5,
    items: [
      ["Чек-ин", 5],
      ["Метрики недели", 10],
      ["Блокеры", 15],
      ["Решения", 10],
      ["Задачи и итоги", 5, true],
    ],
  },
  {
    id: "airport",
    icon: "✈️",
    title: "Сборы в аэропорт",
    description: "Обратный план: выйти к 06:30",
    anchor: "finish",
    time: () => "06:30",
    maxCompression: 0.5,
    items: [
      ["Проверить документы и билеты", 5, true],
      ["Душ", 10],
      ["Кофе", 10],
      ["Собрать последние вещи", 15],
      ["Вызвать такси и выйти", 10, true],
    ],
  },
];

export function planFromTemplate(template, now, makeId) {
  return {
    id: makeId(),
    title: template.title,
    anchor: template.anchor,
    time: template.time(now),
    maxCompression: template.maxCompression,
    items: template.items.map(([title, minutes, fixed = false]) => ({
      id: makeId(),
      title,
      minutes,
      fixed,
    })),
    history: {},
    source: template.id,
    createdAt: now,
  };
}

// Every user-facing string of the app lives here (AGENTS.md rule).

export const S = {
  appName: "Вовремя",
  tagline: "Ведёт по плану и пересчитывает время",

  // Home
  myPlans: "Мои планы",
  newPlan: "Новый план",
  noPlans: "Планов пока нет. Создайте свой или начните с шаблона.",
  templates: "Шаблоны",
  templatesHint: "Готовые планы — поправьте под себя",
  activeRun: "Идёт план",
  openRun: "Открыть",
  start: "Начать",
  edit: "Изменить",
  items: (n) => `${n} ${plural(n, ["пункт", "пункта", "пунктов"])}`,

  // Settings
  settings: "Настройки",
  speed: "Скорость времени",
  speedHint: "Для презентаций: ×60 — минута плана проходит за секунду",
  speedLocked: "Скорость меняется, когда нет активного плана",
  speedNormal: "Обычная",
  notifications: "Уведомления",
  notifyOn: "Включены",
  notifyOff: "Включить",
  notifyDenied: "Запрещены в браузере",
  notifyUnsupported: "Не поддерживаются",
  sound: "Звук и вибрация",
  soundOn: "Вкл",
  soundOff: "Выкл",
  resetData: "Удалить все данные",
  resetConfirm: "Удалить все планы и историю на этом устройстве?",
  browserNote:
    "Данные хранятся только в этом браузере. Уведомления надёжнее, когда вкладка открыта; на iPhone — после «На экран „Домой“».",

  // Editor
  back: "← Планы",
  planTitle: "Название плана",
  untitled: "Без названия",
  anchorStart: "Начать в",
  anchorFinish: "Закончить к",
  compression: "Сжатие при опоздании",
  compressionHint: "Насколько можно сократить пункт, если опаздываем",
  compressionOptions: [
    [0, "не сжимать"],
    [0.25, "до 25%"],
    [0.5, "до 50%"],
    [0.75, "до 75%"],
  ],
  itemTitle: "Что делаем",
  minutesShort: "мин",
  fixed: "Фиксированный — не сжимать",
  flexible: "Можно сжать",
  moveUp: "Выше",
  moveDown: "Ниже",
  removeItem: "Удалить пункт",
  startFromHere: "Начать с этого пункта",
  addItem: "+ Добавить пункт",
  newItem: "Новый пункт",
  startPlan: "Начать план",
  deletePlan: "Удалить план",
  deleteConfirm: "Удалить план?",
  duplicate: "Копия",
  copySuffix: " (копия)",
  total: "Всего",
  begin: "Начало",
  finish: "Финиш",
  previewEarly: (d) => `Если начать сейчас — на ${d} раньше. Пойдём с запасом.`,
  previewOntime: "Если начать сейчас — точно вовремя.",
  previewLate: (d) => `Если начать сейчас — опоздание ${d}. Пункты сожмутся.`,
  previewFar: "План на другое время — начать можно в любой момент.",
  emptyPlan: "Добавьте хотя бы один пункт",
  runActiveBlock: "Сначала завершите текущий план",

  // Run
  itemOf: (i, n) => `Пункт ${i} из ${n}`,
  finishItem: "Закончить",
  skip: "Пропустить",
  stop: "Стоп",
  stopConfirm: "Остановить план? Итоги сохранятся по выполненным пунктам.",
  of: "из",
  compressedFrom: (d) => `сжато с ${d}`,
  overtime: "Опоздание",
  remaining: "Осталось",
  waitingNext: "Следующий пункт",
  plannedAt: (t) => `по плану в ${t}`,
  beginItem: (title) => `Начать «${title}»`,
  next: "Дальше",
  done: "Сделано",
  skipped: "пропущен",
  autoNext: "Сразу начинать следующий пункт",
  noRun: "Сейчас ничего не выполняется.",
  toPlans: "К планам",
  lock: "фикс.",

  // Coach messages (FR-5, FR-6, FR-7)
  msgEarly: "Отлично, идём с запасом",
  msgEarlySub: (d) => `Запас ${d}. Идём по заданному времени — закончим раньше.`,
  msgOntime: "Начинаем вовремя",
  msgOntimeSub: (title, d) => `«${title}» — ${d}.`,
  msgLate: "Кажется, мы опаздываем, придётся поторопиться",
  msgLateSub: (d, pct) =>
    `Опоздание ${d}. Сокращаем пункты на ${pct}%, чтобы закончить вовремя.`,
  msgLateNoCompress: (d) => `Опоздание ${d}. Сжимать нечего — держим темп.`,
  msgShortfall: (d) =>
    `Даже со сжатием не успеваем на ${d}. Можно пропустить пункт.`,
  msgOverdue: (title) => `Время «${title}» вышло`,
  msgOverdueSub: "Нажмите «Закончить», когда будете готовы. Идёт отсчёт опоздания.",

  // Status bar
  status: {
    behind: (d) => `отстаём на ${d}`,
    ahead: (d) => `опережаем на ${d}`,
    onSchedule: "по графику",
    finishAt: (t) => `финиш ≈ ${t}`,
    finishEarly: (d) => `на ${d} раньше`,
    finishLate: (d) => `опоздание ${d}`,
    finishOntime: "вовремя",
    waiting: (title) => `Далее: ${title}`,
  },

  // Summary
  summary: "Итоги",
  finishedEarly: (t, d) => `Закончили в ${t} — на ${d} раньше плана`,
  finishedOntime: (t) => `Закончили в ${t} — точно вовремя`,
  finishedLate: (t, d) => `Закончили в ${t} — позже плана на ${d}`,
  stoppedAt: (t) => `План остановлен в ${t}`,
  colItem: "Пункт",
  colPlan: "План",
  colAllotted: "Выделено",
  colActual: "Факт",
  colDiff: "Разница",
  suggestions: "Поправим план?",
  noSuggestions: "Оценки времени точные — менять нечего.",
  basisLast: "по этому запуску",
  basisMedian: (n) => `по медиане ${n} последних запусков`,
  shortenText: (title, to, from) =>
    `«${title}» занимает ${to} мин вместо ${from}. Сохранить сокращённое время?`,
  extendText: (title, to, from) =>
    `«${title}» занимает ${to} мин вместо ${from}. Увеличить время или разбить на подпункты?`,
  saveShorter: (to) => `Сохранить ${to} мин`,
  extendTo: (to) => `Увеличить до ${to} мин`,
  splitAction: "Разбить на подпункты",
  keep: "Оставить",
  accepted: "Сохранено в плане",
  declined: "Оставили как было",
  splitDone: "Пункт разбит",
  splitTitle: "Подпункты",
  splitPart: (title, i) => `${title} — часть ${i}`,
  splitAddPart: "+ подпункт",
  splitApply: "Разбить",
  cancel: "Отмена",
  planGone: "План удалён — изменения применить нельзя",
  history: "История запусков",

  // Toasts
  speedSet: (x) => `Скорость времени ×${x}`,
  templateAdded: (title) => `План «${title}» добавлен`,
  copied: "Копия создана",
};

export function plural(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

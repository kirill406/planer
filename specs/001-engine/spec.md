# Спецификация: 001-engine — движок плана

**Статус:** Done (0.1.0-alpha)
**FR:** FR-3…FR-15, FR-18 · **NFR:** NFR-2, NFR-4

## 1. Назначение
Единственное место с логикой времени. `frontend/static/js/engine.js` —
чистые функции: на вход план/запуск и `now` (мс), на выход новое состояние.
Нет DOM, `Date.now()`, `localStorage` — поэтому всё тестируется в Node.

## 2. Модель данных

```js
Plan = {
  id, title,
  anchor: 'start' | 'finish',   // время задаёт начало или «закончить к»
  time: 'HH:MM',
  maxCompression: 0.5,          // доля, на которую можно сжать пункт
  items: [{ id, title, minutes, fixed }],
  history: { [itemId]: [actualSeconds, ...] },  // последние 10
}

Run = {
  id, planId, title, status: 'running' | 'finished' | 'stopped',
  plannedStart, plannedFinish,  // мс, зафиксированы при старте
  startedAt, startKind, startDelta,
  current,                      // индекс текущего пункта
  autoNext: true,
  clock: { speed, realBase, virtualBase },
  items: [{ itemId, title, nominal, fixed, plannedAt,
            allotted, startedAt, finishedAt, skipped, notified }],
}
```

## 3. Алгоритм

### 3.1 Расписание
`plannedStart = сегодня HH:MM` (anchor=start) или `finish − Σ` (anchor=finish).
`plannedAt[i] = plannedStart + Σ nominal[0..i)`. Финиш фиксирован на весь запуск.

### 3.2 Классификация старта (плана и каждого пункта)
`delta = now − plannedAt`; `|delta| ≤ 60 с` → `ontime`, `< 0` → `early`, иначе `late`.

### 3.3 Выделение времени (при старте каждого пункта)
```
available = plannedFinish − now
N = Σ nominal оставшихся (включая текущий)
если available ≥ N → всем nominal (запас не растягивает пункты)
иначе F = Σ fixed, C = Σ сжимаемых
      factor = clamp((available − F) / C, 1 − maxCompression, 1)
      allotted = fixed ? nominal : nominal × factor
      shortfall = F + C × factor − available   (> 0 — не успеваем)
```

### 3.4 Строка состояния (каждую секунду)
- `remaining = allotted − (now − startedAt)`; `< 0` → превышение, однократное уведомление.
- `scheduleDelta = now + max(nominal − elapsed, 0) + Σ nominal дальше − plannedFinish`
  (`> 0` — отстаём от графика, `< 0` — опережаем).
- `projectedFinish`: после текущего пункта применяется §3.3 к оставшимся;
  `= plannedFinish + shortfall`, либо раньше финиша, если идём с запасом.

### 3.5 Итоги и подсказки
`actual = finishedAt − startedAt`. База: медиана последних 5 значений истории,
если их ≥ 3, иначе `actual`. `база < 0.9 × nominal` → `shorten`;
`база > 1.1 × nominal` → `extend` (увеличить или разбить). Минимум 1 мин.

## 4. Критерии готовности
- Тесты на каждую ветку §3, включая: ранний/поздний старт, фиксированные
  пункты, упор в лимит сжатия, превышение, пропуск, старт с середины, медиану.

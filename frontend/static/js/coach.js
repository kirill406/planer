// Coach messages shown when a plan item starts (FR-5..FR-8).
// Shared by the app and the landing demo.
import { ONTIME_TOLERANCE } from "./engine.js";
import { fmtSpan } from "./format.js";
import { S } from "./strings.js";

export const itemName = (title, index) => title?.trim() || `${S.newItem} ${index + 1}`;

export function startMessage(run) {
  const item = run.items[run.current];
  if (item.startKind === "early") {
    return { tone: "good", title: S.msgEarly, text: S.msgEarlySub(fmtSpan(-item.startDelta)) };
  }
  if (item.startKind === "ontime" && item.factor === 1) {
    const text = S.msgOntimeSub(itemName(item.title, run.current), fmtSpan(item.allotted));
    return { tone: "good", title: S.msgOntime, text };
  }
  const delay = fmtSpan(Math.max(item.startDelta, 0));
  const pct = Math.round((1 - item.factor) * 100);
  let text = item.factor < 1 ? S.msgLateSub(delay, pct) : S.msgLateNoCompress(delay);
  if (item.shortfall > ONTIME_TOLERANCE) text += ` ${S.msgShortfall(fmtSpan(item.shortfall))}`;
  return { tone: item.shortfall > ONTIME_TOLERANCE ? "bad" : "warn", title: S.msgLate, text };
}

export function overdueMessage(run) {
  const item = run.items[run.current];
  return { tone: "bad", title: S.msgOverdue(itemName(item.title, run.current)), text: S.msgOverdueSub };
}

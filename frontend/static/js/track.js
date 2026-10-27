// Anonymous product analytics: no cookies, no third parties.
import { sessionId } from "./store.js";

export function track(name, props = {}) {
  try {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, session_id: sessionId(), props }),
      keepalive: true,
    }).catch(() => {}); // offline is fine: analytics must never break the app
  } catch (error) {
    console.warn("track failed", error);
  }
}

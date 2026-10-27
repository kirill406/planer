// System notifications, sound and vibration for "time is up".

let audioContext = null;

export function permission() {
  return "Notification" in globalThis ? Notification.permission : "unsupported";
}

export async function requestPermission() {
  if (permission() !== "default") return permission();
  try {
    return await Notification.requestPermission();
  } catch (error) {
    console.warn("notification permission failed", error);
    return permission();
  }
}

// AudioContext may only start after a user gesture: call on first click.
export function unlockAudio() {
  try {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return;
    audioContext ??= new Context();
    if (audioContext.state === "suspended") audioContext.resume();
  } catch (error) {
    console.warn("audio unlock failed", error);
  }
}

export function beep() {
  if (!audioContext) return;
  const start = audioContext.currentTime;
  [0, 0.25, 0.5].forEach((offset, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = index === 2 ? 1046 : 784;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.2);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.22);
  });
}

export function vibrate() {
  navigator.vibrate?.([200, 100, 200]);
}

export async function showNotification(title, body) {
  if (permission() !== "granted") return false;
  const options = {
    body,
    icon: "/static/img/icon.svg",
    badge: "/static/img/icon.svg",
    tag: "planer-run",
    renotify: true,
    requireInteraction: false,
  };
  try {
    // Service worker notifications also work on Android, where
    // `new Notification()` throws.
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return true;
    }
    new Notification(title, options);
    return true;
  } catch (error) {
    console.warn("notification failed", error);
    return false;
  }
}

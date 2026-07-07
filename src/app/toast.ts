let el: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let showing = false;
const queue: { msg: string; ms: number }[] = [];

/**
 * Skapa live-regionen tomt och tidigt: skärmläsare annonserar bara ändringar
 * i regioner som redan finns i DOM:en när innehållet dyker upp.
 */
export function initToast(): void {
  if (el?.isConnected) return;
  el = document.createElement("div");
  el.className = "toast mono";
  el.setAttribute("role", "status");
  document.body.append(el);
}

/** Lästid: ~55 ms/tecken, minst 3,2 s, högst 8 s. */
function readingTime(msg: string): number {
  return Math.min(8000, Math.max(3200, 1600 + msg.length * 55));
}

/**
 * Köad toast: varje meddelande får sin fulla lästid i stället för att
 * skrivas över av nästa — hemlighet + fuskkod i samma sekund visas i tur
 * och ordning. Utan ms används lästid baserad på längden.
 */
export function toast(msg: string, ms?: number): void {
  queue.push({ msg, ms: ms ?? readingTime(msg) });
  // svämmar kön över är det äldsta minst aktuellt
  if (queue.length > 4) queue.shift();
  if (!showing) next();
}

function next(): void {
  const item = queue.shift();
  if (!item) {
    showing = false;
    return;
  }
  showing = true;
  if (!el || !el.isConnected) initToast();
  el!.textContent = item.msg;
  el!.classList.add("is-visible");
  clearTimeout(timer);
  timer = setTimeout(() => {
    el?.classList.remove("is-visible");
    // liten lucka så ögat ser att det är ett NYTT meddelande
    timer = setTimeout(next, 350);
  }, item.ms);
}

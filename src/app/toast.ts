let el: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

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

export function toast(msg: string, ms = 2200): void {
  if (!el || !el.isConnected) initToast();
  el!.textContent = msg;
  el!.classList.add("is-visible");
  clearTimeout(timer);
  timer = setTimeout(() => el?.classList.remove("is-visible"), ms);
}

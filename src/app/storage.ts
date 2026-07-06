/**
 * Lagring som aldrig kastar: webbläsare med blockerad site-data kastar
 * SecurityError vid själva åtkomsten av window.localStorage — vilket utan
 * skydd tar ner hela appen vid boot. Faller tillbaka till minnes-Map.
 */

const memLocal = new Map<string, string>();
const memSession = new Map<string, string>();

function safe(kind: "local" | "session"): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const mem = kind === "local" ? memLocal : memSession;
  try {
    const store = kind === "local" ? window.localStorage : window.sessionStorage;
    // vissa lägen exponerar objektet men kastar först vid användning
    store.getItem("__pf_probe__");
    return store;
  } catch {
    return {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    };
  }
}

export const local = safe("local");
export const session = safe("session");

/** JSON-parse som aldrig kastar och validerar att resultatet är en array. */
export function readJsonArray<T>(store: Pick<Storage, "getItem">, key: string): T[] {
  try {
    const parsed = JSON.parse(store.getItem(key) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

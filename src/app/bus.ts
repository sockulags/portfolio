import type { Bus, BusEvents } from "./contracts";

export function createBus(): Bus {
  const listeners = new Map<string, Set<(payload: never) => void>>();
  return {
    on(event, cb) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(cb as (payload: never) => void);
      return () => set!.delete(cb as (payload: never) => void);
    },
    emit<K extends keyof BusEvents>(event: K, payload: BusEvents[K]) {
      listeners.get(event)?.forEach((cb) => {
        try {
          (cb as (p: BusEvents[K]) => void)(payload);
        } catch (err) {
          console.error(`[bus] listener for "${String(event)}" threw`, err);
        }
      });
    },
  };
}

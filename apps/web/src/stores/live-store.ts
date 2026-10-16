import { create } from 'zustand';

interface LiveState {
  ids: string[];
  push: (id: string) => void;
}

const timers = new Map<string, number>();

export const useLiveStore = create<LiveState>((set, get) => ({
  ids: [],
  push: (id) => {
    const existing = timers.get(id);
    if (existing) {
      window.clearTimeout(existing);
    }
    set({ ids: [id, ...get().ids.filter((item) => item !== id)].slice(0, 20) });
    timers.set(
      id,
      window.setTimeout(() => {
        timers.delete(id);
        set({ ids: get().ids.filter((item) => item !== id) });
      }, 4500),
    );
  },
}));

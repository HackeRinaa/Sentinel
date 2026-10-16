import { create } from 'zustand';

interface SelectionState {
  selectedId: string | null;
  select: (selectedId: string | null) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedId: null,
  select: (selectedId) => set({ selectedId }),
}));

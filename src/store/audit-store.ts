import { create } from "zustand";

interface AuditUiState {
  currentRunId: string | null;
  setCurrentRunId: (id: string | null) => void;
}

export const useAuditStore = create<AuditUiState>((set) => ({
  currentRunId: null,
  setCurrentRunId: (id) => set({ currentRunId: id }),
}));

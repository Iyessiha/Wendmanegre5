"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  userId: string | null;
  hydrated: boolean;
  login: (userId: string) => void;
  logout: () => void;
  setHydrated: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      userId: null,
      hydrated: false,
      login: (userId) => set({ userId }),
      logout: () => set({ userId: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "wmg-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

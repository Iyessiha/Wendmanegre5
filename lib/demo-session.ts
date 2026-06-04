"use client";

import type { Profile } from "./database.types";

// ============================================================
// Mode démo — authentification de secours SANS backend.
// S'active automatiquement quand Supabase n'est pas configuré
// (variables NEXT_PUBLIC_SUPABASE_* absentes). La session est
// stockée dans le localStorage du navigateur.
// ============================================================

const DEMO_KEY = "wmg-demo-session";

// Profils démo, indexés par email (cohérents avec lib/data.ts)
export const DEMO_PROFILES: Record<string, Profile> = {
  "dg@wendmanegre.com": {
    id: "u1", nom: "Le Directeur (DG)", role: "admin",
    telephone: "+226 67 71 33 55", agence: "Yako Centre",
    actif: true, created_at: "", updated_at: "",
  },
  "aminata@wendmanegre.com": {
    id: "u2", nom: "Aminata OUEDRAOGO", role: "gerant",
    telephone: "+226 70 11 22 33", agence: "Yako Centre",
    actif: true, created_at: "", updated_at: "",
  },
  "boukary@wendmanegre.com": {
    id: "u3", nom: "Boukary SAWADOGO", role: "caissier",
    telephone: "+226 76 44 55 66", agence: "Yako Centre",
    actif: true, created_at: "", updated_at: "",
  },
  "salif@wendmanegre.com": {
    id: "u4", nom: "Salif KABORE", role: "caissier",
    telephone: "+226 78 99 00 11", agence: "Bokin",
    actif: true, created_at: "", updated_at: "",
  },
};

/** Ouvre une session démo pour l'email choisi. Renvoie le profil ou null si email inconnu. */
export function setDemoSession(email: string): Profile | null {
  const profile = DEMO_PROFILES[email];
  if (!profile) return null;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(profile));
  }
  return profile;
}

/** Lit la session démo courante (ou null si déconnecté). */
export function getDemoSession(): Profile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DEMO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Profile;
  } catch {
    return null;
  }
}

/** Ferme la session démo. */
export function clearDemoSession(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(DEMO_KEY);
  }
}

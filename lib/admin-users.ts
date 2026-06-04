"use client";

import { getClient } from "./supabase";

// Helper d'appel de la fonction serveur admin-users.
// Toutes les actions sont protégées côté serveur (admin uniquement).

const FN = "admin-users";

async function call(body: Record<string, unknown>) {
  const sb = getClient();
  const { data, error } = await sb.functions.invoke(FN, { body });
  if (error) {
    // Tenter de récupérer le message d'erreur renvoyé par la fonction
    try {
      const ctx = (error as any).context;
      if (ctx?.json) { const j = await ctx.json(); if (j?.error) throw new Error(j.error); }
    } catch (inner) {
      if (inner instanceof Error && inner.message) throw inner;
    }
    throw new Error(error.message || "Erreur serveur.");
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export interface NouvelUtilisateur {
  identifiant: string;
  nom: string;
  role: "admin" | "gerant" | "caissier";
  agence?: string;
  password: string;
}

export const creerUtilisateur   = (u: NouvelUtilisateur) => call({ action: "create", ...u });
export const reinitialiserMdp   = (user_id: string, password: string) => call({ action: "reset_password", user_id, password });
export const definirActif       = (user_id: string, actif: boolean) => call({ action: "set_active", user_id, actif });

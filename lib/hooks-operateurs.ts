"use client";

import { useCallback, useEffect, useState } from "react";
import { getClient } from "./supabase";

export interface Operateur {
  id: string;
  nom: string;
  type: "mobile_money" | "telecom" | "banque" | "autre";
  commission_taux: number;
  solde_flotte: number;
  telephone_support: string | null;
  couleur: string | null;
  photo_url: string | null;
  notes: string | null;
  actif: boolean;
}

export interface MouvementOperateur {
  id: string;
  operateur_id: string;
  type: "appro" | "retrait" | "ajustement";
  montant: number;
  libelle: string | null;
  created_at: string;
}

export function useOperateurs() {
  const [data, setData] = useState<Operateur[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows } = await (getClient() as any).from("operateurs").select("*").order("nom");
      setData(rows ?? []);
    } catch { setData([]); }
    setLoading(false);
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}

export function useMouvementsOperateur(operateurId?: string) {
  const [data, setData] = useState<MouvementOperateur[]>([]);
  const refetch = useCallback(async () => {
    if (!operateurId) { setData([]); return; }
    try {
      const { data: rows } = await (getClient() as any).from("operateurs_mouvements")
        .select("*").eq("operateur_id", operateurId).order("created_at", { ascending: false }).limit(30);
      setData(rows ?? []);
    } catch { setData([]); }
  }, [operateurId]);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, refetch };
}

export async function creerOperateur(input: { id: string; nom: string; type: string; commission_taux?: number; telephone_support?: string; couleur?: string }) {
  const id = input.id.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || ("OP" + Math.random().toString(36).slice(2, 6).toUpperCase());
  const { error } = await (getClient() as any).from("operateurs").insert({
    id, nom: input.nom, type: input.type, commission_taux: input.commission_taux ?? 0,
    telephone_support: input.telephone_support || null, couleur: input.couleur || "#6B7280",
  });
  if (error) throw error;
  return id;
}

export async function modifierOperateur(id: string, patch: Partial<Operateur>) {
  const { error } = await (getClient() as any).from("operateurs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function supprimerOperateur(id: string) {
  const { error } = await (getClient() as any).from("operateurs").update({ actif: false }).eq("id", id);
  if (error) throw error;
}

// Mouvement de flotte (la flotte est recalculée par trigger)
export async function ajusterFlotte(input: { operateur_id: string; type: "appro" | "retrait" | "ajustement"; montant: number; libelle?: string; user_id?: string }) {
  const signe = input.type === "retrait" ? -Math.abs(input.montant) : Math.abs(input.montant);
  const { error } = await (getClient() as any).from("operateurs_mouvements").insert({
    operateur_id: input.operateur_id, type: input.type, montant: signe,
    libelle: input.libelle || null, par_user: input.user_id || null,
  });
  if (error) throw error;
}

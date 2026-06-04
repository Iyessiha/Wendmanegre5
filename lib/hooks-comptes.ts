"use client";

import { useCallback, useEffect, useState } from "react";
import { getClient } from "./supabase";
import { useRealtimeRefetch } from "./realtime";

export type TypeCompte = "banque" | "caisse_especes" | "mobile_money" | "autre";

export interface CompteBancaire {
  id: string;
  dolibarr_id: string | null;
  dolibarr_ref: string | null;
  nom: string;
  type: TypeCompte;
  banque: string | null;
  numero_compte: string | null;
  iban: string | null;
  titulaire: string | null;
  solde_dolibarr: number;
  devise: string;
  actif: boolean;
  notes: string | null;
}

export interface TresorerieResume {
  totalBanque: number;
  totalEspeces: number;
  totalMobile: number;
  totalGlobal: number;
  nbBanques: number;
  nbEspeces: number;
  nbMobile: number;
}

export const TYPE_LABEL: Record<TypeCompte, string> = {
  banque: "Banque",
  caisse_especes: "Caisse espèces",
  mobile_money: "Mobile Money",
  autre: "Autre",
};

export const TYPE_COLOR: Record<TypeCompte, string> = {
  banque: "bg-blue-100 text-blue-700",
  caisse_especes: "bg-leaf-100 text-leaf-600",
  mobile_money: "bg-sand-200 text-orange-600",
  autre: "bg-sand-200 text-ink-600",
};

export function useComptesBancaires() {
  const [data, setData] = useState<CompteBancaire[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows } = await (getClient() as any)
        .from("comptes_bancaires")
        .select("*")
        .order("type")
        .order("solde_dolibarr", { ascending: false });
      setData(rows ?? []);
    } catch { setData([]); }
    setLoading(false);
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  useRealtimeRefetch(["comptes_bancaires"], refetch, 600);
  return { data, loading, refetch };
}

export async function syncComptesBancaires(): Promise<{ upserted: number; total: number }> {
  const sb = getClient() as any;
  const { data, error } = await sb.functions.invoke("sync-comptes", { method: "POST" });
  if (error) throw new Error(error.message ?? "Erreur de synchronisation");
  if (!data?.ok) throw new Error(data?.error ?? "Erreur Dolibarr");
  return { upserted: data.upserted, total: data.total };
}

export function useTresorerie(): TresorerieResume & { loading: boolean } {
  const { data, loading } = useComptesBancaires();
  const actifs = data.filter(c => c.actif);
  return {
    loading,
    totalBanque:  actifs.filter(c => c.type === "banque").reduce((s, c) => s + Number(c.solde_dolibarr), 0),
    totalEspeces: actifs.filter(c => c.type === "caisse_especes").reduce((s, c) => s + Number(c.solde_dolibarr), 0),
    totalMobile:  actifs.filter(c => c.type === "mobile_money").reduce((s, c) => s + Number(c.solde_dolibarr), 0),
    totalGlobal:  actifs.reduce((s, c) => s + Number(c.solde_dolibarr), 0),
    nbBanques:  actifs.filter(c => c.type === "banque").length,
    nbEspeces:  actifs.filter(c => c.type === "caisse_especes").length,
    nbMobile:   actifs.filter(c => c.type === "mobile_money").length,
  };
}

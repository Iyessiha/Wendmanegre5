"use client";

import { useCallback, useEffect, useState } from "react";
import { getClient } from "./supabase";
import { useRealtimeRefetch } from "./realtime";

export type TypeTransaction = "DEPOT" | "RETRAIT" | "ENVOI" | "RECEPTION" | "CREDIT" | "REMBOURSEMENT";

export interface Transaction {
  id: string;
  type: TypeTransaction;
  operateur: string | null;
  montant: number;
  frais: number;
  taux_applique: number | null;
  telephone_client: string | null;
  nom_client: string | null;
  reference: string | null;
  caisse_id: string | null;
  user_id: string | null;
  date_transaction: string;
  statut: string;
  created_at: string;
}

export const TYPES_TRANSACTION: { v: TypeTransaction; l: string }[] = [
  { v: "DEPOT", l: "Dépôt" },
  { v: "RETRAIT", l: "Retrait" },
  { v: "ENVOI", l: "Envoi" },
  { v: "RECEPTION", l: "Réception" },
  { v: "CREDIT", l: "Crédit / Airtime" },
  { v: "REMBOURSEMENT", l: "Remboursement" },
];
export const labelType = (t: string) => TYPES_TRANSACTION.find(x => x.v === t)?.l ?? t;

export function useTransactions(filter?: { type?: string; operateur?: string; limit?: number }) {
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      let q = (getClient() as any).from("transactions").select("*").order("created_at", { ascending: false }).limit(filter?.limit ?? 200);
      if (filter?.type && filter.type !== "tous") q = q.eq("type", filter.type);
      if (filter?.operateur && filter.operateur !== "tous") q = q.eq("operateur", filter.operateur);
      const { data: rows } = await q;
      setData(rows ?? []);
    } catch { setData([]); }
    setLoading(false);
  }, [filter?.type, filter?.operateur, filter?.limit]);
  useEffect(() => { refetch(); }, [refetch]);
  useRealtimeRefetch(["transactions","mouvements_caisse"], refetch, 600);
  return { data, loading, refetch };
}

export async function enregistrerTransaction(input: {
  type: TypeTransaction;
  operateur?: string;
  montant: number;
  frais?: number;
  taux_applique?: number;
  telephone_client?: string;
  nom_client?: string;
  reference?: string;
  caisse_id?: string;
  user_id?: string;
  client_id?: string;
  // Champs distincts par type
  telephone_dest?: string;  // ENVOI
  nom_dest?: string;        // ENVOI
  operateur_dest?: string;  // ENVOI inter-réseau
  type_credit?: string;     // CREDIT: unites_om|cash|credit_tel
  echeance?: string;        // CREDIT: date ISO
  mode_paiement?: string;   // REMBOURSEMENT
  expediteur_nom?: string;  // RECEPTION
  expediteur_tel?: string;  // RECEPTION
}): Promise<void> {
  const sb = getClient() as any;
  const { error } = await sb.from("transactions").insert({
    id: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
    type: input.type,
    operateur: input.operateur || null,
    montant: Math.round(input.montant),
    frais: Math.round(input.frais ?? 0),
    taux_applique: input.taux_applique ?? null,
    telephone_client: input.telephone_client || null,
    nom_client: input.nom_client || null,
    reference: input.reference || null,
    caisse_id: input.caisse_id || null,
    user_id: input.user_id || null,
    client_id: input.client_id || null,
    telephone_dest: input.telephone_dest || null,
    nom_dest: input.nom_dest || null,
    operateur_dest: input.operateur_dest || null,
    type_credit: input.type_credit || null,
    echeance: input.echeance || null,
    mode_paiement: input.mode_paiement || null,
    expediteur_nom: input.expediteur_nom || null,
    expediteur_tel: input.expediteur_tel || null,
    date_transaction: new Date().toISOString().slice(0, 10),
    statut: "effectuee",
  });
  if (error) throw error;
}

// Résumé du jour (volume, nombre, commissions)
export function resumeJour(transactions: Transaction[]) {
  const today = new Date().toISOString().slice(0, 10);
  const dujour = transactions.filter(t => (t.date_transaction ?? t.created_at?.slice(0, 10)) === today && t.statut !== "annulee");
  return {
    nombre: dujour.length,
    volume: dujour.reduce((s, t) => s + t.montant, 0),
    commissions: dujour.reduce((s, t) => s + (t.frais ?? 0), 0),
  };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { getClient } from "./supabase";
import { useRealtimeRefetch } from "./realtime";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface OperateurAvance {
  id: string; nom: string; type: string;
  couleur: string; couleur2: string | null;
  commission_taux: number; solde_flotte: number;
  telephone_support: string | null; ussd_solde: string | null;
  slogan: string | null; icone_type: string | null;
  pays: string; actif: boolean;
  notes: string | null; photo_url: string | null;
  nb_frais?: number; nb_limites?: number;
}

export interface FraisOperateur {
  id: string; operateur_id: string; nom: string;
  type_operation: string; acteur: string; mode: string;
  valeur: number; montant_min: number; montant_max: number;
  actif: boolean; notes: string | null; ordre: number;
}

export interface PalierFrais {
  id: string; frais_id: string;
  tranche_min: number; tranche_max: number;
  frais_fixe: number; frais_pct: number; ordre: number;
}

export interface LimiteOperateur {
  id: string; operateur_id: string;
  type_limite: string; valeur: number; actif: boolean; notes: string | null;
}

export interface MouvementFlotte {
  id: string; type: string; montant: number;
  libelle: string | null; created_at: string;
}

// ── Labels ────────────────────────────────────────────────────────────────────
export const TYPE_OP_LABEL: Record<string, string> = {
  depot: "Dépôt espèces", retrait: "Retrait espèces",
  envoi: "Envoi d'argent", reception: "Réception",
  transfert_inter: "Transfert inter-réseaux",
  paiement_marchand: "Paiement marchand",
  achat_credit: "Achat crédit", commission_depot: "Commission dépôt",
  commission_retrait: "Commission retrait", commission_envoi: "Commission envoi",
  autre: "Autre",
};
export const ACTEUR_LABEL: Record<string, string> = {
  client: "Client", agent: "Agent", dealer: "Dealer",
};
export const MODE_LABEL: Record<string, string> = {
  fixe: "Fixe (XOF)", pourcentage: "Pourcentage (%)", palier: "Paliers",
};
export const LIMITE_LABEL: Record<string, string> = {
  min_depot: "Dépôt minimum", max_depot: "Dépôt maximum",
  min_retrait: "Retrait minimum", max_retrait: "Retrait maximum",
  min_envoi: "Envoi minimum", max_envoi: "Envoi maximum",
  plafond_compte: "Plafond compte client", plafond_journalier: "Plafond journalier",
  nb_transactions_jour: "Nb transactions/jour",
};

// ── Hooks lecture ─────────────────────────────────────────────────────────────
export function useOperateursAvances() {
  const [data, setData] = useState<OperateurAvance[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const sb = getClient() as any;
      const { data: ops } = await sb.from("operateurs").select("*").order("actif", { ascending: false }).order("nom");
      // Enrichir avec counts
      const ids = (ops ?? []).map((o: any) => o.id);
      const { data: frais } = await sb.from("operateur_frais").select("operateur_id").in("operateur_id", ids);
      const { data: lims } = await sb.from("operateur_limites").select("operateur_id").in("operateur_id", ids);
      const fCount: Record<string, number> = {};
      const lCount: Record<string, number> = {};
      (frais ?? []).forEach((f: any) => { fCount[f.operateur_id] = (fCount[f.operateur_id] ?? 0) + 1; });
      (lims ?? []).forEach((l: any) => { lCount[l.operateur_id] = (lCount[l.operateur_id] ?? 0) + 1; });
      setData((ops ?? []).map((o: any) => ({ ...o, nb_frais: fCount[o.id] ?? 0, nb_limites: lCount[o.id] ?? 0 })));
    } catch { setData([]); }
    setLoading(false);
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  useRealtimeRefetch(["operateurs","operateur_frais","operateur_limites"], refetch, 700);
  return { data, loading, refetch };
}

export function useFraisOperateur(operateurId: string) {
  const [data, setData] = useState<FraisOperateur[]>([]);
  const refetch = useCallback(async () => {
    if (!operateurId) { setData([]); return; }
    const { data: rows } = await (getClient() as any).from("operateur_frais")
      .select("*").eq("operateur_id", operateurId).order("ordre");
    setData(rows ?? []);
  }, [operateurId]);
  useEffect(() => { refetch(); }, [refetch]);
  useRealtimeRefetch(["operateur_frais"], refetch, 500);
  return { data, refetch };
}

export function usePaliersOperateur(operateurId: string) {
  const [data, setData] = useState<PalierFrais[]>([]);
  const refetch = useCallback(async () => {
    if (!operateurId) { setData([]); return; }
    const sb = getClient() as any;
    const { data: frais } = await sb.from("operateur_frais").select("id").eq("operateur_id", operateurId);
    const ids = (frais ?? []).map((f: any) => f.id);
    if (ids.length === 0) { setData([]); return; }
    const { data: rows } = await sb.from("operateur_paliers").select("*").in("frais_id", ids).order("frais_id").order("ordre");
    setData(rows ?? []);
  }, [operateurId]);
  useEffect(() => { refetch(); }, [refetch]);
  useRealtimeRefetch(["operateur_paliers"], refetch, 500);
  return { data, refetch };
}

export function useLimitesOperateur(operateurId: string) {
  const [data, setData] = useState<LimiteOperateur[]>([]);
  const refetch = useCallback(async () => {
    if (!operateurId) { setData([]); return; }
    const { data: rows } = await (getClient() as any).from("operateur_limites")
      .select("*").eq("operateur_id", operateurId).order("type_limite");
    setData(rows ?? []);
  }, [operateurId]);
  useEffect(() => { refetch(); }, [refetch]);
  useRealtimeRefetch(["operateur_limites"], refetch, 500);
  return { data, refetch };
}

export function useMouvementsFlotte(operateurId: string) {
  const [data, setData] = useState<MouvementFlotte[]>([]);
  const refetch = useCallback(async () => {
    if (!operateurId) { setData([]); return; }
    const { data: rows } = await (getClient() as any).from("operateurs_mouvements")
      .select("id,type,montant,libelle,created_at")
      .eq("operateur_id", operateurId)
      .order("created_at", { ascending: false }).limit(15);
    setData(rows ?? []);
  }, [operateurId]);
  useEffect(() => { refetch(); }, [refetch]);
  useRealtimeRefetch(["operateurs_mouvements"], refetch, 500);
  return { data, refetch };
}

// ── Mutations frais ───────────────────────────────────────────────────────────
export async function updateFrais(id: string, patch: Partial<FraisOperateur>) {
  const { error } = await (getClient() as any).from("operateur_frais").update(patch).eq("id", id);
  if (error) throw error;
}
export async function createFrais(input: Omit<FraisOperateur, "id">) {
  const { error } = await (getClient() as any).from("operateur_frais").insert(input);
  if (error) throw error;
}
export async function deleteFrais(id: string) {
  const { error } = await (getClient() as any).from("operateur_frais").delete().eq("id", id);
  if (error) throw error;
}

// ── Mutations paliers ─────────────────────────────────────────────────────────
export async function createPalier(input: Omit<PalierFrais, "id">) {
  const { error } = await (getClient() as any).from("operateur_paliers").insert(input);
  if (error) throw error;
}
export async function updatePalier(id: string, patch: Partial<PalierFrais>) {
  const { error } = await (getClient() as any).from("operateur_paliers").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deletePalier(id: string) {
  const { error } = await (getClient() as any).from("operateur_paliers").delete().eq("id", id);
  if (error) throw error;
}

// ── Mutations limites ─────────────────────────────────────────────────────────
export async function updateLimite(id: string, valeur: number) {
  const { error } = await (getClient() as any).from("operateur_limites").update({ valeur }).eq("id", id);
  if (error) throw error;
}
export async function createLimite(input: Omit<LimiteOperateur, "id">) {
  const { error } = await (getClient() as any).from("operateur_limites").insert(input);
  if (error) throw error;
}

// ── Calculateur de frais ──────────────────────────────────────────────────────
export function calculerFrais(frais: FraisOperateur[], paliers: PalierFrais[], typeOp: string, montant: number) {
  const rule = frais.find(f => f.type_operation === typeOp && f.acteur === "client" && f.actif);
  const commDep = frais.find(f => f.type_operation === "commission_depot" && f.acteur === "dealer" && f.actif);
  const commRet = frais.find(f => f.type_operation === "commission_retrait" && f.acteur === "dealer" && f.actif);
  if (!rule) return null;
  let fraisClient = 0;
  if (rule.mode === "fixe") fraisClient = rule.valeur;
  else if (rule.mode === "pourcentage") fraisClient = Math.round(montant * rule.valeur / 100);
  else if (rule.mode === "palier") {
    const p = paliers.filter(p => p.frais_id === rule.id)
      .find(p => montant >= p.tranche_min && montant <= p.tranche_max);
    if (p) fraisClient = p.frais_fixe + Math.round(montant * p.frais_pct / 100);
  }
  const commRule = typeOp === "depot" ? commDep : typeOp === "retrait" ? commRet : null;
  const commission = commRule ? Math.round(montant * commRule.valeur / 100) : 0;
  return { fraisClient, commission, net: montant - fraisClient + commission };
}

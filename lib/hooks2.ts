"use client";

import { useEffect, useState, useCallback } from "react";
import { getClient } from "./supabase";
import type {
  ConfigEntreprise, ConfigFrais, Entrepot, Transaction,
  TypeTransaction, Produit, Profile,
} from "./database.types";

// ─── Config entreprise ─────────────────────────────────────
export function useConfigEntreprise() {
  const [data, setData] = useState<ConfigEntreprise | null>(null);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    const { data: row } = await (getClient() as any).from("config_entreprise").select("*").eq("cle", "principal").single();
    setData(row); setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export async function saveConfigEntreprise(updates: Partial<ConfigEntreprise>) {
  const { error } = await (getClient() as any).from("config_entreprise")
    .update({ ...updates, updated_at: new Date().toISOString() }).eq("cle", "principal");
  if (error) throw error;
}

// ─── Config frais ──────────────────────────────────────────
export function useConfigFrais() {
  const [data, setData] = useState<ConfigFrais[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    const { data: rows } = await (getClient() as any).from("config_frais").select("*").order("operateur").order("type_transaction");
    setData(rows ?? []); setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export async function saveConfigFrais(id: string, updates: Partial<ConfigFrais>) {
  const { error } = await (getClient() as any).from("config_frais")
    .update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// Calculer les frais pour une transaction donnée
export function calculerFrais(fraisConfig: ConfigFrais[], operateur: string, type: TypeTransaction, montant: number): number {
  const cfg = fraisConfig.find(f => f.operateur === operateur && f.type_transaction === type && f.actif);
  if (!cfg) return 0;
  const fraisCalc = Math.round(montant * cfg.taux / 100) + cfg.frais_fixe;
  const fraisAvecMin = Math.max(fraisCalc, cfg.frais_min);
  return cfg.frais_max ? Math.min(fraisAvecMin, cfg.frais_max) : fraisAvecMin;
}

// ─── Transactions ──────────────────────────────────────────
export function useTransactions(caisseId?: string, date?: string) {
  const [data, setData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    let q = (getClient() as any).from("transactions").select("*").order("created_at", { ascending: false }).limit(100);
    if (caisseId) q = q.eq("caisse_id", caisseId);
    if (date) q = q.eq("date_transaction", date);
    const { data: rows } = await q;
    setData(rows ?? []); setLoading(false);
  }, [caisseId, date]);
  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export async function creerTransaction(input: {
  type: TypeTransaction;
  operateur: string;
  montant: number;
  frais: number;
  tauxApplique: number;
  telephoneClient?: string;
  nomClient?: string;
  reference?: string;
  caisseId: string;
  pretId?: string;
  userId: string;
}): Promise<string> {
  const { data, error } = await (getClient() as any).from("transactions").insert({
    type: input.type,
    operateur: input.operateur,
    montant: input.montant,
    frais: input.frais,
    taux_applique: input.tauxApplique,
    telephone_client: input.telephoneClient ?? null,
    nom_client: input.nomClient ?? null,
    reference: input.reference ?? null,
    caisse_id: input.caisseId,
    pret_id: input.pretId ?? null,
    user_id: input.userId,
    statut: "effectuee",
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function annulerTransaction(id: string, motif: string, userId: string) {
  const { error } = await (getClient() as any).from("transactions")
    .update({ statut: "annulee", motif_annulation: motif }).eq("id", id);
  if (error) throw error;
  await (getClient() as any).from("audit_log").insert({
    user_id: userId, action: "ANNULATION", table_name: "transactions",
    record_id: id, new_data: { motif },
  });
}

// ─── Entrepôts ─────────────────────────────────────────────
export function useEntrepots() {
  const [data, setData] = useState<Entrepot[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    const { data: rows } = await (getClient() as any).from("entrepots").select("*").eq("actif", true).order("nom");
    setData(rows ?? []); setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export async function creerEntrepot(input: Pick<Entrepot, "nom" | "ville" | "adresse">) {
  const { error } = await (getClient() as any).from("entrepots").insert(input);
  if (error) throw error;
}

// ─── Produits (étendu) ─────────────────────────────────────
export async function creerProduit(input: Partial<Produit> & { nom: string; categorie: string; entrepot: string }) {
  const id = "P-" + Date.now().toString(36).toUpperCase();
  const { error } = await (getClient() as any).from("produits").insert({ id, ...input });
  if (error) throw error;
}

export async function updateProduit(id: string, updates: Partial<Produit>) {
  const { error } = await (getClient() as any).from("produits").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// ─── Utilisateurs / Profils ────────────────────────────────
export function useProfiles() {
  const [data, setData] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    const { data: rows } = await (getClient() as any).from("profiles").select("*").order("nom");
    setData(rows ?? []); setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export async function updateProfile(id: string, updates: Partial<Profile>) {
  const { error } = await (getClient() as any).from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// ─── Stats comptabilité ────────────────────────────────────
export interface StatsPeriode {
  revenus_commissions: number;
  volume_transactions: number;
  nb_transactions: number;
  encours_prets: number;
  par_operateur: { operateur: string; frais: number; volume: number; nb: number }[];
  par_type: { type: string; montant: number; frais: number; nb: number }[];
  evolution_30j: { jour: string; frais: number; volume: number }[];
}

export function useComptaStats(mois?: string) {
  const [data, setData] = useState<StatsPeriode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const sb = getClient() as any;
      const today = new Date();
      const debut = mois ? mois + "-01" : new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const fin   = mois ? mois + "-31" : today.toISOString().slice(0, 10);

      const [txRes, pretsRes] = await Promise.all([
        sb.from("transactions").select("type,operateur,montant,frais,date_transaction").eq("statut","effectuee").gte("date_transaction", debut).lte("date_transaction", fin),
        sb.from("v_prets_encours").select("reste_a_payer").neq("statut","rembourse").neq("statut","annule"),
      ]);

      const txs: Transaction[] = txRes.data ?? [];
      const encours_prets = (pretsRes.data ?? []).reduce((s: number, p: any) => s + (p.reste_a_payer ?? 0), 0);
      const revenus_commissions = txs.reduce((s, t) => s + t.frais, 0);
      const volume_transactions = txs.reduce((s, t) => s + t.montant, 0);

      // Par opérateur
      const byOp: Record<string, { frais: number; volume: number; nb: number }> = {};
      txs.forEach(t => {
        if (!byOp[t.operateur]) byOp[t.operateur] = { frais: 0, volume: 0, nb: 0 };
        byOp[t.operateur].frais  += t.frais;
        byOp[t.operateur].volume += t.montant;
        byOp[t.operateur].nb     += 1;
      });

      // Par type
      const byType: Record<string, { montant: number; frais: number; nb: number }> = {};
      txs.forEach(t => {
        if (!byType[t.type]) byType[t.type] = { montant: 0, frais: 0, nb: 0 };
        byType[t.type].montant += t.montant;
        byType[t.type].frais   += t.frais;
        byType[t.type].nb      += 1;
      });

      // Évolution 30 derniers jours
      const byDay: Record<string, { frais: number; volume: number }> = {};
      txs.forEach(t => {
        if (!byDay[t.date_transaction]) byDay[t.date_transaction] = { frais: 0, volume: 0 };
        byDay[t.date_transaction].frais  += t.frais;
        byDay[t.date_transaction].volume += t.montant;
      });

      setData({
        revenus_commissions,
        volume_transactions,
        nb_transactions: txs.length,
        encours_prets,
        par_operateur: Object.entries(byOp).map(([operateur, v]) => ({ operateur, ...v })).sort((a,b)=>b.frais-a.frais),
        par_type: Object.entries(byType).map(([type, v]) => ({ type, ...v })),
        evolution_30j: Object.entries(byDay).map(([jour, v]) => ({ jour, ...v })).sort((a,b)=>a.jour.localeCompare(b.jour)),
      });
      setLoading(false);
    }
    load();
  }, [mois]);

  return { data, loading };
}

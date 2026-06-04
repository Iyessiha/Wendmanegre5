"use client";

import { useEffect, useState, useCallback } from "react";
import { getClient } from "./supabase";
import type {
  Client, Caisse, PretEncours, Remboursement,
  MouvementCaisse, Produit, Profile,
} from "./database.types";

type UseResult<T> = { data: T; loading: boolean; error: string | null; refetch: () => void };

// ─── Clients ───────────────────────────────────────────────

export function useClients(): UseResult<Client[]> {
  const [data, setData]     = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data: rows, error: err } = await getClient()
      .from("clients").select("*").eq("actif", true).order("nom");
    if (err) setError(err.message);
    else setData(rows ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export async function upsertClient(client: Partial<Client> & { id: string }) {
  const { error } = await (getClient().from("clients") as any).upsert(client);
  if (error) throw error;
}

export async function deleteClient(id: string) {
  const sb = getClient();
  const { error } = await (sb.from("clients") as any).update({ actif: false }).eq("id", id);
  if (error) throw error;
}

// ─── Prêts (vue avec encours calculés) ────────────────────

export function usePrets(filter?: { statut?: string; clientId?: string }): UseResult<PretEncours[]> {
  const [data, setData]     = useState<PretEncours[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = getClient().from("v_prets_encours").select("*").order("date_octroi", { ascending: false });
    if (filter?.statut && filter.statut !== "tous") q = q.eq("statut", filter.statut);
    if (filter?.clientId) q = q.eq("client_id", filter.clientId);
    const { data: rows, error: err } = await q;
    if (err) setError(err.message);
    else setData(rows ?? []);
    setLoading(false);
  }, [filter?.statut, filter?.clientId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export async function octroyerPret(input: {
  clientId: string;
  typeOperation: string;
  montant: number;
  caisseId: string;
  echeance: string;
  userId: string;
}): Promise<string> {
  const sb = getClient();
  const ref = `FA-${Date.now().toString(36).toUpperCase()}`;
  const today = new Date().toISOString().slice(0, 10);

  const { error: pretErr } = await (sb.from("prets") as any).insert({
    id:             ref,
    client_id:      input.clientId,
    type_operation: input.typeOperation,
    montant:        input.montant,
    date_octroi:    today,
    echeance:       input.echeance,
    statut:         "impaye",
    caisse_id:      input.caisseId,
    octroye_par:    input.userId,
  });
  if (pretErr) throw pretErr;

  const { error: mvtErr } = await (sb.from("mouvements_caisse") as any).insert({
    caisse_id:    input.caisseId,
    type:         "octroi",
    montant:      -input.montant,
    libelle:      `Octroi prêt ${ref}`,
    par_user:     input.userId,
    reference_id: ref,
  });
  if (mvtErr) throw mvtErr;

  await (sb.from("audit_log") as any).insert({
    user_id:    input.userId,
    action:     "INSERT",
    table_name: "prets",
    record_id:  ref,
    new_data:   { montant: input.montant, type: input.typeOperation, client: input.clientId },
  });

  return ref;
}

export async function annulerPret(pretId: string, motif: string, userId: string) {
  const sb = getClient();
  const { data: pret } = await (sb.from("prets") as any).select("*").eq("id", pretId).single();
  if (!pret) throw new Error("Prêt introuvable");

  const { error } = await (sb.from("prets") as any).update({
    statut: "annule", annule: true, motif_annulation: motif,
  }).eq("id", pretId);
  if (error) throw error;

  await (sb.from("audit_log") as any).insert({
    user_id: userId, action: "ANNULATION", table_name: "prets",
    record_id: pretId, old_data: pret, new_data: { motif },
  });
}

// ─── Remboursements ────────────────────────────────────────

export function useRemboursements(pretId?: string): UseResult<Remboursement[]> {
  const [data, setData]     = useState<Remboursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = getClient().from("remboursements").select("*").order("date_remb", { ascending: false });
    if (pretId) q = q.eq("pret_id", pretId);
    const { data: rows, error: err } = await q;
    if (err) setError(err.message);
    else setData(rows ?? []);
    setLoading(false);
  }, [pretId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export async function enregistrerRemboursement(input: {
  pretId: string;
  montant: number;
  mode: Remboursement["mode"];
  caisseId: string;
  userId: string;
}) {
  const sb = getClient();
  const { error: rembErr } = await (sb.from("remboursements") as any).insert({
    pret_id:   input.pretId,
    montant:   input.montant,
    mode:      input.mode,
    caisse_id: input.caisseId,
    saisi_par: input.userId,
  });
  if (rembErr) throw rembErr;

  const { error: mvtErr } = await (sb.from("mouvements_caisse") as any).insert({
    caisse_id:    input.caisseId,
    type:         "remboursement",
    montant:      input.montant,
    libelle:      `Remboursement ${input.pretId}`,
    par_user:     input.userId,
    reference_id: input.pretId,
  });
  if (mvtErr) throw mvtErr;
}

// ─── Caisses ───────────────────────────────────────────────

export function useCaisses(): UseResult<(Caisse & { assignee?: Profile })[]> {
  const [data, setData]     = useState<(Caisse & { assignee?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data: rows, error: err } = await getClient()
      .from("caisses")
      .select("*, assignee:profiles(id,nom,role,agence)")
      .eq("actif", true)
      .order("nom");
    if (err) setError(err.message);
    else setData((rows ?? []) as any);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export async function alimenterCaisse(caisseId: string, montant: number, libelle: string, userId: string) {
  const { error } = await (getClient().from("mouvements_caisse") as any).insert({
    caisse_id: caisseId, type: "alimentation",
    montant, libelle, par_user: userId,
  });
  if (error) throw error;
}

export async function transfererCaisse(input: {
  fromId: string; toId: string; montant: number;
  libelle: string; userId: string;
}) {
  const sb = getClient();
  const err1 = await (sb.from("mouvements_caisse") as any).insert({
    caisse_id: input.fromId, type: "transfert_out",
    montant: -input.montant,
    libelle: `Transfert vers caisse → ${input.libelle}`,
    par_user: input.userId,
  });
  const err2 = await (sb.from("mouvements_caisse") as any).insert({
    caisse_id: input.toId, type: "transfert_in",
    montant: input.montant,
    libelle: `Transfert depuis caisse — ${input.libelle}`,
    par_user: input.userId,
  });
  if (err1.error) throw err1.error;
  if (err2.error) throw err2.error;
}

// ─── Mouvements de caisse ──────────────────────────────────

export function useMouvements(caisseId?: string): UseResult<MouvementCaisse[]> {
  const [data, setData]     = useState<MouvementCaisse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = getClient().from("mouvements_caisse").select("*").order("created_at", { ascending: false }).limit(50);
    if (caisseId) q = q.eq("caisse_id", caisseId);
    const { data: rows, error: err } = await q;
    if (err) setError(err.message);
    else setData(rows ?? []);
    setLoading(false);
  }, [caisseId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

// ─── Produits ─────────────────────────────────────────────

export function useProduits(): UseResult<Produit[]> {
  const [data, setData]     = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data: rows, error: err } = await getClient()
      .from("produits").select("*").eq("actif", true).order("nom");
    if (err) setError(err.message);
    else setData(rows ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

// ─── Dashboard KPIs ────────────────────────────────────────

export interface DashboardStats {
  encours:           number;
  tresorerie:        number;
  nbCommerçants:     number;
  nbImpayes:         number;
  tauxRecouvrement:  number;
  enRetard:          PretEncours[];
  parVille:          { ville: string; montant: number }[];
  parType:           { type: string; montant: number }[];
  activiteRecente:   {
    type: "octroi" | "remboursement";
    ref: string; client: string; montant: number; date: string;
  }[];
}

export function useDashboardStats(): { stats: DashboardStats; loading: boolean } {
  const [stats, setStats] = useState<DashboardStats>({
    encours: 0, tresorerie: 0, nbCommerçants: 0, nbImpayes: 0,
    tauxRecouvrement: 0, enRetard: [], parVille: [], parType: [], activiteRecente: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const sb = getClient() as any;
      const [pretsRes, caissesRes, clientsRes, rembRes] = await Promise.all([
        sb.from("v_prets_encours").select("*"),
        sb.from("caisses").select("solde").eq("actif", true),
        sb.from("clients").select("*", { count: "exact", head: true }).eq("actif", true),
        sb.from("remboursements").select("montant,pret_id,date_remb,prets(client_id,clients(nom))").order("date_remb", { ascending: false }).limit(6),
      ]);

      const prets: PretEncours[] = (pretsRes.data ?? []) as PretEncours[];
      const actifs = prets.filter(p => p.statut !== "rembourse" && p.statut !== "annule");
      const encours = actifs.reduce((s, p) => s + (p.reste_a_payer ?? 0), 0);
      const tresorerie = (caissesRes.data ?? []).reduce((s: number, c: any) => s + c.solde, 0);
      const totalOctroye = prets.reduce((s, p) => s + p.montant, 0);
      const totalRemb = prets.reduce((s, p) => s + p.total_rembourse, 0);
      const tauxRecouvrement = totalOctroye > 0 ? (totalRemb / totalOctroye) * 100 : 0;
      const enRetard = actifs.filter(p => p.jours_retard > 0).slice(0, 5);

      const parVille: Record<string, number> = {};
      actifs.forEach(p => { parVille[p.client_ville] = (parVille[p.client_ville] ?? 0) + (p.reste_a_payer ?? 0); });

      const parType: Record<string, number> = {};
      actifs.forEach(p => { parType[p.type_operation] = (parType[p.type_operation] ?? 0) + (p.reste_a_payer ?? 0); });

      // Activité récente : derniers prêts + remboursements
      const derniersPrets = prets.slice(0, 6).map(p => ({
        type: "octroi" as const, ref: p.id, client: p.client_nom,
        montant: p.montant, date: p.date_octroi,
      }));
      const derniersRemb = (rembRes.data ?? []).map((r: any) => ({
        type: "remboursement" as const, ref: r.pret_id,
        client: r.prets?.clients?.nom ?? "—", montant: r.montant, date: r.date_remb,
      }));
      const activite = [...derniersPrets, ...derniersRemb]
        .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

      setStats({
        encours, tresorerie,
        nbCommerçants: clientsRes.count ?? 0,
        nbImpayes: actifs.length,
        tauxRecouvrement,
        enRetard,
        parVille: Object.entries(parVille).map(([ville, montant]) => ({ ville, montant })).sort((a,b)=>b.montant-a.montant).slice(0,7),
        parType: Object.entries(parType).map(([type, montant]) => ({ type, montant })),
        activiteRecente: activite,
      });
      setLoading(false);
    }
    load();
  }, []);

  return { stats, loading };
}

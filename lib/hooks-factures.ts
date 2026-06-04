"use client";

import { useCallback, useEffect, useState } from "react";
import { getClient } from "./supabase";

export type TypeDoc = "commande" | "facture";
export type StatutDoc = "brouillon" | "validee" | "payee" | "annulee";

export interface LigneFacture {
  id?: string;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  montant: number;
  rang?: number;
}

export interface PaiementFacture {
  id?: string;
  facture_id?: string;
  montant: number;
  mode: string;
  date_paiement: string;
  caisse_id?: string | null;
}

export interface Facture {
  id: string;
  type: TypeDoc;
  client_id: string;
  client_nom?: string;
  client_ville?: string;
  date_facture: string;
  echeance: string | null;
  statut: StatutDoc;
  montant_total: number;
  total_paye?: number;
  reste_a_payer?: number;
  notes: string | null;
  dolibarr_id: string | null;
  created_at: string;
  lignes?: LigneFacture[];
  paiements?: PaiementFacture[];
}

export function useFactures(filter?: { type?: TypeDoc; statut?: string }) {
  const [data, setData] = useState<Facture[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      let q = (getClient() as any).from("v_factures").select("*").order("created_at", { ascending: false });
      if (filter?.type) q = q.eq("type", filter.type);
      if (filter?.statut && filter.statut !== "tous") q = q.eq("statut", filter.statut);
      const { data: rows, error } = await q;
      if (error) throw error;
      setData((rows ?? []).map((f: any) => ({ ...f, client_nom: f.client_nom ?? f.client_id, client_ville: f.client_ville ?? "" })));
    } catch { setData([]); }
    setLoading(false);
  }, [filter?.type, filter?.statut]);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}

export async function getFacture(id: string): Promise<Facture | null> {
  const sb = getClient() as any;
  const { data: f } = await sb.from("factures").select("*, client:clients(*), lignes:factures_lignes(*), paiements:factures_paiements(*)").eq("id", id).maybeSingle();
  if (!f) return null;
  const paiements = (f.paiements ?? []).sort((a: any, b: any) => (a.date_paiement < b.date_paiement ? 1 : -1));
  const total_paye = paiements.reduce((s: number, p: any) => s + (p.montant ?? 0), 0);
  return {
    ...f,
    client_nom: f.client?.nom ?? f.client_id,
    client_ville: f.client?.ville ?? "",
    lignes: (f.lignes ?? []).sort((a: any, b: any) => (a.rang ?? 0) - (b.rang ?? 0)),
    paiements,
    total_paye,
    reste_a_payer: Math.max(0, (f.montant_total ?? 0) - total_paye),
  };
}

export async function enregistrerPaiement(input: {
  facture_id: string;
  montant: number;
  mode: string;
  date_paiement?: string;
  caisse_id?: string | null;
  user_id?: string;
}): Promise<void> {
  const sb = getClient() as any;
  const { error } = await sb.from("factures_paiements").insert({
    facture_id: input.facture_id, montant: Math.round(input.montant), mode: input.mode,
    date_paiement: input.date_paiement || new Date().toISOString().slice(0, 10),
    caisse_id: input.caisse_id || null, saisi_par: input.user_id || null,
  });
  if (error) throw error;
  // Le statut de la facture est recalculé automatiquement (trigger).
  // Si une caisse est précisée, on l'alimente (mouvement de caisse).
  if (input.caisse_id) {
    await sb.from("mouvements_caisse").insert({
      caisse_id: input.caisse_id, type: "remboursement", montant: Math.round(input.montant),
      libelle: `Encaissement facture ${input.facture_id}`, par_user: input.user_id || null,
      reference_id: input.facture_id,
    });
  }
}

export async function creerFacture(input: {
  type: TypeDoc;
  client_id: string;
  date_facture: string;
  echeance?: string | null;
  notes?: string;
  user_id?: string;
  lignes: { designation: string; quantite: number; prix_unitaire: number }[];
}): Promise<string> {
  const sb = getClient() as any;
  const lignes = input.lignes
    .filter(l => l.designation.trim() && l.quantite > 0)
    .map((l, i) => ({ designation: l.designation.trim(), quantite: l.quantite, prix_unitaire: l.prix_unitaire, montant: Math.round(l.quantite * l.prix_unitaire), rang: i }));
  const montant_total = lignes.reduce((s, l) => s + l.montant, 0);

  const { data: fac, error } = await sb.from("factures").insert({
    type: input.type, client_id: input.client_id, date_facture: input.date_facture,
    echeance: input.echeance || null, notes: input.notes || null, statut: "brouillon",
    montant_total, cree_par: input.user_id || null,
  }).select("id").single();
  if (error) throw error;

  if (lignes.length) {
    const { error: e2 } = await sb.from("factures_lignes").insert(lignes.map(l => ({ ...l, facture_id: fac.id })));
    if (e2) throw e2;
  }
  return fac.id;
}

export async function changerStatutFacture(id: string, statut: StatutDoc): Promise<void> {
  const { error } = await (getClient() as any).from("factures").update({ statut, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function supprimerFacture(id: string): Promise<void> {
  const { error } = await (getClient() as any).from("factures").delete().eq("id", id);
  if (error) throw error;
}

// Convertir une commande en facture (duplique les lignes)
export async function convertirEnFacture(commandeId: string, user_id?: string): Promise<string> {
  const c = await getFacture(commandeId);
  if (!c) throw new Error("Commande introuvable");
  return creerFacture({
    type: "facture", client_id: c.client_id, date_facture: new Date().toISOString().slice(0, 10),
    echeance: c.echeance, notes: c.notes ?? undefined, user_id,
    lignes: (c.lignes ?? []).map(l => ({ designation: l.designation, quantite: l.quantite, prix_unitaire: l.prix_unitaire })),
  });
}

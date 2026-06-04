"use client";

import { useCallback, useEffect, useState } from "react";
import { getClient } from "./supabase";

// ── Types ────────────────────────────────────────────────────────────────────
export type SourceCompte = "caisse" | "dolibarr";
export type TypeCompte   = "caisse_especes" | "banque" | "mobile_money" | "autre";

export interface CompteUnifie {
  uid:          string;   // 'c-xxx' ou 'd-xxx'
  compte_id:    string;
  source:       SourceCompte;
  nom:          string;
  type:         TypeCompte;
  banque:       string;
  numero_compte:string | null;
  iban:         string | null;
  titulaire:    string | null;
  solde:        number;
  actif:        boolean;
  agence:       string | null;
  assignee_id:  string | null;
  dolibarr_id:  string | null;
}

export interface MouvementCompte {
  id: string;
  type: string;
  montant: number;
  libelle: string | null;
  created_at: string;
}

export const TYPE_LABEL: Record<TypeCompte, string> = {
  caisse_especes: "Caisse espèces",
  banque:         "Banque",
  mobile_money:   "Mobile Money",
  autre:          "Autre",
};
export const TYPE_BADGE: Record<TypeCompte, string> = {
  caisse_especes: "bg-leaf-100 text-leaf-600",
  banque:         "bg-blue-100 text-blue-700",
  mobile_money:   "bg-orange-100 text-orange-700",
  autre:          "bg-sand-200 text-ink-600",
};
export const SOURCE_BADGE: Record<SourceCompte, string> = {
  caisse:   "bg-clay-100 text-clay-700",
  dolibarr: "bg-sand-200 text-ink-500",
};

// ── Lecture ──────────────────────────────────────────────────────────────────
export function useComptesUnifies() {
  const [data, setData] = useState<CompteUnifie[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rows } = await (getClient() as any)
        .from("v_comptes_unifies").select("*");
      setData((rows ?? []).map((r: any) => ({ ...r, solde: Number(r.solde ?? 0) })));
    } catch { setData([]); }
    setLoading(false);
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}

export function useHistoriqueCompte(uid: string) {
  const [data, setData] = useState<MouvementCompte[]>([]);
  const refetch = useCallback(async () => {
    if (!uid) { setData([]); return; }
    const sb = getClient() as any;
    const [source, id] = uid.startsWith("c-") ? ["caisse", uid.slice(2)] : ["dolibarr", uid.slice(2)];
    try {
      if (source === "caisse") {
        const { data: rows } = await sb.from("mouvements_caisse").select("id,type,montant,libelle,created_at")
          .eq("caisse_id", id).order("created_at", { ascending: false }).limit(20);
        setData(rows ?? []);
      } else {
        const { data: rows } = await sb.from("mouvements_comptes_bancaires").select("id,type,montant,libelle,created_at")
          .eq("compte_id", id).order("created_at", { ascending: false }).limit(20);
        setData(rows ?? []);
      }
    } catch { setData([]); }
  }, [uid]);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, refetch };
}

// ── Résumé trésorerie ────────────────────────────────────────────────────────
export function resumeTresorerie(comptes: CompteUnifie[]) {
  const actifs = comptes.filter(c => c.actif);
  return {
    totalCaisses: actifs.filter(c => c.source === "caisse").reduce((s, c) => s + c.solde, 0),
    totalBanques: actifs.filter(c => c.source === "dolibarr" && c.type === "banque").reduce((s, c) => s + c.solde, 0),
    totalEspeces: actifs.filter(c => c.source === "dolibarr" && c.type === "caisse_especes").reduce((s, c) => s + c.solde, 0),
    totalMobile:  actifs.filter(c => c.type === "mobile_money").reduce((s, c) => s + c.solde, 0),
    totalGlobal:  actifs.reduce((s, c) => s + c.solde, 0),
  };
}

// ── Création ─────────────────────────────────────────────────────────────────
export async function creerCaisseUnifiee(input: { nom: string; agence: string; assignee_id?: string }) {
  const id = "c-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const { error } = await (getClient() as any).from("caisses").insert({ id, ...input, actif: true });
  if (error) throw error;
}

export async function creerCompteBancaire(input: {
  nom: string; type: TypeCompte; banque?: string; numero_compte?: string;
  iban?: string; titulaire?: string; solde_dolibarr?: number;
}) {
  const id = "CB-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const { error } = await (getClient() as any).from("comptes_bancaires").insert({
    id, ...input, banque: input.banque || null, numero_compte: input.numero_compte || null,
    iban: input.iban || null, titulaire: input.titulaire || null,
    solde_dolibarr: input.solde_dolibarr ?? 0, actif: true,
  });
  if (error) throw error;
}

// ── Modification ─────────────────────────────────────────────────────────────
export async function modifierCaisse(id: string, patch: { nom?: string; agence?: string; assignee_id?: string | null; actif?: boolean }) {
  const { error } = await (getClient() as any).from("caisses").update(patch).eq("id", id);
  if (error) throw error;
}

export async function modifierCompteBancaire(id: string, patch: {
  nom?: string; type?: TypeCompte; banque?: string | null;
  numero_compte?: string | null; iban?: string | null; titulaire?: string | null; actif?: boolean;
}) {
  const { error } = await (getClient() as any).from("comptes_bancaires").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// ── Alimentation / Retrait ───────────────────────────────────────────────────
export async function alimenterCompte(uid: string, montant: number, libelle: string, userId?: string) {
  const sb = getClient() as any;
  if (uid.startsWith("c-")) {
    const { error } = await sb.from("mouvements_caisse").insert({ caisse_id: uid.slice(2), type: "alimentation", montant, libelle, par_user: userId || null });
    if (error) throw error;
  } else {
    const { error } = await sb.from("mouvements_comptes_bancaires").insert({ compte_id: uid.slice(2), type: "appro", montant, libelle, par_user: userId || null });
    if (error) throw error;
  }
}

export async function retirerCompte(uid: string, montant: number, libelle: string, userId?: string) {
  const sb = getClient() as any;
  if (uid.startsWith("c-")) {
    const { error } = await sb.from("mouvements_caisse").insert({ caisse_id: uid.slice(2), type: "retrait", montant: -montant, libelle, par_user: userId || null });
    if (error) throw error;
  } else {
    const { error } = await sb.from("mouvements_comptes_bancaires").insert({ compte_id: uid.slice(2), type: "retrait", montant: -montant, libelle, par_user: userId || null });
    if (error) throw error;
  }
}

// ── Virement entre comptes (RPC atomique) ────────────────────────────────────
export async function virerEntreComptes(sourceUid: string, destUid: string, montant: number, libelle: string, userId?: string) {
  const typeOf = (uid: string) => uid.startsWith("c-") ? "caisse" : "compte";
  const idOf   = (uid: string) => uid.startsWith("c-") ? uid.slice(2) : uid.slice(2);
  const { error } = await (getClient() as any).rpc("transfert_comptes", {
    p_source_type: typeOf(sourceUid), p_source_id: idOf(sourceUid),
    p_dest_type:   typeOf(destUid),   p_dest_id:   idOf(destUid),
    p_montant: montant, p_libelle: libelle, p_user_id: userId || null,
  });
  if (error) throw error;
}

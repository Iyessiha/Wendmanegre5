"use client";

import { useState, useCallback, useEffect } from "react";
import { getClient } from "./supabase";

// ── Types ───────────────────────────────────────────────────

export interface Produit {
  id: string; nom: string; categorie: string; code_barre?: string;
  reference_interne?: string; unite: string; tva_taux: number;
  prix_unitaire: number; prix_achat: number; stock: number;
  stock_max?: number; seuil_alerte: number; entrepot: string;
  fournisseur_id?: string; fournisseur_nom?: string;
  actif: boolean; notes?: string;
  // calculés
  valeur_achat: number; valeur_vente: number; marge_potentielle: number;
  niveau_stock: "normal" | "faible" | "critique" | "rupture";
}

export interface Fournisseur {
  id: string; nom: string; type: string; telephone?: string;
  email?: string; adresse?: string; contact?: string;
  delai_livraison: number; conditions_paiement: string;
  solde_du: number; actif: boolean;
  nb_commandes?: number; derniere_commande?: string;
}

export interface LigneCommande {
  id: string; produit_id?: string; produit_nom?: string;
  description?: string; quantite: number; prix_unitaire: number; montant: number;
}

export interface CommandeFournisseur {
  id: string; fournisseur_id: string; fournisseur_nom: string;
  date_commande: string; date_livraison_prevue?: string;
  statut: "brouillon" | "validee" | "recue" | "facturee" | "annulee";
  montant_total: number; notes?: string;
  lignes: LigneCommande[];
}

export interface MouvementStock {
  id: string; produit_id: string; produit_nom: string;
  type: "entree" | "sortie" | "ajustement" | "inventaire" | "transfert";
  quantite: number; motif: string; reference_id?: string;
  par_user?: string; date_mvt: string;
}

export interface Vente {
  id: string; numero?: string; produit_id: string; produit_nom: string;
  quantite: number; prix_unitaire: number; remise_pct: number;
  montant_total: number; cout_achat: number; marge: number;
  mode_paiement: string; client_nom?: string; client_tel?: string;
  caisse_id?: string; annulee: boolean; date_vente: string;
}

export interface LigneInventaire {
  produit_id: string; produit_nom: string; categorie: string;
  entrepot: string; stock_theorique: number; stock_compte: number;
  ecart: number;
}

// ── Données de démo ─────────────────────────────────────────

export const PRODUITS_DEMO: Produit[] = [
  { id: "p1",  nom: "Carte SIM Orange",       categorie: "SIM",      code_barre: "619188",  unite: "unité", tva_taux: 0, prix_unitaire: 500,   prix_achat: 350,   stock: 240, seuil_alerte: 50, stock_max: 500, entrepot: "Yako Centre", actif: true, notes: "SIM standard 4G",    valeur_achat: 84000,    valeur_vente: 120000,   marge_potentielle: 36000,    niveau_stock: "normal"   },
  { id: "p2",  nom: "Carte SIM Moov",         categorie: "SIM",      code_barre: "619189",  unite: "unité", tva_taux: 0, prix_unitaire: 500,   prix_achat: 350,   stock: 38,  seuil_alerte: 50, stock_max: 300, entrepot: "Yako Centre", actif: true, notes: "SIM Moov 4G",        valeur_achat: 13300,    valeur_vente: 19000,    marge_potentielle: 5700,     niveau_stock: "critique" },
  { id: "p3",  nom: "Carte SIM Telecel",      categorie: "SIM",      code_barre: "619190",  unite: "unité", tva_taux: 0, prix_unitaire: 500,   prix_achat: 350,   stock: 120, seuil_alerte: 50, stock_max: 300, entrepot: "Bokin",       actif: true, notes: undefined,                 valeur_achat: 42000,    valeur_vente: 60000,    marge_potentielle: 18000,    niveau_stock: "normal"   },
  { id: "p4",  nom: "Recharge 1 000 F Orange",categorie: "Recharge", code_barre: "R1000-OM",unite: "carte", tva_taux: 0, prix_unitaire: 1000,  prix_achat: 970,   stock: 500, seuil_alerte: 100,stock_max: 1000,entrepot: "Yako Centre", actif: true, notes: "Scratch card",       valeur_achat: 485000,   valeur_vente: 500000,   marge_potentielle: 15000,    niveau_stock: "normal"   },
  { id: "p5",  nom: "Recharge 5 000 F Orange",categorie: "Recharge", code_barre: "R5000-OM",unite: "carte", tva_taux: 0, prix_unitaire: 5000,  prix_achat: 4850,  stock: 85,  seuil_alerte: 100,stock_max: 500, entrepot: "Yako Centre", actif: true, notes: undefined,                 valeur_achat: 412250,   valeur_vente: 425000,   marge_potentielle: 12750,    niveau_stock: "faible"   },
  { id: "p6",  nom: "Tecno Spark 10 Pro",     categorie: "Téléphone",code_barre: "TECNO-S10",unite: "unité",tva_taux: 0, prix_unitaire: 95000, prix_achat: 80000, stock: 12,  seuil_alerte: 5,  stock_max: 30,  entrepot: "Yako Centre", actif: true, notes: "6.8 pouces, 4G",     valeur_achat: 960000,   valeur_vente: 1140000,  marge_potentielle: 180000,   niveau_stock: "normal"   },
  { id: "p7",  nom: "Tecno Pop 7",            categorie: "Téléphone",code_barre: "TECNO-P7", unite: "unité",tva_taux: 0, prix_unitaire: 55000, prix_achat: 44000, stock: 8,   seuil_alerte: 5,  stock_max: 20,  entrepot: "Yako Centre", actif: true, notes: "Entrée de gamme",    valeur_achat: 352000,   valeur_vente: 440000,   marge_potentielle: 88000,    niveau_stock: "faible"   },
  { id: "p8",  nom: "Powerbank 10 000 mAh",  categorie: "Accessoire",code_barre: "PB-10K",  unite: "unité",tva_taux: 0, prix_unitaire: 8500,  prix_achat: 5500,  stock: 4,   seuil_alerte: 10, stock_max: 50,  entrepot: "Bokin",       actif: true, notes: undefined,                 valeur_achat: 22000,    valeur_vente: 34000,    marge_potentielle: 12000,    niveau_stock: "critique" },
  { id: "p9",  nom: "Câble USB-C 1m",        categorie: "Accessoire",code_barre: "USB-C1",  unite: "unité",tva_taux: 0, prix_unitaire: 2500,  prix_achat: 1200,  stock: 65,  seuil_alerte: 20, stock_max: 200, entrepot: "Yako Centre", actif: true, notes: undefined,                 valeur_achat: 78000,    valeur_vente: 162500,   marge_potentielle: 84500,    niveau_stock: "normal"   },
  { id: "p10", nom: "Coque silicone Tecno",  categorie: "Accessoire",code_barre: "CSQ-T",   unite: "unité",tva_taux: 0, prix_unitaire: 1500,  prix_achat: 600,   stock: 0,   seuil_alerte: 20, stock_max: 100, entrepot: "Yako Centre", actif: true, notes: undefined,                 valeur_achat: 0,        valeur_vente: 0,        marge_potentielle: 0,        niveau_stock: "rupture"  },
  { id: "p11", nom: "Carte SIM Wizall",       categorie: "SIM",      code_barre: "619200",  unite: "unité", tva_taux: 0, prix_unitaire: 500,   prix_achat: 350,   stock: 55,  seuil_alerte: 30, stock_max: 200, entrepot: "Yako Centre", actif: true, notes: undefined,                 valeur_achat: 19250,    valeur_vente: 27500,    marge_potentielle: 8250,     niveau_stock: "normal"   },
  { id: "p12", nom: "Recharge 2 000 F Moov", categorie: "Recharge", code_barre: "R2000-MV",unite: "carte", tva_taux: 0, prix_unitaire: 2000,  prix_achat: 1940,  stock: 0,   seuil_alerte: 50, stock_max: 300, entrepot: "Bokin",       actif: true, notes: undefined,                 valeur_achat: 0,        valeur_vente: 0,        marge_potentielle: 0,        niveau_stock: "rupture"  },
];

export const FOURNISSEURS_DEMO: Fournisseur[] = [
  { id: "f1", nom: "Orange Money Burkina",    type: "OPERATEUR",    telephone: "+226 76 00 00 00", email: "distribution.bf@orange.com", adresse: "Ouagadougou", contact: "Service distributeurs", delai_livraison: 3,  conditions_paiement: "Avance",         solde_du: 0,        actif: true, nb_commandes: 24, derniere_commande: "2026-06-01" },
  { id: "f2", nom: "Moov Africa Burkina",     type: "OPERATEUR",    telephone: "+226 70 00 00 00", email: "pro@moov.bf",               adresse: "Ouagadougou", contact: "Service distribution",  delai_livraison: 5,  conditions_paiement: "Avance",         solde_du: 0,        actif: true, nb_commandes: 12, derniere_commande: "2026-05-28" },
  { id: "f3", nom: "Telecel Faso",            type: "OPERATEUR",    telephone: "+226 78 00 00 00", email: undefined,                        adresse: "Koudougou",   contact: "Agence Yako",           delai_livraison: 7,  conditions_paiement: "À réception",    solde_du: 150000,   actif: true, nb_commandes: 6,  derniere_commande: "2026-05-15" },
  { id: "f4", nom: "Grossiste SIM Yako",      type: "DISTRIBUTEUR", telephone: "+226 71 00 00 00", email: undefined,                        adresse: "Marché Yako", contact: "Hamidou",               delai_livraison: 1,  conditions_paiement: "Espèces",        solde_du: 0,        actif: true, nb_commandes: 18, derniere_commande: "2026-06-03" },
  { id: "f5", nom: "TECNO Burkina Faso",      type: "DISTRIBUTEUR", telephone: "+226 25 33 44 55", email: "bf@tecno-mobile.com",       adresse: "Ouagadougou", contact: "Commercial",            delai_livraison: 14, conditions_paiement: "30 jours",       solde_du: 480000,   actif: true, nb_commandes: 4,  derniere_commande: "2026-04-10" },
];

export const COMMANDES_DEMO: CommandeFournisseur[] = [
  {
    id: "cmd1", fournisseur_id: "f1", fournisseur_nom: "Orange Money Burkina",
    date_commande: "2026-06-01", date_livraison_prevue: "2026-06-04",
    statut: "recue", montant_total: 500000,
    lignes: [
      { id: "l1", produit_id: "p1", produit_nom: "Carte SIM Orange",       quantite: 200, prix_unitaire: 350, montant: 70000 },
      { id: "l2", produit_id: "p4", produit_nom: "Recharge 1000F Orange",  quantite: 400, prix_unitaire: 970, montant: 388000 },
      { id: "l3", produit_id: "p5", produit_nom: "Recharge 5000F Orange",  quantite: 20,  prix_unitaire: 4850, montant: 97000 },
    ]
  },
  {
    id: "cmd2", fournisseur_id: "f4", fournisseur_nom: "Grossiste SIM Yako",
    date_commande: "2026-06-03", date_livraison_prevue: "2026-06-05",
    statut: "validee", montant_total: 87500,
    lignes: [
      { id: "l4", produit_id: "p2", produit_nom: "Carte SIM Moov",    quantite: 100, prix_unitaire: 350, montant: 35000 },
      { id: "l5", produit_id: "p11",produit_nom: "Carte SIM Wizall",  quantite: 100, prix_unitaire: 350, montant: 35000 },
      { id: "l6", produit_id: "p3", produit_nom: "Carte SIM Telecel", quantite: 50,  prix_unitaire: 350, montant: 17500 },
    ]
  },
  {
    id: "cmd3", fournisseur_id: "f5", fournisseur_nom: "TECNO Burkina Faso",
    date_commande: "2026-05-20", date_livraison_prevue: "2026-06-15",
    statut: "brouillon", montant_total: 960000,
    lignes: [
      { id: "l7", produit_id: "p6", produit_nom: "Tecno Spark 10 Pro", quantite: 10, prix_unitaire: 80000, montant: 800000 },
      { id: "l8", produit_id: "p7", produit_nom: "Tecno Pop 7",        quantite: 8,  prix_unitaire: 44000, montant: 352000 },
      { id: "l9", produit_id: "p8", produit_nom: "Powerbank 10000mAh", quantite: 20, prix_unitaire: 5500,  montant: 110000 },
    ]
  },
];

export const MOUVEMENTS_DEMO: MouvementStock[] = [
  { id: "m1",  produit_id: "p1",  produit_nom: "Carte SIM Orange",       type: "entree",    quantite: 200,  motif: "reception_commande", reference_id: "cmd1", date_mvt: "2026-06-01" },
  { id: "m2",  produit_id: "p4",  produit_nom: "Recharge 1000F Orange",  type: "entree",    quantite: 400,  motif: "reception_commande", reference_id: "cmd1", date_mvt: "2026-06-01" },
  { id: "m3",  produit_id: "p1",  produit_nom: "Carte SIM Orange",       type: "sortie",    quantite: -5,   motif: "vente",              reference_id: "VTE-2606-0012", date_mvt: "2026-06-03" },
  { id: "m4",  produit_id: "p6",  produit_nom: "Tecno Spark 10 Pro",     type: "sortie",    quantite: -2,   motif: "vente",              reference_id: "VTE-2606-0011", date_mvt: "2026-06-02" },
  { id: "m5",  produit_id: "p10", produit_nom: "Coque silicone Tecno",   type: "sortie",    quantite: -12,  motif: "vente",              reference_id: "VTE-2606-0010", date_mvt: "2026-06-01" },
  { id: "m6",  produit_id: "p8",  produit_nom: "Powerbank 10000mAh",     type: "sortie",    quantite: -6,   motif: "vente",              reference_id: "VTE-2606-0009", date_mvt: "2026-05-30" },
  { id: "m7",  produit_id: "p5",  produit_nom: "Recharge 5000F Orange",  type: "entree",    quantite: 50,   motif: "reception_commande", reference_id: "cmd1", date_mvt: "2026-05-28" },
  { id: "m8",  produit_id: "p9",  produit_nom: "Câble USB-C 1m",         type: "ajustement",quantite: -3,   motif: "perte",              reference_id: undefined,   date_mvt: "2026-05-25" },
  { id: "m9",  produit_id: "p2",  produit_nom: "Carte SIM Moov",         type: "entree",    quantite: 150,  motif: "reception_commande", reference_id: "cmd2", date_mvt: "2026-05-20" },
  { id: "m10", produit_id: "p7",  produit_nom: "Tecno Pop 7",            type: "sortie",    quantite: -1,   motif: "vente",              reference_id: "VTE-2606-0008", date_mvt: "2026-05-18" },
];

export const VENTES_DEMO: Vente[] = [
  { id: "v1",  numero: "VTE-2606-0012", produit_id: "p1", produit_nom: "Carte SIM Orange",      quantite: 5,  prix_unitaire: 500,  remise_pct: 0, montant_total: 2500,   cout_achat: 1750,  marge: 750,   mode_paiement: "Espèces",      annulee: false, date_vente: "2026-06-03" },
  { id: "v2",  numero: "VTE-2606-0011", produit_id: "p6", produit_nom: "Tecno Spark 10 Pro",    quantite: 2,  prix_unitaire: 95000,remise_pct: 0, montant_total: 190000, cout_achat: 160000,marge: 30000, mode_paiement: "Orange Money", annulee: false, date_vente: "2026-06-02" },
  { id: "v3",  numero: "VTE-2606-0010", produit_id: "p10",produit_nom: "Coque silicone Tecno",  quantite: 12, prix_unitaire: 1500, remise_pct: 0, montant_total: 18000,  cout_achat: 7200,  marge: 10800, mode_paiement: "Espèces",      annulee: false, date_vente: "2026-06-01" },
  { id: "v4",  numero: "VTE-2606-0009", produit_id: "p8", produit_nom: "Powerbank 10000mAh",   quantite: 6,  prix_unitaire: 8500, remise_pct: 5, montant_total: 48450,  cout_achat: 33000, marge: 15450, mode_paiement: "Espèces",      annulee: false, date_vente: "2026-05-30" },
  { id: "v5",  numero: "VTE-2606-0008", produit_id: "p7", produit_nom: "Tecno Pop 7",          quantite: 1,  prix_unitaire: 55000,remise_pct: 0, montant_total: 55000,  cout_achat: 44000, marge: 11000, mode_paiement: "Espèces",      annulee: false, date_vente: "2026-05-18" },
  { id: "v6",  numero: "VTE-2606-0007", produit_id: "p9", produit_nom: "Câble USB-C 1m",       quantite: 8,  prix_unitaire: 2500, remise_pct: 0, montant_total: 20000,  cout_achat: 9600,  marge: 10400, mode_paiement: "Espèces",      annulee: false, date_vente: "2026-05-15" },
];

// ── Hooks simples (wrappant demo data + Supabase si configuré) ──

export function useProduits() {
  const [data, setData] = useState<Produit[]>(PRODUITS_DEMO);
  const [loading, setLoading] = useState(false);
  const refetch = useCallback(async () => {
    try {
      const { data: rows } = await (getClient() as any).from("v_stock_valorise").select("*");
      if (rows?.length) setData(rows);
    } catch {}
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}

export function useFournisseurs() {
  const [data, setData] = useState<Fournisseur[]>(FOURNISSEURS_DEMO);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    try {
      const { data: rows, error } = await (getClient() as any).from("fournisseurs").select("*").order("nom");
      if (error) throw error;
      setData(rows ?? []);
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}

export function useCommandes() {
  const [data, setData] = useState<CommandeFournisseur[]>(COMMANDES_DEMO);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    try {
      const { data: rows, error } = await (getClient() as any)
        .from("commandes_fournisseurs")
        .select("*, fournisseur:fournisseurs(nom), lignes:commandes_lignes(*)")
        .order("date_commande", { ascending: false });
      if (error) throw error;
      setData((rows ?? []).map((c: any) => ({
        ...c,
        fournisseur_nom: c.fournisseur?.nom ?? "",
        lignes: (c.lignes ?? []).map((l: any) => ({
          id: l.id, produit_id: l.produit_id, produit_nom: l.description ?? "",
          description: l.description, quantite: l.quantite, prix_unitaire: l.prix_unitaire, montant: l.montant,
        })),
      })));
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}

export function useMouvements() {
  const [data, setData] = useState<MouvementStock[]>(MOUVEMENTS_DEMO);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    try {
      const { data: rows, error } = await (getClient() as any)
        .from("mouvements_stock")
        .select("*, produit:produits(nom)")
        .order("date_mvt", { ascending: false }).limit(50);
      if (error) throw error;
      setData((rows ?? []).map((m: any) => ({ ...m, produit_nom: m.produit?.nom ?? "" })));
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}

export function useVentes() {
  const [data, setData] = useState<Vente[]>(VENTES_DEMO);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    try {
      const { data: rows, error } = await (getClient() as any)
        .from("ventes")
        .select("*, produit:produits(nom)")
        .order("date_vente", { ascending: false }).limit(100);
      if (error) throw error;
      setData((rows ?? []).map((v: any) => ({ ...v, produit_nom: v.produit?.nom ?? "" })));
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}

export async function creerVente(input: {
  produit_id: string; quantite: number; prix_unitaire: number;
  remise_pct: number; cout_achat: number; mode_paiement: string;
  client_nom?: string; client_tel?: string; caisse_id?: string; user_id?: string;
}): Promise<void> {
  const montant_total = Math.round(input.prix_unitaire * input.quantite * (1 - input.remise_pct / 100));
  const marge = montant_total - input.cout_achat * input.quantite;
  try {
    await (getClient() as any).from("ventes").insert({
      produit_id: input.produit_id, quantite: input.quantite,
      prix_unitaire: input.prix_unitaire, remise_pct: input.remise_pct,
      montant_total, cout_achat: input.cout_achat * input.quantite, marge,
      mode_paiement: input.mode_paiement,
      client_nom: input.client_nom ?? null, client_tel: input.client_tel ?? null,
      caisse_id: input.caisse_id ?? null, vendu_par: input.user_id ?? null,
    });
  } catch (e) { console.warn("Vente en mode demo seulement:", e); }
}

export async function creerCommande(input: {
  fournisseur_id: string; date_livraison_prevue?: string; notes?: string;
  lignes: { produit_id?: string; description: string; quantite: number; prix_unitaire: number }[];
}): Promise<string> {
  const sb = getClient() as any;
  const montant_total = input.lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
  const { data: cmd, error } = await sb.from("commandes_fournisseurs").insert({
    fournisseur_id: input.fournisseur_id,
    date_livraison_prevue: input.date_livraison_prevue || null,
    notes: input.notes || null, statut: "brouillon", montant_total,
  }).select("id").single();
  if (error) throw error;
  const lignes = input.lignes.map(l => ({
    commande_id: cmd.id, produit_id: l.produit_id || null, description: l.description,
    quantite: l.quantite, prix_unitaire: l.prix_unitaire, montant: l.quantite * l.prix_unitaire,
  }));
  const { error: e2 } = await sb.from("commandes_lignes").insert(lignes);
  if (e2) throw e2;
  return cmd.id;
}

export async function changerStatutCommande(id: string, statut: string): Promise<void> {
  const { error } = await (getClient() as any).from("commandes_fournisseurs").update({ statut }).eq("id", id);
  if (error) throw error;
}

export async function recevoirCommande(commande: CommandeFournisseur): Promise<void> {
  const sb = getClient() as any;
  const { data: rec, error } = await sb.from("receptions").insert({
    commande_id: commande.id, date_reception: new Date().toISOString().slice(0, 10),
  }).select("id").single();
  if (error) throw error;
  const lignes = commande.lignes
    .filter(l => l.produit_id)
    .map(l => ({ reception_id: rec.id, produit_id: l.produit_id, quantite_cmd: l.quantite, quantite_recue: l.quantite }));
  if (lignes.length) {
    const { error: e2 } = await sb.from("receptions_lignes").insert(lignes);
    if (e2) throw e2;
  }
  await sb.from("commandes_fournisseurs").update({ statut: "recue" }).eq("id", commande.id);
}

export async function creerProduit(input: {
  nom: string; categorie: string; code_barre?: string; prix_unitaire: number;
  prix_achat: number; stock: number; seuil_alerte: number; entrepot: string;
  fournisseur_id?: string; notes?: string;
}): Promise<void> {
  const id = "PRD-" + Date.now().toString(36).toUpperCase();
  const { error } = await (getClient() as any).from("produits").insert({
    id, nom: input.nom, categorie: input.categorie, code_barre: input.code_barre || null,
    prix_unitaire: input.prix_unitaire, prix_achat: input.prix_achat, stock: input.stock,
    seuil_alerte: input.seuil_alerte, entrepot: input.entrepot,
    fournisseur_id: input.fournisseur_id || null, notes: input.notes || null, actif: true,
  });
  if (error) throw error;
}

export async function ajusterStock(produit_id: string, quantite: number, motif: string): Promise<void> {
  try {
    await (getClient() as any).from("mouvements_stock").insert({
      produit_id, type: quantite > 0 ? "entree" : "ajustement",
      quantite, motif, date_mvt: new Date().toISOString().slice(0,10),
    });
  } catch (e) { console.warn("Ajustement en mode demo:", e); }
}

// ── Entrepôts (CRUD complet) ──────────────────────────────

export interface Entrepot {
  id: string;
  nom: string;
  ville: string | null;
  adresse: string | null;
  responsable_id: string | null;
  responsable_nom?: string | null;
  actif: boolean;
}

export function useEntrepots() {
  const [data, setData] = useState<Entrepot[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    try {
      const { data: rows, error } = await (getClient() as any)
        .from("entrepots").select("*, responsable:profiles(nom)").eq("actif", true).order("nom");
      if (error) throw error;
      setData((rows ?? []).map((e: any) => ({ ...e, responsable_nom: e.responsable?.nom ?? null })));
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { refetch(); }, [refetch]);
  return { data, loading, refetch };
}

export async function creerEntrepot(input: { nom: string; ville?: string; adresse?: string; responsable_id?: string }): Promise<void> {
  const { error } = await (getClient() as any).from("entrepots").insert({
    nom: input.nom, ville: input.ville || null, adresse: input.adresse || null,
    responsable_id: input.responsable_id || null, actif: true,
  });
  if (error) throw error;
}

export async function modifierEntrepot(id: string, patch: { nom?: string; ville?: string | null; adresse?: string | null; responsable_id?: string | null }): Promise<void> {
  const { error } = await (getClient() as any).from("entrepots").update(patch).eq("id", id);
  if (error) throw error;
}

export async function supprimerEntrepot(id: string): Promise<void> {
  const { error } = await (getClient() as any).from("entrepots").update({ actif: false }).eq("id", id);
  if (error) throw error;
}

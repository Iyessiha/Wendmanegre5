"use client";

import { useEffect, useState, useCallback } from "react";
import { getClient } from "./supabase";

// ── Types ──────────────────────────────────────────────────

export type TypeContrat = "CDI" | "CDD" | "STAGE" | "FREELANCE";
export type StatutPresence = "present" | "absent" | "conge" | "retard" | "maladie" | "demi_journee" | "ferie";
export type StatutConge = "en_attente" | "approuve" | "refuse";
export type StatutPaie = "brouillon" | "valide" | "paye";

export interface Employe {
  id: string;
  nom: string; // from profiles join
  role: string;
  telephone: string | null;
  agence: string;
  // grh_employes fields
  numero_cnss: string | null;
  numero_cnib: string | null;
  date_naissance: string | null;
  lieu_naissance: string | null;
  adresse: string | null;
  type_contrat: TypeContrat;
  date_debut: string;
  date_fin_contrat: string | null;
  poste: string | null;
  departement: string;
  salaire_base: number;
  prime_base: number;
  solde_conges: number;
  jours_conges_pris: number;
  contact_urgence_nom: string | null;
  contact_urgence_tel: string | null;
  iban_bancaire: string | null;
  notes: string | null;
  actif: boolean;
}

export interface Presence {
  id: string;
  employe_id: string;
  employe_nom?: string;
  date_presence: string;
  statut: StatutPresence;
  heure_arrivee: string | null;
  heure_depart: string | null;
  nb_heures: number | null;
  notes: string | null;
}

export interface Conge {
  id: string;
  employe_id: string;
  employe_nom?: string;
  type: string;
  date_debut: string;
  date_fin: string;
  nb_jours: number;
  motif: string | null;
  statut: StatutConge;
  approuve_par: string | null;
  date_decision: string | null;
  notes_admin: string | null;
  created_at: string;
}

export interface FichePaie {
  id: string;
  employe_id: string;
  employe_nom?: string;
  poste?: string;
  periode: string; // YYYY-MM
  jours_travailles: number;
  jours_absents: number;
  salaire_base: number;
  primes: number;
  heures_sup: number;
  avances_deduites: number;
  autres_retenues: number;
  cnss_employe: number;
  cnss_employeur: number;
  iuts: number;
  salaire_brut: number;
  salaire_net: number;
  cout_employeur: number;
  statut: StatutPaie;
  date_paiement: string | null;
  mode_paiement: string;
  notes: string | null;
}

export interface AvanceSalaire {
  id: string;
  employe_id: string;
  employe_nom?: string;
  montant: number;
  date_avance: string;
  motif: string | null;
  rembourse: boolean;
  caisse_id: string | null;
  created_at: string;
}

// ── Calculs fiscaux Burkina Faso ─────────────────────────

export function calculerPaie(salaire_base: number, prime_base: number, primes_perf: number, jours_travailles: number, avances: number) {
  const joursRef = 26;
  const baseAjustee = Math.round((salaire_base / joursRef) * jours_travailles);
  const salaire_brut = baseAjustee + prime_base + primes_perf;

  // CNSS employé : 5.5% plafonné à 250 000 XOF de base
  const plafond_cnss = 250_000;
  const cnss_employe = Math.min(Math.round(salaire_brut * 0.055), Math.round(plafond_cnss * 0.055));
  const cnss_employeur = Math.min(Math.round(salaire_brut * 0.16), Math.round(plafond_cnss * 0.16));

  // IUTS simplifié (Burkina Faso – barème progressif mensuel)
  const imposable = salaire_brut - cnss_employe;
  let iuts = 0;
  if (imposable > 530_000)      iuts = Math.round((imposable - 530_000) * 0.187 + 280_000 * 0.157 + 150_000 * 0.139 + 80_000 * 0.121);
  else if (imposable > 280_000) iuts = Math.round((imposable - 280_000) * 0.157 + 150_000 * 0.139 + 80_000 * 0.121);
  else if (imposable > 130_000) iuts = Math.round((imposable - 130_000) * 0.139 + 80_000 * 0.121);
  else if (imposable > 50_000)  iuts = Math.round((imposable - 50_000) * 0.121);

  const salaire_net = salaire_brut - cnss_employe - iuts - avances;
  const cout_employeur = salaire_brut + cnss_employeur;

  return { salaire_brut, cnss_employe, cnss_employeur, iuts, salaire_net, cout_employeur };
}

// ── Données de démo (seed) ────────────────────────────────

export const EMPLOYES_DEMO: Employe[] = [
  { id: "u1", nom: "Le Directeur (DG)", role: "admin", telephone: "+226 67 71 33 55", agence: "Yako Centre", numero_cnss: "BF-123456", numero_cnib: "B2034567", date_naissance: "1980-05-12", lieu_naissance: "Ouagadougou", adresse: "Quartier Secteur 1, Yako", type_contrat: "CDI", date_debut: "2020-01-01", date_fin_contrat: null, poste: "Directeur Général", departement: "Direction", salaire_base: 300000, prime_base: 50000, solde_conges: 24, jours_conges_pris: 4, contact_urgence_nom: "OUEDRAOGO Marie", contact_urgence_tel: "+226 70 44 55 66", iban_bancaire: null, notes: null, actif: true },
  { id: "u2", nom: "Aminata OUEDRAOGO", role: "gerant", telephone: "+226 70 11 22 33", agence: "Yako Centre", numero_cnss: "BF-234567", numero_cnib: "B2034568", date_naissance: "1990-08-20", lieu_naissance: "Yako", adresse: "Rue du Commerce, Yako", type_contrat: "CDI", date_debut: "2021-03-15", date_fin_contrat: null, poste: "Gérant d'agence", departement: "Opérations", salaire_base: 120000, prime_base: 15000, solde_conges: 18, jours_conges_pris: 6, contact_urgence_nom: "OUEDRAOGO Sékou", contact_urgence_tel: "+226 76 55 66 77", iban_bancaire: null, notes: null, actif: true },
  { id: "u3", nom: "Boukary SAWADOGO", role: "caissier", telephone: "+226 76 44 55 66", agence: "Yako Centre", numero_cnss: "BF-345678", numero_cnib: "B2034569", date_naissance: "1995-03-08", lieu_naissance: "Bokin", adresse: "Secteur 2, Yako", type_contrat: "CDI", date_debut: "2022-06-01", date_fin_contrat: null, poste: "Caissier principal", departement: "Opérations", salaire_base: 75000, prime_base: 5000, solde_conges: 18, jours_conges_pris: 2, contact_urgence_nom: "SAWADOGO Adja", contact_urgence_tel: "+226 78 66 77 88", iban_bancaire: null, notes: null, actif: true },
  { id: "u4", nom: "Salif KABORE", role: "caissier", telephone: "+226 78 99 00 11", agence: "Bokin", numero_cnss: "BF-456789", numero_cnib: "B2034570", date_naissance: "1997-11-25", lieu_naissance: "Kirsi", adresse: "Centre Bokin", type_contrat: "CDD", date_debut: "2023-01-10", date_fin_contrat: "2025-01-09", poste: "Caissier", departement: "Opérations", salaire_base: 65000, prime_base: 5000, solde_conges: 18, jours_conges_pris: 0, contact_urgence_nom: "KABORE Rasmata", contact_urgence_tel: "+226 70 77 88 99", iban_bancaire: null, notes: "CDD renouvelable", actif: true },
];

export const CONGES_DEMO: Conge[] = [
  { id: "cg1", employe_id: "u3", employe_nom: "Boukary SAWADOGO", type: "annuel", date_debut: "2026-06-10", date_fin: "2026-06-14", nb_jours: 5, motif: "Voyage familial", statut: "en_attente", approuve_par: null, date_decision: null, notes_admin: null, created_at: "2026-06-04T10:00:00Z" },
  { id: "cg2", employe_id: "u2", employe_nom: "Aminata OUEDRAOGO", type: "maladie", date_debut: "2026-05-20", date_fin: "2026-05-22", nb_jours: 3, motif: "Ordonnance médicale", statut: "approuve", approuve_par: "u1", date_decision: "2026-05-19", notes_admin: "Certificat médical reçu", created_at: "2026-05-19T08:00:00Z" },
];

// Présences de la semaine courante (simulées)
function genPresencesSemaine(): Presence[] {
  const today = new Date("2026-06-04");
  const lundi = new Date(today);
  lundi.setDate(today.getDate() - today.getDay() + 1);
  const presences: Presence[] = [];
  const employes = ["u2","u3","u4"];
  const statuts: StatutPresence[] = ["present","present","present","retard","present"];
  for (let j = 0; j < 5; j++) {
    const d = new Date(lundi);
    d.setDate(lundi.getDate() + j);
    const dateStr = d.toISOString().slice(0, 10);
    employes.forEach((eid, ei) => {
      presences.push({
        id: `pr-${eid}-${dateStr}`,
        employe_id: eid,
        date_presence: dateStr,
        statut: j === 2 && ei === 1 ? "absent" : statuts[j],
        heure_arrivee: "08:00",
        heure_depart: "17:00",
        nb_heures: 8,
        notes: null,
      });
    });
  }
  return presences;
}
export const PRESENCES_DEMO = genPresencesSemaine();

// ── Hooks Supabase (avec fallback démo) ──────────────────

export function useEmployes() {
  const [data, setData] = useState<Employe[]>(EMPLOYES_DEMO);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(async () => {
    try {
      const { data: rows } = await (getClient() as any)
        .from("employes")
        .select("*, profile:profiles(nom,role,telephone,agence)")
        .eq("actif", true);
      if (rows?.length) {
        setData(rows.map((r: any) => ({ ...r, ...r.profile })));
      }
    } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
}

export function useConges() {
  const [data, setData] = useState<Conge[]>(CONGES_DEMO);
  const [loading, setLoading] = useState(false);
  return { data, loading };
}

export function usePresencesSemaine(semaine: string) {
  const [data, setData] = useState<Presence[]>(PRESENCES_DEMO);
  const [loading, setLoading] = useState(false);
  return { data, loading };
}

export async function sauvegarderPresence(p: Omit<Presence, "id">) {
  try {
    await (getClient() as any).from("presences").upsert({ ...p, saisi_par: null }, { onConflict: "employe_id,date_presence" });
  } catch {}
}

export async function deciderConge(id: string, statut: "approuve" | "refuse", notes?: string) {
  try {
    await (getClient() as any).from("conges").update({ statut, notes_admin: notes, date_decision: new Date().toISOString().slice(0,10) }).eq("id", id);
  } catch {}
}

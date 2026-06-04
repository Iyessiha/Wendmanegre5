export type TypeOperation =
  | "ORANGE MONEY"
  | "MOOV MONEY"
  | "TELECEL"
  | "UNITES"
  | "CASH"
  | "SIM"
  | "TRANSFERT INTL";

export type StatutPret = "impaye" | "partiel" | "rembourse" | "retard";

export type RoleUser = "admin" | "gerant" | "caissier";

export interface Client {
  id: string; // code CU2503-00127
  nom: string;
  nomAlternatif?: string;
  ville: string;
  telephone: string;
  cnib?: string;
  plafond: number; // plafond de crédit en XOF
  dateCreation: string; // ISO
}

export interface Remboursement {
  id: string;
  pretId: string;
  montant: number;
  date: string; // ISO
  mode: "Versement" | "Espèces" | "Orange Money" | "Virement";
  caisseId: string;
}

export interface Pret {
  id: string; // ref facture FA2606-54063
  clientId: string;
  type: TypeOperation;
  montant: number; // capital octroyé
  dateOctroi: string; // ISO
  echeance: string; // ISO
  statut: StatutPret;
  caisseId: string;
  octroyePar: string; // userId
}

export interface Caisse {
  id: string;
  nom: string;
  solde: number;
  assigneeA: string | null; // userId du caissier
  agence: string;
}

export interface MouvementCaisse {
  id: string;
  caisseId: string;
  type: "alimentation" | "retrait" | "octroi" | "remboursement" | "ajustement";
  montant: number;
  date: string;
  libelle: string;
  parUser: string;
}

export interface User {
  id: string;
  nom: string;
  role: RoleUser;
  telephone: string;
  agence: string;
  actif: boolean;
}

export interface Produit {
  id: string;
  nom: string;
  categorie: string;
  prixUnitaire: number;
  stock: number;
  entrepot: string;
  seuilAlerte: number;
}

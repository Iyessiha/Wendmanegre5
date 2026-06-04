import type {
  Client,
  Pret,
  Remboursement,
  Caisse,
  MouvementCaisse,
  User,
  Produit,
} from "./types";

// Utilisateurs (admin + employés)
export const users: User[] = [
  { id: "u1", nom: "Le Directeur (DG)", role: "admin", telephone: "+226 67 71 33 55", agence: "Yako Centre", actif: true },
  { id: "u2", nom: "Aminata OUEDRAOGO", role: "gerant", telephone: "+226 70 11 22 33", agence: "Yako Centre", actif: true },
  { id: "u3", nom: "Boukary SAWADOGO", role: "caissier", telephone: "+226 76 44 55 66", agence: "Yako Centre", actif: true },
  { id: "u4", nom: "Salif KABORE", role: "caissier", telephone: "+226 78 99 00 11", agence: "Bokin", actif: true },
];

// Caisses (assignées à des employés)
export const caisses: Caisse[] = [
  { id: "c1", nom: "Caisse principale", solde: 4_500_000, assigneeA: "u2", agence: "Yako Centre" },
  { id: "c2", nom: "Caisse guichet 1", solde: 850_000, assigneeA: "u3", agence: "Yako Centre" },
  { id: "c3", nom: "Caisse Bokin", solde: 1_200_000, assigneeA: "u4", agence: "Bokin" },
  { id: "c4", nom: "Caisse réserve", solde: 6_800_000, assigneeA: null, agence: "Yako Centre" },
];

// Clients commerçants (réseau de sous-distributeurs)
export const clients: Client[] = [
  { id: "CU2503-00127", nom: "SALOU KORANTIN", ville: "Yako", telephone: "+226 70 12 34 01", cnib: "1843798", plafond: 1_000_000, dateCreation: "2025-03-10" },
  { id: "CU2603-00601", nom: "SAWADOGO TIGA", nomAlternatif: "Commerçant à Tougan", ville: "Bokin", telephone: "+226 71 22 33 02", plafond: 1_500_000, dateCreation: "2026-03-04" },
  { id: "CU2503-00120", nom: "SAWADOGO OUSMANE", ville: "Kirsi", telephone: "+226 76 33 44 03", plafond: 3_000_000, dateCreation: "2025-03-08" },
  { id: "CU2503-00246", nom: "OUEDRAOGO BRAHIMA", ville: "Yako", telephone: "+226 78 44 55 04", plafond: 500_000, dateCreation: "2025-03-15" },
  { id: "CU2503-00055", nom: "SANFO SAYOUBA", ville: "Yako", telephone: "+226 70 55 66 05", plafond: 800_000, dateCreation: "2025-03-05" },
  { id: "CU2503-00033", nom: "DIANDA SALIFO", ville: "Bokin", telephone: "+226 71 66 77 06", plafond: 1_500_000, dateCreation: "2025-03-03" },
  { id: "CU2503-00181", nom: "OUEDRAOGO NABI", ville: "Yako", telephone: "+226 76 77 88 07", plafond: 500_000, dateCreation: "2025-03-12" },
  { id: "CU2503-00372", nom: "KIENTEGA WENDKUNI", ville: "Koudougou", telephone: "+226 78 88 99 08", plafond: 1_500_000, dateCreation: "2025-03-20" },
  { id: "CU2503-00262", nom: "SAWADOGO ISSA", ville: "Ouahigouya", telephone: "+226 70 99 00 09", plafond: 4_000_000, dateCreation: "2025-03-18" },
  { id: "CU2604-00614", nom: "PAKODTOGO SALAM", nomAlternatif: "Commerçant à Bokin", ville: "Bokin", telephone: "+226 71 10 20 10", plafond: 1_000_000, dateCreation: "2026-04-02" },
  { id: "CU2503-00112", nom: "CISSE KARIME", ville: "Yako", telephone: "+226 76 11 21 11", plafond: 500_000, dateCreation: "2025-03-07" },
  { id: "CU2503-00375", nom: "OUEDRAOGO SAIDOU", ville: "Gilgou", telephone: "+226 78 12 22 12", plafond: 500_000, dateCreation: "2025-03-21" },
  { id: "CU2512-00566", nom: "ILBOUDO PINGDWENDE", nomAlternatif: "Commerçant Tinhin", ville: "Yako", telephone: "+226 70 13 23 13", plafond: 2_000_000, dateCreation: "2025-12-05" },
  { id: "CU2503-00315", nom: "SANFO HAROUNA", ville: "Latoden", telephone: "+226 71 14 24 14", plafond: 500_000, dateCreation: "2025-03-19" },
  { id: "CU2503-00035", nom: "DIANDA OUMAROU", ville: "Bokin", telephone: "+226 76 15 25 15", plafond: 2_500_000, dateCreation: "2025-03-03" },
  { id: "CU2503-00322", nom: "KABORE AZISE", ville: "Bobo", telephone: "+226 78 16 26 16", plafond: 3_500_000, dateCreation: "2025-03-18" },
  { id: "CU2601-00578", nom: "OUEDRAOGO LASSANE", nomAlternatif: "Commerçant à Arbollé", ville: "Arbollé", telephone: "+226 70 17 27 17", plafond: 500_000, dateCreation: "2026-01-10" },
  { id: "CU2604-00621", nom: "SANKARA KARIM", nomAlternatif: "Commerçant à Kirsi", ville: "Kirsi", telephone: "+226 71 18 28 18", plafond: 600_000, dateCreation: "2026-04-05" },
  { id: "CU2503-00150", nom: "SAMNE EMMANUEL", ville: "Yako", telephone: "+226 76 19 29 19", plafond: 600_000, dateCreation: "2025-03-11" },
  { id: "CU2503-00209", nom: "OUEDRAOGO YACOUBA", ville: "Bobo", telephone: "+226 78 20 30 20", plafond: 1_500_000, dateCreation: "2025-03-14" },
  { id: "CU2503-00165", nom: "SAWADOGO SERGE", ville: "Yako", telephone: "+226 70 21 31 21", plafond: 300_000, dateCreation: "2025-03-11" },
  { id: "CU2601-00589", nom: "TENKODOGO BOUREIMA", nomAlternatif: "Commerçant à Tikaré", ville: "Tikaré", telephone: "+226 71 22 32 22", plafond: 800_000, dateCreation: "2026-01-12" },
  { id: "CU2503-00277", nom: "OUEDRAOGO BOUKARE", ville: "Ouahigouya", telephone: "+226 76 23 33 23", plafond: 1_500_000, dateCreation: "2025-03-16" },
  { id: "CU2510-00532", nom: "DJIGUEMDE LASSANE", nomAlternatif: "Commerçant à Samba", ville: "Samba", telephone: "+226 78 24 34 24", plafond: 400_000, dateCreation: "2025-10-08" },
];

// Prêts / créances — les 25 factures impayées du 03/06/2026 (total 21 550 000 F)
export const prets: Pret[] = [
  { id: "FA2606-54063", clientId: "CU2503-00127", type: "ORANGE MONEY", montant: 500_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c1", octroyePar: "u2" },
  { id: "FA2606-54062", clientId: "CU2603-00601", type: "ORANGE MONEY", montant: 900_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c1", octroyePar: "u2" },
  { id: "FA2606-54061", clientId: "CU2503-00120", type: "ORANGE MONEY", montant: 2_000_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c1", octroyePar: "u2" },
  { id: "FA2606-54060", clientId: "CU2503-00246", type: "ORANGE MONEY", montant: 300_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c2", octroyePar: "u3" },
  { id: "FA2606-54059", clientId: "CU2503-00055", type: "ORANGE MONEY", montant: 500_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c2", octroyePar: "u3" },
  { id: "FA2606-54058", clientId: "CU2503-00033", type: "ORANGE MONEY", montant: 1_000_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c3", octroyePar: "u4" },
  { id: "FA2606-54057", clientId: "CU2503-00181", type: "ORANGE MONEY", montant: 300_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c2", octroyePar: "u3" },
  { id: "FA2606-54056", clientId: "CU2503-00372", type: "MOOV MONEY", montant: 1_000_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c1", octroyePar: "u2" },
  { id: "FA2606-54055", clientId: "CU2503-00262", type: "ORANGE MONEY", montant: 3_000_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c1", octroyePar: "u2" },
  { id: "FA2606-54054", clientId: "CU2604-00614", type: "ORANGE MONEY", montant: 500_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c3", octroyePar: "u4" },
  { id: "FA2606-54051", clientId: "CU2503-00112", type: "ORANGE MONEY", montant: 300_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c2", octroyePar: "u3" },
  { id: "FA2606-54050", clientId: "CU2503-00375", type: "UNITES", montant: 300_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c2", octroyePar: "u3" },
  { id: "FA2606-54048", clientId: "CU2512-00566", type: "ORANGE MONEY", montant: 1_700_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c1", octroyePar: "u2" },
  { id: "FA2606-54046", clientId: "CU2503-00315", type: "ORANGE MONEY", montant: 300_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c3", octroyePar: "u4" },
  { id: "FA2606-54045", clientId: "CU2503-00035", type: "ORANGE MONEY", montant: 2_000_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c3", octroyePar: "u4" },
  { id: "FA2606-54044", clientId: "CU2604-00614", type: "UNITES", montant: 100_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c3", octroyePar: "u4" },
  { id: "FA2606-54043", clientId: "CU2503-00322", type: "ORANGE MONEY", montant: 3_000_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c1", octroyePar: "u2" },
  { id: "FA2606-54042", clientId: "CU2601-00578", type: "ORANGE MONEY", montant: 200_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c2", octroyePar: "u3" },
  { id: "FA2606-54033", clientId: "CU2604-00621", type: "ORANGE MONEY", montant: 400_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c3", octroyePar: "u4" },
  { id: "FA2606-54031", clientId: "CU2503-00150", type: "ORANGE MONEY", montant: 400_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c2", octroyePar: "u3" },
  { id: "FA2606-54030", clientId: "CU2503-00209", type: "TELECEL", montant: 1_000_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c1", octroyePar: "u2" },
  { id: "FA2606-54028", clientId: "CU2503-00165", type: "UNITES", montant: 100_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c2", octroyePar: "u3" },
  { id: "FA2606-54027", clientId: "CU2601-00589", type: "ORANGE MONEY", montant: 500_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c1", octroyePar: "u2" },
  { id: "FA2606-54025", clientId: "CU2503-00277", type: "ORANGE MONEY", montant: 1_000_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c1", octroyePar: "u2" },
  { id: "FA2606-54024", clientId: "CU2510-00532", type: "ORANGE MONEY", montant: 250_000, dateOctroi: "2026-06-03", echeance: "2026-06-18", statut: "impaye", caisseId: "c2", octroyePar: "u3" },

  // Historique : prêts antérieurs déjà soldés / partiels (pour des KPIs vivants)
  { id: "FA2605-53980", clientId: "CU2503-00127", type: "ORANGE MONEY", montant: 400_000, dateOctroi: "2026-05-10", echeance: "2026-05-25", statut: "rembourse", caisseId: "c1", octroyePar: "u2" },
  { id: "FA2605-53942", clientId: "CU2503-00262", type: "ORANGE MONEY", montant: 2_500_000, dateOctroi: "2026-05-08", echeance: "2026-05-23", statut: "rembourse", caisseId: "c1", octroyePar: "u2" },
  { id: "FA2605-53901", clientId: "CU2503-00033", type: "MOOV MONEY", montant: 800_000, dateOctroi: "2026-05-02", echeance: "2026-05-17", statut: "partiel", caisseId: "c3", octroyePar: "u4" },
  { id: "FA2604-53780", clientId: "CU2503-00322", type: "ORANGE MONEY", montant: 1_500_000, dateOctroi: "2026-04-15", echeance: "2026-04-30", statut: "retard", caisseId: "c1", octroyePar: "u2" },
  { id: "FA2605-53850", clientId: "CU2503-00120", type: "ORANGE MONEY", montant: 1_000_000, dateOctroi: "2026-05-01", echeance: "2026-05-16", statut: "rembourse", caisseId: "c1", octroyePar: "u2" },
];

export const remboursements: Remboursement[] = [
  { id: "r1", pretId: "FA2605-53980", montant: 400_000, date: "2026-05-24", mode: "Orange Money", caisseId: "c1" },
  { id: "r2", pretId: "FA2605-53942", montant: 2_500_000, date: "2026-05-22", mode: "Versement", caisseId: "c1" },
  { id: "r3", pretId: "FA2605-53901", montant: 500_000, date: "2026-05-15", mode: "Espèces", caisseId: "c3" },
  { id: "r4", pretId: "FA2605-53850", montant: 1_000_000, date: "2026-05-14", mode: "Virement", caisseId: "c1" },
];

export const mouvements: MouvementCaisse[] = [
  { id: "m1", caisseId: "c1", type: "alimentation", montant: 10_000_000, date: "2026-06-01", libelle: "Approvisionnement eUnités Orange", parUser: "u1" },
  { id: "m2", caisseId: "c3", type: "alimentation", montant: 2_000_000, date: "2026-06-01", libelle: "Dotation caisse Bokin", parUser: "u1" },
  { id: "m3", caisseId: "c2", type: "alimentation", montant: 1_500_000, date: "2026-06-02", libelle: "Dotation guichet 1", parUser: "u1" },
];

export const produits: Produit[] = [
  { id: "p1", nom: "Carte SIM Orange", categorie: "SIM", prixUnitaire: 500, stock: 240, entrepot: "Yako Centre", seuilAlerte: 50 },
  { id: "p2", nom: "Carte SIM Moov", categorie: "SIM", prixUnitaire: 500, stock: 38, entrepot: "Yako Centre", seuilAlerte: 50 },
  { id: "p3", nom: "Carte SIM Telecel", categorie: "SIM", prixUnitaire: 500, stock: 120, entrepot: "Bokin", seuilAlerte: 50 },
  { id: "p4", nom: "Recharge physique 1000 F", categorie: "Recharge", prixUnitaire: 1000, stock: 500, entrepot: "Yako Centre", seuilAlerte: 100 },
  { id: "p5", nom: "Recharge physique 5000 F", categorie: "Recharge", prixUnitaire: 5000, stock: 85, entrepot: "Yako Centre", seuilAlerte: 100 },
  { id: "p6", nom: "Téléphone Tecno Spark", categorie: "Téléphone", prixUnitaire: 65_000, stock: 12, entrepot: "Yako Centre", seuilAlerte: 5 },
  { id: "p7", nom: "Powerbank 10000mAh", categorie: "Accessoire", prixUnitaire: 8_500, stock: 4, entrepot: "Bokin", seuilAlerte: 10 },
];

export const ENTREPRISE = {
  nom: "ETS WENDMANÉGRÉ",
  adresse: "2 rue, Yako, Burkina Faso",
  tel: "+226 67 71 33 55",
  email: "dg@wendmanegre.com",
  web: "wendmanegre.com",
  capital: 10_000_000,
};

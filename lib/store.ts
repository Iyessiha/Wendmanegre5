"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  clients as seedClients,
  prets as seedPrets,
  remboursements as seedRemb,
  caisses as seedCaisses,
  mouvements as seedMouv,
  users as seedUsers,
  produits as seedProduits,
} from "./data";
import type {
  Client,
  Pret,
  Remboursement,
  Caisse,
  MouvementCaisse,
  User,
  Produit,
  TypeOperation,
} from "./types";
import { resteAPayer } from "./format";

interface State {
  clients: Client[];
  prets: Pret[];
  remboursements: Remboursement[];
  caisses: Caisse[];
  mouvements: MouvementCaisse[];
  users: User[];
  produits: Produit[];

  octroyerPret: (input: {
    clientId: string;
    type: TypeOperation;
    montant: number;
    caisseId: string;
    echeance: string;
  }) => void;

  enregistrerRemboursement: (input: {
    pretId: string;
    montant: number;
    mode: Remboursement["mode"];
    caisseId: string;
  }) => void;

  alimenterCaisse: (caisseId: string, montant: number, libelle: string) => void;
  ajouterClient: (c: Omit<Client, "dateCreation">) => void;
  resetDemo: () => void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      clients: seedClients,
      prets: seedPrets,
      remboursements: seedRemb,
      caisses: seedCaisses,
      mouvements: seedMouv,
      users: seedUsers,
      produits: seedProduits,

  octroyerPret: ({ clientId, type, montant, caisseId, echeance }) => {
    const today = new Date().toISOString().slice(0, 10);
    const ref = "FA-" + Math.floor(10000 + Math.random() * 89999);
    const nouveau: Pret = {
      id: ref,
      clientId,
      type,
      montant,
      dateOctroi: today,
      echeance,
      statut: "impaye",
      caisseId,
      octroyePar: "u1",
    };
    const mouv: MouvementCaisse = {
      id: "mv-" + Date.now(),
      caisseId,
      type: "octroi",
      montant: -montant,
      date: today,
      libelle: `Octroi prêt ${ref}`,
      parUser: "u1",
    };
    set((s) => ({
      prets: [nouveau, ...s.prets],
      caisses: s.caisses.map((c) =>
        c.id === caisseId ? { ...c, solde: c.solde - montant } : c
      ),
      mouvements: [mouv, ...s.mouvements],
    }));
  },

  enregistrerRemboursement: ({ pretId, montant, mode, caisseId }) => {
    const today = new Date().toISOString().slice(0, 10);
    const remb: Remboursement = {
      id: "rb-" + Date.now(),
      pretId,
      montant,
      date: today,
      mode,
      caisseId,
    };
    const mouv: MouvementCaisse = {
      id: "mv-" + Date.now(),
      caisseId,
      type: "remboursement",
      montant,
      date: today,
      libelle: `Remboursement ${pretId}`,
      parUser: "u1",
    };
    set((s) => {
      const nouveauxRemb = [remb, ...s.remboursements];
      const prets = s.prets.map((p) => {
        if (p.id !== pretId) return p;
        const reste = resteAPayer(p, nouveauxRemb);
        const statut = reste <= 0 ? "rembourse" : "partiel";
        return { ...p, statut: statut as Pret["statut"] };
      });
      return {
        remboursements: nouveauxRemb,
        prets,
        caisses: s.caisses.map((c) =>
          c.id === caisseId ? { ...c, solde: c.solde + montant } : c
        ),
        mouvements: [mouv, ...s.mouvements],
      };
    });
  },

  alimenterCaisse: (caisseId, montant, libelle) => {
    const today = new Date().toISOString().slice(0, 10);
    const mouv: MouvementCaisse = {
      id: "mv-" + Date.now(),
      caisseId,
      type: "alimentation",
      montant,
      date: today,
      libelle,
      parUser: "u1",
    };
    set((s) => ({
      caisses: s.caisses.map((c) =>
        c.id === caisseId ? { ...c, solde: c.solde + montant } : c
      ),
      mouvements: [mouv, ...s.mouvements],
    }));
  },

  ajouterClient: (c) => {
    set((s) => ({
      clients: [
        { ...c, dateCreation: new Date().toISOString().slice(0, 10) },
        ...s.clients,
      ],
    }));
  },

  resetDemo: () => {
    set({
      clients: seedClients,
      prets: seedPrets,
      remboursements: seedRemb,
      caisses: seedCaisses,
      mouvements: seedMouv,
      users: seedUsers,
      produits: seedProduits,
    });
  },
    }),
    { name: "wmg-data", version: 1 }
  )
);

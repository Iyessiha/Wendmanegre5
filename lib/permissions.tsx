"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getClient } from "./supabase";

// ── Types ───────────────────────────────────────────────────

export type PermissionKey =
  | "prets_voir" | "prets_octroyer" | "prets_modifier" | "prets_annuler" | "remb_saisir"
  | "caisses_voir" | "caisses_alimenter" | "caisses_transferer"
  | "clients_voir" | "clients_creer" | "clients_modifier"
  | "stock_voir" | "stock_ajuster" | "ventes_saisir" | "commandes_voir" | "commandes_valider"
  | "rh_voir" | "rh_pointage" | "conges_approuver" | "paie_voir"
  | "rapports_voir" | "rapports_exporter" | "comptabilite_voir";

export interface PermDef {
  cle: string; libelle: string; description: string; groupe: string; risque: string;
}

export interface UserPermission {
  cle: string; libelle: string; groupe: string; risque: string; actif: boolean;
}

// ── Permissions par défaut (mode démo / fallback) ──────────

export const GERANT_DEFAULTS: Set<PermissionKey> = new Set([
  "prets_voir","prets_octroyer","remb_saisir",
  "caisses_voir","caisses_alimenter",
  "clients_voir","clients_creer","clients_modifier",
  "stock_voir","stock_ajuster","ventes_saisir","commandes_voir","commandes_valider",
  "rh_voir","rh_pointage","conges_approuver",
  "rapports_voir",
]);

const CAISSIER_DEFAULTS: Set<PermissionKey> = new Set([
  "prets_voir","prets_octroyer","remb_saisir",
  "caisses_voir","clients_voir","stock_voir","ventes_saisir",
]);

const ADMIN_DEFAULTS: Set<PermissionKey> = new Set([
  "prets_voir","prets_octroyer","prets_modifier","prets_annuler","remb_saisir",
  "caisses_voir","caisses_alimenter","caisses_transferer",
  "clients_voir","clients_creer","clients_modifier",
  "stock_voir","stock_ajuster","ventes_saisir","commandes_voir","commandes_valider",
  "rh_voir","rh_pointage","conges_approuver","paie_voir",
  "rapports_voir","rapports_exporter","comptabilite_voir",
]);

// ── Contexte ────────────────────────────────────────────────

interface PermissionsContextType {
  can: (key: PermissionKey) => boolean;
  loading: boolean;
  permissions: Set<PermissionKey>;
  allDefs: UserPermission[];           // toutes les permissions (pour l'admin)
}

const PermissionsContext = createContext<PermissionsContextType>({
  can: () => false,
  loading: true,
  permissions: new Set(),
  allDefs: [],
});

export function PermissionsProvider({
  userId, role, children,
}: {
  userId: string | null;
  role: string;
  children: ReactNode;
}) {
  const [permissions, setPermissions] = useState<Set<PermissionKey>>(new Set());
  const [allDefs, setAllDefs] = useState<UserPermission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    async function load() {
      try {
        // Essayer de charger depuis Supabase
        const { data: rows } = await (getClient() as any)
          .from("v_user_permissions")
          .select("permission,actif,permissions_def(libelle,groupe,risque)")
          .eq("user_id", userId);

        if (rows?.length) {
          const active = new Set<PermissionKey>(
            rows.filter((r: any) => r.actif).map((r: any) => r.permission)
          );
          setPermissions(active);
          setAllDefs(rows.map((r: any) => ({
            cle: r.permission,
            libelle: r.permissions_def?.libelle ?? r.permission,
            groupe: r.permissions_def?.groupe ?? "",
            risque: r.permissions_def?.risque ?? "moyen",
            actif: r.actif,
          })));
        } else {
          // Fallback démo selon le rôle
          useFallback(role);
        }
      } catch {
        useFallback(role);
      }
      setLoading(false);
    }

    function useFallback(r: string) {
      const defaults = r === "admin" ? ADMIN_DEFAULTS : r === "gerant" ? GERANT_DEFAULTS : CAISSIER_DEFAULTS;
      setPermissions(defaults);
    }

    load();
  }, [userId, role]);

  const can = (key: PermissionKey) => role === "admin" || permissions.has(key);

  return (
    <PermissionsContext.Provider value={{ can, loading, permissions, allDefs }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

// ── Fonctions admin pour gérer les permissions ─────────────

export async function togglePermission(userId: string, permission: string, actif: boolean, adminId: string): Promise<void> {
  const { error } = await (getClient() as any)
    .from("user_permissions")
    .upsert({
      user_id: userId, permission, actif, accorde_par: adminId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,permission" });
  if (error) throw error;
}

export async function getPermissionsForUser(userId: string, role: string): Promise<UserPermission[]> {
  try {
    const { data: rows } = await (getClient() as any)
      .from("v_user_permissions")
      .select("permission,actif,permissions_def(libelle,groupe,risque,description)")
      .eq("user_id", userId);

    if (rows?.length) {
      return rows.map((r: any) => ({
        cle: r.permission,
        libelle: r.permissions_def?.libelle ?? r.permission,
        groupe: r.permissions_def?.groupe ?? "",
        risque: r.permissions_def?.risque ?? "moyen",
        actif: r.actif,
      }));
    }
  } catch {}

  // Fallback démo
  const defaults = role === "admin" ? ADMIN_DEFAULTS : role === "gerant" ? GERANT_DEFAULTS : CAISSIER_DEFAULTS;
  return Array.from(defaults).map(cle => ({ cle, libelle: cle, groupe: "", risque: "moyen", actif: true }));
}

// Toutes les définitions de permissions (pour le panneau admin)
export const PERMISSIONS_DEFS: { cle: PermissionKey; libelle: string; desc: string; groupe: string; risque: "faible"|"moyen"|"eleve" }[] = [
  { cle:"prets_voir",         libelle:"Voir les prêts",              desc:"Consulter la liste et le détail des prêts",         groupe:"Prêts",    risque:"faible" },
  { cle:"prets_octroyer",     libelle:"Octroyer des prêts",          desc:"Créer un nouveau prêt pour un commerçant",          groupe:"Prêts",    risque:"moyen"  },
  { cle:"prets_modifier",     libelle:"Modifier des prêts",          desc:"Changer les montants, échéances, types",            groupe:"Prêts",    risque:"eleve"  },
  { cle:"prets_annuler",      libelle:"Annuler des prêts",           desc:"Marquer un prêt comme annulé avec motif",           groupe:"Prêts",    risque:"eleve"  },
  { cle:"remb_saisir",        libelle:"Saisir remboursements",       desc:"Enregistrer un paiement d'un commerçant",           groupe:"Prêts",    risque:"moyen"  },
  { cle:"caisses_voir",       libelle:"Voir les caisses",            desc:"Voir les soldes et mouvements des caisses",         groupe:"Caisses",  risque:"faible" },
  { cle:"caisses_alimenter",  libelle:"Alimenter les caisses",       desc:"Verser des fonds dans une caisse",                  groupe:"Caisses",  risque:"eleve"  },
  { cle:"caisses_transferer", libelle:"Transférer entre caisses",    desc:"Déplacer des fonds d'une caisse à une autre",       groupe:"Caisses",  risque:"eleve"  },
  { cle:"clients_voir",       libelle:"Voir les commerçants",        desc:"Consulter la liste et les fiches clients",          groupe:"Clients",  risque:"faible" },
  { cle:"clients_creer",      libelle:"Créer des commerçants",       desc:"Ajouter un nouveau commerçant au réseau",           groupe:"Clients",  risque:"moyen"  },
  { cle:"clients_modifier",   libelle:"Modifier des commerçants",    desc:"Modifier les informations, le plafond",             groupe:"Clients",  risque:"moyen"  },
  { cle:"stock_voir",         libelle:"Voir le stock",               desc:"Consulter le catalogue et les niveaux de stock",    groupe:"Stock",    risque:"faible" },
  { cle:"stock_ajuster",      libelle:"Ajuster le stock",            desc:"Corriger manuellement les quantités",               groupe:"Stock",    risque:"moyen"  },
  { cle:"ventes_saisir",      libelle:"Saisir des ventes",           desc:"Enregistrer une vente au point de vente",           groupe:"Stock",    risque:"moyen"  },
  { cle:"commandes_voir",     libelle:"Voir les commandes",          desc:"Consulter les commandes fournisseurs",              groupe:"Stock",    risque:"faible" },
  { cle:"commandes_valider",  libelle:"Valider les commandes",       desc:"Confirmer et réceptionner une commande",            groupe:"Stock",    risque:"moyen"  },
  { cle:"rh_voir",            libelle:"Voir les RH",                 desc:"Consulter les fiches employés et présences",        groupe:"RH",       risque:"faible" },
  { cle:"rh_pointage",        libelle:"Gérer le pointage",           desc:"Saisir les présences et absences",                  groupe:"RH",       risque:"moyen"  },
  { cle:"conges_approuver",   libelle:"Approuver les congés",        desc:"Valider ou refuser les demandes de congé",          groupe:"RH",       risque:"moyen"  },
  { cle:"paie_voir",          libelle:"Voir la paie",                desc:"Consulter les fiches de paie",                      groupe:"RH",       risque:"eleve"  },
  { cle:"rapports_voir",      libelle:"Voir les rapports",           desc:"Accéder au tableau de bord comptabilité",           groupe:"Rapports", risque:"faible" },
  { cle:"rapports_exporter",  libelle:"Exporter les rapports",       desc:"Télécharger les données en Excel/PDF",              groupe:"Rapports", risque:"moyen"  },
  { cle:"comptabilite_voir",  libelle:"Voir la comptabilité",        desc:"Accéder aux données financières complètes",         groupe:"Rapports", risque:"moyen"  },
];

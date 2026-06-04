// Types générés depuis supabase/schema.sql
// En production : npx supabase gen types typescript --project-id VOTRE_ID > lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nom: string;
          role: 'admin' | 'gerant' | 'caissier';
          telephone: string | null;
          agence: string;
          actif: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      clients: {
        Row: {
          id: string;
          nom: string;
          nom_alternatif: string | null;
          ville: string;
          telephone: string | null;
          cnib: string | null;
          identifiant_pro1: string | null;
          identifiant_pro2: string | null;
          plafond: number;
          actif: boolean;
          date_creation: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['clients']['Row'], 'created_at' | 'updated_at'> & {
          date_creation?: string;
          actif?: boolean;
        };
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
      };
      caisses: {
        Row: {
          id: string;
          nom: string;
          solde: number;
          agence: string;
          assignee_id: string | null;
          actif: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['caisses']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['caisses']['Insert']>;
      };
      prets: {
        Row: {
          id: string;
          client_id: string;
          type_operation: string;
          montant: number;
          date_octroi: string;
          echeance: string;
          statut: 'impaye' | 'partiel' | 'rembourse' | 'retard' | 'annule';
          caisse_id: string;
          octroye_par: string | null;
          annule: boolean;
          motif_annulation: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['prets']['Row'], 'created_at' | 'updated_at' | 'annule'> & {
          annule?: boolean;
        };
        Update: Partial<Database['public']['Tables']['prets']['Insert']>;
      };
      remboursements: {
        Row: {
          id: string;
          pret_id: string;
          montant: number;
          date_remb: string;
          mode: 'Espèces' | 'Versement' | 'Orange Money' | 'Virement';
          caisse_id: string;
          saisi_par: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['remboursements']['Row'], 'id' | 'created_at'> & {
          date_remb?: string;
        };
        Update: Partial<Database['public']['Tables']['remboursements']['Insert']>;
      };
      mouvements_caisse: {
        Row: {
          id: string;
          caisse_id: string;
          type: 'alimentation' | 'retrait' | 'octroi' | 'remboursement' | 'transfert_in' | 'transfert_out' | 'ajustement';
          montant: number;
          date_mvt: string;
          libelle: string;
          par_user: string | null;
          reference_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['mouvements_caisse']['Row'], 'id' | 'created_at'> & {
          date_mvt?: string;
        };
        Update: never;
      };
      fournisseurs: {
        Row: {
          id: string;
          nom: string;
          type: 'OPERATEUR' | 'DISTRIBUTEUR' | 'AUTRE';
          telephone: string | null;
          email: string | null;
          adresse: string | null;
          contact: string | null;
          actif: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['fournisseurs']['Row'], 'id' | 'created_at'> & { actif?: boolean };
        Update: Partial<Database['public']['Tables']['fournisseurs']['Insert']>;
      };
      produits: {
        Row: {
          id: string;
          nom: string;
          categorie: string;
          prix_unitaire: number;
          stock: number;
          entrepot: string;
          seuil_alerte: number;
          fournisseur_id: string | null;
          actif: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['produits']['Row'], 'created_at' | 'updated_at'> & { actif?: boolean };
        Update: Partial<Database['public']['Tables']['produits']['Insert']>;
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          table_name: string | null;
          record_id: string | null;
          old_data: Json | null;
          new_data: Json | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_log']['Row'], 'id' | 'created_at'>;
        Update: never;
      };
    };
    Views: {
      v_prets_encours: {
        Row: Database['public']['Tables']['prets']['Row'] & {
          client_nom: string;
          client_ville: string;
          total_rembourse: number;
          reste_a_payer: number;
          jours_retard: number;
        };
      };
    };
    Functions: {
      current_role_name: { Returns: string };
      my_caisse_id: { Returns: string | null };
    };
  };
}

// Types raccourcis
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Client = Database['public']['Tables']['clients']['Row'];
export type Caisse = Database['public']['Tables']['caisses']['Row'];
export type Pret = Database['public']['Tables']['prets']['Row'];
export type PretEncours = Database['public']['Views']['v_prets_encours']['Row'];
export type Remboursement = Database['public']['Tables']['remboursements']['Row'];
export type MouvementCaisse = Database['public']['Tables']['mouvements_caisse']['Row'];
export type Produit = Database['public']['Tables']['produits']['Row'];
export type Fournisseur = Database['public']['Tables']['fournisseurs']['Row'];

// ── Nouvelles tables (migration 001) ─────────────────────────
export interface ConfigEntreprise {
  id: string; cle: string; nom: string; adresse: string | null;
  ville: string | null; telephone: string | null; telephone2: string | null;
  email: string | null; web: string | null; capital: number;
  logo_url: string | null; ifu: string | null; rccm: string | null;
  mention_bas_facture: string | null; conditions_paiement: string | null;
  mode_paiement_defaut: string | null; devise: string; updated_at: string;
}

export interface Entrepot {
  id: string; nom: string; adresse: string | null; ville: string | null;
  responsable_id: string | null; actif: boolean; created_at: string;
}

export interface ConfigFrais {
  id: string; operateur: string; type_transaction: string;
  taux: number; frais_fixe: number; frais_min: number;
  frais_max: number | null; actif: boolean; notes: string | null; updated_at: string;
}

export type TypeTransaction = 'DEPOT' | 'RETRAIT' | 'ENVOI' | 'RECEPTION' | 'CREDIT' | 'REMBOURSEMENT';

export interface Transaction {
  id: string; type: TypeTransaction; operateur: string;
  montant: number; frais: number; taux_applique: number;
  telephone_client: string | null; nom_client: string | null;
  reference: string | null; caisse_id: string;
  pret_id: string | null; user_id: string | null;
  date_transaction: string; statut: 'effectuee' | 'annulee' | 'en_attente';
  motif_annulation: string | null; created_at: string;
}

// ── RH (migration 002) ─────────────────────────────────────
export interface Employe {
  id: string; numero_cnss: string | null; numero_cnib: string | null;
  date_naissance: string | null; lieu_naissance: string | null; adresse: string | null;
  type_contrat: 'CDI'|'CDD'|'STAGE'|'FREELANCE';
  date_debut: string; date_fin_contrat: string | null;
  poste: string | null; departement: string | null;
  salaire_base: number; prime_base: number;
  solde_conges: number; jours_conges_pris: number;
  contact_urgence_nom: string | null; contact_urgence_tel: string | null;
  iban_bancaire: string | null; notes: string | null;
  actif: boolean; created_at: string; updated_at: string;
}

export type StatutPresence = 'present'|'absent'|'conge'|'retard'|'maladie'|'demi_journee'|'ferie';
export interface Presence {
  id: string; employe_id: string; date_presence: string;
  statut: StatutPresence; heure_arrivee: string | null; heure_depart: string | null;
  nb_heures: number | null; notes: string | null; created_at: string;
}

export type TypeConge = 'annuel'|'maladie'|'maternite'|'paternite'|'deces'|'sans_solde'|'autre';
export interface Conge {
  id: string; employe_id: string; type: TypeConge;
  date_debut: string; date_fin: string; nb_jours: number;
  motif: string | null; statut: 'en_attente'|'approuve'|'refuse';
  approuve_par: string | null; date_decision: string | null;
  notes_admin: string | null; created_at: string;
}

export interface AvanceSalaire {
  id: string; employe_id: string; montant: number;
  date_avance: string; motif: string | null; rembourse: boolean;
  caisse_id: string | null; accorde_par: string | null; created_at: string;
}

export interface FichePaie {
  id: string; employe_id: string; periode: string;
  jours_travailles: number; jours_absents: number;
  salaire_base: number; primes: number; heures_sup: number;
  avances_deduites: number; autres_retenues: number;
  cnss_employe: number; cnss_employeur: number; iuts: number;
  salaire_brut: number; salaire_net: number; cout_employeur: number;
  statut: 'brouillon'|'valide'|'paye';
  date_paiement: string | null; mode_paiement: string | null;
  notes: string | null; created_at: string; updated_at: string;
}

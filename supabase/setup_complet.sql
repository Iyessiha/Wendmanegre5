-- ============================================================
-- ETS WENDMANÉGRÉ — INSTALLATION COMPLÈTE (un seul script)
-- Coller dans Supabase → SQL Editor → New query → Run.
-- Regroupe, dans le bon ordre : schema + migrations 001→004 + seed.
-- Tous les bugs (vue, double comptage caisse/stock) sont corrigés.
-- À lancer une seule fois sur un projet vierge.
-- ============================================================

-- ########## 1/6 — SCHÉMA DE BASE ##########
-- ============================================================
-- ETS WENDMANÉGRÉ — Schéma Supabase complet
-- Exécuter dans l'éditeur SQL Supabase (Dashboard > SQL Editor)
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. PROFILES (étend auth.users de Supabase)
-- ============================================================
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  nom          text not null,
  role         text not null check (role in ('admin', 'gerant', 'caissier')),
  telephone    text,
  agence       text not null default 'Yako Centre',
  actif        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.profiles is 'Profils des utilisateurs — admin, gérant, caissier';

-- Auto-créer le profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nom, role, telephone, agence)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'caissier'),
    new.raw_user_meta_data->>'telephone',
    coalesce(new.raw_user_meta_data->>'agence', 'Yako Centre')
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. CLIENTS / COMMERÇANTS
-- ============================================================
create table public.clients (
  id                text primary key,       -- ex: CU2503-00127
  nom               text not null,
  nom_alternatif    text,
  ville             text not null,
  telephone         text,
  cnib              text,
  identifiant_pro1  text,
  identifiant_pro2  text,
  plafond           bigint not null default 500000,  -- XOF
  actif             boolean not null default true,
  date_creation     date not null default current_date,
  created_by        uuid references public.profiles,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index idx_clients_ville on public.clients (ville);
create index idx_clients_nom on public.clients using gin (to_tsvector('simple', nom));

-- ============================================================
-- 3. CAISSES
-- ============================================================
create table public.caisses (
  id           text primary key,            -- ex: c1
  nom          text not null,
  solde        bigint not null default 0,   -- XOF, recalculé via mouvements
  agence       text not null,
  assignee_id  uuid references public.profiles on delete set null,
  actif        boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- 4. PRÊTS / CRÉANCES
-- ============================================================
create table public.prets (
  id                  text primary key,       -- ex: FA2606-54063
  client_id           text not null references public.clients,
  type_operation      text not null,          -- ORANGE MONEY, MOOV MONEY, TELECEL, UNITES, CASH, SIM, TRANSFERT INTL
  montant             bigint not null,        -- Capital octroyé en XOF
  date_octroi         date not null default current_date,
  echeance            date not null,
  statut              text not null default 'impaye'
                        check (statut in ('impaye','partiel','rembourse','retard','annule')),
  caisse_id           text not null references public.caisses,
  octroye_par         uuid references public.profiles,
  annule              boolean not null default false,
  motif_annulation    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_prets_client on public.prets (client_id);
create index idx_prets_statut on public.prets (statut);
create index idx_prets_echeance on public.prets (echeance);

-- (La vue v_prets_encours est définie après la table remboursements, section 5)

-- ============================================================
-- 5. REMBOURSEMENTS
-- ============================================================
create table public.remboursements (
  id          uuid primary key default gen_random_uuid(),
  pret_id     text not null references public.prets on delete restrict,
  montant     bigint not null check (montant > 0),
  date_remb   date not null default current_date,
  mode        text not null check (mode in ('Espèces','Versement','Orange Money','Virement')),
  caisse_id   text not null references public.caisses,
  saisi_par   uuid references public.profiles,
  created_at  timestamptz not null default now()
);
create index idx_remb_pret on public.remboursements (pret_id);
create index idx_remb_date on public.remboursements (date_remb);

-- Trigger : mettre à jour le statut du prêt après remboursement
create or replace function public.update_pret_statut()
returns trigger language plpgsql as $$
declare
  v_montant   bigint;
  v_rembourse bigint;
begin
  select montant into v_montant from public.prets where id = new.pret_id;
  select coalesce(sum(montant),0) into v_rembourse
  from public.remboursements where pret_id = new.pret_id;
  update public.prets set
    statut = case when v_rembourse >= v_montant then 'rembourse'
                  when v_rembourse > 0 then 'partiel'
                  else 'impaye' end,
    updated_at = now()
  where id = new.pret_id;
  return new;
end;
$$;
create trigger after_remboursement
  after insert or update on public.remboursements
  for each row execute procedure public.update_pret_statut();

-- Vue calculée : reste à payer par prêt (définie ici car elle dépend de remboursements)
create or replace view public.v_prets_encours as
select
  p.*,
  c.nom             as client_nom,
  c.ville           as client_ville,
  coalesce(r.total_rembourse, 0) as total_rembourse,
  greatest(0, p.montant - coalesce(r.total_rembourse, 0)) as reste_a_payer,
  case
    when p.statut = 'rembourse' then 0
    else greatest(0, current_date - p.echeance)
  end as jours_retard
from public.prets p
join public.clients c on c.id = p.client_id
left join (
  select pret_id, sum(montant) as total_rembourse
  from public.remboursements
  group by pret_id
) r on r.pret_id = p.id;

-- ============================================================
-- 6. MOUVEMENTS DE CAISSE
-- ============================================================
create table public.mouvements_caisse (
  id           uuid primary key default gen_random_uuid(),
  caisse_id    text not null references public.caisses,
  type         text not null check (type in ('alimentation','retrait','octroi','remboursement','transfert_in','transfert_out','ajustement')),
  montant      bigint not null,             -- positif = entrée, négatif = sortie
  date_mvt     date not null default current_date,
  libelle      text not null,
  par_user     uuid references public.profiles,
  reference_id text,                        -- ID prêt / remboursement lié
  created_at   timestamptz not null default now()
);
create index idx_mvt_caisse on public.mouvements_caisse (caisse_id, date_mvt desc);

-- Trigger : mettre à jour le solde de caisse
create or replace function public.update_caisse_solde()
returns trigger language plpgsql as $$
begin
  update public.caisses
  set solde = solde + new.montant
  where id = new.caisse_id;
  return new;
end;
$$;
create trigger after_mouvement_caisse
  after insert on public.mouvements_caisse
  for each row execute procedure public.update_caisse_solde();

-- ============================================================
-- 7. FOURNISSEURS
-- ============================================================
create table public.fournisseurs (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  type        text not null check (type in ('OPERATEUR','DISTRIBUTEUR','AUTRE')),
  telephone   text,
  email       text,
  adresse     text,
  contact     text,
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 8. PRODUITS
-- ============================================================
create table public.produits (
  id              text primary key,
  nom             text not null,
  categorie       text not null,
  prix_unitaire   bigint not null default 0,
  stock           integer not null default 0,
  entrepot        text not null,
  seuil_alerte    integer not null default 10,
  fournisseur_id  uuid references public.fournisseurs on delete set null,
  actif           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_produits_categorie on public.produits (categorie);

-- ============================================================
-- 9. COMMANDES FOURNISSEURS
-- ============================================================
create table public.commandes_fournisseurs (
  id                    uuid primary key default gen_random_uuid(),
  fournisseur_id        uuid not null references public.fournisseurs,
  date_commande         date not null default current_date,
  date_livraison_prevue date,
  statut                text not null default 'brouillon'
                          check (statut in ('brouillon','validee','recue','facturee','annulee')),
  montant_total         bigint not null default 0,
  notes                 text,
  cree_par              uuid references public.profiles,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.commandes_lignes (
  id              uuid primary key default gen_random_uuid(),
  commande_id     uuid not null references public.commandes_fournisseurs on delete cascade,
  produit_id      text references public.produits on delete set null,
  description     text,                      -- pour les eUnités sans produit catalogué
  quantite        integer not null default 1,
  prix_unitaire   bigint not null default 0,
  montant         bigint not null default 0
);

-- ============================================================
-- 10. MOUVEMENTS DE STOCK
-- ============================================================
create table public.mouvements_stock (
  id           uuid primary key default gen_random_uuid(),
  produit_id   text not null references public.produits,
  type         text not null check (type in ('entree','sortie','ajustement','inventaire')),
  quantite     integer not null,              -- positif = entrée, négatif = sortie
  motif        text,                          -- reception_commande, vente, perte, etc.
  reference_id text,                          -- ID commande ou prêt lié
  par_user     uuid references public.profiles,
  date_mvt     date not null default current_date,
  created_at   timestamptz not null default now()
);

-- Trigger : mettre à jour le stock produit
create or replace function public.update_stock()
returns trigger language plpgsql as $$
begin
  update public.produits
  set stock = stock + new.quantite, updated_at = now()
  where id = new.produit_id;
  return new;
end;
$$;
create trigger after_mouvement_stock
  after insert on public.mouvements_stock
  for each row execute procedure public.update_stock();

-- ============================================================
-- 11. JOURNAL D'AUDIT
-- ============================================================
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles,
  action      text not null,                  -- INSERT, UPDATE, DELETE, LOGIN, LOGOUT, ANNULATION
  table_name  text,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  ip_address  text,
  created_at  timestamptz not null default now()
);
create index idx_audit_user on public.audit_log (user_id, created_at desc);
create index idx_audit_table on public.audit_log (table_name, created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Activer RLS sur toutes les tables
alter table public.profiles           enable row level security;
alter table public.clients            enable row level security;
alter table public.caisses            enable row level security;
alter table public.prets              enable row level security;
alter table public.remboursements     enable row level security;
alter table public.mouvements_caisse  enable row level security;
alter table public.fournisseurs       enable row level security;
alter table public.produits           enable row level security;
alter table public.commandes_fournisseurs enable row level security;
alter table public.commandes_lignes   enable row level security;
alter table public.mouvements_stock   enable row level security;
alter table public.audit_log          enable row level security;

-- Fonction utilitaire : rôle de l'utilisateur connecté
create or replace function public.current_role_name()
returns text language sql security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Fonction : caisse assignée à l'utilisateur connecté
create or replace function public.my_caisse_id()
returns text language sql security definer as $$
  select id from public.caisses where assignee_id = auth.uid() limit 1;
$$;

-- PROFILES : chacun voit son profil ; admin voit tout
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or current_role_name() in ('admin','gerant'));
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid());
create policy "profiles_admin" on public.profiles for all
  using (current_role_name() = 'admin');

-- CLIENTS : tous peuvent voir ; admin/gérant peuvent modifier
create policy "clients_select_all" on public.clients for select using (true);
create policy "clients_insert_staff" on public.clients for insert
  with check (current_role_name() in ('admin','gerant'));
create policy "clients_update_staff" on public.clients for update
  using (current_role_name() in ('admin','gerant'));
create policy "clients_delete_admin" on public.clients for delete
  using (current_role_name() = 'admin');

-- CAISSES : caissier voit uniquement la sienne ; admin/gérant voient tout
create policy "caisses_select_own" on public.caisses for select
  using (current_role_name() in ('admin','gerant') or assignee_id = auth.uid());
create policy "caisses_manage_admin" on public.caisses for all
  using (current_role_name() in ('admin','gerant'));

-- PRÊTS : tous peuvent lire ; caissier crée depuis sa caisse
create policy "prets_select_all" on public.prets for select using (true);
create policy "prets_insert_caissier" on public.prets for insert
  with check (current_role_name() in ('admin','gerant') or caisse_id = my_caisse_id());
create policy "prets_update_admin" on public.prets for update
  using (current_role_name() in ('admin','gerant'));
create policy "prets_delete_admin" on public.prets for delete
  using (current_role_name() = 'admin');

-- REMBOURSEMENTS : tous lisent ; caissier insère depuis sa caisse
create policy "remb_select_all" on public.remboursements for select using (true);
create policy "remb_insert" on public.remboursements for insert
  with check (current_role_name() in ('admin','gerant') or caisse_id = my_caisse_id());
create policy "remb_update_admin" on public.remboursements for update
  using (current_role_name() in ('admin','gerant'));

-- MOUVEMENTS CAISSE : caissier voit les siens ; admin voit tout
create policy "mvt_select" on public.mouvements_caisse for select
  using (current_role_name() in ('admin','gerant') or caisse_id = my_caisse_id());
create policy "mvt_insert" on public.mouvements_caisse for insert
  with check (current_role_name() in ('admin','gerant') or caisse_id = my_caisse_id());

-- FOURNISSEURS, PRODUITS, COMMANDES, STOCK : admin/gérant seulement
create policy "fournisseurs_staff" on public.fournisseurs for all
  using (current_role_name() in ('admin','gerant'));
create policy "produits_select_all" on public.produits for select using (true);
create policy "produits_manage_staff" on public.produits for all
  using (current_role_name() in ('admin','gerant'));
create policy "commandes_staff" on public.commandes_fournisseurs for all
  using (current_role_name() in ('admin','gerant'));
create policy "lignes_staff" on public.commandes_lignes for all
  using (current_role_name() in ('admin','gerant'));
create policy "stock_select_all" on public.mouvements_stock for select using (true);
create policy "stock_insert_staff" on public.mouvements_stock for insert
  with check (current_role_name() in ('admin','gerant'));

-- AUDIT : admin lit tout ; système peut insérer
create policy "audit_select_admin" on public.audit_log for select
  using (current_role_name() in ('admin','gerant'));
create policy "audit_insert_all" on public.audit_log for insert
  with check (true);

-- ########## 2/6 — TRANSACTIONS / FRAIS / CONFIG ##########
-- ============================================================
-- MIGRATION 001 — Transactions, Frais, Config, Entrepôts
-- Exécuter dans Supabase SQL Editor APRÈS schema.sql
-- ============================================================

-- ============================================================
-- CONFIG ENTREPRISE (informations visibles sur les factures)
-- ============================================================
create table if not exists public.config_entreprise (
  id          uuid primary key default gen_random_uuid(),
  cle         text unique not null default 'principal',
  nom         text not null default 'ETS WENDMANÉGRÉ',
  adresse     text default '2 rue, Yako, Burkina Faso',
  ville       text default 'Yako',
  telephone   text default '+226 67 71 33 55',
  telephone2  text,
  email       text default 'dg@wendmanegre.com',
  web         text default 'wendmanegre.com',
  capital     bigint default 10000000,
  logo_url    text,
  ifu         text,                          -- Identifiant Fiscal Unique (Burkina Faso)
  rccm        text,                          -- Registre du Commerce
  mention_bas_facture text default 'Merci de votre confiance.',
  conditions_paiement text default 'A réception',
  mode_paiement_defaut text default 'Versement',
  devise      text default 'XOF',
  updated_at  timestamptz default now()
);

-- Insérer la config par défaut
insert into public.config_entreprise (cle) values ('principal') on conflict (cle) do nothing;

-- RLS
alter table public.config_entreprise enable row level security;
create policy "config_select_all" on public.config_entreprise for select using (true);
create policy "config_update_admin" on public.config_entreprise for all
  using (public.current_role_name() in ('admin','gerant'));

-- ============================================================
-- ENTREPÔTS
-- ============================================================
create table if not exists public.entrepots (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  adresse       text,
  ville         text,
  responsable_id uuid references public.profiles on delete set null,
  actif         boolean not null default true,
  created_at    timestamptz not null default now()
);

insert into public.entrepots (nom, ville) values
  ('Entrepôt principal Yako', 'Yako'),
  ('Entrepôt Bokin', 'Bokin')
on conflict do nothing;

-- Ajouter colonne entrepot_id aux produits
alter table public.produits add column if not exists entrepot_id uuid references public.entrepots;
alter table public.produits add column if not exists prix_achat bigint default 0;

alter table public.entrepots enable row level security;
create policy "entrepots_select_all" on public.entrepots for select using (true);
create policy "entrepots_manage_staff" on public.entrepots for all
  using (public.current_role_name() in ('admin','gerant'));

-- ============================================================
-- CONFIG FRAIS PAR OPÉRATEUR
-- (marges/commissions sur chaque type de transaction)
-- ============================================================
create table if not exists public.config_frais (
  id              uuid primary key default gen_random_uuid(),
  operateur       text not null,              -- ORANGE MONEY, MOOV MONEY, TELECEL, etc.
  type_transaction text not null,             -- DEPOT, RETRAIT, ENVOI, RECEPTION, CREDIT
  taux            numeric(5,2) not null default 0,   -- % commission sur le montant
  frais_fixe      bigint not null default 0,  -- frais fixe en XOF (en plus du %)
  frais_min       bigint not null default 0,  -- commission minimum
  frais_max       bigint,                     -- plafond commission (null = illimité)
  actif           boolean not null default true,
  notes           text,
  updated_at      timestamptz default now(),
  unique (operateur, type_transaction)
);

-- Frais par défaut (à ajuster selon les vraies conditions négociées avec chaque opérateur)
insert into public.config_frais (operateur, type_transaction, taux, frais_fixe, frais_min) values
  -- Orange Money
  ('ORANGE MONEY', 'DEPOT',     0.00,  0,     0),      -- dépôt gratuit pour le client
  ('ORANGE MONEY', 'RETRAIT',   1.00,  0,     25),     -- 1% à la charge du distributeur → marge
  ('ORANGE MONEY', 'ENVOI',     0.80,  0,     25),
  ('ORANGE MONEY', 'RECEPTION', 0.00,  0,     0),
  ('ORANGE MONEY', 'CREDIT',    0.00,  0,     0),
  -- Moov Money
  ('MOOV MONEY',   'DEPOT',     0.00,  0,     0),
  ('MOOV MONEY',   'RETRAIT',   0.90,  0,     25),
  ('MOOV MONEY',   'ENVOI',     0.75,  0,     25),
  ('MOOV MONEY',   'RECEPTION', 0.00,  0,     0),
  ('MOOV MONEY',   'CREDIT',    0.00,  0,     0),
  -- Telecel
  ('TELECEL',      'DEPOT',     0.00,  0,     0),
  ('TELECEL',      'RETRAIT',   0.90,  0,     25),
  ('TELECEL',      'ENVOI',     0.80,  0,     25),
  ('TELECEL',      'RECEPTION', 0.00,  0,     0),
  -- Wizall
  ('WIZALL',       'DEPOT',     0.00,  0,     0),
  ('WIZALL',       'RETRAIT',   1.00,  0,     50),
  ('WIZALL',       'ENVOI',     0.80,  0,     50),
  -- Wave
  ('WAVE',         'DEPOT',     0.00,  0,     0),
  ('WAVE',         'RETRAIT',   1.00,  0,     25),
  ('WAVE',         'ENVOI',     0.00,  0,     0),     -- Wave souvent gratuit
  -- Wari
  ('WARI',         'DEPOT',     0.50,  0,     50),
  ('WARI',         'RETRAIT',   1.00,  0,     100),
  ('WARI',         'ENVOI',     1.00,  500,   500),
  -- Ria / WU
  ('RIA',          'RECEPTION', 1.00,  0,     200),
  ('WESTERN UNION','RECEPTION', 1.00,  0,     500),
  -- Unités téléphoniques
  ('UNITES',       'CREDIT',    2.00,  0,     25),    -- marge distributeur sur vente d'unités
  ('UNITES',       'DEPOT',     2.00,  0,     25),
  -- SIM
  ('SIM',          'DEPOT',     0.00,  0,     0)
on conflict (operateur, type_transaction) do nothing;

alter table public.config_frais enable row level security;
create policy "frais_select_all" on public.config_frais for select using (true);
create policy "frais_manage_admin" on public.config_frais for all
  using (public.current_role_name() in ('admin','gerant'));

-- ============================================================
-- TRANSACTIONS MOBILE MONEY / DÉPÔTS-RETRAITS
-- ============================================================
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  type            text not null
                    check (type in ('DEPOT','RETRAIT','ENVOI','RECEPTION','CREDIT','REMBOURSEMENT')),
  operateur       text not null,
  montant         bigint not null check (montant > 0),
  frais           bigint not null default 0,       -- commission/marge réalisée
  taux_applique   numeric(5,2) default 0,           -- taux réel appliqué
  telephone_client text,
  nom_client      text,
  reference       text,                            -- ref Orange/Moov/etc. si dispo
  caisse_id       text not null references public.caisses,
  pret_id         text references public.prets,   -- lié si CREDIT ou REMBOURSEMENT
  user_id         uuid references public.profiles,
  date_transaction date not null default current_date,
  statut          text not null default 'effectuee'
                    check (statut in ('effectuee','annulee','en_attente')),
  motif_annulation text,
  created_at      timestamptz not null default now()
);

create index idx_tx_caisse on public.transactions (caisse_id, date_transaction desc);
create index idx_tx_user on public.transactions (user_id, date_transaction desc);
create index idx_tx_type on public.transactions (type, operateur, date_transaction desc);

-- Trigger : impacter la caisse selon le type de transaction
create or replace function public.impact_caisse_transaction()
returns trigger language plpgsql as $$
declare v_impact bigint;
begin
  -- Pour la caisse : RETRAIT et CREDIT = sortie d'argent ; DEPOT et RECEPTION = entrée
  case new.type
    when 'RETRAIT'       then v_impact := -(new.montant);   -- on verse du cash au client
    when 'CREDIT'        then v_impact := -(new.montant);   -- on avance du crédit
    when 'DEPOT'         then v_impact := new.montant;      -- on encaisse du cash
    when 'RECEPTION'     then v_impact := 0;                -- juste commission
    when 'ENVOI'         then v_impact := new.montant;      -- on encaisse avant d'envoyer
    when 'REMBOURSEMENT' then v_impact := new.montant;      -- on reçoit du cash
    else v_impact := 0;
  end case;
  -- Frais toujours positifs pour la caisse (revenu).
  -- NB : on ne met PAS à jour caisses.solde directement ici — l'insertion du
  -- mouvement ci-dessous déclenche after_mouvement_caisse qui s'en charge
  -- (sinon le solde serait impacté deux fois).
  insert into public.mouvements_caisse (caisse_id, type, montant, libelle, par_user, reference_id)
  values (
    new.caisse_id,
    case when v_impact >= 0 then 'alimentation' else 'retrait' end,
    v_impact + new.frais,
    new.type || ' ' || new.operateur || coalesce(' — ' || new.nom_client, ''),
    new.user_id,
    new.id::text
  );
  return new;
end;
$$;

create trigger after_transaction
  after insert on public.transactions
  for each row execute procedure public.impact_caisse_transaction();

alter table public.transactions enable row level security;
create policy "tx_select" on public.transactions for select
  using (public.current_role_name() in ('admin','gerant') or caisse_id = public.my_caisse_id());
create policy "tx_insert" on public.transactions for insert
  with check (public.current_role_name() in ('admin','gerant') or caisse_id = public.my_caisse_id());
create policy "tx_update_admin" on public.transactions for update
  using (public.current_role_name() in ('admin','gerant'));

-- ============================================================
-- VUE : RÉSUMÉ COMPTABLE JOURNALIER
-- ============================================================
create or replace view public.v_journal_journalier as
select
  date_transaction as jour,
  operateur,
  type,
  count(*)         as nb_operations,
  sum(montant)     as volume_total,
  sum(frais)       as frais_total,
  sum(case when type in ('DEPOT','RECEPTION','REMBOURSEMENT') then montant else 0 end) as entrees,
  sum(case when type in ('RETRAIT','CREDIT','ENVOI') then montant else 0 end) as sorties
from public.transactions
where statut = 'effectuee'
group by date_transaction, operateur, type
order by date_transaction desc, frais_total desc;

-- ============================================================
-- VUE : P&L PAR PÉRIODE
-- ============================================================
create or replace view public.v_pnl_mensuel as
select
  date_trunc('month', t.date_transaction) as mois,
  sum(t.frais)                             as revenus_commissions,
  sum(case when p.statut = 'rembourse' then
      (select sum(r.montant) from public.remboursements r where r.pret_id = p.id) - p.montant
      else 0 end)                          as interets_credit,
  count(distinct t.id)                     as nb_transactions,
  sum(t.montant)                           as volume_transactions
from public.transactions t
left join public.prets p on p.id = t.pret_id
where t.statut = 'effectuee'
group by mois
order by mois desc;

-- ########## 3/6 — RESSOURCES HUMAINES ##########
-- ============================================================
-- MIGRATION 002 — Module RH (Ressources Humaines)
-- ETS WENDMANÉGRÉ — Yako, Burkina Faso
-- Exécuter après schema.sql et migration 001
-- ============================================================

-- ============================================================
-- 1. EMPLOYÉS (extension des profils)
-- ============================================================
create table if not exists public.employes (
  id                   uuid primary key references public.profiles on delete cascade,
  numero_cnss          text,                          -- N° CNSS (sécurité sociale Burkina)
  numero_cnib          text,                          -- Carte Nationale d'Identité Burkinabè
  date_naissance       date,
  lieu_naissance       text,
  adresse              text,
  type_contrat         text not null default 'CDI'
                         check (type_contrat in ('CDI','CDD','STAGE','FREELANCE')),
  date_debut           date not null default current_date,
  date_fin_contrat     date,                          -- null = CDI
  poste                text,                          -- Caissier, Gérant, Directeur, etc.
  departement          text default 'Opérations',
  salaire_base         bigint not null default 75000, -- XOF brut mensuel
  prime_base           bigint not null default 0,     -- prime fixe mensuelle
  solde_conges         integer not null default 18,   -- jours disponibles
  jours_conges_pris    integer not null default 0,
  contact_urgence_nom  text,
  contact_urgence_tel  text,
  iban_bancaire        text,                          -- compte bancaire si virement
  notes                text,
  actif                boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.employes is 'Fiches RH des employés (extension de profiles)';

-- Données initiales pour les 4 utilisateurs existants
-- (à exécuter après avoir créé les profiles dans Supabase Auth)
-- Exemple : INSERT INTO employes SELECT id, '...', ... FROM profiles;

alter table public.employes enable row level security;
create policy "employes_read_staff" on public.employes for select
  using (public.current_role_name() in ('admin','gerant') or id = auth.uid());
create policy "employes_manage_admin" on public.employes for all
  using (public.current_role_name() in ('admin','gerant'));

-- ============================================================
-- 2. PRÉSENCE / POINTAGE
-- ============================================================
create table if not exists public.presences (
  id             uuid primary key default gen_random_uuid(),
  employe_id     uuid not null references public.profiles on delete cascade,
  date_presence  date not null default current_date,
  statut         text not null default 'present'
                   check (statut in ('present','absent','conge','retard','maladie','demi_journee','ferie')),
  heure_arrivee  time,
  heure_depart   time,
  nb_heures      numeric(4,1),                        -- calculé ou saisi
  notes          text,
  saisi_par      uuid references public.profiles,
  created_at     timestamptz not null default now(),
  unique (employe_id, date_presence)
);
create index idx_presences_employe on public.presences (employe_id, date_presence desc);
create index idx_presences_date on public.presences (date_presence desc);

-- Vue : résumé présence du mois courant
create or replace view public.v_presence_mois as
select
  p.employe_id,
  pr.nom                                           as employe_nom,
  date_trunc('month', p.date_presence)             as mois,
  count(*) filter (where p.statut = 'present')     as jours_presents,
  count(*) filter (where p.statut = 'absent')      as jours_absents,
  count(*) filter (where p.statut = 'retard')      as jours_retard,
  count(*) filter (where p.statut = 'maladie')     as jours_maladie,
  count(*) filter (where p.statut = 'conge')       as jours_conge,
  count(*)                                          as total_jours_saisis
from public.presences p
join public.profiles pr on pr.id = p.employe_id
group by p.employe_id, pr.nom, mois;

alter table public.presences enable row level security;
create policy "presences_read_staff" on public.presences for select
  using (public.current_role_name() in ('admin','gerant') or employe_id = auth.uid());
create policy "presences_manage_admin" on public.presences for all
  using (public.current_role_name() in ('admin','gerant'));

-- ============================================================
-- 3. CONGÉS
-- ============================================================
create table if not exists public.conges (
  id             uuid primary key default gen_random_uuid(),
  employe_id     uuid not null references public.profiles on delete cascade,
  type           text not null default 'annuel'
                   check (type in ('annuel','maladie','maternite','paternite','deces','sans_solde','autre')),
  date_debut     date not null,
  date_fin       date not null,
  nb_jours       integer not null,                   -- calculé automatiquement
  motif          text,
  statut         text not null default 'en_attente'
                   check (statut in ('en_attente','approuve','refuse')),
  approuve_par   uuid references public.profiles,
  date_decision  date,
  notes_admin    text,
  created_at     timestamptz not null default now()
);
create index idx_conges_employe on public.conges (employe_id, date_debut desc);

-- Trigger : mettre à jour le solde congés lors d'approbation
create or replace function public.update_solde_conges()
returns trigger language plpgsql as $$
begin
  if new.statut = 'approuve' and old.statut != 'approuve' then
    -- Décrémenter si congé annuel
    if new.type = 'annuel' then
      update public.employes set
        jours_conges_pris = jours_conges_pris + new.nb_jours,
        updated_at = now()
      where id = new.employe_id;
    end if;
  end if;
  if new.statut = 'refuse' and old.statut = 'approuve' then
    if new.type = 'annuel' then
      update public.employes set
        jours_conges_pris = greatest(0, jours_conges_pris - new.nb_jours),
        updated_at = now()
      where id = new.employe_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger after_conge_decision
  after update of statut on public.conges
  for each row execute procedure public.update_solde_conges();

alter table public.conges enable row level security;
create policy "conges_read" on public.conges for select
  using (public.current_role_name() in ('admin','gerant') or employe_id = auth.uid());
create policy "conges_insert" on public.conges for insert
  with check (public.current_role_name() in ('admin','gerant') or employe_id = auth.uid());
create policy "conges_manage_admin" on public.conges for update
  using (public.current_role_name() in ('admin','gerant'));

-- ============================================================
-- 4. AVANCES SUR SALAIRE
-- ============================================================
create table if not exists public.avances_salaire (
  id           uuid primary key default gen_random_uuid(),
  employe_id   uuid not null references public.profiles on delete cascade,
  montant      bigint not null check (montant > 0),
  date_avance  date not null default current_date,
  motif        text,
  rembourse    boolean not null default false,
  caisse_id    text references public.caisses,
  accorde_par  uuid references public.profiles,
  created_at   timestamptz not null default now()
);
create index idx_avances_employe on public.avances_salaire (employe_id, date_avance desc);

alter table public.avances_salaire enable row level security;
create policy "avances_read" on public.avances_salaire for select
  using (public.current_role_name() in ('admin','gerant') or employe_id = auth.uid());
create policy "avances_manage_admin" on public.avances_salaire for all
  using (public.current_role_name() in ('admin','gerant'));

-- ============================================================
-- 5. FICHES DE PAIE
-- ============================================================
create table if not exists public.fiches_paie (
  id                uuid primary key default gen_random_uuid(),
  employe_id        uuid not null references public.profiles on delete cascade,
  periode           text not null,                  -- format "2026-06"
  jours_travailles  integer not null default 26,
  jours_absents     integer not null default 0,
  salaire_base      bigint not null,
  primes            bigint not null default 0,      -- primes diverses
  heures_sup        bigint not null default 0,      -- indemnités heures sup
  avances_deduites  bigint not null default 0,      -- avances récupérées ce mois
  autres_retenues   bigint not null default 0,
  -- Charges sociales Burkina Faso
  cnss_employe      bigint not null default 0,      -- 5.5% plafonné
  cnss_employeur    bigint not null default 0,      -- 16% plafonné
  iuts              bigint not null default 0,      -- Impôt Unique sur les Traitements et Salaires
  -- Résultats
  salaire_brut      bigint not null,                -- base + primes + heures sup
  salaire_net       bigint not null,                -- brut - cnss_employe - iuts - avances - retenues
  -- Coût total employeur
  cout_employeur    bigint not null,                -- brut + cnss_employeur
  statut            text not null default 'brouillon'
                      check (statut in ('brouillon','valide','paye')),
  date_paiement     date,
  mode_paiement     text default 'Espèces',
  notes             text,
  genere_par        uuid references public.profiles,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (employe_id, periode)
);
create index idx_fiches_paie_employe on public.fiches_paie (employe_id, periode desc);
create index idx_fiches_paie_periode on public.fiches_paie (periode desc);

-- Vue : totaux paie par période
create or replace view public.v_paie_periode as
select
  f.periode,
  count(*)                     as nb_employes,
  sum(f.salaire_net)           as total_net,
  sum(f.salaire_brut)          as total_brut,
  sum(f.cout_employeur)        as cout_total_employeur,
  sum(f.cnss_employe)          as total_cnss_employe,
  sum(f.cnss_employeur)        as total_cnss_employeur,
  sum(f.iuts)                  as total_iuts,
  count(*) filter (where f.statut = 'paye') as nb_payes
from public.fiches_paie f
group by f.periode
order by f.periode desc;

alter table public.fiches_paie enable row level security;
create policy "fiches_paie_read" on public.fiches_paie for select
  using (public.current_role_name() in ('admin','gerant') or employe_id = auth.uid());
create policy "fiches_paie_manage_admin" on public.fiches_paie for all
  using (public.current_role_name() in ('admin','gerant'));

-- ============================================================
-- DONNÉES DE DÉMONSTRATION RH
-- (à adapter avec les vrais UUIDs des profils Supabase)
-- ============================================================
-- Une fois les profiles créés, insérer les données RH :
-- INSERT INTO public.employes (id, poste, salaire_base, type_contrat, date_debut, numero_cnss)
-- SELECT p.id,
--   CASE p.role
--     WHEN 'admin'   THEN 'Directeur Général'
--     WHEN 'gerant'  THEN 'Gérant d''agence'
--     ELSE 'Caissier(e)'
--   END,
--   CASE p.role WHEN 'admin' THEN 250000 WHEN 'gerant' THEN 120000 ELSE 75000 END,
--   'CDI', '2025-01-01', 'BF-' || floor(random()*999999)::text
-- FROM public.profiles p
-- ON CONFLICT (id) DO NOTHING;

do $$ begin raise notice 'Migration 002 RH terminée.'; end $$;

-- ########## 4/6 — STOCK COMPLET ##########
-- ============================================================
-- MIGRATION 003 — Gestion stock complète
-- ETS WENDMANÉGRÉ — Exécuter après schema.sql + 001 + 002
-- ============================================================

-- ── Extension table produits ────────────────────────────────
alter table public.produits
  add column if not exists code_barre        text,
  add column if not exists reference_interne text,
  add column if not exists unite             text default 'unité',
  add column if not exists tva_taux          numeric(4,2) default 0,
  add column if not exists stock_max         integer,
  add column if not exists notes             text;

-- ── Extension table fournisseurs ───────────────────────────
alter table public.fournisseurs
  add column if not exists delai_livraison   integer default 7,   -- jours
  add column if not exists conditions_paiement text default 'A réception',
  add column if not exists solde_du          bigint default 0,    -- dette envers ce fournisseur
  add column if not exists nb_commandes      integer default 0,   -- calculé
  add column if not exists derniere_commande date;

-- ── VENTES (Point de vente boutique) ────────────────────────
create table if not exists public.ventes (
  id            uuid primary key default gen_random_uuid(),
  numero        text unique,                          -- VTE-2606-001
  produit_id    text not null references public.produits,
  quantite      integer not null check (quantite > 0),
  prix_unitaire bigint not null,
  remise_pct    numeric(4,2) default 0,
  montant_total bigint not null,
  cout_achat    bigint not null default 0,            -- pour calculer la marge
  marge         bigint not null default 0,
  mode_paiement text not null default 'Espèces'
                  check (mode_paiement in ('Espèces','Orange Money','Moov Money','Telecel','Wizall','Virement','Crédit')),
  client_nom    text,
  client_tel    text,
  caisse_id     text references public.caisses,
  vendu_par     uuid references public.profiles,
  annulee       boolean not null default false,
  motif_annulation text,
  date_vente    date not null default current_date,
  created_at    timestamptz not null default now()
);
create index idx_ventes_produit on public.ventes (produit_id, date_vente desc);
create index idx_ventes_date on public.ventes (date_vente desc);

-- Séquence pour le numéro de vente
create sequence if not exists vente_seq start 1;
create or replace function public.gen_vente_numero()
returns trigger language plpgsql as $$
begin
  if new.numero is null then
    new.numero := 'VTE-' || to_char(current_date, 'YYMM') || '-' || lpad(nextval('vente_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;
create trigger before_insert_vente
  before insert on public.ventes
  for each row execute procedure public.gen_vente_numero();

-- Trigger : décrémenter stock + créer mouvement à la vente
create or replace function public.impact_stock_vente()
returns trigger language plpgsql as $$
begin
  if not new.annulee then
    -- Le stock est décrémenté via le mouvement de stock ci-dessous
    -- (after_mouvement_stock), pas directement, pour éviter un double comptage.
    insert into public.mouvements_stock (produit_id, type, quantite, motif, reference_id, par_user, date_mvt)
    values (new.produit_id, 'sortie', -new.quantite, 'vente', new.id::text, new.vendu_par, new.date_vente);
    -- Impacter la caisse si renseignée
    if new.caisse_id is not null then
      insert into public.mouvements_caisse (caisse_id, type, montant, libelle, par_user, reference_id)
      values (new.caisse_id, 'alimentation', new.montant_total, 'Vente ' || new.numero || ' — ' || (select nom from public.produits where id = new.produit_id), new.vendu_par, new.id::text);
    end if;
  end if;
  return new;
end;
$$;
create trigger after_insert_vente
  after insert on public.ventes
  for each row execute procedure public.impact_stock_vente();

alter table public.ventes enable row level security;
create policy "ventes_select_all" on public.ventes for select using (true);
create policy "ventes_insert_staff" on public.ventes for insert
  with check (public.current_role_name() in ('admin','gerant') or caisse_id = public.my_caisse_id());
create policy "ventes_manage_admin" on public.ventes for update
  using (public.current_role_name() in ('admin','gerant'));

-- ── RÉCEPTION DES COMMANDES ─────────────────────────────────
-- Table de réception (lorsque commande_statut passe à 'recue')
create table if not exists public.receptions (
  id              uuid primary key default gen_random_uuid(),
  commande_id     uuid not null references public.commandes_fournisseurs on delete restrict,
  date_reception  date not null default current_date,
  notes           text,
  receptionne_par uuid references public.profiles,
  created_at      timestamptz not null default now()
);

create table if not exists public.receptions_lignes (
  id            uuid primary key default gen_random_uuid(),
  reception_id  uuid not null references public.receptions on delete cascade,
  produit_id    text not null references public.produits,
  quantite_cmd  integer not null,
  quantite_recue integer not null,
  emplacement   text,                                -- entrepôt de destination
  notes         text
);

-- Trigger : incrémenter stock à la réception
create or replace function public.impact_stock_reception()
returns trigger language plpgsql as $$
begin
  -- Le stock est incrémenté via le mouvement de stock ci-dessous
  -- (after_mouvement_stock), pas directement, pour éviter un double comptage.
  insert into public.mouvements_stock (produit_id, type, quantite, motif, reference_id, date_mvt)
  values (new.produit_id, 'entree', new.quantite_recue, 'reception_commande', new.reception_id::text, current_date);
  return new;
end;
$$;
create trigger after_insert_reception_ligne
  after insert on public.receptions_lignes
  for each row execute procedure public.impact_stock_reception();

-- ── INVENTAIRES PHYSIQUES ────────────────────────────────────
create table if not exists public.inventaires (
  id            uuid primary key default gen_random_uuid(),
  titre         text not null default 'Inventaire',
  date_inventaire date not null default current_date,
  statut        text not null default 'en_cours'
                  check (statut in ('en_cours','valide','annule')),
  entrepot      text,
  notes         text,
  realise_par   uuid references public.profiles,
  valide_par    uuid references public.profiles,
  date_validation date,
  created_at    timestamptz not null default now()
);

create table if not exists public.inventaires_lignes (
  id              uuid primary key default gen_random_uuid(),
  inventaire_id   uuid not null references public.inventaires on delete cascade,
  produit_id      text not null references public.produits,
  stock_theorique integer not null,
  stock_compte    integer not null default 0,
  ecart           integer generated always as (stock_compte - stock_theorique) stored,
  commentaire     text
);

-- Trigger : valider inventaire → créer ajustements de stock
create or replace function public.valider_inventaire()
returns trigger language plpgsql as $$
begin
  if new.statut = 'valide' and old.statut = 'en_cours' then
    -- Créer des mouvements d'ajustement pour chaque écart non nul
    insert into public.mouvements_stock (produit_id, type, quantite, motif, reference_id, par_user, date_mvt)
    select il.produit_id, 'inventaire', il.ecart, 'ajustement_inventaire', new.id::text, new.valide_par, new.date_inventaire
    from public.inventaires_lignes il
    where il.inventaire_id = new.id and il.ecart <> 0;
    -- Mettre à jour les stocks
    update public.produits p
    set stock = il.stock_compte, updated_at = now()
    from public.inventaires_lignes il
    where il.inventaire_id = new.id and il.produit_id = p.id and il.ecart <> 0;
  end if;
  return new;
end;
$$;
create trigger after_update_inventaire
  after update of statut on public.inventaires
  for each row execute procedure public.valider_inventaire();

alter table public.inventaires        enable row level security;
alter table public.inventaires_lignes enable row level security;
alter table public.receptions         enable row level security;
alter table public.receptions_lignes  enable row level security;
create policy "inv_all_staff" on public.inventaires      for all using (public.current_role_name() in ('admin','gerant'));
create policy "inv_lignes_staff" on public.inventaires_lignes for all using (public.current_role_name() in ('admin','gerant'));
create policy "rec_staff" on public.receptions            for all using (public.current_role_name() in ('admin','gerant'));
create policy "rec_lignes_staff" on public.receptions_lignes for all using (public.current_role_name() in ('admin','gerant'));

-- ── VUES ANALYTIQUES ────────────────────────────────────────
create or replace view public.v_stock_valorise as
select
  p.id, p.nom, p.categorie, p.entrepot, p.stock,
  p.seuil_alerte, p.prix_unitaire, p.prix_achat,
  p.stock * p.prix_achat    as valeur_achat,
  p.stock * p.prix_unitaire as valeur_vente,
  p.stock * (p.prix_unitaire - p.prix_achat) as marge_potentielle,
  case
    when p.stock = 0 then 'rupture'
    when p.stock <= p.seuil_alerte then 'critique'
    when p.stock <= p.seuil_alerte * 2 then 'faible'
    else 'normal'
  end as niveau_stock
from public.produits p
where p.actif = true;

create or replace view public.v_ventes_stats as
select
  date_trunc('month', v.date_vente) as mois,
  p.categorie,
  count(*) as nb_ventes,
  sum(v.quantite) as quantite_totale,
  sum(v.montant_total) as chiffre_affaires,
  sum(v.marge) as marge_totale
from public.ventes v
join public.produits p on p.id = v.produit_id
where not v.annulee
group by mois, p.categorie
order by mois desc, marge_totale desc;

do $$ begin raise notice 'Migration 003 Stock complet terminée.'; end $$;

-- ########## 5/6 — PERMISSIONS GRANULAIRES ##########
-- ============================================================
-- MIGRATION 004 — Permissions granulaires
-- Permet à l'admin d'octroyer/révoquer des droits spécifiques
-- par utilisateur (gérant, caissier)
-- ============================================================

-- ── Définition des permissions disponibles ─────────────────
create table if not exists public.permissions_def (
  cle         text primary key,
  libelle     text not null,
  description text,
  groupe      text not null, -- Prêts, Caisses, Clients, Stock, RH, Rapports
  risque      text not null default 'moyen' check (risque in ('faible','moyen','eleve'))
);

insert into public.permissions_def (cle, libelle, description, groupe, risque) values
  -- Prêts & Transactions
  ('prets_voir',          'Voir les prêts',               'Consulter la liste et le détail des prêts',         'Prêts',    'faible'),
  ('prets_octroyer',      'Octroyer des prêts',           'Créer un nouveau prêt pour un commerçant',          'Prêts',    'moyen'),
  ('prets_modifier',      'Modifier des prêts',           'Changer les montants, échéances, types',            'Prêts',    'eleve'),
  ('prets_annuler',       'Annuler des prêts',            'Marquer un prêt comme annulé avec motif',           'Prêts',    'eleve'),
  ('remb_saisir',         'Saisir des remboursements',    'Enregistrer un paiement d''un commerçant',          'Prêts',    'moyen'),
  -- Caisses
  ('caisses_voir',        'Voir les caisses',             'Voir les soldes et mouvements des caisses',         'Caisses',  'faible'),
  ('caisses_alimenter',   'Alimenter les caisses',        'Verser des fonds dans une caisse',                  'Caisses',  'eleve'),
  ('caisses_transferer',  'Transférer entre caisses',     'Déplacer des fonds d''une caisse à une autre',      'Caisses',  'eleve'),
  -- Clients
  ('clients_voir',        'Voir les commerçants',         'Consulter la liste et les fiches clients',          'Clients',  'faible'),
  ('clients_creer',       'Créer des commerçants',        'Ajouter un nouveau commerçant au réseau',           'Clients',  'moyen'),
  ('clients_modifier',    'Modifier des commerçants',     'Modifier les informations, le plafond',             'Clients',  'moyen'),
  -- Stock & Boutique
  ('stock_voir',          'Voir le stock',                'Consulter le catalogue et les niveaux de stock',    'Stock',    'faible'),
  ('stock_ajuster',       'Ajuster le stock',             'Corriger manuellement les quantités',               'Stock',    'moyen'),
  ('ventes_saisir',       'Saisir des ventes',            'Enregistrer une vente au point de vente',           'Stock',    'moyen'),
  ('commandes_voir',      'Voir les commandes',           'Consulter les commandes fournisseurs',              'Stock',    'faible'),
  ('commandes_valider',   'Valider les commandes',        'Confirmer et réceptionner une commande',            'Stock',    'moyen'),
  -- RH
  ('rh_voir',             'Voir les RH',                  'Consulter les fiches employés et présences',        'RH',       'faible'),
  ('rh_pointage',         'Gérer le pointage',            'Saisir les présences et absences',                  'RH',       'moyen'),
  ('conges_approuver',    'Approuver les congés',         'Valider ou refuser les demandes de congé',          'RH',       'moyen'),
  ('paie_voir',           'Voir la paie',                 'Consulter les fiches de paie',                      'RH',       'eleve'),
  -- Rapports & Comptabilité
  ('rapports_voir',       'Voir les rapports',            'Accéder au tableau de bord comptabilité',           'Rapports', 'faible'),
  ('rapports_exporter',   'Exporter les rapports',        'Télécharger les données en Excel/PDF',              'Rapports', 'moyen'),
  ('comptabilite_voir',   'Voir la comptabilité',         'Accéder aux données financières complètes',         'Rapports', 'moyen')
on conflict (cle) do nothing;

-- ── Permissions accordées par utilisateur ──────────────────
create table if not exists public.user_permissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles on delete cascade,
  permission  text not null references public.permissions_def (cle),
  actif       boolean not null default true,
  accorde_par uuid references public.profiles,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, permission)
);

-- ── Permissions par défaut par rôle ────────────────────────
create table if not exists public.role_permissions_defaut (
  role        text not null check (role in ('admin','gerant','caissier')),
  permission  text not null references public.permissions_def (cle),
  actif       boolean not null default true,
  primary key (role, permission)
);

-- Gérant : droits par défaut (opérationnel complet, pas de configuration système)
insert into public.role_permissions_defaut (role, permission, actif) values
  ('gerant', 'prets_voir',         true),
  ('gerant', 'prets_octroyer',     true),
  ('gerant', 'prets_modifier',     false),   -- sensible, désactivé par défaut
  ('gerant', 'prets_annuler',      false),   -- très sensible
  ('gerant', 'remb_saisir',        true),
  ('gerant', 'caisses_voir',       true),
  ('gerant', 'caisses_alimenter',  true),
  ('gerant', 'caisses_transferer', false),   -- désactivé par défaut
  ('gerant', 'clients_voir',       true),
  ('gerant', 'clients_creer',      true),
  ('gerant', 'clients_modifier',   true),
  ('gerant', 'stock_voir',         true),
  ('gerant', 'stock_ajuster',      true),
  ('gerant', 'ventes_saisir',      true),
  ('gerant', 'commandes_voir',     true),
  ('gerant', 'commandes_valider',  true),
  ('gerant', 'rh_voir',            true),
  ('gerant', 'rh_pointage',        true),
  ('gerant', 'conges_approuver',   true),
  ('gerant', 'paie_voir',          false),   -- sensible
  ('gerant', 'rapports_voir',      true),
  ('gerant', 'rapports_exporter',  false),
  ('gerant', 'comptabilite_voir',  false)    -- réservé admin par défaut
on conflict do nothing;

-- Caissier : droits minimaux
insert into public.role_permissions_defaut (role, permission, actif) values
  ('caissier', 'prets_voir',     true),
  ('caissier', 'prets_octroyer', true),
  ('caissier', 'remb_saisir',    true),
  ('caissier', 'caisses_voir',   true),    -- sa caisse seulement (RLS)
  ('caissier', 'clients_voir',   true),
  ('caissier', 'clients_creer',  false),
  ('caissier', 'stock_voir',     true),
  ('caissier', 'ventes_saisir',  true),
  ('caissier', 'rh_voir',        false)
on conflict do nothing;

-- ── Vue : permissions effectives par utilisateur ───────────
-- Combine les permissions par défaut du rôle ET les overrides individuels
create or replace view public.v_user_permissions as
select
  p.id   as user_id,
  p.role,
  pd.cle as permission,
  -- Override individuel > défaut du rôle
  coalesce(up.actif, rpd.actif, false) as actif
from public.profiles p
cross join public.permissions_def pd
left join public.role_permissions_defaut rpd
  on rpd.role = p.role and rpd.permission = pd.cle
left join public.user_permissions up
  on up.user_id = p.id and up.permission = pd.cle;

-- RLS
alter table public.user_permissions     enable row level security;
alter table public.permissions_def      enable row level security;
alter table public.role_permissions_defaut enable row level security;

create policy "perm_read_all"   on public.permissions_def      for select using (true);
create policy "rpd_read_all"    on public.role_permissions_defaut for select using (true);
create policy "up_read_self"    on public.user_permissions for select
  using (user_id = auth.uid() or public.current_role_name() in ('admin','gerant'));
create policy "up_manage_admin" on public.user_permissions for all
  using (public.current_role_name() = 'admin');

do $$ begin raise notice 'Migration 004 Permissions terminée.'; end $$;

-- ########## 6/6 — DONNÉES INITIALES (SEED) ##########
-- ============================================================
-- ETS WENDMANÉGRÉ — Données initiales (seed)
-- À exécuter APRÈS avoir créé les 4 comptes dans Supabase Auth
-- ET récupéré leurs UUIDs dans auth.users
-- ============================================================
-- Remplacez ces UUIDs par ceux générés par Supabase Auth :
-- DG          → 'DG_UUID_ICI'
-- Aminata     → 'AMINATA_UUID_ICI'
-- Boukary     → 'BOUKARY_UUID_ICI'
-- Salif       → 'SALIF_UUID_ICI'
-- ============================================================

do $$ begin raise notice 'Début seed ETS Wendmanégré'; end $$;

-- ============================================================
-- CAISSES
-- ============================================================
-- Soldes initialisés à 0 : ils sont construits par les mouvements ci-dessous
-- (le trigger after_mouvement_caisse additionne chaque mouvement au solde).
insert into public.caisses (id, nom, solde, agence, assignee_id) values
  ('c1', 'Caisse principale',   0, 'Yako Centre', null),
  ('c2', 'Caisse guichet 1',    0, 'Yako Centre', null),
  ('c3', 'Caisse Bokin',        0, 'Bokin',       null),
  ('c4', 'Caisse réserve',      0, 'Yako Centre', null)
on conflict (id) do nothing;

-- ============================================================
-- FOURNISSEURS (Orange Money, Moov, Telecel, distributeurs SIM)
-- ============================================================
insert into public.fournisseurs (nom, type, telephone, contact) values
  ('Orange Money Burkina', 'OPERATEUR', '+226 76 00 00 00', 'Service distributeurs'),
  ('Moov Africa Burkina',  'OPERATEUR', '+226 70 00 00 00', 'Service distribution'),
  ('Telecel Faso',         'OPERATEUR', '+226 78 00 00 00', 'Agence Yako'),
  ('Wari Burkina',         'DISTRIBUTEUR', '+226 67 00 00 00', 'Contact commercial'),
  ('Distributeur SIM Yako','DISTRIBUTEUR', '+226 71 00 00 00', 'Grossiste local')
on conflict do nothing;

-- ============================================================
-- PRODUITS
-- ============================================================
insert into public.produits (id, nom, categorie, prix_unitaire, stock, entrepot, seuil_alerte) values
  ('p1', 'Carte SIM Orange',       'SIM',      500,    240, 'Yako Centre', 50),
  ('p2', 'Carte SIM Moov',         'SIM',      500,    38,  'Yako Centre', 50),
  ('p3', 'Carte SIM Telecel',      'SIM',      500,    120, 'Bokin',       50),
  ('p4', 'Recharge physique 1000', 'Recharge', 1000,   500, 'Yako Centre', 100),
  ('p5', 'Recharge physique 5000', 'Recharge', 5000,   85,  'Yako Centre', 100),
  ('p6', 'Téléphone Tecno Spark',  'Téléphone',65000,  12,  'Yako Centre', 5),
  ('p7', 'Powerbank 10000mAh',     'Accessoire',8500,  4,   'Bokin',       10)
on conflict (id) do nothing;

-- ============================================================
-- CLIENTS / COMMERÇANTS
-- (24 fiches — correspondant aux vraies factures FA2606-*)
-- ============================================================
insert into public.clients (id, nom, nom_alternatif, ville, telephone, cnib, plafond) values
  ('CU2503-00127', 'SALOU KORANTIN',      null,                         'Yako',       '+226 70 12 34 01', '1843798', 1000000),
  ('CU2603-00601', 'SAWADOGO TIGA',       'Commerçant à Tougan',        'Bokin',      '+226 71 22 33 02', null,      1500000),
  ('CU2503-00120', 'SAWADOGO OUSMANE',    null,                         'Kirsi',      '+226 76 33 44 03', null,      3000000),
  ('CU2503-00246', 'OUEDRAOGO BRAHIMA',   null,                         'Yako',       '+226 78 44 55 04', null,      500000),
  ('CU2503-00055', 'SANFO SAYOUBA',       null,                         'Yako',       '+226 70 55 66 05', null,      800000),
  ('CU2503-00033', 'DIANDA SALIFO',       null,                         'Bokin',      '+226 71 66 77 06', null,      1500000),
  ('CU2503-00181', 'OUEDRAOGO NABI',      null,                         'Yako',       '+226 76 77 88 07', null,      500000),
  ('CU2503-00372', 'KIENTEGA WENDKUNI',   null,                         'Koudougou',  '+226 78 88 99 08', null,      1500000),
  ('CU2503-00262', 'SAWADOGO ISSA',       null,                         'Ouahigouya', '+226 70 99 00 09', null,      4000000),
  ('CU2604-00614', 'PAKODTOGO SALAM',     'Commerçant à Bokin',         'Bokin',      '+226 71 10 20 10', null,      1000000),
  ('CU2503-00112', 'CISSE KARIME',        null,                         'Yako',       '+226 76 11 21 11', null,      500000),
  ('CU2503-00375', 'OUEDRAOGO SAIDOU',    null,                         'Gilgou',     '+226 78 12 22 12', null,      500000),
  ('CU2512-00566', 'ILBOUDO PINGDWENDE',  'Commerçant Tinhin',          'Yako',       '+226 70 13 23 13', null,      2000000),
  ('CU2503-00315', 'SANFO HAROUNA',       null,                         'Latoden',    '+226 71 14 24 14', null,      500000),
  ('CU2503-00035', 'DIANDA OUMAROU',      null,                         'Bokin',      '+226 76 15 25 15', null,      2500000),
  ('CU2503-00322', 'KABORE AZISE',        null,                         'Bobo',       '+226 78 16 26 16', null,      3500000),
  ('CU2601-00578', 'OUEDRAOGO LASSANE',   'Commerçant à Arbollé',       'Arbollé',    '+226 70 17 27 17', null,      500000),
  ('CU2604-00621', 'SANKARA KARIM',       'Commerçant à Kirsi',         'Kirsi',      '+226 71 18 28 18', null,      600000),
  ('CU2503-00150', 'SAMNE EMMANUEL',      null,                         'Yako',       '+226 76 19 29 19', null,      600000),
  ('CU2503-00209', 'OUEDRAOGO YACOUBA',   null,                         'Bobo',       '+226 78 20 30 20', null,      1500000),
  ('CU2503-00165', 'SAWADOGO SERGE',      null,                         'Yako',       '+226 70 21 31 21', null,      300000),
  ('CU2601-00589', 'TENKODOGO BOUREIMA',  'Commerçant à Tikaré',        'Tikaré',     '+226 71 22 32 22', null,      800000),
  ('CU2503-00277', 'OUEDRAOGO BOUKARE',   null,                         'Ouahigouya', '+226 76 23 33 23', null,      1500000),
  ('CU2510-00532', 'DJIGUEMDE LASSANE',   'Commerçant à Samba',         'Samba',      '+226 78 24 34 24', null,      400000)
on conflict (id) do nothing;

-- ============================================================
-- PRÊTS — 25 créances impayées du 03/06/2026 (Total : 21 550 000 F)
-- ============================================================
insert into public.prets (id, client_id, type_operation, montant, date_octroi, echeance, statut, caisse_id) values
  ('FA2606-54063', 'CU2503-00127', 'ORANGE MONEY', 500000,  '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54062', 'CU2603-00601', 'ORANGE MONEY', 900000,  '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54061', 'CU2503-00120', 'ORANGE MONEY', 2000000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54060', 'CU2503-00246', 'ORANGE MONEY', 300000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54059', 'CU2503-00055', 'ORANGE MONEY', 500000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54058', 'CU2503-00033', 'ORANGE MONEY', 1000000, '2026-06-03', '2026-06-18', 'impaye', 'c3'),
  ('FA2606-54057', 'CU2503-00181', 'ORANGE MONEY', 300000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54056', 'CU2503-00372', 'MOOV MONEY',   1000000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54055', 'CU2503-00262', 'ORANGE MONEY', 3000000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54054', 'CU2604-00614', 'ORANGE MONEY', 500000,  '2026-06-03', '2026-06-18', 'impaye', 'c3'),
  ('FA2606-54051', 'CU2503-00112', 'ORANGE MONEY', 300000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54050', 'CU2503-00375', 'UNITES',       300000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54048', 'CU2512-00566', 'ORANGE MONEY', 1700000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54046', 'CU2503-00315', 'ORANGE MONEY', 300000,  '2026-06-03', '2026-06-18', 'impaye', 'c3'),
  ('FA2606-54045', 'CU2503-00035', 'ORANGE MONEY', 2000000, '2026-06-03', '2026-06-18', 'impaye', 'c3'),
  ('FA2606-54044', 'CU2604-00614', 'UNITES',       100000,  '2026-06-03', '2026-06-18', 'impaye', 'c3'),
  ('FA2606-54043', 'CU2503-00322', 'ORANGE MONEY', 3000000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54042', 'CU2601-00578', 'ORANGE MONEY', 200000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54033', 'CU2604-00621', 'ORANGE MONEY', 400000,  '2026-06-03', '2026-06-18', 'impaye', 'c3'),
  ('FA2606-54031', 'CU2503-00150', 'ORANGE MONEY', 400000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54030', 'CU2503-00209', 'TELECEL',      1000000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54028', 'CU2503-00165', 'UNITES',       100000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54027', 'CU2601-00589', 'ORANGE MONEY', 500000,  '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54025', 'CU2503-00277', 'ORANGE MONEY', 1000000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54024', 'CU2510-00532', 'ORANGE MONEY', 250000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  -- Historique soldé (pour des KPIs réalistes)
  ('FA2605-53980', 'CU2503-00127', 'ORANGE MONEY', 400000,  '2026-05-10', '2026-05-25', 'rembourse', 'c1'),
  ('FA2605-53942', 'CU2503-00262', 'ORANGE MONEY', 2500000, '2026-05-08', '2026-05-23', 'rembourse', 'c1'),
  ('FA2605-53901', 'CU2503-00033', 'MOOV MONEY',   800000,  '2026-05-02', '2026-05-17', 'partiel',   'c3'),
  ('FA2604-53780', 'CU2503-00322', 'ORANGE MONEY', 1500000, '2026-04-15', '2026-04-30', 'retard',    'c1'),
  ('FA2605-53850', 'CU2503-00120', 'ORANGE MONEY', 1000000, '2026-05-01', '2026-05-16', 'rembourse', 'c1')
on conflict (id) do nothing;

-- Remboursements liés à l'historique
insert into public.remboursements (pret_id, montant, date_remb, mode, caisse_id) values
  ('FA2605-53980', 400000,  '2026-05-24', 'Orange Money', 'c1'),
  ('FA2605-53942', 2500000, '2026-05-22', 'Versement',    'c1'),
  ('FA2605-53901', 500000,  '2026-05-15', 'Espèces',      'c3'),
  ('FA2605-53850', 1000000, '2026-05-14', 'Virement',     'c1')
on conflict do nothing;

-- Mouvements de caisse initiaux — construisent les soldes de départ
-- (c1=4 500 000, c2=850 000, c3=1 200 000, c4=6 800 000)
insert into public.mouvements_caisse (caisse_id, type, montant, date_mvt, libelle) values
  ('c1', 'alimentation', 4500000, '2026-06-01', 'Solde d''ouverture — caisse principale'),
  ('c2', 'alimentation', 850000,  '2026-06-02', 'Solde d''ouverture — guichet 1'),
  ('c3', 'alimentation', 1200000, '2026-06-01', 'Solde d''ouverture — Bokin'),
  ('c4', 'alimentation', 6800000, '2026-06-01', 'Solde d''ouverture — réserve')
on conflict do nothing;

do $$ begin raise notice 'Seed terminé avec succès.'; end $$;

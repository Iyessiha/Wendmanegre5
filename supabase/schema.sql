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

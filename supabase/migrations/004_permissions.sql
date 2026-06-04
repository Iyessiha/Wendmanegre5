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

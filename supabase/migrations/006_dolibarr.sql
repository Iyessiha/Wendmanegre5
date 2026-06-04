-- ============================================================
-- MIGRATION 006 — Connexion Dolibarr (synchronisation)
-- ============================================================

-- Table de secrets verrouillée : lisible uniquement par le service_role
-- (les fonctions serveur). Aucune policy = anon/authenticated n'y accèdent pas.
create table if not exists public.app_secrets (
  cle text primary key,
  valeur text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;

-- Correspondance avec les identifiants Dolibarr (anti-doublon)
alter table public.clients  add column if not exists dolibarr_id text;
alter table public.produits add column if not exists dolibarr_id text;

-- Renseigner la connexion Dolibarr (remplacer par vos valeurs réelles)
-- insert into public.app_secrets (cle, valeur) values
--   ('DOLIBARR_URL', 'https://VOTRE-DOMAINE/api/index.php'),
--   ('DOLIBARR_API_KEY', 'VOTRE_CLE_API')
-- on conflict (cle) do update set valeur = excluded.valeur, updated_at = now();

-- Correspondance factures/avoirs Dolibarr sur les prêts
alter table public.prets add column if not exists dolibarr_id text;
alter table public.prets add column if not exists dolibarr_avoir_id text;

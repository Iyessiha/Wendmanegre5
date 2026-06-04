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

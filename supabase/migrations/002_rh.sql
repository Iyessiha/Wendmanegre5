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

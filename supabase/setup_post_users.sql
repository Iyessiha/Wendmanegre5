-- ============================================================
-- ETS WENDMANÉGRÉ — À EXÉCUTER APRÈS avoir créé les 4 comptes
-- dans Supabase → Authentication → Users.
-- Coller dans SQL Editor → Run. Sans danger à relancer.
--
-- Ce script associe chaque compte (par email) à son rôle, son nom
-- lisible, sa caisse, et crée sa fiche employé (module RH).
-- Il fonctionne quelle que soit la façon dont les comptes ont été
-- créés (avec ou sans metadata).
-- ============================================================

-- ── 1. Rôles (par email, fiable même sans metadata) ────────
update public.profiles p set role = 'admin'
  from auth.users u where u.id = p.id and u.email = 'dg@wendmanegre.com';
update public.profiles p set role = 'gerant'
  from auth.users u where u.id = p.id and u.email = 'aminata@wendmanegre.com';
update public.profiles p set role = 'caissier'
  from auth.users u where u.id = p.id
  and u.email in ('boukary@wendmanegre.com', 'salif@wendmanegre.com');

-- ── 2. Noms lisibles (si créés sans metadata, nom = email) ─
update public.profiles p set nom = 'Le Directeur (DG)'
  from auth.users u where u.id = p.id and u.email = 'dg@wendmanegre.com';
update public.profiles p set nom = 'Aminata OUEDRAOGO'
  from auth.users u where u.id = p.id and u.email = 'aminata@wendmanegre.com';
update public.profiles p set nom = 'Boukary SAWADOGO'
  from auth.users u where u.id = p.id and u.email = 'boukary@wendmanegre.com';
update public.profiles p set nom = 'Salif KABORE'
  from auth.users u where u.id = p.id and u.email = 'salif@wendmanegre.com';

-- ── 3. Agences ─────────────────────────────────────────────
update public.profiles p set agence = 'Bokin'
  from auth.users u where u.id = p.id and u.email = 'salif@wendmanegre.com';

-- ── 4. Assignation des caisses aux caissiers ───────────────
update public.caisses set assignee_id = (
  select p.id from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'boukary@wendmanegre.com' limit 1
) where id = 'c2';

update public.caisses set assignee_id = (
  select p.id from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'salif@wendmanegre.com' limit 1
) where id = 'c3';

-- ── 5. Fiches employés (module RH) ─────────────────────────
insert into public.employes (id, poste, salaire_base, type_contrat, date_debut, departement)
select p.id,
  case p.role
    when 'admin'  then 'Directeur Général'
    when 'gerant' then 'Gérant d''agence'
    else 'Caissier(ère)'
  end,
  case p.role
    when 'admin'  then 250000
    when 'gerant' then 120000
    else 75000
  end,
  'CDI', '2025-01-01', 'Opérations'
from public.profiles p
on conflict (id) do nothing;

-- ── Vérification ───────────────────────────────────────────
-- select p.nom, p.role, p.agence from public.profiles p order by p.role;
-- select id, nom, solde, assignee_id from public.caisses order by id;

do $$ begin raise notice 'Configuration post-utilisateurs terminée.'; end $$;

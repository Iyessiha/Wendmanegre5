-- ============================================================
-- MIGRATION 005 — Identifiant de connexion (nom d'utilisateur)
-- Permet la connexion par identifiant au lieu de l'e-mail.
-- Idempotent : peut être relancé sans risque.
-- ============================================================

-- Colonne identifiant (unique) sur les profils
alter table public.profiles add column if not exists identifiant text unique;

-- Le déclencheur copie aussi l'identifiant depuis les métadonnées
-- (ou, à défaut, la partie locale de l'e-mail interne)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nom, role, telephone, agence, identifiant)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nom', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'caissier'),
    new.raw_user_meta_data->>'telephone',
    coalesce(new.raw_user_meta_data->>'agence', 'Yako Centre'),
    coalesce(new.raw_user_meta_data->>'identifiant', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

-- Remplir l'identifiant des comptes déjà créés
update public.profiles p
set identifiant = split_part(u.email, '@', 1)
from auth.users u
where u.id = p.id and (p.identifiant is null or p.identifiant = '');

do $$ begin raise notice 'Migration 005 Identifiant terminée.'; end $$;

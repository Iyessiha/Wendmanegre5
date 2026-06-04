-- ============================================================
-- ETS WENDMANÉGRÉ — Création des 4 comptes en SQL (un seul Run)
-- À exécuter APRÈS setup_complet.sql.
-- Mot de passe pour les 4 comptes : demo1234
--
-- ⚠️  Alternative pratique à la création manuelle dans
--     Authentication → Users. Si la connexion échoue après ce
--     script (versions Supabase variables), créez plutôt les
--     comptes via l'interface (voir SETUP_SUPABASE.md, étape 3).
--
-- Le déclencheur on_auth_user_created remplit automatiquement la
-- table profiles (nom + rôle) à partir des métadonnées ci-dessous.
-- Lancez ensuite setup_post_users.sql pour les caisses et le RH.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_obj  jsonb;
  v_id   uuid;
  v_users jsonb := '[
    {"email":"dg@wendmanegre.com",      "nom":"Le Directeur (DG)", "role":"admin",    "agence":"Yako Centre"},
    {"email":"aminata@wendmanegre.com", "nom":"Aminata OUEDRAOGO", "role":"gerant",   "agence":"Yako Centre"},
    {"email":"boukary@wendmanegre.com", "nom":"Boukary SAWADOGO",  "role":"caissier", "agence":"Yako Centre"},
    {"email":"salif@wendmanegre.com",   "nom":"Salif KABORE",      "role":"caissier", "agence":"Bokin"}
  ]'::jsonb;
begin
  for v_obj in select * from jsonb_array_elements(v_users) loop
    -- Ne pas recréer un compte déjà existant
    if exists (select 1 from auth.users where email = v_obj->>'email') then
      continue;
    end if;

    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_obj->>'email',
      extensions.crypt('demo1234', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nom', v_obj->>'nom', 'role', v_obj->>'role', 'agence', v_obj->>'agence'),
      '', '', '', ''
    );

    -- Identité e-mail (requise pour la connexion par mot de passe)
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_obj->>'email'),
      'email', v_obj->>'email',
      now(), now(), now()
    );
  end loop;
end $$;

-- Vérification
-- select u.email, p.nom, p.role from auth.users u join public.profiles p on p.id = u.id order by p.role;

do $$ begin raise notice 'Comptes créés (mot de passe : demo1234).'; end $$;

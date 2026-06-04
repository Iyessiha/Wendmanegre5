# Mise en production Supabase — ETS WENDMANÉGRÉ

Guide complet et vérifié. Suivez les étapes dans l'ordre.
Durée : ~20 minutes. Coût : 0 F (offres gratuites Supabase + Vercel).

> **Astuce** : tout le SQL est regroupé dans deux fichiers prêts à coller :
> `supabase/setup_complet.sql` (étape 2) et `supabase/setup_post_users.sql` (étape 4).
> Vous n'avez pas à exécuter les fichiers un par un.

---

## ÉTAPE 1 — Créer le projet Supabase

1. https://supabase.com → **New project**
2. Nom : `wendmanegre-gestion`
3. Mot de passe base de données : choisir un mot de passe fort (le **noter**)
4. Région : **eu-west-3 (Paris)** ou **eu-central-1 (Frankfurt)** (plus proche du Burkina)
5. Plan gratuit

---

## ÉTAPE 2 — Installer toute la base (un seul script)

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Coller **tout** le contenu de `supabase/setup_complet.sql`
3. **Run** — le script doit se terminer par « Seed terminé avec succès. »

Ce script crée le schéma, les 4 migrations (transactions, RH, stock, permissions)
et insère les données de démonstration, dans le bon ordre.

> Si vous préférez les fichiers séparés, exécutez-les dans cet ordre :
> `schema.sql` → `migrations/001` → `002` → `003` → `004` → `seed.sql`.

---

## ÉTAPE 3 — Créer les 4 comptes utilisateurs

Supabase Dashboard → **Authentication → Users** → **Add user** (ou **Invite**) :

| Email | Mot de passe | Rôle (assigné à l'étape 4) |
|-------|-------------|----------------------------|
| dg@wendmanegre.com | demo1234 | admin |
| aminata@wendmanegre.com | demo1234 | gérant |
| boukary@wendmanegre.com | demo1234 | caissier |
| salif@wendmanegre.com | demo1234 | caissier |

Avec **Add user**, cochez « Auto Confirm User » pour éviter l'email de confirmation.

> À la création, un déclencheur crée automatiquement un profil dans `profiles`
> (rôle « caissier » par défaut). L'étape 4 corrige les rôles et les noms.

---

## ÉTAPE 4 — Configurer rôles, caisses et fiches RH

1. SQL Editor → **New query**
2. Coller le contenu de `supabase/setup_post_users.sql`
3. **Run**

Ce script associe chaque email à son rôle, son nom lisible, assigne la caisse
guichet 1 à Boukary et la caisse Bokin à Salif, et crée les fiches employés.

Vérification (décommentez les `select` en bas du script) : 4 profils avec les bons
rôles, 4 caisses avec les bons soldes (4 500 000 / 850 000 / 1 200 000 / 6 800 000).

---

## ÉTAPE 5 — Variables d'environnement (le point qui bloquait)

1. Supabase → **Settings → API**, copier :
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public key** (clé `eyJ...`)

2. Vercel → votre projet → **Settings → Environment Variables**, ajouter
   (cocher Production + Preview + Development) :

```
NEXT_PUBLIC_SUPABASE_URL = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
```

3. **REDÉPLOYER** — indispensable. Ces variables sont intégrées au build :
   Vercel → **Deployments** → menu « … » du dernier déploiement → **Redeploy**.

> Tant que ces variables ne sont pas posées, l'app reste en **mode démo** local
> (connexion sans backend). Une fois posées + redéployées, elle bascule
> automatiquement sur Supabase. Aucun code à modifier.

---

## ÉTAPE 6 — Vérification finale

1. Ouvrir l'URL Vercel → page d'accueil ✓
2. **Connexion** → choisir « Le Directeur (DG) » → mot de passe `demo1234` → dashboard admin ✓
3. KPIs cohérents (encours ~21,55 M F, 24 commerçants) ✓
4. Se déconnecter → se connecter en **Boukary** → espace caissier, sa caisse uniquement ✓
5. Octroyer un prêt → la caisse décroît du bon montant (une seule fois) ✓
6. Rafraîchir → les données persistent (Supabase) ✓

---

## (Optionnel) ÉTAPE 7 — Import Dolibarr

Pour importer vos vraies données depuis Dolibarr (gescom.wendmanegre.com),
voir `scripts/migrate-dolibarr.mjs` et remplir dans `.env.local` :
`DOLIBARR_URL`, `DOLIBARR_API_KEY`, `SUPABASE_SERVICE_KEY` (Settings → API →
service_role, **jamais** côté client). Puis : `node scripts/migrate-dolibarr.mjs`.

---

## Corrections apportées au schéma (mémo technique)

- Vue `v_prets_encours` déplacée après la table `remboursements` (sinon erreur de création).
- Soldes de caisse : construits par les mouvements (plus de double comptage au seed).
- Trigger transactions : ne met plus le solde à jour deux fois.
- Triggers ventes & réceptions : ne modifient plus le stock deux fois.
- Migrations 001→004 désormais incluses dans le parcours d'installation.

# Wendmanégré — Gestion de distribution

Dashboard web de gestion pour **ETS WENDMANÉGRÉ** (master distributeur Orange Money, Yako, Burkina Faso) : CRM des commerçants, suivi des prêts/encours, caisses multi-employés et stock boutique.

> MVP Phase 1 — données de démonstration basées sur les factures réelles. Le backend Supabase sera branché en phase 2.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** (palette « fintech sahélienne »)
- **Recharts** (graphiques)
- **Zustand** (état applicatif en mémoire)
- **lucide-react** (icônes)

## Lancer en local

```bash
npm install
npm run dev
```

Ouvrir http://localhost:3000

## Déployer sur Vercel

1. Pousser le dossier sur un dépôt GitHub :
   ```bash
   git init
   git add .
   git commit -m "MVP dashboard Wendmanégré"
   git branch -M main
   git remote add origin git@github.com:VOTRE_COMPTE/wendmanegre-gestion.git
   git push -u origin main
   ```
2. Sur [vercel.com](https://vercel.com) → **Add New Project** → importer le dépôt.
3. Vercel détecte Next.js automatiquement. Aucune variable d'environnement requise pour ce MVP.
4. **Deploy** → l'URL de prévisualisation est prête.

## Pages

| Route | Accès | Contenu |
|-------|-------|---------|
| `/` | public | Landing page de présentation |
| `/login` | public | Connexion (sélection de compte démo) |
| `/dashboard` | admin/gérant | Tableau de bord global : KPIs, encours, alertes, activité |
| `/caisse` | caissier | Espace caissier : sa caisse, opérations du jour, clôture |
| `/clients` | tous | Réseau de commerçants, recherche, ajout |
| `/clients/[id]` | tous | Fiche client : historique, encaissement |
| `/prets` | tous | Toutes les créances, filtres |
| `/caisses` | admin/gérant | Soldes par caisse, alimentation, mouvements |
| `/boutique` | admin/gérant | Produits, entrepôts, stock |
| `/parametres` | admin/gérant | Entreprise, utilisateurs, reset démo |

## Comptes de démonstration

À la connexion, choisissez un compte (code PIN ignoré en démo) :

- **Le Directeur (DG)** → administrateur, accès complet
- **Aminata OUEDRAOGO** → gérant, accès administration
- **Boukary SAWADOGO** → caissier (guichet 1), espace restreint
- **Salif KABORE** → caissier (Bokin), espace restreint

L'admin et le caissier sont redirigés vers des tableaux de bord différents. Le caissier n'a pas accès à la gestion globale des caisses ni aux paramètres.

## Persistance

Les données (prêts, remboursements, caisses) sont persistées dans le `localStorage` du navigateur : vos opérations de test sont conservées après rafraîchissement. Un bouton **Réinitialiser** dans *Paramètres* restaure les données d'origine.

## Fonctionnel dès maintenant (interactif)

- Octroyer un prêt à un commerçant → débite la caisse + crée la créance
- Enregistrer un remboursement (partiel ou total) → crédite la caisse + met à jour le statut
- Alimenter une caisse depuis le dashboard admin
- Ajouter un commerçant

## Prochaines étapes (phase 2)

- Backend **Supabase** : schéma SQL + Auth + Row Level Security multi-agences
- Génération **PDF** des factures (format identique aux factures actuelles)
- Relances **SMS** automatiques des commerçants en retard
- App mobile **React Native** offline-first pour les caissiers
- Import des données existantes Dolibarr

-- ============================================================
-- MIGRATION 003 — Gestion stock complète
-- ETS WENDMANÉGRÉ — Exécuter après schema.sql + 001 + 002
-- ============================================================

-- ── Extension table produits ────────────────────────────────
alter table public.produits
  add column if not exists code_barre        text,
  add column if not exists reference_interne text,
  add column if not exists unite             text default 'unité',
  add column if not exists tva_taux          numeric(4,2) default 0,
  add column if not exists stock_max         integer,
  add column if not exists notes             text;

-- ── Extension table fournisseurs ───────────────────────────
alter table public.fournisseurs
  add column if not exists delai_livraison   integer default 7,   -- jours
  add column if not exists conditions_paiement text default 'A réception',
  add column if not exists solde_du          bigint default 0,    -- dette envers ce fournisseur
  add column if not exists nb_commandes      integer default 0,   -- calculé
  add column if not exists derniere_commande date;

-- ── VENTES (Point de vente boutique) ────────────────────────
create table if not exists public.ventes (
  id            uuid primary key default gen_random_uuid(),
  numero        text unique,                          -- VTE-2606-001
  produit_id    text not null references public.produits,
  quantite      integer not null check (quantite > 0),
  prix_unitaire bigint not null,
  remise_pct    numeric(4,2) default 0,
  montant_total bigint not null,
  cout_achat    bigint not null default 0,            -- pour calculer la marge
  marge         bigint not null default 0,
  mode_paiement text not null default 'Espèces'
                  check (mode_paiement in ('Espèces','Orange Money','Moov Money','Telecel','Wizall','Virement','Crédit')),
  client_nom    text,
  client_tel    text,
  caisse_id     text references public.caisses,
  vendu_par     uuid references public.profiles,
  annulee       boolean not null default false,
  motif_annulation text,
  date_vente    date not null default current_date,
  created_at    timestamptz not null default now()
);
create index idx_ventes_produit on public.ventes (produit_id, date_vente desc);
create index idx_ventes_date on public.ventes (date_vente desc);

-- Séquence pour le numéro de vente
create sequence if not exists vente_seq start 1;
create or replace function public.gen_vente_numero()
returns trigger language plpgsql as $$
begin
  if new.numero is null then
    new.numero := 'VTE-' || to_char(current_date, 'YYMM') || '-' || lpad(nextval('vente_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;
create trigger before_insert_vente
  before insert on public.ventes
  for each row execute procedure public.gen_vente_numero();

-- Trigger : décrémenter stock + créer mouvement à la vente
create or replace function public.impact_stock_vente()
returns trigger language plpgsql as $$
begin
  if not new.annulee then
    -- Le stock est décrémenté via le mouvement de stock ci-dessous
    -- (after_mouvement_stock), pas directement, pour éviter un double comptage.
    insert into public.mouvements_stock (produit_id, type, quantite, motif, reference_id, par_user, date_mvt)
    values (new.produit_id, 'sortie', -new.quantite, 'vente', new.id::text, new.vendu_par, new.date_vente);
    -- Impacter la caisse si renseignée
    if new.caisse_id is not null then
      insert into public.mouvements_caisse (caisse_id, type, montant, libelle, par_user, reference_id)
      values (new.caisse_id, 'alimentation', new.montant_total, 'Vente ' || new.numero || ' — ' || (select nom from public.produits where id = new.produit_id), new.vendu_par, new.id::text);
    end if;
  end if;
  return new;
end;
$$;
create trigger after_insert_vente
  after insert on public.ventes
  for each row execute procedure public.impact_stock_vente();

alter table public.ventes enable row level security;
create policy "ventes_select_all" on public.ventes for select using (true);
create policy "ventes_insert_staff" on public.ventes for insert
  with check (public.current_role_name() in ('admin','gerant') or caisse_id = public.my_caisse_id());
create policy "ventes_manage_admin" on public.ventes for update
  using (public.current_role_name() in ('admin','gerant'));

-- ── RÉCEPTION DES COMMANDES ─────────────────────────────────
-- Table de réception (lorsque commande_statut passe à 'recue')
create table if not exists public.receptions (
  id              uuid primary key default gen_random_uuid(),
  commande_id     uuid not null references public.commandes_fournisseurs on delete restrict,
  date_reception  date not null default current_date,
  notes           text,
  receptionne_par uuid references public.profiles,
  created_at      timestamptz not null default now()
);

create table if not exists public.receptions_lignes (
  id            uuid primary key default gen_random_uuid(),
  reception_id  uuid not null references public.receptions on delete cascade,
  produit_id    text not null references public.produits,
  quantite_cmd  integer not null,
  quantite_recue integer not null,
  emplacement   text,                                -- entrepôt de destination
  notes         text
);

-- Trigger : incrémenter stock à la réception
create or replace function public.impact_stock_reception()
returns trigger language plpgsql as $$
begin
  -- Le stock est incrémenté via le mouvement de stock ci-dessous
  -- (after_mouvement_stock), pas directement, pour éviter un double comptage.
  insert into public.mouvements_stock (produit_id, type, quantite, motif, reference_id, date_mvt)
  values (new.produit_id, 'entree', new.quantite_recue, 'reception_commande', new.reception_id::text, current_date);
  return new;
end;
$$;
create trigger after_insert_reception_ligne
  after insert on public.receptions_lignes
  for each row execute procedure public.impact_stock_reception();

-- ── INVENTAIRES PHYSIQUES ────────────────────────────────────
create table if not exists public.inventaires (
  id            uuid primary key default gen_random_uuid(),
  titre         text not null default 'Inventaire',
  date_inventaire date not null default current_date,
  statut        text not null default 'en_cours'
                  check (statut in ('en_cours','valide','annule')),
  entrepot      text,
  notes         text,
  realise_par   uuid references public.profiles,
  valide_par    uuid references public.profiles,
  date_validation date,
  created_at    timestamptz not null default now()
);

create table if not exists public.inventaires_lignes (
  id              uuid primary key default gen_random_uuid(),
  inventaire_id   uuid not null references public.inventaires on delete cascade,
  produit_id      text not null references public.produits,
  stock_theorique integer not null,
  stock_compte    integer not null default 0,
  ecart           integer generated always as (stock_compte - stock_theorique) stored,
  commentaire     text
);

-- Trigger : valider inventaire → créer ajustements de stock
create or replace function public.valider_inventaire()
returns trigger language plpgsql as $$
begin
  if new.statut = 'valide' and old.statut = 'en_cours' then
    -- Créer des mouvements d'ajustement pour chaque écart non nul
    insert into public.mouvements_stock (produit_id, type, quantite, motif, reference_id, par_user, date_mvt)
    select il.produit_id, 'inventaire', il.ecart, 'ajustement_inventaire', new.id::text, new.valide_par, new.date_inventaire
    from public.inventaires_lignes il
    where il.inventaire_id = new.id and il.ecart <> 0;
    -- Mettre à jour les stocks
    update public.produits p
    set stock = il.stock_compte, updated_at = now()
    from public.inventaires_lignes il
    where il.inventaire_id = new.id and il.produit_id = p.id and il.ecart <> 0;
  end if;
  return new;
end;
$$;
create trigger after_update_inventaire
  after update of statut on public.inventaires
  for each row execute procedure public.valider_inventaire();

alter table public.inventaires        enable row level security;
alter table public.inventaires_lignes enable row level security;
alter table public.receptions         enable row level security;
alter table public.receptions_lignes  enable row level security;
create policy "inv_all_staff" on public.inventaires      for all using (public.current_role_name() in ('admin','gerant'));
create policy "inv_lignes_staff" on public.inventaires_lignes for all using (public.current_role_name() in ('admin','gerant'));
create policy "rec_staff" on public.receptions            for all using (public.current_role_name() in ('admin','gerant'));
create policy "rec_lignes_staff" on public.receptions_lignes for all using (public.current_role_name() in ('admin','gerant'));

-- ── VUES ANALYTIQUES ────────────────────────────────────────
create or replace view public.v_stock_valorise as
select
  p.id, p.nom, p.categorie, p.entrepot, p.stock,
  p.seuil_alerte, p.prix_unitaire, p.prix_achat,
  p.stock * p.prix_achat    as valeur_achat,
  p.stock * p.prix_unitaire as valeur_vente,
  p.stock * (p.prix_unitaire - p.prix_achat) as marge_potentielle,
  case
    when p.stock = 0 then 'rupture'
    when p.stock <= p.seuil_alerte then 'critique'
    when p.stock <= p.seuil_alerte * 2 then 'faible'
    else 'normal'
  end as niveau_stock
from public.produits p
where p.actif = true;

create or replace view public.v_ventes_stats as
select
  date_trunc('month', v.date_vente) as mois,
  p.categorie,
  count(*) as nb_ventes,
  sum(v.quantite) as quantite_totale,
  sum(v.montant_total) as chiffre_affaires,
  sum(v.marge) as marge_totale
from public.ventes v
join public.produits p on p.id = v.produit_id
where not v.annulee
group by mois, p.categorie
order by mois desc, marge_totale desc;

do $$ begin raise notice 'Migration 003 Stock complet terminée.'; end $$;

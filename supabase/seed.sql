-- ============================================================
-- ETS WENDMANÉGRÉ — Données initiales (seed)
-- À exécuter APRÈS avoir créé les 4 comptes dans Supabase Auth
-- ET récupéré leurs UUIDs dans auth.users
-- ============================================================
-- Remplacez ces UUIDs par ceux générés par Supabase Auth :
-- DG          → 'DG_UUID_ICI'
-- Aminata     → 'AMINATA_UUID_ICI'
-- Boukary     → 'BOUKARY_UUID_ICI'
-- Salif       → 'SALIF_UUID_ICI'
-- ============================================================

do $$ begin raise notice 'Début seed ETS Wendmanégré'; end $$;

-- ============================================================
-- CAISSES
-- ============================================================
-- Soldes initialisés à 0 : ils sont construits par les mouvements ci-dessous
-- (le trigger after_mouvement_caisse additionne chaque mouvement au solde).
insert into public.caisses (id, nom, solde, agence, assignee_id) values
  ('c1', 'Caisse principale',   0, 'Yako Centre', null),
  ('c2', 'Caisse guichet 1',    0, 'Yako Centre', null),
  ('c3', 'Caisse Bokin',        0, 'Bokin',       null),
  ('c4', 'Caisse réserve',      0, 'Yako Centre', null)
on conflict (id) do nothing;

-- ============================================================
-- FOURNISSEURS (Orange Money, Moov, Telecel, distributeurs SIM)
-- ============================================================
insert into public.fournisseurs (nom, type, telephone, contact) values
  ('Orange Money Burkina', 'OPERATEUR', '+226 76 00 00 00', 'Service distributeurs'),
  ('Moov Africa Burkina',  'OPERATEUR', '+226 70 00 00 00', 'Service distribution'),
  ('Telecel Faso',         'OPERATEUR', '+226 78 00 00 00', 'Agence Yako'),
  ('Wari Burkina',         'DISTRIBUTEUR', '+226 67 00 00 00', 'Contact commercial'),
  ('Distributeur SIM Yako','DISTRIBUTEUR', '+226 71 00 00 00', 'Grossiste local')
on conflict do nothing;

-- ============================================================
-- PRODUITS
-- ============================================================
insert into public.produits (id, nom, categorie, prix_unitaire, stock, entrepot, seuil_alerte) values
  ('p1', 'Carte SIM Orange',       'SIM',      500,    240, 'Yako Centre', 50),
  ('p2', 'Carte SIM Moov',         'SIM',      500,    38,  'Yako Centre', 50),
  ('p3', 'Carte SIM Telecel',      'SIM',      500,    120, 'Bokin',       50),
  ('p4', 'Recharge physique 1000', 'Recharge', 1000,   500, 'Yako Centre', 100),
  ('p5', 'Recharge physique 5000', 'Recharge', 5000,   85,  'Yako Centre', 100),
  ('p6', 'Téléphone Tecno Spark',  'Téléphone',65000,  12,  'Yako Centre', 5),
  ('p7', 'Powerbank 10000mAh',     'Accessoire',8500,  4,   'Bokin',       10)
on conflict (id) do nothing;

-- ============================================================
-- CLIENTS / COMMERÇANTS
-- (24 fiches — correspondant aux vraies factures FA2606-*)
-- ============================================================
insert into public.clients (id, nom, nom_alternatif, ville, telephone, cnib, plafond) values
  ('CU2503-00127', 'SALOU KORANTIN',      null,                         'Yako',       '+226 70 12 34 01', '1843798', 1000000),
  ('CU2603-00601', 'SAWADOGO TIGA',       'Commerçant à Tougan',        'Bokin',      '+226 71 22 33 02', null,      1500000),
  ('CU2503-00120', 'SAWADOGO OUSMANE',    null,                         'Kirsi',      '+226 76 33 44 03', null,      3000000),
  ('CU2503-00246', 'OUEDRAOGO BRAHIMA',   null,                         'Yako',       '+226 78 44 55 04', null,      500000),
  ('CU2503-00055', 'SANFO SAYOUBA',       null,                         'Yako',       '+226 70 55 66 05', null,      800000),
  ('CU2503-00033', 'DIANDA SALIFO',       null,                         'Bokin',      '+226 71 66 77 06', null,      1500000),
  ('CU2503-00181', 'OUEDRAOGO NABI',      null,                         'Yako',       '+226 76 77 88 07', null,      500000),
  ('CU2503-00372', 'KIENTEGA WENDKUNI',   null,                         'Koudougou',  '+226 78 88 99 08', null,      1500000),
  ('CU2503-00262', 'SAWADOGO ISSA',       null,                         'Ouahigouya', '+226 70 99 00 09', null,      4000000),
  ('CU2604-00614', 'PAKODTOGO SALAM',     'Commerçant à Bokin',         'Bokin',      '+226 71 10 20 10', null,      1000000),
  ('CU2503-00112', 'CISSE KARIME',        null,                         'Yako',       '+226 76 11 21 11', null,      500000),
  ('CU2503-00375', 'OUEDRAOGO SAIDOU',    null,                         'Gilgou',     '+226 78 12 22 12', null,      500000),
  ('CU2512-00566', 'ILBOUDO PINGDWENDE',  'Commerçant Tinhin',          'Yako',       '+226 70 13 23 13', null,      2000000),
  ('CU2503-00315', 'SANFO HAROUNA',       null,                         'Latoden',    '+226 71 14 24 14', null,      500000),
  ('CU2503-00035', 'DIANDA OUMAROU',      null,                         'Bokin',      '+226 76 15 25 15', null,      2500000),
  ('CU2503-00322', 'KABORE AZISE',        null,                         'Bobo',       '+226 78 16 26 16', null,      3500000),
  ('CU2601-00578', 'OUEDRAOGO LASSANE',   'Commerçant à Arbollé',       'Arbollé',    '+226 70 17 27 17', null,      500000),
  ('CU2604-00621', 'SANKARA KARIM',       'Commerçant à Kirsi',         'Kirsi',      '+226 71 18 28 18', null,      600000),
  ('CU2503-00150', 'SAMNE EMMANUEL',      null,                         'Yako',       '+226 76 19 29 19', null,      600000),
  ('CU2503-00209', 'OUEDRAOGO YACOUBA',   null,                         'Bobo',       '+226 78 20 30 20', null,      1500000),
  ('CU2503-00165', 'SAWADOGO SERGE',      null,                         'Yako',       '+226 70 21 31 21', null,      300000),
  ('CU2601-00589', 'TENKODOGO BOUREIMA',  'Commerçant à Tikaré',        'Tikaré',     '+226 71 22 32 22', null,      800000),
  ('CU2503-00277', 'OUEDRAOGO BOUKARE',   null,                         'Ouahigouya', '+226 76 23 33 23', null,      1500000),
  ('CU2510-00532', 'DJIGUEMDE LASSANE',   'Commerçant à Samba',         'Samba',      '+226 78 24 34 24', null,      400000)
on conflict (id) do nothing;

-- ============================================================
-- PRÊTS — 25 créances impayées du 03/06/2026 (Total : 21 550 000 F)
-- ============================================================
insert into public.prets (id, client_id, type_operation, montant, date_octroi, echeance, statut, caisse_id) values
  ('FA2606-54063', 'CU2503-00127', 'ORANGE MONEY', 500000,  '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54062', 'CU2603-00601', 'ORANGE MONEY', 900000,  '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54061', 'CU2503-00120', 'ORANGE MONEY', 2000000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54060', 'CU2503-00246', 'ORANGE MONEY', 300000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54059', 'CU2503-00055', 'ORANGE MONEY', 500000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54058', 'CU2503-00033', 'ORANGE MONEY', 1000000, '2026-06-03', '2026-06-18', 'impaye', 'c3'),
  ('FA2606-54057', 'CU2503-00181', 'ORANGE MONEY', 300000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54056', 'CU2503-00372', 'MOOV MONEY',   1000000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54055', 'CU2503-00262', 'ORANGE MONEY', 3000000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54054', 'CU2604-00614', 'ORANGE MONEY', 500000,  '2026-06-03', '2026-06-18', 'impaye', 'c3'),
  ('FA2606-54051', 'CU2503-00112', 'ORANGE MONEY', 300000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54050', 'CU2503-00375', 'UNITES',       300000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54048', 'CU2512-00566', 'ORANGE MONEY', 1700000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54046', 'CU2503-00315', 'ORANGE MONEY', 300000,  '2026-06-03', '2026-06-18', 'impaye', 'c3'),
  ('FA2606-54045', 'CU2503-00035', 'ORANGE MONEY', 2000000, '2026-06-03', '2026-06-18', 'impaye', 'c3'),
  ('FA2606-54044', 'CU2604-00614', 'UNITES',       100000,  '2026-06-03', '2026-06-18', 'impaye', 'c3'),
  ('FA2606-54043', 'CU2503-00322', 'ORANGE MONEY', 3000000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54042', 'CU2601-00578', 'ORANGE MONEY', 200000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54033', 'CU2604-00621', 'ORANGE MONEY', 400000,  '2026-06-03', '2026-06-18', 'impaye', 'c3'),
  ('FA2606-54031', 'CU2503-00150', 'ORANGE MONEY', 400000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54030', 'CU2503-00209', 'TELECEL',      1000000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54028', 'CU2503-00165', 'UNITES',       100000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  ('FA2606-54027', 'CU2601-00589', 'ORANGE MONEY', 500000,  '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54025', 'CU2503-00277', 'ORANGE MONEY', 1000000, '2026-06-03', '2026-06-18', 'impaye', 'c1'),
  ('FA2606-54024', 'CU2510-00532', 'ORANGE MONEY', 250000,  '2026-06-03', '2026-06-18', 'impaye', 'c2'),
  -- Historique soldé (pour des KPIs réalistes)
  ('FA2605-53980', 'CU2503-00127', 'ORANGE MONEY', 400000,  '2026-05-10', '2026-05-25', 'rembourse', 'c1'),
  ('FA2605-53942', 'CU2503-00262', 'ORANGE MONEY', 2500000, '2026-05-08', '2026-05-23', 'rembourse', 'c1'),
  ('FA2605-53901', 'CU2503-00033', 'MOOV MONEY',   800000,  '2026-05-02', '2026-05-17', 'partiel',   'c3'),
  ('FA2604-53780', 'CU2503-00322', 'ORANGE MONEY', 1500000, '2026-04-15', '2026-04-30', 'retard',    'c1'),
  ('FA2605-53850', 'CU2503-00120', 'ORANGE MONEY', 1000000, '2026-05-01', '2026-05-16', 'rembourse', 'c1')
on conflict (id) do nothing;

-- Remboursements liés à l'historique
insert into public.remboursements (pret_id, montant, date_remb, mode, caisse_id) values
  ('FA2605-53980', 400000,  '2026-05-24', 'Orange Money', 'c1'),
  ('FA2605-53942', 2500000, '2026-05-22', 'Versement',    'c1'),
  ('FA2605-53901', 500000,  '2026-05-15', 'Espèces',      'c3'),
  ('FA2605-53850', 1000000, '2026-05-14', 'Virement',     'c1')
on conflict do nothing;

-- Mouvements de caisse initiaux — construisent les soldes de départ
-- (c1=4 500 000, c2=850 000, c3=1 200 000, c4=6 800 000)
insert into public.mouvements_caisse (caisse_id, type, montant, date_mvt, libelle) values
  ('c1', 'alimentation', 4500000, '2026-06-01', 'Solde d''ouverture — caisse principale'),
  ('c2', 'alimentation', 850000,  '2026-06-02', 'Solde d''ouverture — guichet 1'),
  ('c3', 'alimentation', 1200000, '2026-06-01', 'Solde d''ouverture — Bokin'),
  ('c4', 'alimentation', 6800000, '2026-06-01', 'Solde d''ouverture — réserve')
on conflict do nothing;

do $$ begin raise notice 'Seed terminé avec succès.'; end $$;

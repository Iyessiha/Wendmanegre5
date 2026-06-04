#!/usr/bin/env node
/**
 * Script de migration Dolibarr → Supabase
 * ETS WENDMANÉGRÉ
 *
 * Usage :
 *   node scripts/migrate-dolibarr.mjs
 *
 * Variables d'environnement requises (.env.local) :
 *   DOLIBARR_URL       = https://gescom.wendmanegre.com
 *   DOLIBARR_API_KEY   = votre_cle_api_dolibarr
 *   SUPABASE_URL       = https://xxxx.supabase.co
 *   SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * Comment obtenir la clé Dolibarr :
 *   1. Dans Dolibarr → Configuration → Modules → Activer "API REST"
 *   2. Administration → Utilisateurs → votre user → Onglet "API/Services web"
 *   3. Générer ou définir la "Clé pour l'API"
 *
 * Comment obtenir la clé Supabase Service Role :
 *   Dashboard Supabase → Settings → API → service_role key
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const DOLIBARR_URL     = process.env.DOLIBARR_URL;
const DOLIBARR_API_KEY = process.env.DOLIBARR_API_KEY;
const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY;

if (!DOLIBARR_URL || !DOLIBARR_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Variables d\'environnement manquantes. Voir le commentaire en tête de fichier.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ────────────────────────────────────────────────

async function doliGet(endpoint, params = {}) {
  const url = new URL(`${DOLIBARR_URL}/api/index.php/${endpoint}`);
  url.searchParams.set('limit', '100');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  let page = 0;
  const all = [];

  while (true) {
    url.searchParams.set('page', page);
    const res = await fetch(url.toString(), {
      headers: { 'DOLAPIKEY': DOLIBARR_API_KEY, 'Accept': 'application/json' },
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Dolibarr ${endpoint} HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
    page++;
    process.stdout.write('.');
  }
  return all;
}

function log(msg) { console.log(`\n📦 ${msg}`); }
function ok(msg, n) { console.log(`   ✅ ${n} ${msg}`); }
function warn(msg) { console.log(`   ⚠️  ${msg}`); }

// ─── Parsers : Dolibarr → Supabase ──────────────────────────

function parseClient(t) {
  // Dans Dolibarr, les commerçants sont des "tiers" avec code client
  const ref = t.code_client || `CU${t.id}`;
  return {
    id:             ref,
    nom:            (t.nom || t.name || '').toUpperCase().trim(),
    nom_alternatif: t.name_alias || null,
    ville:          t.town || t.ville || '',
    telephone:      t.phone || t.phone_pro || null,
    cnib:           t.idprof1 || null,
    identifiant_pro1: t.idprof1 || null,
    identifiant_pro2: t.idprof2 || null,
    plafond:        parseInt(t.outstanding_limit || '500000') || 500000,
    actif:          t.status !== '0',
    date_creation:  t.date_creation ? new Date(parseInt(t.date_creation) * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

function parsePret(inv) {
  // Dans Dolibarr, les créances sont des "invoices" clients
  // Le type d'opération est dans les lignes (inv.lines[0].desc ou product_ref)
  const ligne = inv.lines?.[0];
  const typeOp = extraireType(ligne?.desc || ligne?.product_label || 'ORANGE MONEY');
  const statut = resolveStatut(inv.paye, inv.statut, inv.remaintopay);

  return {
    id:             inv.ref,
    client_id:      inv.socid ? null : null, // → sera résolu par le mapping tiers
    client_ref:     inv.thirdparty_code || inv.thirdparty?.code_client, // pour résolution
    type_operation: typeOp,
    montant:        Math.round(parseFloat(inv.total_ht || inv.total_ttc || 0)),
    date_octroi:    inv.date ? new Date(parseInt(inv.date) * 1000).toISOString().slice(0, 10) : null,
    echeance:       inv.date_lim_reglement ? new Date(parseInt(inv.date_lim_reglement) * 1000).toISOString().slice(0, 10) : null,
    statut,
    caisse_id:      'c1', // défaut — à mettre à jour manuellement si besoin
  };
}

function extraireType(desc) {
  const d = (desc || '').toUpperCase();
  if (d.includes('ORANGE'))   return 'ORANGE MONEY';
  if (d.includes('MOOV'))     return 'MOOV MONEY';
  if (d.includes('TELECEL'))  return 'TELECEL';
  if (d.includes('SIM'))      return 'SIM';
  if (d.includes('UNIT'))     return 'UNITES';
  if (d.includes('WARI') || d.includes('RIA') || d.includes('INTL')) return 'TRANSFERT INTL';
  return 'ORANGE MONEY';
}

function resolveStatut(paye, statut, remaintopay) {
  if (paye === '1' || statut === '2') return 'rembourse';
  const reste = parseFloat(remaintopay || '0');
  if (reste <= 0) return 'rembourse';
  // Statut Dolibarr : 0=brouillon, 1=validé, 2=payé, 3=abandon
  if (statut === '3') return 'annule';
  return 'impaye';
}

// ─── Migration ───────────────────────────────────────────────

async function migrateClients() {
  log('Migration des tiers / commerçants...');
  const tiers = await doliGet('thirdparties', { mode: '1' }); // mode=1 = clients uniquement
  ok('tiers récupérés depuis Dolibarr', tiers.length);

  const clients = tiers
    .filter(t => t.client === '1' || t.client === '2') // clients et prospects
    .map(parseClient)
    .filter(c => c.nom && c.id);

  if (clients.length === 0) {
    warn('Aucun client trouvé. Vérifiez le filtre mode=1 ou les permissions de l\'API.');
    return new Map();
  }

  // Insérer par batches de 50
  let inserted = 0;
  for (let i = 0; i < clients.length; i += 50) {
    const batch = clients.slice(i, i + 50);
    const { error } = await supabase.from('clients').upsert(batch, { onConflict: 'id' });
    if (error) { warn(`Erreur insertion clients batch ${i}: ${error.message}`); }
    else inserted += batch.length;
  }
  ok(`clients insérés dans Supabase`, inserted);

  // Retourner le mapping thirdparty_id → client_id pour les factures
  const mapping = new Map();
  tiers.forEach(t => { mapping.set(String(t.id), t.code_client || `CU${t.id}`); });
  return mapping;
}

async function migrateInvoices(clientMapping) {
  log('Migration des factures clients (créances)...');

  // Récupérer les factures non payées (statut=1) et payées (statut=2)
  const [unpaid, paid] = await Promise.all([
    doliGet('invoices', { status: 'unpaid' }),
    doliGet('invoices', { status: 'paid' }),
  ]);

  const all = [...unpaid, ...paid];
  ok(`factures récupérées depuis Dolibarr (impayées: ${unpaid.length}, payées: ${paid.length})`, all.length);

  const prets = all
    .map(inv => {
      const p = parsePret(inv);
      // Résoudre le client_id depuis le thirdparty_id
      p.client_id = clientMapping.get(String(inv.socid)) || null;
      delete p.client_ref;
      return p;
    })
    .filter(p => p.client_id && p.montant > 0 && p.id);

  let inserted = 0;
  for (let i = 0; i < prets.length; i += 50) {
    const batch = prets.slice(i, i + 50);
    const { error } = await supabase.from('prets').upsert(batch, { onConflict: 'id' });
    if (error) { warn(`Erreur insertion prêts batch ${i}: ${error.message}`); }
    else inserted += batch.length;
  }
  ok(`prêts/créances insérés dans Supabase`, inserted);

  // Récupérer et migrer les paiements existants
  log('Migration des paiements / remboursements...');
  let rembs = 0;
  for (const inv of paid.slice(0, 100)) { // Les 100 dernières factures payées
    try {
      const payments = await doliGet(`invoices/${inv.id}/payments`);
      for (const pay of payments) {
        const { error } = await supabase.from('remboursements').insert({
          pret_id:  inv.ref,
          montant:  Math.round(parseFloat(pay.amount || 0)),
          date_remb: pay.datepaye ? new Date(parseInt(pay.datepaye) * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
          mode:     'Versement',
          caisse_id: 'c1',
        });
        if (!error) rembs++;
      }
    } catch {}
  }
  ok(`remboursements importés`, rembs);
}

async function migrateProducts() {
  log('Migration des produits...');
  const products = await doliGet('products');
  ok('produits récupérés', products.length);

  const produits = products.map(p => ({
    id:            `DOL-${p.id}`,
    nom:           p.label || p.libelle || '',
    categorie:     p.type === '1' ? 'Service' : (p.customcode || 'Produit'),
    prix_unitaire: Math.round(parseFloat(p.price || 0)),
    stock:         parseInt(p.stock_reel || 0),
    entrepot:      'Yako Centre',
    seuil_alerte:  parseInt(p.seuil_stock_alerte || 10),
  })).filter(p => p.nom);

  let inserted = 0;
  for (let i = 0; i < produits.length; i += 50) {
    const { error } = await supabase.from('produits').upsert(produits.slice(i, i + 50), { onConflict: 'id' });
    if (!error) inserted += Math.min(50, produits.length - i);
  }
  ok(`produits insérés`, inserted);
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  Migration Dolibarr → Supabase                  ║');
  console.log('║  ETS WENDMANÉGRÉ — Yako, Burkina Faso            ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\nDolibarr : ${DOLIBARR_URL}`);
  console.log(`Supabase  : ${SUPABASE_URL}\n`);

  try {
    // Test de connexion
    const { error: connErr } = await supabase.from('clients').select('count').limit(1);
    if (connErr) throw new Error(`Connexion Supabase: ${connErr.message}`);
    console.log('✅ Connexions OK\n');

    const clientMapping = await migrateClients();
    await migrateInvoices(clientMapping);
    await migrateProducts();

    console.log('\n═════════════════════════════════════════');
    console.log('✅ Migration terminée avec succès !');
    console.log('═════════════════════════════════════════\n');
    console.log('Prochaines étapes :');
    console.log('  1. Vérifier les données dans le dashboard Supabase');
    console.log('  2. Mettre à jour les caisse_id des prêts si nécessaire');
    console.log('  3. Assigner les caisses aux utilisateurs dans l\'app\n');
  } catch (err) {
    console.error('\n❌ Erreur de migration:', err.message);
    process.exit(1);
  }
}

main();

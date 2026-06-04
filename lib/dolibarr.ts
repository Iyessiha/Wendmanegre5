"use client";

import { getClient } from "./supabase";

// Appels à la fonction serveur sync-dolibarr (admin uniquement, clé Dolibarr côté serveur).
async function callFn(fn: string, body: Record<string, unknown>) {
  const sb = getClient();
  const { data, error } = await sb.functions.invoke(fn, { body });
  if (error) {
    try {
      const ctx = (error as any).context;
      if (ctx?.json) { const j = await ctx.json(); if (j?.error) throw new Error(j.error); }
    } catch (inner) { if (inner instanceof Error && inner.message) throw inner; }
    throw new Error(error.message || "Erreur serveur.");
  }
  if (data?.error) throw new Error(data.error + (data.detail ? " — " + JSON.stringify(data.detail) : ""));
  return data;
}

const call = (body: Record<string, unknown>) => callFn("sync-dolibarr", body);

export const testerDolibarr      = () => call({ action: "test" });
export const synchroniserClients = () => call({ action: "sync_clients" });
export const synchroniserProduits = () => call({ action: "sync_produits" });
export const synchroniserFactures = () => call({ action: "sync_factures" });
export const synchroniserAvoirs   = () => call({ action: "sync_avoirs" });
export const synchroniserCommandes = () => call({ action: "sync_commandes" });
export const synchroniserFacturesClients = () => call({ action: "sync_factures_clients" });

// Import : Dolibarr → application
export const importerDepuisDolibarr = () => callFn("import-dolibarr", { action: "import_all" });
export const importerClients = () => callFn("import-dolibarr", { action: "import_clients" });
export const importerProduits = () => callFn("import-dolibarr", { action: "import_produits" });

// Edge Function : sync-dolibarr — synchronisation app → Dolibarr (admin uniquement)
// Actions : test | sync_clients | sync_produits | sync_factures | sync_avoirs
// Configuration (table app_secrets) : DOLIBARR_URL, DOLIBARR_API_KEY
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function errDetail(d: any) { return typeof d === "object" ? JSON.stringify(d?.error ?? d) : String(d); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: caller, error: cErr } = await admin.auth.getUser(token);
    if (cErr || !caller?.user) return json({ error: "Non authentifié." }, 401);
    const { data: prof } = await admin.from("profiles").select("role").eq("id", caller.user.id).single();
    if (prof?.role !== "admin") return json({ error: "Réservé à l'administrateur." }, 403);

    const { data: secrets } = await admin.from("app_secrets").select("cle,valeur").in("cle", ["DOLIBARR_URL", "DOLIBARR_API_KEY"]);
    const map: Record<string, string> = {};
    (secrets ?? []).forEach((s: any) => { map[s.cle] = s.valeur; });
    const baseUrl = (map["DOLIBARR_URL"] || "").replace(/\/$/, "");
    const apiKey = map["DOLIBARR_API_KEY"] || "";
    if (!baseUrl || !apiKey) return json({ error: "Configuration Dolibarr manquante." }, 400);

    async function doli(method: string, path: string, body?: unknown) {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { "DOLAPIKEY": apiKey, "Content-Type": "application/json", "Accept": "application/json" },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let parsed: any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
      return { ok: res.ok, status: res.status, data: parsed };
    }
    const idOf = (d: any) => typeof d === "number" ? String(d) : String(d?.id ?? d);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "test") {
      const r = await doli("GET", "/thirdparties?limit=1&mode=1");
      if (!r.ok) return json({ error: `Dolibarr a répondu ${r.status}`, detail: r.data }, 200);
      const n = Array.isArray(r.data) ? r.data.length : 0;
      return json({ ok: true, message: `Connexion réussie (${n} tiers testé).` });
    }

    if (action === "sync_clients") {
      const { data: clients } = await admin.from("clients").select("*").eq("actif", true);
      let created = 0, updated = 0; const errors: string[] = [];
      for (const c of clients ?? []) {
        try {
          const payload: any = { name: c.nom, client: 1, town: c.ville ?? null, phone: c.telephone ?? null };
          let doliId = c.dolibarr_id as string | null;
          if (!doliId) {
            const safe = String(c.nom).replace(/'/g, "\\'");
            const s = await doli("GET", `/thirdparties?limit=1&mode=1&sqlfilters=${encodeURIComponent(`(t.nom:=:'${safe}')`)}`);
            if (s.ok && Array.isArray(s.data) && s.data.length > 0) doliId = String(s.data[0].id);
          }
          if (doliId) {
            const up = await doli("PUT", `/thirdparties/${doliId}`, payload);
            if (!up.ok) { errors.push(`${c.nom}: maj ${up.status}`); continue; }
            if (!c.dolibarr_id) await admin.from("clients").update({ dolibarr_id: doliId }).eq("id", c.id);
            updated++;
          } else {
            const cr = await doli("POST", "/thirdparties", { ...payload, code_client: "auto" });
            if (!cr.ok) { errors.push(`${c.nom}: création ${cr.status} ${errDetail(cr.data)}`); continue; }
            await admin.from("clients").update({ dolibarr_id: idOf(cr.data) }).eq("id", c.id);
            created++;
          }
        } catch (e) { errors.push(`${c.nom}: ${String((e as Error)?.message ?? e)}`); }
      }
      return json({ ok: true, entity: "commerçants", created, updated, errors });
    }

    if (action === "sync_produits") {
      const { data: produits } = await admin.from("produits").select("*").eq("actif", true);
      let created = 0, updated = 0; const errors: string[] = [];
      for (const p of produits ?? []) {
        try {
          const ref = String(p.code_barre || p.id);
          const payload: any = { ref, label: p.nom, price: p.prix_unitaire ?? 0, type: 0 };
          let doliId = p.dolibarr_id as string | null;
          if (!doliId) {
            const safe = ref.replace(/'/g, "\\'");
            const s = await doli("GET", `/products?limit=1&sqlfilters=${encodeURIComponent(`(t.ref:=:'${safe}')`)}`);
            if (s.ok && Array.isArray(s.data) && s.data.length > 0) doliId = String(s.data[0].id);
          }
          if (doliId) {
            const up = await doli("PUT", `/products/${doliId}`, { label: p.nom, price: p.prix_unitaire ?? 0 });
            if (!up.ok) { errors.push(`${p.nom}: maj ${up.status}`); continue; }
            if (!p.dolibarr_id) await admin.from("produits").update({ dolibarr_id: doliId }).eq("id", p.id);
            updated++;
          } else {
            const cr = await doli("POST", "/products", payload);
            if (!cr.ok) { errors.push(`${p.nom}: création ${cr.status} ${errDetail(cr.data)}`); continue; }
            await admin.from("produits").update({ dolibarr_id: idOf(cr.data) }).eq("id", p.id);
            created++;
          }
        } catch (e) { errors.push(`${p.nom}: ${String((e as Error)?.message ?? e)}`); }
      }
      return json({ ok: true, entity: "produits", created, updated, errors });
    }

    if (action === "sync_factures") {
      const { data: prets } = await admin.from("prets").select("*").neq("statut", "annule");
      const { data: clients } = await admin.from("clients").select("id,dolibarr_id");
      const cmap: Record<string, string> = {}; (clients ?? []).forEach((c: any) => { if (c.dolibarr_id) cmap[c.id] = c.dolibarr_id; });
      let created = 0, validated = 0; const errors: string[] = [];
      for (const p of prets ?? []) {
        try {
          if (p.dolibarr_id) continue;
          const socid = cmap[p.client_id];
          if (!socid) { errors.push(`${p.id}: client non synchronisé`); continue; }
          const payload: any = {
            socid, type: "0", date: p.date_octroi, ref_client: p.id,
            note_private: `Prêt ${p.id} — ${p.type_operation}`,
            lines: [{ desc: `${p.type_operation} — prêt ${p.id}`, subprice: p.montant, qty: 1, tva_tx: 0 }],
          };
          const cr = await doli("POST", "/invoices", payload);
          if (!cr.ok) { errors.push(`${p.id}: création ${cr.status} ${errDetail(cr.data)}`); continue; }
          const invId = idOf(cr.data);
          await admin.from("prets").update({ dolibarr_id: invId }).eq("id", p.id);
          created++;
          const val = await doli("POST", `/invoices/${invId}/validate`, {});
          if (val.ok) validated++; else errors.push(`${p.id}: facture créée mais non validée (${val.status})`);
        } catch (e) { errors.push(`${p.id}: ${String((e as Error)?.message ?? e)}`); }
      }
      const msg = `Factures : ${created} créée(s), ${validated} validée(s)` + (errors.length ? `, ${errors.length} à vérifier :\n` + errors.slice(0, 6).join("\n") : ".");
      return json({ ok: true, message: msg });
    }

    if (action === "sync_avoirs") {
      const today = new Date().toISOString().slice(0, 10);
      const { data: prets } = await admin.from("prets").select("*").eq("statut", "annule");
      const { data: clients } = await admin.from("clients").select("id,dolibarr_id");
      const cmap: Record<string, string> = {}; (clients ?? []).forEach((c: any) => { if (c.dolibarr_id) cmap[c.id] = c.dolibarr_id; });
      let created = 0, validated = 0; const errors: string[] = [];
      for (const p of prets ?? []) {
        try {
          if (p.dolibarr_avoir_id) continue;
          const socid = cmap[p.client_id];
          if (!socid) { errors.push(`${p.id}: client non synchronisé`); continue; }
          if (!p.dolibarr_id) { errors.push(`${p.id}: facture source absente (synchronisez d'abord les factures)`); continue; }
          const payload: any = {
            socid, type: "2", date: today, fk_facture_source: p.dolibarr_id, ref_client: `AVOIR-${p.id}`,
            note_private: `Avoir — annulation prêt ${p.id}` + (p.motif_annulation ? ` (${p.motif_annulation})` : ""),
            lines: [{ desc: `Annulation prêt ${p.id}`, subprice: -Math.abs(p.montant), qty: 1, tva_tx: 0 }],
          };
          const cr = await doli("POST", "/invoices", payload);
          if (!cr.ok) { errors.push(`${p.id}: avoir ${cr.status} ${errDetail(cr.data)}`); continue; }
          const avId = idOf(cr.data);
          await admin.from("prets").update({ dolibarr_avoir_id: avId }).eq("id", p.id);
          created++;
          const val = await doli("POST", `/invoices/${avId}/validate`, {});
          if (val.ok) validated++;
        } catch (e) { errors.push(`${p.id}: ${String((e as Error)?.message ?? e)}`); }
      }
      const msg = `Avoirs : ${created} créé(s), ${validated} validé(s)` + (errors.length ? `, ${errors.length} à vérifier :\n` + errors.slice(0, 6).join("\n") : ".");
      return json({ ok: true, message: msg });
    }


    if (action === "sync_commandes") {
      const { data: cmds } = await admin.from("factures").select("*, lignes:factures_lignes(*)").eq("type", "commande").neq("statut", "annulee");
      const { data: clients } = await admin.from("clients").select("id,dolibarr_id");
      const cmap: Record<string, string> = {}; (clients ?? []).forEach((c: any) => { if (c.dolibarr_id) cmap[c.id] = c.dolibarr_id; });
      let created = 0, validated = 0; const errors: string[] = [];
      for (const c of cmds ?? []) {
        try {
          if (c.dolibarr_id) continue;
          const socid = cmap[c.client_id];
          if (!socid) { errors.push(`${c.id}: client non synchronisé`); continue; }
          const lignes = (c.lignes ?? []).sort((a: any, b: any) => (a.rang ?? 0) - (b.rang ?? 0))
            .map((l: any) => ({ desc: l.designation, subprice: l.prix_unitaire, qty: l.quantite, tva_tx: 0 }));
          const payload: any = { socid, type: 0, date: c.date_facture, ref_client: c.id, note_private: c.notes ?? `Commande ${c.id}`, lines: lignes };
          const cr = await doli("POST", "/orders", payload);
          if (!cr.ok) { errors.push(`${c.id}: création ${cr.status} ${errDetail(cr.data)}`); continue; }
          const oid = idOf(cr.data);
          await admin.from("factures").update({ dolibarr_id: oid }).eq("id", c.id);
          created++;
          const val = await doli("POST", `/orders/${oid}/validate`, {});
          if (val.ok) validated++; else errors.push(`${c.id}: commande créée mais non validée (${val.status})`);
        } catch (e) { errors.push(`${c.id}: ${String((e as Error)?.message ?? e)}`); }
      }
      const msg = `Commandes clients : ${created} créée(s), ${validated} validée(s)` + (errors.length ? `, ${errors.length} à vérifier :\n` + errors.slice(0, 6).join("\n") : ".");
      return json({ ok: true, message: msg });
    }

    if (action === "sync_factures_clients") {
      const { data: facs } = await admin.from("factures").select("*, lignes:factures_lignes(*)").eq("type", "facture").neq("statut", "annulee");
      const { data: clients } = await admin.from("clients").select("id,dolibarr_id");
      const cmap: Record<string, string> = {}; (clients ?? []).forEach((c: any) => { if (c.dolibarr_id) cmap[c.id] = c.dolibarr_id; });
      let created = 0, validated = 0; const errors: string[] = [];
      for (const f of facs ?? []) {
        try {
          if (f.dolibarr_id) continue;
          const socid = cmap[f.client_id];
          if (!socid) { errors.push(`${f.id}: client non synchronisé`); continue; }
          const lignes = (f.lignes ?? []).sort((a: any, b: any) => (a.rang ?? 0) - (b.rang ?? 0))
            .map((l: any) => ({ desc: l.designation, subprice: l.prix_unitaire, qty: l.quantite, tva_tx: 0 }));
          const payload: any = { socid, type: "0", date: f.date_facture, ref_client: f.id, note_private: f.notes ?? `Facture ${f.id}`, lines: lignes };
          const cr = await doli("POST", "/invoices", payload);
          if (!cr.ok) { errors.push(`${f.id}: création ${cr.status} ${errDetail(cr.data)}`); continue; }
          const invId = idOf(cr.data);
          await admin.from("factures").update({ dolibarr_id: invId }).eq("id", f.id);
          created++;
          const val = await doli("POST", `/invoices/${invId}/validate`, {});
          if (val.ok) validated++; else errors.push(`${f.id}: facture créée mais non validée (${val.status})`);
        } catch (e) { errors.push(`${f.id}: ${String((e as Error)?.message ?? e)}`); }
      }
      const msg = `Factures clients : ${created} créée(s), ${validated} validée(s)` + (errors.length ? `, ${errors.length} à vérifier :\n` + errors.slice(0, 6).join("\n") : ".");
      return json({ ok: true, message: msg });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

// Edge Function : import-dolibarr — importe les données Dolibarr VERS l'application (admin uniquement)
// Actions : import_clients | import_produits | import_all
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
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

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

    async function doli(path: string) {
      const res = await fetch(`${baseUrl}${path}`, { headers: { "DOLAPIKEY": apiKey, "Accept": "application/json" } });
      const text = await res.text();
      let parsed: any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
      return { ok: res.ok, status: res.status, data: parsed };
    }

    async function importThirdparties() {
      let page = 0, imported = 0, updated = 0; const errors: string[] = []; const limit = 100;
      while (page < 50) {
        const r = await doli(`/thirdparties?mode=1&limit=${limit}&page=${page}&sortfield=t.rowid&sortorder=ASC`);
        if (!r.ok) { if (r.status !== 404 && page === 0) errors.push(`lecture ${r.status} ${errDetail(r.data)}`); break; }
        const arr = Array.isArray(r.data) ? r.data : [];
        if (arr.length === 0) break;
        for (const t of arr) {
          try {
            const dolId = String(t.id);
            const nom = t.name || t.nom || `Tiers ${dolId}`;
            const ville = t.town || t.ville || "N/C";
            const tel = t.phone || t.phone_pro || null;
            const { data: ex } = await admin.from("clients").select("id").eq("dolibarr_id", dolId).maybeSingle();
            if (ex) { await admin.from("clients").update({ nom, ville, telephone: tel, updated_at: new Date().toISOString() }).eq("id", ex.id); updated++; }
            else { await admin.from("clients").insert({ id: `D${dolId}`, nom, ville, telephone: tel, dolibarr_id: dolId }); imported++; }
          } catch (e) { errors.push(`tiers ${t?.id}: ${String((e as Error)?.message ?? e)}`); }
        }
        if (arr.length < limit) break; page++;
      }
      return { imported, updated, errors };
    }

    async function importProducts() {
      let page = 0, imported = 0, updated = 0; const errors: string[] = []; const limit = 100;
      while (page < 50) {
        const r = await doli(`/products?limit=${limit}&page=${page}&sortfield=t.rowid&sortorder=ASC`);
        if (!r.ok) { if (r.status !== 404 && page === 0) errors.push(`lecture ${r.status} ${errDetail(r.data)}`); break; }
        const arr = Array.isArray(r.data) ? r.data : [];
        if (arr.length === 0) break;
        for (const p of arr) {
          try {
            const dolId = String(p.id);
            const nom = p.label || p.ref || `Produit ${dolId}`;
            const prix = Math.round(Number(p.price ?? p.price_ttc ?? 0)) || 0;
            const ref = p.ref || null;
            const { data: ex } = await admin.from("produits").select("id").eq("dolibarr_id", dolId).maybeSingle();
            if (ex) { await admin.from("produits").update({ nom, prix_unitaire: prix, code_barre: ref, updated_at: new Date().toISOString() }).eq("id", ex.id); updated++; }
            else { await admin.from("produits").insert({ id: `DP${dolId}`, nom, categorie: "Import Dolibarr", prix_unitaire: prix, entrepot: "Yako Centre", code_barre: ref, dolibarr_id: dolId }); imported++; }
          } catch (e) { errors.push(`produit ${p?.id}: ${String((e as Error)?.message ?? e)}`); }
        }
        if (arr.length < limit) break; page++;
      }
      return { imported, updated, errors };
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === "import_clients") {
      const r = await importThirdparties();
      return json({ ok: true, ...r, message: `Commerçants : ${r.imported} importé(s), ${r.updated} mis à jour` + (r.errors.length ? `, ${r.errors.length} erreur(s)` : "") });
    }
    if (action === "import_produits") {
      const r = await importProducts();
      return json({ ok: true, ...r, message: `Produits : ${r.imported} importé(s), ${r.updated} mis à jour` + (r.errors.length ? `, ${r.errors.length} erreur(s)` : "") });
    }
    if (action === "import_all") {
      const a = await importThirdparties();
      const b = await importProducts();
      const nbErr = a.errors.length + b.errors.length;
      return json({
        ok: true, clients: a, produits: b,
        message: `Commerçants : ${a.imported} importé(s) / ${a.updated} maj — Produits : ${b.imported} importé(s) / ${b.updated} maj` + (nbErr ? ` — ${nbErr} erreur(s)` : ""),
      });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

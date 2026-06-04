// ============================================================
// Edge Function : admin-users
// Gestion des comptes réservée à l'administrateur.
// Actions : create | reset_password | set_active
//
// Déploiement (CLI) :  supabase functions deploy admin-users
// La clé service_role est injectée automatiquement par Supabase
// (variable SUPABASE_SERVICE_ROLE_KEY) — ne jamais la coder en dur.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DOMAINE = "wendmanegre.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1. Identifier l'appelant via son jeton
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: caller, error: cErr } = await admin.auth.getUser(token);
    if (cErr || !caller?.user) return json({ error: "Non authentifié." }, 401);

    // 2. Vérifier qu'il est administrateur
    const { data: prof } = await admin
      .from("profiles").select("role").eq("id", caller.user.id).single();
    if (prof?.role !== "admin") return json({ error: "Réservé à l'administrateur." }, 403);

    const body = await req.json();
    const action = body.action as string;

    // 3. Créer un compte
    if (action === "create") {
      const identifiant = String(body.identifiant ?? "").trim().toLowerCase();
      const nom = String(body.nom ?? "").trim();
      const role = String(body.role ?? "caissier");
      const agence = String(body.agence ?? "Yako Centre");
      const password = String(body.password ?? "");
      if (!identifiant || !nom || !password) return json({ error: "Identifiant, nom et mot de passe sont requis." }, 400);
      if (password.length < 6) return json({ error: "Le mot de passe doit faire au moins 6 caractères." }, 400);
      if (!["admin", "gerant", "caissier"].includes(role)) return json({ error: "Rôle invalide." }, 400);

      const email = `${identifiant}@${DOMAINE}`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nom, role, agence, identifiant },
      });
      if (error) {
        const msg = /already/i.test(error.message) ? "Cet identifiant existe déjà." : error.message;
        return json({ error: msg }, 400);
      }
      return json({ ok: true, id: data.user?.id, identifiant });
    }

    // 4. Réinitialiser un mot de passe
    if (action === "reset_password") {
      const userId = String(body.user_id ?? "");
      const password = String(body.password ?? "");
      if (!userId || password.length < 6) return json({ error: "Mot de passe d'au moins 6 caractères requis." }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    // 5. Activer / désactiver un compte
    if (action === "set_active") {
      const userId = String(body.user_id ?? "");
      const actif = Boolean(body.actif);
      if (!userId) return json({ error: "Utilisateur manquant." }, 400);
      if (userId === caller.user.id && !actif) return json({ error: "Vous ne pouvez pas désactiver votre propre compte." }, 400);
      await admin.from("profiles").update({ actif }).eq("id", userId);
      // Bannir dans l'authentification quand désactivé (l'empêche de se connecter)
      await admin.auth.admin.updateUserById(userId, { ban_duration: actif ? "none" : "876000h" });
      return json({ ok: true });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

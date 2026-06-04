"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck, Eye, EyeOff, User, Lock } from "lucide-react";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { setDemoSession, DEMO_PROFILES } from "@/lib/demo-session";

// Domaine interne ajouté automatiquement derrière l'identifiant.
// L'employé ne voit jamais d'e-mail : il tape "boukary", l'app utilise
// "boukary@wendmanegre.com" pour parler à Supabase.
const AUTH_DOMAINE = "wendmanegre.com";

function versEmail(identifiant: string): string {
  const v = identifiant.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${AUTH_DOMAINE}`;
}

const roleChip: Record<string, string> = {
  admin:    "bg-clay-100 text-clay-700",
  gerant:   "bg-gold-100 text-[#8a6a1f]",
  caissier: "bg-leaf-100 text-leaf-600",
};
const roleLabel: Record<string, string> = {
  admin: "Administrateur", gerant: "Gérant", caissier: "Caissier",
};

export default function LoginPage() {
  const router = useRouter();
  const [identifiant, setIdentifiant] = useState("");
  const [password, setPassword]       = useState("");
  const [showPwd, setShowPwd]         = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  async function connecter(idArg?: string, pwdArg?: string) {
    const id  = (idArg ?? identifiant).trim();
    const pwd = pwdArg ?? password;

    if (!id)  { setError("Saisissez votre identifiant."); return; }
    if (!pwd) { setError("Saisissez votre mot de passe."); return; }
    setLoading(true);
    setError(null);

    const mail = versEmail(id);

    // ── Mode démo : aucun backend requis ──────────────────
    if (!SUPABASE_CONFIGURED) {
      const profile = setDemoSession(mail);
      if (!profile) {
        setError("Identifiant de démonstration inconnu.");
        setLoading(false);
        return;
      }
      router.push(profile.role === "caissier" ? "/caisse" : "/dashboard");
      return;
    }

    // ── Mode Supabase (production) ────────────────────────
    const sb = getClient();
    const { data, error: authErr } = await sb.auth.signInWithPassword({ email: mail, password: pwd });

    if (authErr) {
      setError(authErr.message === "Invalid login credentials"
        ? "Identifiant ou mot de passe incorrect."
        : authErr.message);
      setLoading(false);
      return;
    }

    const { data: profileRow } = await sb.from("profiles").select("role").eq("id", data.user.id).single();
    const role = (profileRow as { role?: string } | null)?.role ?? "caissier";
    router.push(role === "caissier" ? "/caisse" : "/dashboard");
  }

  function remplirDemo(mailKey: string) {
    const id = mailKey.split("@")[0];
    setIdentifiant(id);
    setPassword("demo1234");
    setError(null);
    connecter(id, "demo1234");
  }

  return (
    <div className="grain-bg relative flex min-h-screen items-center justify-center px-5 py-10">
      {/* Halo chaud en arrière-plan */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-clay/10 blur-3xl" />
        <div className="absolute bottom-0 right-10 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-up">
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink">
          <ArrowLeft size={16} /> Accueil
        </Link>

        <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white/85 shadow-lift backdrop-blur-sm">
          {/* Bandeau de marque */}
          <div className="flex items-center gap-3 border-b border-sand-200 bg-sand-50/70 px-7 py-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink font-display text-xl font-extrabold text-sand-50 shadow-card">
              W
            </div>
            <div>
              <h1 className="display text-lg font-bold leading-tight text-ink">ETS WENDMANÉGRÉ</h1>
              <p className="text-[12px] text-ink-400">Espace de gestion — Yako, Burkina Faso</p>
            </div>
          </div>

          <div className="p-7">
            <h2 className="display mb-1 text-2xl font-bold text-ink">Connexion</h2>
            <p className="mb-6 text-[13px] text-ink-500">Accédez à votre tableau de bord.</p>

            {/* Identifiant */}
            <label className="mb-4 block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-700">Identifiant</span>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="text" value={identifiant} autoComplete="username" autoCapitalize="none" spellCheck={false}
                  onChange={(e) => setIdentifiant(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && connecter()}
                  placeholder="ex. boukary"
                  className="w-full rounded-xl border border-sand-300 bg-white py-2.5 pl-10 pr-3.5 text-sm outline-none transition-all focus:border-clay focus:ring-2 focus:ring-clay/15"
                />
              </div>
            </label>

            {/* Mot de passe */}
            <label className="mb-5 block">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-700">Mot de passe</span>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type={showPwd ? "text" : "password"} value={password} autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && connecter()}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-sand-300 bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition-all focus:border-clay focus:ring-2 focus:ring-clay/15"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 transition-colors hover:text-ink">
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error && (
              <p className="mb-4 rounded-xl bg-ember-100 px-3.5 py-2.5 text-[13px] text-ember-600">{error}</p>
            )}

            <button onClick={() => connecter()} disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-clay px-4 py-3 text-sm font-semibold text-sand-50 transition-all hover:bg-clay-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
              {loading ? "Connexion…" : (<>Se connecter <ArrowRight size={16} /></>)}
            </button>

            <p className="mt-4 text-center text-[12px] text-ink-400">
              Mot de passe oublié ? Contactez votre administrateur.
            </p>

            {/* Accès démonstration — uniquement hors production */}
            {!SUPABASE_CONFIGURED && (
              <div className="mt-6">
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-sand-200" />
                  <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Accès démonstration</span>
                  <div className="h-px flex-1 bg-sand-200" />
                </div>
                <div className="grid gap-2">
                  {Object.entries(DEMO_PROFILES).map(([mailKey, p]) => (
                    <button key={mailKey} onClick={() => remplirDemo(mailKey)}
                      className="flex items-center justify-between rounded-xl border border-sand-200 px-3.5 py-2.5 text-left transition-all hover:border-sand-300 hover:bg-sand-100">
                      <span>
                        <span className="block text-sm font-medium text-ink">{p.nom}</span>
                        <span className="block text-[11px] text-ink-400">identifiant : {mailKey.split("@")[0]}</span>
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${roleChip[p.role]}`}>
                        {roleLabel[p.role]}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-center text-[11px] text-ink-400">Mot de passe de démonstration : demo1234</p>
              </div>
            )}

            <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-ink-400">
              <ShieldCheck size={13} /> Connexion sécurisée
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

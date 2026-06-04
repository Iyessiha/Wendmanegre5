"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";

export default function MotDePassePage() {
  const router = useRouter();
  const [mode, setMode]         = useState<"request" | "update">("request");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [sent, setSent]         = useState(false);
  const [done, setDone]         = useState(false);

  // Quand l'utilisateur arrive depuis le lien reçu par e-mail,
  // Supabase ouvre une session de récupération → on passe en mode "update".
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;
    const sb = getClient();
    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    return () => subscription.unsubscribe();
  }, []);

  async function envoyerLien() {
    const mail = email.trim().toLowerCase();
    if (!mail) { setError("Saisissez votre adresse e-mail."); return; }
    if (!SUPABASE_CONFIGURED) {
      setError("La récupération de mot de passe nécessite la version en ligne.");
      return;
    }
    setLoading(true); setError(null);
    const sb = getClient();
    const { error: err } = await sb.auth.resetPasswordForEmail(mail, {
      redirectTo: `${window.location.origin}/mot-de-passe`,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  async function definirNouveau() {
    if (password.length < 6) { setError("Le mot de passe doit faire au moins 6 caractères."); return; }
    setLoading(true); setError(null);
    const sb = getClient();
    const { error: err } = await sb.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => router.push("/login"), 1800);
  }

  return (
    <div className="grain-bg relative flex min-h-screen items-center justify-center px-5 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-clay/10 blur-3xl" />
        <div className="absolute bottom-0 right-10 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-up">
        <Link href="/login" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink">
          <ArrowLeft size={16} /> Connexion
        </Link>

        <div className="overflow-hidden rounded-2xl border border-sand-200 bg-white/85 shadow-lift backdrop-blur-sm">
          <div className="flex items-center gap-3 border-b border-sand-200 bg-sand-50/70 px-7 py-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink font-display text-xl font-extrabold text-sand-50 shadow-card">W</div>
            <div>
              <h1 className="display text-lg font-bold leading-tight text-ink">ETS WENDMANÉGRÉ</h1>
              <p className="text-[12px] text-ink-400">Récupération d'accès</p>
            </div>
          </div>

          <div className="p-7">
            {/* État : lien envoyé */}
            {sent && mode === "request" ? (
              <div className="text-center">
                <CheckCircle2 size={40} className="mx-auto mb-3 text-leaf" />
                <h2 className="display mb-1 text-xl font-bold text-ink">E-mail envoyé</h2>
                <p className="text-[13px] text-ink-500">
                  Si un compte existe pour <span className="font-medium text-ink">{email.trim().toLowerCase()}</span>,
                  vous recevrez un lien pour réinitialiser votre mot de passe. Pensez à vérifier vos courriers indésirables.
                </p>
                <Link href="/login" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-clay hover:text-clay-600">
                  Retour à la connexion <ArrowRight size={15} />
                </Link>
              </div>
            ) : done ? (
              <div className="text-center">
                <CheckCircle2 size={40} className="mx-auto mb-3 text-leaf" />
                <h2 className="display mb-1 text-xl font-bold text-ink">Mot de passe mis à jour</h2>
                <p className="text-[13px] text-ink-500">Redirection vers la connexion…</p>
              </div>
            ) : mode === "update" ? (
              /* État : définir un nouveau mot de passe */
              <>
                <h2 className="display mb-1 text-2xl font-bold text-ink">Nouveau mot de passe</h2>
                <p className="mb-6 text-[13px] text-ink-500">Choisissez un nouveau mot de passe pour votre compte.</p>
                <label className="mb-5 block">
                  <span className="mb-1.5 block text-[13px] font-medium text-ink-700">Nouveau mot de passe</span>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input
                      type={showPwd ? "text" : "password"} value={password} autoComplete="new-password"
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && definirNouveau()}
                      placeholder="Au moins 6 caractères"
                      className="w-full rounded-xl border border-sand-300 bg-white py-2.5 pl-10 pr-10 text-sm outline-none transition-all focus:border-clay focus:ring-2 focus:ring-clay/15"
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 transition-colors hover:text-ink">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
                {error && <p className="mb-4 rounded-xl bg-ember-100 px-3.5 py-2.5 text-[13px] text-ember-600">{error}</p>}
                <button onClick={definirNouveau} disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-clay px-4 py-3 text-sm font-semibold text-sand-50 transition-all hover:bg-clay-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
                  {loading ? "Enregistrement…" : "Enregistrer le mot de passe"}
                </button>
              </>
            ) : (
              /* État : demander le lien */
              <>
                <h2 className="display mb-1 text-2xl font-bold text-ink">Mot de passe oublié</h2>
                <p className="mb-6 text-[13px] text-ink-500">
                  Saisissez votre e-mail : nous vous enverrons un lien de réinitialisation.
                </p>
                <label className="mb-5 block">
                  <span className="mb-1.5 block text-[13px] font-medium text-ink-700">Adresse e-mail</span>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                    <input
                      type="email" value={email} autoComplete="email"
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && envoyerLien()}
                      placeholder="nom@wendmanegre.com"
                      className="w-full rounded-xl border border-sand-300 bg-white py-2.5 pl-10 pr-3.5 text-sm outline-none transition-all focus:border-clay focus:ring-2 focus:ring-clay/15"
                    />
                  </div>
                </label>
                {error && <p className="mb-4 rounded-xl bg-ember-100 px-3.5 py-2.5 text-[13px] text-ember-600">{error}</p>}
                <button onClick={envoyerLien} disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-clay px-4 py-3 text-sm font-semibold text-sand-50 transition-all hover:bg-clay-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
                  {loading ? "Envoi…" : (<>Envoyer le lien <ArrowRight size={16} /></>)}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

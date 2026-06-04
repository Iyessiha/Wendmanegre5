"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { PermissionsProvider } from "@/lib/permissions";
import type { Profile } from "@/lib/database.types";

const ADMIN_ONLY  = ["/caisses", "/boutique", "/parametres", "/comptabilite", "/grh"];
const GERANT_SKIP = ["/parametres", "/utilisateurs"]; // gerant ne peut pas aller dans paramètres système ni gestion des comptes

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const path    = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready,   setReady]   = useState(false);

  useEffect(() => {
    // ── Mode démo : session lue depuis le localStorage ────
    if (!SUPABASE_CONFIGURED) {
      const demo = getDemoSession();
      if (!demo) { router.replace("/login"); return; }
      setProfile(demo);
      setReady(true);
      return;
    }

    // ── Mode Supabase ─────────────────────────────────────
    const sb = getClient();
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      const { data } = await (sb as any).from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(data ?? null);
      setReady(true);
    });
    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) { setProfile(null); router.replace("/login"); }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!ready || !profile) return;
    const role = profile.role;

    // Caissier → uniquement son espace + clients + prêts en lecture
    if (role === "caissier") {
      const allowed = ["/caisse", "/clients", "/prets"];
      if (!allowed.some(p => path === p || path.startsWith(p + "/"))) {
        router.replace("/caisse");
      }
    }
    // Gérant → accès large mais pas paramètres système
    if (role === "gerant") {
      if (GERANT_SKIP.some(p => path.startsWith(p))) {
        router.replace("/dashboard");
      }
      // Si sur /caisse → rediriger vers /dashboard
      if (path.startsWith("/caisse") && !path.startsWith("/caisses")) {
        router.replace("/dashboard");
      }
    }
    // Admin → tout est autorisé, sauf /caisse (espace caissier)
    if (role === "admin") {
      if (path.startsWith("/caisse") && !path.startsWith("/caisses")) {
        router.replace("/dashboard");
      }
    }
  }, [ready, profile, path, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-clay/80 animate-pulse" />
          <div className="text-sm text-ink-400">Chargement...</div>
        </div>
      </div>
    );
  }
  if (!profile) return null;

  return (
    <PermissionsProvider userId={profile.id} role={profile.role}>
      <Sidebar profile={profile} />
      <main className="grain-bg min-h-screen lg:pl-64">
        <div className="has-mobile-nav mx-auto max-w-[1280px] px-4 py-5 sm:px-8 sm:py-8">
          {children}
        </div>
      </main>
      <MobileNav profile={profile} />
    </PermissionsProvider>
  );
}

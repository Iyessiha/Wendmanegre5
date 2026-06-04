"use client";

import { useEffect, useState } from "react";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { getDemoSession } from "@/lib/demo-session";
import { useStore } from "@/lib/store";
import AdminDashboard from "@/components/AdminDashboard";
import GerantDashboard from "@/components/GerantDashboard";
import type { Profile } from "@/lib/database.types";

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const { users } = useStore();

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setProfile(getDemoSession());
      return;
    }
    getClient().auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        try {
          const { data } = await (getClient() as any).from("profiles").select("*").eq("id", session.user.id).single();
          setProfile(data ?? null);
        } catch {
          // Fallback démo : essayer de trouver dans les seed users
        }
      }
    });
  }, []);

  // Fallback démo : utiliser les users du store
  const demoRole = users.find(u => u.id === "u1")?.role ?? "admin";
  const role = profile?.role ?? demoRole;
  const displayProfile = profile ?? {
    id: "u1", nom: "Le Directeur (DG)", role: "admin",
    telephone: "+226 67 71 33 55", agence: "Yako Centre",
    actif: true, created_at: "", updated_at: "",
  } as Profile;

  if (role === "gerant") {
    return <GerantDashboard profile={displayProfile} />;
  }
  return <AdminDashboard />;
}

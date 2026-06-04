"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Users, HandCoins, Wallet, Store, UserCog,
  MoreHorizontal, X, Package, Calculator, Settings,
  LogOut, ChevronRight, FileText, ShieldCheck, Radio, ArrowLeftRight, Building2,
} from "lucide-react";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { clearDemoSession } from "@/lib/demo-session";
import type { Profile } from "@/lib/database.types";

const primaryAdmin = [
  { href: "/dashboard",    label: "Accueil",     icon: LayoutDashboard },
  { href: "/transactions", label: "Transac.",    icon: ArrowLeftRight  },
  { href: "/clients",      label: "Commerçants", icon: Users           },
  { href: "/caisses",      label: "Caisses",     icon: Wallet          },
];

const primaryCaissier = [
  { href: "/caisse",       label: "Accueil",     icon: Store          },
  { href: "/transactions", label: "Transac.",    icon: ArrowLeftRight },
  { href: "/clients",      label: "Commerçants", icon: Users          },
  { href: "/prets",        label: "Prêts",       icon: HandCoins      },
];

const drawerAdmin = [
  { href: "/boutique",     label: "Boutique & stock",  icon: Package    },
  { href: "/comptes",      label: "Banques & Caisses", icon: Building2  },
  { href: "/operateurs",   label: "Opérateurs",         icon: Radio      },
  { href: "/facturation",  label: "Facturation",        icon: FileText   },
  { href: "/comptabilite", label: "Comptabilité",       icon: Calculator },
  { href: "/parametres",   label: "Paramètres",         icon: Settings   },
  { href: "/grh",          label: "Ressources humaines", icon: UserCog    },
  { href: "/utilisateurs", label: "Utilisateurs",        icon: ShieldCheck },
];

export default function MobileNav({ profile }: { profile: Profile | null }) {
  const path = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isCaissier = profile?.role === "caissier";
  const primary = isCaissier ? primaryCaissier : primaryAdmin;

  // Fermer le drawer sur changement de route
  useEffect(() => { setDrawerOpen(false); }, [path]);

  async function logout() {
    if (!SUPABASE_CONFIGURED) {
      clearDemoSession();
    } else {
      await getClient().auth.signOut();
    }
    router.push("/login");
  }

  const isDrawerActive = drawerAdmin.some(n => path.startsWith(n.href));

  return (
    <>
      {/* Bottom nav — visible uniquement sur mobile (< lg) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-sand-200 bg-white/95 backdrop-blur-sm lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex items-center justify-around">
          {primary.map(({ href, label, icon: Icon }) => {
            const active = path === href || (href !== "/" && path.startsWith(href + "/"));
            return (
              <Link key={href} href={href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2.5 tap transition-colors ${active ? "text-clay" : "text-ink-400"}`}>
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-[10px] ${active ? "font-semibold" : "font-normal"}`}>{label}</span>
              </Link>
            );
          })}
          {!isCaissier && (
            <button onClick={() => setDrawerOpen(true)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2.5 tap transition-colors ${isDrawerActive ? "text-clay" : "text-ink-400"}`}>
              <MoreHorizontal size={22} strokeWidth={isDrawerActive ? 2.5 : 1.8} />
              <span className={`text-[10px] ${isDrawerActive ? "font-semibold" : "font-normal"}`}>Plus</span>
            </button>
          )}
        </div>
      </nav>

      {/* Drawer slide-up pour items secondaires */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Overlay */}
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />

          {/* Panel */}
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-5 shadow-lift"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-ink">{profile?.nom}</div>
                <div className="text-[12px] text-ink-400">{profile?.agence}</div>
              </div>
              <button onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-sand-200 text-ink-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              {drawerAdmin.map(({ href, label, icon: Icon }) => {
                const active = path.startsWith(href);
                return (
                  <Link key={href} href={href}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${active ? "bg-clay/10 text-clay-700 font-medium" : "text-ink hover:bg-sand-100"}`}>
                    <Icon size={20} className={active ? "text-clay" : "text-ink-400"} />
                    <span className="text-[15px]">{label}</span>
                    <ChevronRight size={16} className="ml-auto text-ink-300" />
                  </Link>
                );
              })}
            </div>

            <button onClick={logout}
              className="mt-3 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-ember-600 hover:bg-ember-100/50 transition-colors">
              <LogOut size={20} />
              <span className="text-[15px] font-medium">Se déconnecter</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

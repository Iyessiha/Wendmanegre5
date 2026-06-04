"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, HandCoins, Wallet,
  Package, Settings, LogOut, Store, Calculator, UserCog, FileText, ShieldCheck, Radio, ArrowLeftRight,
} from "lucide-react";
import { ENTREPRISE } from "@/lib/data";
import { getClient, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { clearDemoSession } from "@/lib/demo-session";
import type { Profile } from "@/lib/database.types";

const navAdmin = [
  { href: "/dashboard",    label: "Tableau de bord",  icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions",      icon: ArrowLeftRight  },
  { href: "/clients",      label: "Commerçants",       icon: Users           },
  { href: "/prets",        label: "Prêts & encours",   icon: HandCoins       },
  { href: "/caisses",      label: "Caisses",            icon: Wallet          },
  { href: "/operateurs",   label: "Opérateurs",         icon: Radio           },
  { href: "/boutique",     label: "Boutique & stock",   icon: Package         },
  { href: "/facturation",  label: "Facturation",        icon: FileText        },
  { href: "/comptabilite", label: "Comptabilité",       icon: Calculator      },
  { href: "/grh",          label: "Ressources humaines",icon: UserCog         },
  { href: "/utilisateurs", label: "Utilisateurs",       icon: ShieldCheck     },
  { href: "/parametres",   label: "Paramètres",         icon: Settings        },
];

const navCaissier = [
  { href: "/caisse",   label: "Mon espace",       icon: Store    },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/clients",  label: "Commerçants",      icon: Users    },
  { href: "/prets",    label: "Prêts & encours",  icon: HandCoins},
];

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const path = usePathname();
  const router = useRouter();
  const isCaissier = profile?.role === "caissier";
  const nav = isCaissier ? navCaissier : navAdmin;

  async function deconnexion() {
    if (!SUPABASE_CONFIGURED) {
      clearDemoSession();
    } else {
      await getClient().auth.signOut();
    }
    router.push("/login");
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink text-sand-100 lg:flex">
      <div className="flex items-center gap-3 px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-clay font-display text-lg font-extrabold text-sand-50">W</div>
        <div className="leading-tight">
          <div className="display text-[14px] font-bold tracking-tight">WENDMANEGRE</div>
          <div className="text-[11px] text-ink-300">{isCaissier ? "Espace caissier" : "Administration"}</div>
        </div>
      </div>
      <nav className="mt-1 flex-1 space-y-0.5 px-3 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/" && path.startsWith(href + "/"));
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active ? "bg-clay/90 text-sand-50 font-medium" : "text-ink-300 hover:bg-white/5 hover:text-sand-100"}`}>
              <Icon size={17} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        <div className="mb-2 px-1">
          <div className="text-[13px] font-medium text-sand-100">{profile?.nom ?? "—"}</div>
          <div className="text-[11px] text-ink-400">{profile?.agence}</div>
        </div>
        <button onClick={deconnexion}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-ink-300 hover:bg-white/5 hover:text-sand-100 transition-colors">
          <LogOut size={16} /> Se déconnecter
        </button>
        <div className="mt-2 px-1 text-[10px] text-ink-500">{ENTREPRISE.nom}</div>
      </div>
    </aside>
  );
}

"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, HandCoins, Wallet,
  Package, Settings, LogOut, Store, Calculator, UserCog,
  FileText, ShieldCheck, Radio, ArrowLeftRight, Building2,
  TrendingUp, Download, BarChart3, Boxes, ShoppingCart,
} from "lucide-react";
import { ENTREPRISE } from "@/lib/data";
import { getClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

interface NavItem { href: string; label: string; icon: React.ElementType; }
interface NavSection { label: string; items: NavItem[]; }

const navAdmin: NavSection[] = [
  {
    label: "Accueil",
    items: [
      { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    ],
  },
  {
    label: "Opérations",
    items: [
      { href: "/transactions", label: "Transactions",    icon: ArrowLeftRight },
      { href: "/operateurs",   label: "Opérateurs OM",  icon: Radio          },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/clients",      label: "Commerçants",    icon: Users          },
      { href: "/facturation",  label: "Facturation",    icon: FileText       },
      { href: "/commandes",    label: "Commandes",      icon: ShoppingCart   },
      { href: "/prets",        label: "Prêts & Crédits",icon: HandCoins      },
    ],
  },
  {
    label: "Inventaire",
    items: [
      { href: "/boutique",     label: "Boutique",       icon: Store          },
      { href: "/stock",        label: "Stock",          icon: Boxes          },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/comptes",      label: "Trésorerie",     icon: Building2      },
      { href: "/marges",       label: "Marge & Bénéfice",icon: TrendingUp   },
      { href: "/comptabilite", label: "Comptabilité",   icon: Calculator     },
      { href: "/export",       label: "Export données", icon: Download       },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/grh",          label: "Ressources Hum.",icon: UserCog        },
      { href: "/utilisateurs", label: "Utilisateurs",  icon: ShieldCheck    },
      { href: "/parametres",   label: "Paramètres",    icon: Settings       },
    ],
  },
];

const navGerant: NavSection[] = [
  { label: "Accueil",     items: [{ href:"/dashboard",    label:"Tableau de bord", icon:LayoutDashboard }] },
  { label: "Opérations",  items: [
    { href:"/transactions",label:"Transactions",   icon:ArrowLeftRight },
    { href:"/operateurs",  label:"Opérateurs OM",  icon:Radio },
  ]},
  { label: "Commerce",    items: [
    { href:"/clients",     label:"Commerçants",    icon:Users },
    { href:"/facturation", label:"Facturation",    icon:FileText },
    { href:"/prets",       label:"Prêts & Crédits",icon:HandCoins },
  ]},
  { label: "Finance",     items: [
    { href:"/comptes",     label:"Trésorerie",     icon:Building2 },
    { href:"/marges",      label:"Marge & Bénéfice",icon:TrendingUp },
  ]},
];

const navCaissier: NavSection[] = [
  { label: "Espace caissier", items: [
    { href:"/caisse",      label:"Mon espace",     icon:Store },
    { href:"/transactions",label:"Transactions",   icon:ArrowLeftRight },
    { href:"/clients",     label:"Commerçants",    icon:Users },
    { href:"/prets",       label:"Prêts & Crédits",icon:HandCoins },
  ]},
];

export default function Sidebar({ role = "caissier" }: { role?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const sections = role === "admin" ? navAdmin : role === "gerant" ? navGerant : navCaissier;

  async function logout() {
    await getClient().auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 h-full w-64 flex-col bg-white/95 backdrop-blur-sm border-r border-sand-200 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sand-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-clay text-sand-50 font-bold text-sm shadow-sm">
          {ENTREPRISE.nom.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-bold text-ink">{ENTREPRISE.nom}</div>
          <div className="text-[10px] text-ink-400 capitalize">{role}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {sections.map((section, si) => (
          <Fragment key={si}>
            {si > 0 && <div className="h-px bg-sand-100 mx-2 my-2"/>}
            <div className="px-2 pb-1 pt-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-300">
                {section.label}
              </span>
            </div>
            {section.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all
                    ${active
                      ? "bg-clay text-sand-50 shadow-sm"
                      : "text-ink-600 hover:bg-sand-100 hover:text-ink"}`}>
                  <Icon size={16} className={active ? "text-sand-50" : "text-ink-400"}/>
                  {item.label}
                </Link>
              );
            })}
          </Fragment>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-sand-100 p-3">
        <button onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-ink-500 hover:bg-ember-50 hover:text-ember-600 transition-colors">
          <LogOut size={16}/> Déconnexion
        </button>
      </div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, HandCoins, Store, ArrowLeftRight,
  Menu, X, ChevronRight, FileText, ShieldCheck, Radio,
  Building2, TrendingUp, Download, Calculator, Boxes,
  UserCog, Settings, LogOut, Package,
} from "lucide-react";
import { getClient } from "@/lib/supabase";

const primaryAdmin = [
  { href:"/dashboard",    label:"Accueil",       icon:LayoutDashboard },
  { href:"/transactions", label:"Transac.",       icon:ArrowLeftRight  },
  { href:"/clients",      label:"Commerçants",   icon:Users           },
  { href:"/comptes",      label:"Trésorerie",    icon:Building2       },
];

const primaryCaissier = [
  { href:"/caisse",       label:"Accueil",       icon:Store           },
  { href:"/transactions", label:"Transac.",       icon:ArrowLeftRight  },
  { href:"/clients",      label:"Commerçants",   icon:Users           },
  { href:"/prets",        label:"Prêts",         icon:HandCoins       },
];

const drawerAdmin = [
  { section:"Opérations",   items:[
    { href:"/operateurs",   label:"Opérateurs OM",   icon:Radio },
    { href:"/prets",        label:"Prêts & Crédits",  icon:HandCoins },
  ]},
  { section:"Commerce",     items:[
    { href:"/facturation",  label:"Facturation",     icon:FileText },
    { href:"/boutique",     label:"Boutique",        icon:Store },
    { href:"/stock",        label:"Stock",           icon:Boxes },
  ]},
  { section:"Finance",      items:[
    { href:"/marges",       label:"Marge & Bénéfice",icon:TrendingUp },
    { href:"/comptabilite", label:"Comptabilité",    icon:Calculator },
    { href:"/export",       label:"Export données",  icon:Download },
  ]},
  { section:"Admin",        items:[
    { href:"/grh",          label:"RH",              icon:UserCog },
    { href:"/utilisateurs", label:"Utilisateurs",   icon:ShieldCheck },
    { href:"/parametres",   label:"Paramètres",     icon:Settings },
  ]},
];

export default function MobileNav({ role="caissier" }: { role?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const primary = role === "admin" || role === "gerant" ? primaryAdmin : primaryCaissier;

  async function logout() {
    await getClient().auth.signOut();
    router.push("/login");
  }

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-sand-200 bg-white/95 backdrop-blur-sm sm:hidden">
        {primary.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href+"/");
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 ${active?"text-clay":"text-ink-400"}`}>
              <Icon size={20}/>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        {(role==="admin"||role==="gerant") && (
          <button onClick={()=>setOpen(true)} className="flex flex-col items-center gap-0.5 px-3 py-1 text-ink-400">
            <Menu size={20}/>
            <span className="text-[10px] font-medium">Menu</span>
          </button>
        )}
      </nav>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={()=>setOpen(false)}/>
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white pb-safe">
            <div className="flex items-center justify-between px-4 py-4 border-b border-sand-100">
              <span className="font-bold text-[15px] text-ink">Navigation</span>
              <button onClick={()=>setOpen(false)} className="p-1.5 rounded-xl hover:bg-sand-100"><X size={18}/></button>
            </div>
            {drawerAdmin.map(sec=>(
              <div key={sec.section} className="px-3 py-2">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-ink-300">{sec.section}</div>
                {sec.items.map(item=>{
                  const Icon=item.icon;const active=pathname===item.href;
                  return(
                    <Link key={item.href} href={item.href} onClick={()=>setOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 ${active?"bg-clay text-sand-50":"text-ink-600 hover:bg-sand-100"}`}>
                      <Icon size={16} className={active?"text-sand-50":"text-ink-400"}/>
                      <span className="text-[14px] font-medium">{item.label}</span>
                      <ChevronRight size={14} className="ml-auto opacity-50"/>
                    </Link>
                  );
                })}
              </div>
            ))}
            <div className="px-3 pb-6 pt-2 border-t border-sand-100">
              <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-ink-500 hover:bg-ember-50 hover:text-ember-600">
                <LogOut size={16}/>
                <span className="text-[14px] font-medium">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

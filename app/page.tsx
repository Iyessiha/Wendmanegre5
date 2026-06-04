import Link from "next/link";
import {
  HandCoins,
  Users,
  Wallet,
  Package,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import { ENTREPRISE } from "@/lib/data";

const features = [
  { icon: HandCoins, titre: "Prêts & encours", desc: "Octroi de crédit aux commerçants, suivi des remboursements et des retards en temps réel." },
  { icon: Users, titre: "Réseau de commerçants", desc: "Fiche client complète, plafonds de crédit, historique et scoring de fiabilité." },
  { icon: Wallet, titre: "Caisses multi-employés", desc: "Soldes indépendants par caissier, alimentation depuis l'administration, journal des mouvements." },
  { icon: Package, titre: "Boutique & stock", desc: "Produits par entrepôt, valeur du stock, alertes de seuil et inventaire." },
];

export default function Landing() {
  return (
    <div className="grain-bg min-h-screen">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink font-display text-lg font-extrabold text-sand-50">
            W
          </div>
          <div className="leading-tight">
            <div className="display text-[15px] font-bold tracking-tight text-ink">WENDMANÉGRÉ</div>
            <div className="text-[11px] text-ink-400">Gestion de distribution</div>
          </div>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-xl bg-clay px-4 py-2.5 text-sm font-medium text-sand-50 transition-colors hover:bg-clay-600"
        >
          Se connecter <ArrowRight size={16} />
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-10 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-clay-100 px-3 py-1 text-[12px] font-medium text-clay-700">
              <Smartphone size={13} /> Master distributeur · Yako, Burkina Faso
            </span>
            <h1 className="display mt-5 text-[40px] font-extrabold leading-[1.05] text-ink sm:text-[54px]">
              Pilotez votre réseau de{" "}
              <span className="text-clay">distribution mobile money</span>
            </h1>
            <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-500">
              Suivez les prêts accordés à vos commerçants, gérez vos caisses par
              employé, votre stock et vos remboursements — le tout depuis un seul
              tableau de bord.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-clay px-6 py-3.5 text-sm font-semibold text-sand-50 shadow-card transition-all hover:bg-clay-600 active:scale-[0.98]"
              >
                Accéder à l'espace <ArrowRight size={17} />
              </Link>
              <span className="text-[13px] text-ink-400">
                Capital {(ENTREPRISE.capital / 1_000_000).toFixed(0)} M XOF
              </span>
            </div>
          </div>

          {/* Aperçu visuel */}
          <div className="animate-fade-up rounded-2xl border border-sand-200 bg-white/70 p-6 shadow-lift backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="display text-sm font-bold text-ink">Aperçu réseau</span>
              <span className="num rounded-lg bg-leaf-100 px-2 py-1 text-[11px] font-medium text-leaf-600">
                +94 % recouvrement
              </span>
            </div>
            <div className="space-y-3">
              <Stat label="Encours total" value="21 550 000 F" pct={72} color="bg-clay" />
              <Stat label="Trésorerie caisses" value="13 350 000 F" pct={55} color="bg-leaf" />
              <Stat label="Commerçants actifs" value="24" pct={88} color="bg-gold" />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-sand-200 pt-4 text-center">
              <Mini icon={<HandCoins size={15} />} label="Prêts" />
              <Mini icon={<TrendingUp size={15} />} label="Recouvrement" />
              <Mini icon={<ShieldCheck size={15} />} label="Sécurisé" />
            </div>
          </div>
        </div>
      </section>

      {/* Fonctionnalités */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.titre} className="rounded-2xl border border-sand-200 bg-white/60 p-5 shadow-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink/5 text-clay">
                <f.icon size={19} />
              </span>
              <h3 className="display mt-4 text-base font-bold text-ink">{f.titre}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-sand-200 py-6 text-center text-[12px] text-ink-400">
        {ENTREPRISE.nom} · {ENTREPRISE.tel} · {ENTREPRISE.web}
      </footer>
    </div>
  );
}

function Stat({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-ink-500">{label}</span>
        <span className="num font-semibold text-ink">{value}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sand-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Mini({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-ink-500">
      <span className="text-clay">{icon}</span>
      <span className="text-[11px]">{label}</span>
    </div>
  );
}

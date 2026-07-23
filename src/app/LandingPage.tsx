"use client";

import { useState } from "react";
import Link from "next/link";

const FEATURED = [
  { letter: "S", name: "Salesforce Japan", tag: "CRM・営業支援", tone: "sky", href: "/companies/salesforce" },
  { letter: "S", name: "SmartHR", tag: "HR Tech", tone: "slate", href: "/companies/smarthr" },
  { letter: "F", name: "freee", tag: "FinTech", tone: "violet", href: "/companies/f98f5d13-c72f-42fa-9c91-ee4647de2793" },
];

const ROLES = [
  { label: "フィールドセールス", href: "/jobs/dept/sales" },
  { label: "インサイドセールス", href: "/jobs/dept/sales" },
  { label: "カスタマーサクセス", href: "/jobs/dept/management" },
  { label: "プロダクトマネージャー", href: "/jobs/dept/product" },
  { label: "エンジニア", href: "/jobs/dept/engineer" },
  { label: "マーケティング", href: "/jobs/dept/marketing" },
];

const STATS = [
  { num: "80+", label: "掲載企業数", sub: "IT/SaaS業界に特化" },
  { num: "74",  label: "公開求人数", sub: "随時更新中" },
  { num: "0",   label: "スカウト・営業電話", sub: "登録しても来ません" },
];

const COMPARE = [
  { feature: "取材による企業情報",             opinio: true,  others: false },
  { feature: "現役社員・OBとの面談",           opinio: true,  others: false },
  { feature: "求人の更新日が見える",           opinio: true,  others: false },
  { feature: "スカウト・営業電話なし",         opinio: true,  others: false },
  { feature: "追われずに自分のペースで検討",   opinio: true,  others: false },
  { feature: "メール登録のみ・完全無料",       opinio: true,  others: false },
];

const CONCERNS = [
  {
    icon: "clock",
    before: "この求人、いつの情報?",
    beforeSub: "更新日の見えない求人票では、鮮度がわからない。古い情報かもしれないまま、動き出すのは怖い。",
    after: "編集部が定期取材し、更新日を明示。求人票には載らない「今の状態」まで届けます。",
  },
  {
    icon: "chat",
    before: "中に入るまで、本当の文化はわからない",
    beforeSub: "公式サイトの言葉と、実際の働き方は違う。入社してからギャップに気づくのは、もう遅い。",
    after: "現役社員・OBへの取材レポートを企業ページで公開。求人票に載らない組織の実態が読めます。",
  },
  {
    icon: "users",
    before: "登録した瞬間、追いかけられ始める",
    beforeSub: "スカウト、営業電話、リマインドメール。冷静に比べたいのに、急かされて選ばされる。",
    after: "スカウトも営業連絡も一切なし。登録しても、企業からあなたに連絡が来ることはありません。",
  },
];

const STEPS = [
  {
    n: "01",
    en: "Research",
    title: "内側を、知る",
    body: "取材記事・求人票・組織情報が一か所に。メール登録だけで、IT/SaaS企業のリアルを自由に調べられます。",
    cta: "企業を見てみる",
    href: "/companies",
    tone: "navy",
  },
  {
    n: "02",
    en: "Compare",
    title: "並べて、比べる",
    body: "職種・年収・働き方で横断検索。取材記事と求人票を並べて、自分に本当に合う会社かを確かめる。",
    cta: "求人を探す",
    href: "/jobs",
    tone: "ink",
  },
  {
    n: "03",
    en: "Decide",
    title: "自分のペースで、決める",
    body: "応募する。残る。もう少し考える。急かされないから、どの選択も納得して選べる。主役はあなたです。",
    cta: "求人を探す",
    href: "/jobs",
    tone: "green",
  },
];

const FAQ = [
  {
    q: "転職せずに、現職に残ってもいいですか?",
    a: "もちろんです。OPINIOは「まず知る」ための場所です。調べた結果、今の会社に残るという判断も、私たちは等しく尊重します。残るよう急かす連絡も、転職を勧める連絡も一切ありません。",
  },
  {
    q: "他の転職サービスと、何が違いますか?",
    a: "スカウトも営業連絡もありません。編集部が実際に取材・審査した企業だけを掲載し、求人票には載らない組織の実態まで公開します。追われずに、自分のペースで比較できることが最大の違いです。",
  },
  {
    q: "本当に無料で使えますか?",
    a: "はい。メールアドレスの登録だけで、掲載企業の情報にすべて無料でアクセスできます。求職者側の費用は一切かかりません。",
  },
];

const Icon = ({ name, className = "w-5 h-5" }: { name: string; className?: string }) => {
  const paths: Record<string, React.ReactNode> = {
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    chat: <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />,
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    compare: (
      <>
        <rect x="3" y="4" width="7" height="16" rx="1" />
        <rect x="14" y="4" width="7" height="16" rx="1" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    doc: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 13h6M9 17h6" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name]}
    </svg>
  );
};

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block text-xs font-semibold tracking-[0.14em] uppercase text-blue-700/80">
    {children}
  </span>
);

const CompanyBadge = ({ letter, tone }: { letter: string; tone: string }) => {
  const map: Record<string, string> = {
    sky: "bg-sky-500",
    slate: "bg-slate-700",
    violet: "bg-violet-500",
    navy: "bg-[#0A1F44]",
  };
  return (
    <div className={`flex items-center justify-center w-11 h-11 rounded-lg text-white text-sm font-semibold ${map[tone] ?? "bg-slate-700"}`}>
      {letter}
    </div>
  );
};

export default function LandingPage() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0F172A] antialiased selection:bg-blue-100">
      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-[#EAEAE4] bg-[#FAFAF8]/80 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-baseline gap-2.5">
            <span className="text-xl font-bold tracking-tight text-[#0A1F44]">OPINIO</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <Link href="/companies" className="hover:text-slate-900 transition-colors">企業</Link>
            <Link href="/jobs" className="hover:text-slate-900 transition-colors">求人</Link>
            <Link href="/people" className="hover:text-slate-900 transition-colors">ユーザー</Link>
            <Link href="/feed" className="hover:text-slate-900 transition-colors">フィード</Link>
            <Link href="/articles" className="hover:text-slate-900 transition-colors">記事</Link>
          </nav>
          <Link href="/auth" className="text-sm font-medium px-4 py-2 rounded-lg bg-[#0A1F44] text-white hover:bg-[#0d2856] transition-colors">
            無料で始める
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(160deg, #f0f4ff 0%, #f8f6ff 35%, #fff8f0 70%, #FAFAF8 100%)" }}>
        <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 lg:gap-10 items-center">
            {/* 左: コピー */}
            <div>
              <Eyebrow>SaaS 業界特化のキャリアプラットフォーム</Eyebrow>
              <h1 className="mt-6 font-serif text-5xl md:text-6xl leading-[1.15] tracking-tight text-[#0F172A]">
                知ってから、動く。
              </h1>
              <p className="mt-7 text-lg leading-relaxed text-slate-600 max-w-xl">
                取材された企業情報と求人を、ひとつの場所に。スカウトも営業電話もありません。
                <br className="hidden sm:block" />
                追われずに、自分のペースで確かめられます。
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Link href="/companies" className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#0A1F44] text-white font-medium hover:bg-[#0d2856] transition-colors">
                  まず企業を見てみる
                  <Icon name="arrow" className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link href="/auth" className="text-sm text-slate-500 hover:text-slate-800 transition-colors">
                  無料登録はこちら（30秒）
                </Link>
              </div>
            </div>

            {/* 右: プロダクトモック */}
            <div className="relative">
              <div className="relative rounded-2xl border border-[#E5E5DF] bg-white shadow-[0_20px_60px_-20px_rgba(10,31,68,0.25)] overflow-hidden">
                {/* ブラウザ風バー */}
                <div className="flex items-center gap-1.5 px-4 h-9 border-b border-[#EFEFEA] bg-[#F7F7F3]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E3655B]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E9B44C]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4CAF7D]" />
                  <span className="ml-3 text-[11px] text-slate-400">opinio.jp / companies</span>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-sky-500 text-white font-semibold">S</div>
                      <div>
                        <div className="font-semibold text-slate-900 leading-tight">Salesforce Japan</div>
                        <div className="text-xs text-slate-500">CRM・営業支援 / 外資SaaS</div>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      更新 3日前
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl border border-[#EFEFEA] bg-[#FAFAF8] p-3.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 uppercase tracking-wide">
                      <Icon name="doc" className="w-3.5 h-3.5" />
                      編集部の取材記事
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-800 leading-snug">
                      「数字より先に、人を見る」— 現場が語る評価とカルチャーの実像
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                      入社3年目のAEと採用責任者に、求人票には載らない働き方を聞きました。
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {[
                      { role: "エンタープライズ営業", meta: "年収 900–1,400万 / 東京・リモート可" },
                      { role: "インサイドセールス", meta: "年収 550–780万 / 東京・リモート可" },
                    ].map((j) => (
                      <div key={j.role} className="flex items-center justify-between gap-3 rounded-lg border border-[#EFEFEA] bg-white px-3.5 py-2.5">
                        <div>
                          <div className="text-sm font-medium text-slate-800">{j.role}</div>
                          <div className="text-[11px] text-slate-500">{j.meta}</div>
                        </div>
                        <Icon name="arrow" className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl border border-[#EFEFEA] bg-[#FAFAF8] p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        <Icon name="users" className="w-3.5 h-3.5" />
                        この会社の現役社員
                      </div>
                      <span className="text-[11px] text-blue-700">すべて見る</span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {[
                        { initial: "K", grad: "bg-indigo-500", role: "エンタープライズ営業", note: "前職: 証券 → 現職4年目" },
                        { initial: "F", grad: "bg-teal-500", role: "フィールドセールス", note: "新卒入社 / SaaS一筋" },
                      ].map((p) => (
                        <div key={p.initial} className="flex items-center gap-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-semibold shrink-0 ${p.grad}`}>
                            {p.initial}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-800 leading-tight">{p.role}</div>
                            <div className="text-[11px] text-slate-400 truncate">{p.note}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-[#EFEFEA] bg-[#FAFAF8] p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        <Icon name="users" className="w-3.5 h-3.5" />
                        この会社のOB・OG
                      </div>
                      <span className="text-[11px] text-blue-700">すべて見る</span>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {[
                        { initial: "T", grad: "bg-amber-500", role: "在籍3年 → 現: 別SaaSでVP", note: "在籍: インサイドセールス" },
                        { initial: "N", grad: "bg-violet-500", role: "在籍5年 → 現: スタートアップ創業", note: "在籍: カスタマーサクセス" },
                      ].map((p) => (
                        <div key={p.initial} className="flex items-center gap-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-semibold shrink-0 ${p.grad}`}>
                            {p.initial}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-800 leading-tight">{p.role}</div>
                            <div className="text-[11px] text-slate-400 truncate">{p.note}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
                    <Icon name="check" className="w-3.5 h-3.5 text-emerald-500" />
                    閲覧しても、この企業から連絡が来ることはありません
                  </div>
                </div>
              </div>

              <div className="absolute -z-10 -bottom-4 -right-4 w-full h-full rounded-2xl bg-blue-100/40" />
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute -top-24 -right-24 w-[520px] h-[520px] rounded-full opacity-[0.06] blur-3xl" style={{ background: "radial-gradient(circle, #2563EB, transparent 70%)" }} />
      </section>

      {/* 掲載企業の例 + 職種で探す */}
      <section className="border-y border-[#EAEAE4] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="text-sm font-semibold tracking-wide text-slate-500">注目されている企業</h2>
            <Link href="/companies" className="text-sm text-blue-700 hover:text-blue-900 inline-flex items-center gap-1">
              すべての企業を見る <Icon name="arrow" className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {FEATURED.map((c) => (
              <Link key={c.name} href={c.href} className="group rounded-2xl border border-[#EAEAE4] bg-[#FAFAF8] p-6 hover:border-slate-300 hover:shadow-sm transition-all" style={{ textDecoration: "none" }}>
                <CompanyBadge letter={c.letter} tone={c.tone} />
                <h3 className="mt-4 font-semibold text-slate-900">{c.name}</h3>
                <p className="text-sm text-slate-500">{c.tag}</p>
                <div className="mt-5 pt-4 border-t border-[#EAEAE4] text-sm text-slate-400 group-hover:text-blue-700 transition-colors inline-flex items-center gap-1">
                  取材記事と求人を見る
                  <Icon name="arrow" className="w-3.5 h-3.5" />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-500 mr-1">職種で探す</span>
            {ROLES.map((r) => (
              <Link key={r.label} href={r.href} className="text-sm px-4 py-2 rounded-full border border-[#EAEAE4] bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700 transition-colors">
                {r.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* よくある悩み */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <Eyebrow>よくある悩み</Eyebrow>
          <h2 className="mt-5 font-serif text-4xl md:text-5xl tracking-tight">
            その転職活動、情報が足りていますか?
          </h2>
          <div className="mt-8 space-y-2.5 text-lg md:text-xl font-serif text-slate-700 leading-relaxed">
            <p>その企業で、どんな社員が働いているのか。</p>
            <p>その企業を退職した人は、どんなキャリアを歩んでいるのか。</p>
          </div>
          <p className="mt-8 text-slate-600 leading-relaxed">
            求人票だけでは見えない「人」まで知ることが、納得のいくキャリア判断につながります。OPINIOは、そこから変えます。
          </p>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {CONCERNS.map((c) => (
            <div key={c.before} className="flex flex-col rounded-2xl border border-[#EAEAE4] bg-white overflow-hidden">
              <div className="p-6">
                <div className="inline-flex items-center gap-2 text-rose-600 mb-4">
                  <Icon name={c.icon} className="w-5 h-5" />
                  <span className="text-xs font-semibold tracking-wide uppercase">これまで</span>
                </div>
                <h3 className="font-semibold text-slate-900 leading-snug">{c.before}</h3>
                <p className="mt-3 text-sm text-slate-500 leading-relaxed">{c.beforeSub}</p>
              </div>
              <div className="mt-auto p-6 bg-emerald-50/60 border-t border-emerald-100">
                <div className="inline-flex items-center gap-2 text-emerald-700 mb-2">
                  <Icon name="check" className="w-4 h-4" />
                  <span className="text-xs font-semibold tracking-wide uppercase">OPINIOなら</span>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{c.after}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <Link href="/companies" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#0A1F44] text-white font-medium hover:bg-[#0d2856] transition-colors">
            まず企業を見てみる
            <Icon name="arrow" className="w-4 h-4" />
          </Link>
          <p className="mt-3 text-sm text-slate-400">メール登録のみ・完全無料</p>
        </div>
      </section>

      {/* 比較テーブル */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <Eyebrow>他のサービスとの違い</Eyebrow>
          <h2 className="mt-5 font-serif text-4xl md:text-5xl tracking-tight">
            なぜ、OPINIOなのか。
          </h2>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#EAEAE4] shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="py-5 px-6 text-left text-sm font-medium text-slate-400 bg-[#FAFAF8] w-[44%]" />
                <th className="py-5 px-6 text-center bg-[#0A1F44] w-[28%]">
                  <span className="text-sm font-bold text-white tracking-wide">OPINIO</span>
                </th>
                <th className="py-5 px-6 text-center bg-[#FAFAF8] w-[28%]">
                  <span className="text-sm font-medium text-slate-400">一般の転職サービス</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row, i) => (
                <tr key={i} className={`border-t border-[#EAEAE4] ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAF8]/50"}`}>
                  <td className="py-4 px-6 text-sm text-slate-700 font-medium">{row.feature}</td>
                  <td className="py-4 px-6 text-center bg-[#0A1F44]/[0.04]">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    {row.others
                      ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg></span>
                      : <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-100 text-rose-600"><svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 使い方 */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="text-center max-w-2xl mx-auto">
          <Eyebrow>使い方</Eyebrow>
          <h2 className="mt-5 font-serif text-4xl md:text-5xl tracking-tight">
            調べて、比べて、あなたが決める
          </h2>
          <p className="mt-6 text-slate-600 leading-relaxed">
            企業と、そこで働く人の情報を一か所に。集めてから動くから、迷いが減る。
          </p>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {STEPS.map((s) => {
            const badge = s.tone === "navy" ? "bg-[#0A1F44]" : s.tone === "green" ? "bg-emerald-600" : "bg-slate-800";
            return (
              <div key={s.n} className="relative rounded-2xl border border-[#EAEAE4] bg-white p-7 overflow-hidden">
                <span className="absolute top-5 right-6 text-6xl font-bold text-slate-100 select-none">{s.n}</span>
                <div className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">Step {s.n}</div>
                <div className={`mt-4 flex items-center justify-center w-12 h-12 rounded-xl text-white ${badge}`}>
                  <Icon name={s.n === "01" ? "search" : s.n === "02" ? "compare" : "check"} className="w-5 h-5" />
                </div>
                <h3 className="mt-5 font-semibold text-lg text-slate-900">
                  {s.title} <span className="text-sm font-normal text-slate-400">{s.en}</span>
                </h3>
                <p className="mt-3 text-sm text-slate-500 leading-relaxed">{s.body}</p>
                <Link href={s.href} className="mt-6 inline-flex items-center gap-1 text-sm text-blue-700 hover:text-blue-900 transition-colors">
                  {s.cta} <Icon name="arrow" className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* 現場と会える */}
      <section className="border-y border-[#EAEAE4] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <Eyebrow>調べるだけで、終わらない</Eyebrow>
              <h2 className="mt-5 font-serif text-4xl md:text-5xl tracking-tight leading-[1.2]">
                現場の人と、
                <br />
                実際に会って話せる。
              </h2>
              <p className="mt-7 text-slate-600 leading-relaxed">
                普通の転職では、会えるのは人事だけ。OPINIOなら、実際に一緒に働く現場のメンバーと直接話せます。
              </p>
              <p className="mt-4 text-slate-600 leading-relaxed">
                日々の仕事のリアル、チームの雰囲気、入社後に見えてくること——求人票にも面接にも出てこない話を、現場の視点で聞いてから決められます。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {["現場メンバーと面談", "人事だけでは聞けない話", "会ってから判断できる"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-full border border-[#EAEAE4] bg-[#FAFAF8] text-slate-700">
                    <Icon name="check" className="w-3.5 h-3.5 text-emerald-600" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-[#E5E5DF] bg-[#FAFAF8] p-6 shadow-[0_20px_60px_-24px_rgba(10,31,68,0.2)]">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 uppercase tracking-wide">
                  <Icon name="chat" className="w-3.5 h-3.5" />
                  カジュアル面談
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    { initial: "K", grad: "bg-indigo-500", role: "エンタープライズ営業 / 現場マネージャー", note: "「数字の裏側の働き方を話します」" },
                    { initial: "F", grad: "bg-teal-500", role: "フィールドセールス / 4年目", note: "「入社前後のギャップ、正直に話します」" },
                  ].map((p) => (
                    <div key={p.initial} className="flex items-start gap-3 rounded-xl border border-[#EFEFEA] bg-white p-3.5">
                      <div className={`flex items-center justify-center w-9 h-9 rounded-full text-white text-sm font-semibold shrink-0 ${p.grad}`}>
                        {p.initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-800 leading-tight">{p.role}</div>
                        <div className="mt-1 text-xs text-slate-500 leading-relaxed">{p.note}</div>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        面談可
                      </span>
                    </div>
                  ))}
                </div>

                <Link href="/companies" className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-[#0A1F44] text-white text-sm font-medium py-2.5 hover:bg-[#0d2856] transition-colors">
                  話を聞いてみる
                  <Icon name="arrow" className="w-4 h-4" />
                </Link>
                <p className="mt-3 text-center text-[11px] text-slate-400">
                  会うかどうかも、会ってから動くかも、あなた次第です
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[#EAEAE4] bg-white">
        <div className="mx-auto max-w-3xl px-6 py-24">
          <div className="text-center">
            <Eyebrow>よくあるご質問</Eyebrow>
            <h2 className="mt-5 font-serif text-4xl tracking-tight">正直に、お答えします</h2>
            <p className="mt-5 text-slate-600">OPINIOを初めて使う方から、よくいただく質問に。</p>
          </div>

          <div className="mt-12 divide-y divide-[#EAEAE4] border-y border-[#EAEAE4]">
            {FAQ.map((item, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-5 text-left group"
                  aria-expanded={open === i}
                >
                  <span className="flex gap-3 font-medium text-slate-900">
                    <span className="text-blue-700">Q.</span>
                    {item.q}
                  </span>
                  <span className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-full border border-[#EAEAE4] text-slate-400 transition-transform ${open === i ? "rotate-45 bg-blue-50 border-blue-200 text-blue-700" : ""}`}>
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </button>
                {open === i && (
                  <p className="pb-6 -mt-1 text-sm text-slate-600 leading-relaxed pr-11 pl-7">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 最終CTA */}
      <section className="relative bg-[#0A1F44] text-white overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: "radial-gradient(ellipse at 50% -20%, #1e3a8a, transparent 60%)" }} />
        <div className="relative mx-auto max-w-3xl px-6 py-28 text-center">
          <h2 className="font-serif text-4xl md:text-5xl tracking-tight text-white">深く知ってから、動く。</h2>
          <p className="mt-6 text-lg text-blue-100/90 leading-relaxed">
            今のキャリアを、無理に変えなくてもいい。まずは知ることから、はじめよう。
          </p>
          <p className="mt-4 text-sm text-blue-200/70">
            取材された企業情報と求人が、ひとつの場所に。完全無料・メールアドレスのみで登録。
          </p>
          <div className="mt-10 flex flex-col items-center gap-4">
            <Link href="/companies" className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-[#0A1F44] font-semibold hover:bg-blue-50 transition-colors">
              まず企業を見てみる
              <Icon name="arrow" className="w-4 h-4" />
            </Link>
            <Link href="/auth" className="text-sm text-blue-200/80 hover:text-white transition-colors">
              → メールアドレスで無料登録（30秒）
            </Link>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="bg-[#0B1220] text-slate-400">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid md:grid-cols-4 gap-10">
            <div>
              <span className="text-lg font-bold text-white">OPINIO</span>
              <p className="mt-1 text-xs text-slate-500 tracking-wide">Truth to Careers</p>
              <p className="mt-4 text-sm leading-relaxed">
                IT/SaaS業界に特化した転職サービス。取材された企業情報と求人が、ここに揃っています。
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["完全無料", "営業電話なし", "メール登録のみ"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full border border-slate-700">
                    <Icon name="check" className="w-3 h-3 text-emerald-400" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-4">求職者の方</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/companies" className="hover:text-white transition-colors">企業を探す</Link></li>
                <li><Link href="/jobs" className="hover:text-white transition-colors">求人を探す</Link></li>
                <li><Link href="/salary" className="hover:text-white transition-colors">年収相場</Link></li>
                <li><Link href="/people" className="hover:text-white transition-colors">先輩を知る</Link></li>
                <li><Link href="/articles" className="hover:text-white transition-colors">記事</Link></li>
                <li><Link href="/careers" className="hover:text-white transition-colors">転職ガイド</Link></li>
                <li><Link href="/auth" className="hover:text-white transition-colors">無料登録</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-4">企業の方</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/biz/auth?mode=signup" className="hover:text-white transition-colors">企業登録</Link></li>
                <li><Link href="/business" className="hover:text-white transition-colors">掲載について</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-4">運営</h4>
              <ul className="space-y-3 text-sm">
                <li><Link href="/contact" className="hover:text-white transition-colors">お問い合わせ</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">利用規約</Link></li>
                <li><Link href="/terms/business" className="hover:text-white transition-colors">企業向け規約</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">プライバシーポリシー</Link></li>
                <li><Link href="/legal/agency" className="hover:text-white transition-colors">職業安定法に基づく明示事項</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-14 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between gap-2 text-xs text-slate-500">
            <span>© 2026 Opinio Inc. All rights reserved.</span>
            <span>Opinio Inc. · 〒107-0062 東京都港区南青山</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

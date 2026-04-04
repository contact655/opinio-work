import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

/* ─── Hero Section ─── */
function Hero() {
  return (
    <section className="relative h-[620px] flex items-center justify-center overflow-hidden">
      {/* Background — 3 employee photos side by side (placeholder) */}
      <div className="absolute inset-0 grid grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-gray-300"
            style={{
              backgroundImage: `url(/placeholder-person-${i}.jpg)`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        ))}
      </div>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/[0.48]" />

      {/* Content */}
      <div className="relative z-10 text-center text-white px-4 max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4">
          あなたのキャリアに、
          <br />
          本当のことを。
        </h1>
        <p className="text-base sm:text-lg text-white/80 mb-8">
          IT/SaaS業界のビジネス職に特化。
          <br className="sm:hidden" />
          カルチャー・雰囲気で企業を選べる転職サービス。
        </p>

        {/* Email Registration CTA */}
        <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <input
            type="email"
            placeholder="メールアドレスを入力"
            className="flex-1 px-4 py-3 rounded-full text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary-dark transition-colors"
          >
            無料で始める
          </button>
        </form>
      </div>
    </section>
  );
}

/* ─── Stats Bar ─── */
function StatsBar() {
  const stats = [
    { value: "128社", label: "掲載企業" },
    { value: "200名+", label: "登録求職者" },
    { value: "0件", label: "早期離職" },
    { value: "120社+", label: "クライアント" },
  ];

  return (
    <section className="bg-white border-y border-card-border">
      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-2xl md:text-3xl font-bold text-primary">
              {s.value}
            </p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Features ─── */
function Features() {
  const features = [
    {
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      title: "カルチャーで選べる",
      desc: "社員の顔写真や雰囲気から、あなたに合った企業を見つけられます。条件だけでなく「人」で選ぶ転職を。",
    },
    {
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
      title: "マッチ理由が言葉で届く",
      desc: "「なぜこの求人があなたに合うか」を箇条書きで表示。納得感のある求人提案を実現します。",
    },
    {
      icon: (
        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: "早期離職ゼロ",
      desc: "入社後の早期離職ゼロの実績。ミスマッチのない転職を実現する独自のマッチング精度。",
    },
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
          opinio.workが選ばれる理由
        </h2>
        <p className="text-center text-gray-500 text-sm mb-12">
          条件ではなく、人の顔・雰囲気で企業を選べる新しい転職体験
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-card p-8 border border-card-border text-center"
            >
              <div className="flex justify-center mb-4">{f.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Steps ─── */
function Steps() {
  const steps = [
    {
      num: "01",
      title: "無料登録",
      desc: "メールアドレスで簡単登録。プロフィールを入力して準備完了。",
    },
    {
      num: "02",
      title: "企業を探す",
      desc: "社員の顔写真やカルチャーから、あなたに合った企業を見つけましょう。",
    },
    {
      num: "03",
      title: "応募・面談",
      desc: "気になる求人に応募。カジュアル面談からスタートすることも可能です。",
    },
  ];

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
          3ステップで始める
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.num} className="text-center">
              <div className="w-14 h-14 rounded-full bg-primary-light text-primary text-xl font-bold flex items-center justify-center mx-auto mb-4">
                {s.num}
              </div>
              <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Testimonials ─── */
function Testimonials() {
  const voices = [
    {
      name: "田中 翔太",
      role: "営業 → CS（SaaS企業へ転職）",
      text: "条件だけでなく、社員の雰囲気や社風が事前にわかったので、入社後のギャップがゼロでした。",
    },
    {
      name: "佐藤 美咲",
      role: "マーケター → 事業開発（スタートアップへ転職）",
      text: "マッチ理由が具体的に表示されるので、なぜこの会社なのかを自分でも納得できました。",
    },
    {
      name: "鈴木 健太",
      role: "IS → フィールドセールス（外資SaaSへ転職）",
      text: "スカウトの質が高く、自分のスキルが評価されていると感じられる転職活動ができました。",
    },
  ];

  return (
    <section className="py-20 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
          転職者の声
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {voices.map((v) => (
            <div
              key={v.name}
              className="bg-white rounded-card p-6 border border-card-border"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-primary font-bold text-sm">
                  {v.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold">{v.name}</p>
                  <p className="text-xs text-gray-400">{v.role}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                &ldquo;{v.text}&rdquo;
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Footer CTA ─── */
function FooterCTA() {
  return (
    <section className="py-20 px-4 bg-primary text-white text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">
          まず、企業を見てみませんか？
        </h2>
        <p className="text-white/80 text-sm mb-8">
          登録不要で企業の雰囲気やカルチャーを確認できます
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/companies"
            className="px-8 py-3 bg-white text-primary font-medium rounded-full hover:bg-gray-100 transition-colors text-sm"
          >
            企業一覧を見る
          </Link>
          <Link
            href="/auth/signup"
            className="px-8 py-3 border border-white text-white font-medium rounded-full hover:bg-white/10 transition-colors text-sm"
          >
            無料で登録する
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Page ─── */
export default function Home() {
  return (
    <>
      <Header />
      <main className="pt-16">
        <Hero />
        <StatsBar />
        <Features />
        <Steps />
        <Testimonials />
        <FooterCTA />
      </main>
      <Footer />
    </>
  );
}

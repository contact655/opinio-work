"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { DirectoryPerson } from "@/lib/people/directory";
import { FollowUserButton } from "../u/[id]/FollowUserButton";
import { usableLogoUrl } from "@/lib/utils/companyLogo";

/**
 * カード1枚のデータ。取得は src/lib/people/directory.ts。
 * 2026-08-04 に「企業が承認した所属を持つ人」から「登録ユーザー全体」に変えたため、
 * 社名・役職は必ずあるとは限らない（affiliation.kind === "none" の人がいる）。
 */
export type AmbassadorCard = DirectoryPerson;

type Props = {
  ambassadors: AmbassadorCard[];
  /** ow_roles の slug → id。フィルタの照合に使う。page 側で解決して渡す */
  roleSlugToId: Record<string, string>;
  /** 閲覧者の ow_users.id。自分のカードにフォローボタンを出さないために使う */
  myUserId: string | null;
  /** 閲覧者が既にフォローしている ow_users.id */
  followedUserIds: string[];
};

// ── フィルタ・ソート定数 ────────────────────────────────────────────
/**
 * 職種フィルタ。ow_roles のトップレベル9件（slug 付き）に対応する。
 *
 * ⚠️ 2026-08-04 まで role_title の正規表現マッチだった。
 *    自由記述との照合なので「営業」が「営業企画」にも当たるなど精度が出ず、
 *    カードに出す職種（ow_roles 由来）と軸も食い違っていた。
 *    値は ow_roles の slug で、page 側で slug → id に解決して topRoleId と比較する。
 *    ここに無い slug を足すときは ow_roles 側にも同じ slug があることを確認すること。
 */
const ROLE_OPTIONS = [
  { value: "sales",     label: "営業" },
  { value: "cs",        label: "カスタマーサクセス" },
  { value: "marketing", label: "マーケティング" },
  { value: "product",   label: "プロダクト" },
  { value: "engineer",  label: "エンジニア" },
  { value: "data-ai",   label: "データ・AI" },
  { value: "bizdev",    label: "事業開発" },
  { value: "corporate", label: "コーポレート" },
  { value: "exec",      label: "経営・CxO" },
];

const AGE_OPTIONS = [
  { value: "20s", label: "20代", min: 20, max: 29 },
  { value: "30s", label: "30代", min: 30, max: 39 },
  { value: "40s", label: "40代", min: 40, max: 49 },
  { value: "50s", label: "50代", min: 50, max: 59 },
  { value: "60s", label: "60代", min: 60, max: 69 },
];

const SORT_OPTIONS = [
  { value: "profile", label: "プロフィール順" },
  { value: "newest",  label: "新着順" },
  { value: "exp",     label: "経験年数順" },
];

// ── FilterChip ────────────────────────────────────────────────────────
function FilterChip({
  label, value, options, onSelect, isOpen, onToggle,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (v: string | null) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const activeOpt = options.find((o) => o.value === value);
  const isActive = !!value;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={onToggle}
        className={`ppl-chip${isActive ? " active" : ""}`}
      >
        {isActive && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
        {isActive ? activeOpt?.label : label}
        {isActive ? (
          <span
            onClick={(e) => { e.stopPropagation(); onSelect(null); }}
            style={{ fontSize: 12, marginLeft: 1, opacity: 0.75 }}
            aria-label="クリア"
          >✕</span>
        ) : (
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0 }}>
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "#fff", border: "1.5px solid var(--royal)",
          borderRadius: 12, padding: "8px 0",
          boxShadow: "0 8px 28px rgba(0,35,102,0.14)",
          minWidth: 180, maxHeight: 320, overflowY: "auto",
        }}>
          {options.map((o) => {
            const sel = value === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onSelect(sel ? null : o.value); onToggle(); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "9px 16px",
                  background: sel ? "var(--royal-50)" : "none",
                  color: sel ? "var(--royal)" : "var(--ink)",
                  fontSize: 13.5, fontWeight: sel ? 700 : 400,
                  cursor: "pointer", border: "none", fontFamily: "inherit",
                }}
                onMouseEnter={(e) => { if (!sel) (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)"; }}
                onMouseLeave={(e) => { if (!sel) (e.currentTarget as HTMLElement).style.background = "none"; }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────
function Avatar({ card, size }: { card: AmbassadorCard; size: number }) {
  if (card.avatarUrl) {
    return (
      <Image
        src={card.avatarUrl}
        alt={card.name}
        width={size}
        height={size}
        style={{
          width: size, height: size, borderRadius: "50%", objectFit: "cover",
          border: "3px solid #fff", boxShadow: "0 2px 12px rgba(0,0,0,0.14)", flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: card.gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 800, color: "#fff",
      flexShrink: 0, border: "3px solid #fff",
      boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
    }}>
      {card.initial}
    </div>
  );
}

function companyInitial(name: string, letter: string | null): string {
  if (letter) return letter;
  return (
    name
      .replace(/^(株式会社|合同会社|有限会社|一般社団法人|一般財団法人|公益社団法人)\s*/, "")
      .replace(/\s*(株式会社|合同会社|有限会社)$/, "")
      .charAt(0) || name.charAt(0) || "社"
  );
}

/**
 * 所属の表示。出どころで見た目を変える。
 *
 *   verified … ow_company_members 由来。企業ロゴ付き
 *   self     … ow_experiences の現職。ロゴなしのテキストのみ
 *   past      … 現職が無い人の直近の所属。「元 Salesforce」の形
 *   education … 職歴がまだ無い人の最終学歴。学帽アイコン + 学校名
 *   none      … 何も出さない（この人はそもそも一覧に出ない）
 *
 * ⚠️ verified は「企業が在籍を確認した」という意味ではない。2026-08-04 実測で、
 *    公開中の4件はすべて invited_at / invited_by が空＝運営が直接作った行であり、
 *    企業側の招待フローを通っていない。ドメイン認証済みの企業も 85社中0社。
 *    在籍確認済みを示す ✓ を出していたが、根拠が無いため同日削除した。
 *    企業側の確認フローが実際に回り始めるまで、確認済みを示す印を復活させないこと。
 *
 * ⚠️ カードに自由記述（自己紹介 / 役職名）は出さない。人によって品質がばらつき、
 *    一覧の比較軸が崩れるため。出すのは所属企業と ow_roles の職種だけ。
 */
function AffiliationBlock({ card }: { card: AmbassadorCard }) {
  const a = card.affiliation;

  if (a.kind === "none") return null;

  if (a.kind === "education") {
    // 職歴がまだ無い人。学校名を出す。企業と取り違えないよう、
    // 企業ロゴの位置に学帽アイコンを置いて出どころを分ける。
    return (
      <div className="ppl-company ppl-company-self">
        <svg className="ppl-edu-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5" />
        </svg>
        <span>{a.schoolName}</span>
      </div>
    );
  }

  if (a.kind === "past") {
    return (
      <div className="ppl-company ppl-company-self">
        <span className="ppl-past-mark">元</span>
        <span>{a.companyName}</span>
      </div>
    );
  }

  if (a.kind === "self") {
    return (
      <div className="ppl-company ppl-company-self">
        <span>{a.companyName}</span>
      </div>
    );
  }

  // ⚠️ 死んでいると分かっている配信元（Clearbit）は null に潰れる。
  //    判定は lib/utils/companyLogo の usableLogoUrl 1箇所に集約している。
  const logoSrc = usableLogoUrl(a.logoUrl);
  return (
    <div className="ppl-company">
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt="" className="ppl-company-logo" />
      ) : (
        <span
          className="ppl-company-logo ppl-company-logo-fallback"
          style={{ background: a.logoGradient ?? "linear-gradient(135deg, #001233, #002366)" }}
        >
          {companyInitial(a.companyName, a.logoLetter)}
        </span>
      )}
      <span>{a.companyName}</span>
    </div>
  );
}

/**
 * 経験年数。
 *
 * 「経験年数順」で並べ替えられるのにカードに年数が出ておらず、
 * 並べ替えた結果を利用者が確認できなかったため出している。
 *
 * 職種は役職行（上）に出すのでここには入れない。両方に出すと
 * 同じことを2回違う言葉で言うことになる。
 *
 * ⚠️ 値が無ければ行ごと出さない。「—」や「0年」に置き換えない。
 */
function CardFacts({ card }: { card: AmbassadorCard }) {
  if (card.experienceMonths == null) return null;
  const years = Math.floor(card.experienceMonths / 12);
  return <div className="ppl-facts">{years >= 1 ? `経験 ${years}年` : "経験 1年未満"}</div>;
}

// ── グリッドカード ────────────────────────────────────────────────────
function GridCard({ card, myUserId, followedUserIds }: {
  card: AmbassadorCard; myUserId: string | null; followedUserIds: string[];
}) {
  const router = useRouter();
  // ⚠️ ow_company_members.role_title（自由記述）ではなく ow_roles の職種名を出す。
  //    自由記述は「営業」「Enterprise Account Executive」「セールス（デジタルセールス）」
  //    「営業（金融ソリューション）」のように粒度がばらばらで、
  //    同じ職種でも読み手が毎回解釈することになるため（2026-08-04）。
  //    肩書きそのものに意味がある /u/[id] と /biz/candidates では役職名を残している。
  const role = card.roleName;
  // ⚠️ talk_themes の件数ではなく can_casual_meeting で判定する（2026-08-04）。
  //    talk_themes は本来「何を話せるか」であって可否ではなく、代用だった。
  //    可否のフラグは ow_users.can_casual_meeting（/admin/candidates で切り替え）。
  const isAvailable = card.canCasualMeeting;

  return (
    <div
      onClick={() => router.push(`/u/${card.userId}`)}
      className="ppl-grid-card"
      style={{ position: "relative" }}
    >
      {/* 右上 面談可バッジ */}
      {isAvailable && (
        <span style={{
          position: "absolute", top: 10, right: 10,
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 12, fontWeight: 700,
          padding: "3px 9px", borderRadius: 100,
          background: "#FFF7ED", color: "#C2410C",
          border: "1px solid #FED7AA", whiteSpace: "nowrap",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
          zIndex: 1,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F97316", flexShrink: 0 }} />
          面談可
        </span>
      )}

      {/* アバター */}
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "center" }}>
        <Avatar card={card} size={88} />
      </div>

      {/* 名前・役職・所属 */}
      <div style={{ textAlign: "center", marginBottom: 12, marginTop: 6, width: "100%" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", marginBottom: 3, lineHeight: 1.3 }}>
          {card.name}
        </div>
        {/* ⚠️ 役職が無いときに「—」を出さない。値が無いことを、ある値に置き換えない。
               高さは minHeight で揃える。 */}
        <div className="ppl-role">{role}</div>
        <AffiliationBlock card={card} />
        <CardFacts card={card} />
      </div>

      {/* CTAボタン */}
      <div style={{ marginTop: "auto", width: "100%" }}>
        <Link
          href={`/u/${card.userId}`}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "block", textAlign: "center",
            padding: "8px 14px",
            background: "#fff",
            color: "var(--royal)", borderRadius: 9,
            fontSize: 12, fontWeight: 600, textDecoration: "none",
            border: "1.5px solid var(--royal-100)",
          }}
        >
          プロフィールを見る
        </Link>
        {/* ⚠️ 横並びにしないこと。5列時のカード内寸は約196pxで、
               「プロフィールを見る」(約136px) と並べると溢れる。縦に積む。
            ⚠️ onClick の伝播を止める。カード全体が router.push を持っているため、
               止めないとフォローと同時にプロフィールへ遷移する。 */}
        {myUserId !== null && card.userId !== myUserId && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", justifyContent: "center", marginTop: 8 }}
          >
            <FollowUserButton
              targetUserId={card.userId}
              initialFollowed={followedUserIds.includes(card.userId)}
              isAuthenticated
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── フィルタ判定 ─────────────────────────────────────────────────────
/** v は ow_roles の slug。roleSlugToId は page 側で解決して渡す */
function matchRole(card: AmbassadorCard, v: string, roleSlugToId: Record<string, string>): boolean {
  if (!v) return true;
  const id = roleSlugToId[v];
  if (!id) return true;          // slug が解決できない = 絞り込まない（黙って0件にしない）
  return card.topRoleId === id;
}
function matchAge(card: AmbassadorCard, v: string): boolean {
  if (!v) return true;
  if (card.birthYear == null) return false;
  const age = 2026 - card.birthYear;
  const opt = AGE_OPTIONS.find((o) => o.value === v);
  return opt ? age >= opt.min && age <= opt.max : true;
}

// ── PeopleListClient ─────────────────────────────────────────────────
export function PeopleListClient({ ambassadors, roleSlugToId, myUserId, followedUserIds }: Props) {
  const [role, setRole] = useState("");

  const [age, setAge] = useState("");
  const [sort, setSort] = useState("profile");
  const [keyword, setKeyword] = useState("");
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenChip(null);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function toggleChip(name: string) {
    setOpenChip(openChip === name ? null : name);
  }

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return ambassadors.filter((a) => {
      if (!matchRole(a, role, roleSlugToId)) return false;
      if (!matchAge(a, age)) return false;
      if (!q) return true;
      // 検索対象。学歴の人は学校名で引けるようにする
      const aff = a.affiliation;
      const company =
        aff.kind === "none" ? "" : aff.kind === "education" ? aff.schoolName : aff.companyName;
      const roleLabel =
        aff.kind === "none" || aff.kind === "education" ? "" : (aff.roleTitle ?? "");
      return (
        a.name.toLowerCase().includes(q) ||
        company.toLowerCase().includes(q) ||
        roleLabel.toLowerCase().includes(q) ||
        (a.roleName ?? "").toLowerCase().includes(q)
      );
    });
  }, [ambassadors, role, age, keyword, roleSlugToId]);

  const sorted = useMemo(() => {
    // 既定（プロフィール順）はサーバー側で publicScore 降順に並べてあるのでそのまま。
    if (sort === "newest") {
      return [...filtered].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    }
    if (sort === "exp") {
      // ⚠️ 以前ここは createdAt 降順で、「新着順」と同じ結果を返していた（2026-08-04 修正）。
      //    実際の経験月数（最初の職歴の開始〜現在）で並べる。
      //    職歴が無い人は算出できないので、0 扱いにせず必ず末尾に置く。
      return [...filtered].sort((a, b) => {
        if (a.experienceMonths == null && b.experienceMonths == null) return 0;
        if (a.experienceMonths == null) return 1;
        if (b.experienceMonths == null) return -1;
        return b.experienceMonths - a.experienceMonths;
      });
    }
    return filtered;
  }, [filtered, sort]);

  const hasFilter = !!(keyword || role || age);

  function clearAll() {
    setKeyword(""); setRole(""); setAge("");
  }

  if (ambassadors.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>💬</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>まだ登録がありません</div>
        <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>プロフィールを登録した方から順に表示されます。</div>
      </div>
    );
  }

  return (
    <>
      <style suppressHydrationWarning>{`
        .ppl-row-btn-mobile { display: none; }
        .ppl-row-btn-desktop { display: flex; }
        @media (max-width: 600px) {
          .ppl-row-btn-mobile { display: block; }
          .ppl-row-btn-desktop { display: none !important; }
        }

        /* グリッド: 3列 → 2列 → 1列 */
        /* ── コンテナ幅と列数（2026-08-04）──────────────────────────────────
           1440px 以上で 5列にする。人数が増えたときのための変更で、現時点では4名。

           ⚠️ 1100px のまま5列にすると 1枚 198px になり、職種が2行に折り返す。
              「セールス（デジタルセールス）」が「ス）」だけ2行目に落ちる状態。
              なので 1440px 以上ではコンテナも 1300px に広げ、1枚 235px を確保する。
              4列時（251px）とほぼ同じ幅なので、カード内の見え方は今と変わらない。
              社名だけは18文字級（日本ヒューレット・パッカード合同会社）が2行になるが、
              これは現在の4列でも同じで、今回の変更による劣化ではない。

           ⚠️ maxWidth をインラインに戻さないこと。インラインはメディアクエリに勝つので
              下の 1300px が一切効かなくなる（CLAUDE.md 参照）。 */
        /* ⚠️ 基底ルールを先に書くこと。同じ詳細度なので、後に書いたほうが勝つ。
              .ppl-grid の4列指定をメディアクエリより後ろに置くと 5列が効かない。 */
        .ppl-wrap { max-width: 1100px; }
        .ppl-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
        @media (min-width: 1440px) {
          .ppl-wrap { max-width: 1300px; }
          .ppl-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
        }
        @media (max-width: 1024px) { .ppl-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; } }
        @media (max-width: 768px)  { .ppl-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; } }
        /* ⚠️ 1列に落とすのは 560px。420px にすると 421〜560px の帯で
              2列 × 180〜250px になり、5列時（235px）より細いカードが出てしまう。
              「狭い画面ほどカードが細い」わけではないので、境界は列数から逆算すること。 */
        @media (max-width: 560px)  { .ppl-grid { grid-template-columns: minmax(0, 1fr); gap: 10px; } }

        /* グリッドカード */
        .ppl-grid-card {
          background: #fff;
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 28px 20px 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: box-shadow 0.18s, transform 0.18s, border-color 0.18s;
        }
        /* ── 役職・所属 ─────────────────────────────────────────────────────
           役職は2行までにクランプする。自己申告の役職名は部署名を含んで長く、
           5列時のカード幅（235px）に1行で収まらないことがあるため。
           途中で切り詰めない（切れた役職名は誤読のもとになる）。 */
        .ppl-role {
          font-size: 13px; color: var(--ink-soft); line-height: 1.5;
          margin-bottom: 10px; min-height: 20px;
          display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
          overflow: hidden; overflow-wrap: anywhere;
        }
        .ppl-company {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          font-size: 13px; font-weight: 600; color: var(--ink); line-height: 1.35;
          overflow-wrap: anywhere;
        }
        /* 自己申告の所属。企業ロゴを付けない = 承認済みと区別が付く */
        .ppl-company-self { font-weight: 500; color: var(--ink-soft); }
        .ppl-company-logo {
          width: 22px; height: 22px; border-radius: 5px; flex-shrink: 0;
          object-fit: contain; background: #fff; border: 1px solid var(--line);
        }
        .ppl-company-logo-fallback {
          display: flex; align-items: center; justify-content: center;
          border: none; font-size: 12px; font-weight: 800; color: #fff;
        }
        /* 職歴がまだ無い人の学校名。企業と取り違えないようアイコンで分ける */
        .ppl-edu-icon { flex-shrink: 0; color: var(--ink-mute); }
        /* 現職が無い人の「元」。社名より弱く出す */
        .ppl-past-mark {
          flex-shrink: 0; font-size: 12px; font-weight: 700; color: var(--ink-mute);
          background: var(--bg-tint); border: 1px solid var(--line-soft);
          border-radius: 4px; padding: 1px 5px; line-height: 1.4;
        }
        /* 経験年数。並べ替えの軸をカード上でも見えるようにする */
        .ppl-facts {
          margin-top: 8px; font-size: 12px; font-weight: 600; color: var(--ink-soft);
          line-height: 1.5; overflow-wrap: anywhere;
        }
        .ppl-grid-card:hover {
          box-shadow: 0 8px 32px rgba(0,35,102,0.12);
          transform: translateY(-3px);
          border-color: var(--royal-100);
        }

        /* FilterChip */
        .ppl-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 7px 14px; border-radius: 999px;
          border: 1.5px solid #e2e8f0; background: #fff;
          color: var(--ink); font-size: 13px; font-weight: 500;
          cursor: pointer; white-space: nowrap;
          transition: all 0.12s; font-family: inherit; flex-shrink: 0;
        }
        .ppl-chip:hover { border-color: var(--royal-100); background: var(--royal-50); color: var(--royal); }
        .ppl-chip.active {
          border-color: var(--royal); background: var(--royal);
          color: #fff; font-weight: 700;
          box-shadow: 0 2px 10px rgba(0,35,102,0.25);
        }

        /* モバイル: フィルタ折りたたみ */
        .ppl-filter-chips { display: contents; }
        .ppl-filter-toggle { display: none; }
        @media (max-width: 767px) {
          .ppl-filter-toggle {
            display: inline-flex; align-items: center; gap: 5px;
            font-size: 12.5px; color: var(--ink-soft); cursor: pointer;
            white-space: nowrap; border: 1.5px solid #e2e8f0;
            border-radius: 999px; padding: 6px 12px;
            background: #fff; font-family: inherit; font-weight: 500;
            transition: border-color 0.15s, background 0.15s; flex-shrink: 0;
          }
          .ppl-filter-toggle.active { border-color: var(--royal); background: var(--royal-50); color: var(--royal); font-weight: 700; }
          .ppl-filter-chips { display: none; flex-wrap: wrap; gap: 6px; padding: 4px 0; width: 100%; }
          .ppl-filter-chips.expanded { display: flex; }
        }
      `}</style>

      <h1 className="sr-only">登録ユーザーを探す</h1>


      {/* ── 検索 + フィルタバー ── */}
      <div
        ref={wrapRef}
        style={{
          position: "sticky", top: 60, zIndex: 30,
          background: "#fff",
          borderBottom: "1px solid var(--line)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
          padding: "20px 0 0",
        }}
      >
        <div className="ppl-wrap" style={{ margin: "0 auto", padding: "0 24px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* 検索インプット */}
            <div style={{
              position: "relative", flex: "1 1 220px", minWidth: 0,
              display: "flex", alignItems: "center", gap: 8,
              background: "#fff", border: "1.5px solid #e6e9ef", borderRadius: 999,
              padding: "0 14px", transition: "border-color 0.15s, box-shadow 0.15s",
            }}
              onFocusCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--royal)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(0,35,102,0.08)"; }}
              onBlurCapture={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#e6e9ef"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b95a3" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }} aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef}
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="名前・会社・職種で検索"
                style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, color: "var(--ink)", background: "transparent", padding: "9px 0", minWidth: 0, fontFamily: "inherit" }}
                aria-label="ユーザーを検索"
              />
              {keyword && (
                <button type="button" onClick={() => { setKeyword(""); inputRef.current?.focus(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#8b95a3", fontSize: 16, padding: "2px" }} aria-label="クリア">✕</button>
              )}
            </div>

            {/* モバイル: フィルタトグル */}
            <button
              type="button"
              className={`ppl-filter-toggle${(role || age) ? " active" : ""}`}
              onClick={() => setFiltersExpanded(!filtersExpanded)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              絞り込む{filtersExpanded ? " ▴" : " ▾"}
            </button>

            {/* フィルタチップ */}
            <div className={`ppl-filter-chips${filtersExpanded ? " expanded" : ""}`}>
              <FilterChip label="職種" value={role} options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} onSelect={(v) => { setRole(v ?? ""); setOpenChip(null); }} isOpen={openChip === "role"} onToggle={() => toggleChip("role")} />
              <FilterChip label="年齢" value={age} options={AGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} onSelect={(v) => { setAge(v ?? ""); setOpenChip(null); }} isOpen={openChip === "age"} onToggle={() => toggleChip("age")} />
              {hasFilter && (
                <button type="button" onClick={clearAll} style={{ fontSize: 12, fontWeight: 500.5, color: "var(--ink-mute)", background: "none", border: "none", cursor: "pointer", padding: "5px 4px", whiteSpace: "nowrap", fontFamily: "inherit" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--ink-mute)"; }}
                >
                  ✕ すべてクリア
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 並び替えバー ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--line)" }}>
      <div className="ppl-wrap" style={{ margin: "0 auto", padding: "12px 24px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          background: "#fff", borderRadius: 12, border: "1px solid var(--line)",
          padding: "10px 16px", boxShadow: "0 1px 4px rgba(15,23,42,0.05)",
        }}>
          {/* 並び替え */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--ink-mute)", fontWeight: 600, flexShrink: 0 }}>並び替え</span>
            <div style={{ width: 1, height: 18, background: "var(--line)" }} />
            <div style={{ display: "flex", gap: 6 }}>
              {SORT_OPTIONS.map((o) => {
                const active = sort === o.value;
                return (
                  <button key={o.value} type="button" onClick={() => setSort(o.value)} style={{
                    padding: "5px 13px", borderRadius: 100, fontSize: 12, fontWeight: active ? 700 : 500,
                    cursor: "pointer", border: active ? "none" : "1.5px solid var(--line)",
                    background: active ? "var(--royal)" : "#fff",
                    color: active ? "#fff" : "var(--ink-soft)",
                    transition: "all 0.15s", fontFamily: "inherit",
                    boxShadow: active ? "0 2px 8px rgba(0,35,102,0.25)" : "none",
                  }}>
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 件数。
              一覧/詳細のトグルは 2026-08-04 に撤去した。
              詳細ビューのほうが情報量が少なく、一覧との差が利用者に伝わらないため。
              /schools/[id] でも同じ判断で撤去済み（commit f83fc122）。 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 13, color: "var(--ink-mute)", fontWeight: 500 }}>
              <strong style={{ color: "var(--ink)", fontWeight: 800, fontFamily: "var(--font-inter), sans-serif", fontSize: 16 }}>
                {sorted.length}
              </strong> 名
            </span>
          </div>
        </div>
      </div>
      </div>

      {/* ── コンテンツ ── */}
      <div className="ppl-wrap" style={{ margin: "0 auto", padding: "16px 24px 80px" }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-mute)", fontSize: 14 }}>
            該当する方が見つかりません
          </div>
        ) : (
          <div className="ppl-grid">
            {sorted.map((card) => (
              <GridCard key={card.userId} card={card} myUserId={myUserId} followedUserIds={followedUserIds} />
            ))}
          </div>
        )}

        <div style={{
          marginTop: 24, padding: "14px 18px",
          background: "var(--bg-tint)", border: "1px solid var(--line)",
          borderRadius: 10, fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", lineHeight: 1.8,
        }}>
          ※ <strong style={{ color: "var(--ink-soft)", fontWeight: 700 }}>面談可</strong> は、話を聞く相手として登録している方です。無料で相談できます。<br />
          所属・職種・経歴はご本人の登録内容です。OPINIO は在籍確認を行っていません。
        </div>
      </div>
    </>
  );
}

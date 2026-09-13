import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { ApplicationEntryCard } from "@/components/mypage/ApplicationEntryCard";
import type { Entry } from "@/components/mypage/ApplicationEntryCard";
import { SuggestionsSection } from "@/components/mypage/SuggestionsSection";
import type { SuggestedCompany, SuggestedJob } from "@/components/mypage/SuggestionsSection";
import { CASUAL_MEETING_STATUSES } from "@/lib/constants/casualMeetingStatus";

/**
 * 「応募・面談」（`/mypage/applications`）。2026-09-13 追加。
 *
 * ── なぜ要るか ──────────────────────────────────────────────────────────────
 * ⚠️★**実データが1行も無い。** 2026-09-13 実測で `ow_casual_meetings` 0行 /
 *    `ow_job_applications` 0行。実画面では**空状態しか描画されない**ので、
 *    カードも進捗バーもおすすめも、ここでしか目にできない。
 *    → CLAUDE.md「データが薄い画面は /dev/preview で見る」
 *
 * ── 何を見るか ──────────────────────────────────────────────────────────────
 * ⚠️ 面談の段は**3段**（申込・日程調整・面談）。求人応募の**5段**を当てはめていないこと。
 * ⚠️ 見送り・不合格では**バーごと出ない**こと。
 * ⚠️ `scheduling` は DB の CHECK にあるがアプリの型には無い値。**素の値が出ず、
 *    「日程調整中」と出る**こと（未知の状態に落ちていない）。
 * ⚠️ 会社が引けない行・求人が引けない行で**落ちない**こと（「—」でも埋めない）。
 * ⚠️ 長い社名・長い求人名が**枠からはみ出さない**こと（1行クランプ）。
 * ⚠️ おすすめは**0件のときセクションごと出ない**こと。**%も星も出ない**こと。
 */

const CO = {
  id: "c1", slug: "salesforce", name: "株式会社セールスフォース・ジャパン",
  logoUrl: null, url: "https://www.salesforce.com/jp/",
};
const CO_LONG = {
  id: "c2", slug: "long", name: "富士フイルムビジネスイノベーションジャパン株式会社",
  logoUrl: null, url: null,
};

const meeting = (status: string, over: Partial<Entry> = {}): Entry => ({
  kind: "meeting", id: `m-${status}`, status, createdAt: "2026-09-01T00:00:00Z",
  company: CO, job: null, conversationId: null, ...over,
});

const application = (status: string, over: Partial<Entry> = {}): Entry => ({
  kind: "job", id: `j-${status}`, status, createdAt: "2026-08-20T00:00:00Z",
  company: CO,
  job: { id: "j1", slug: "account-executive-mulesoft", title: "Account Executive, MuleSoft" },
  conversationId: null, ...over,
});

const SUGGESTED_JOBS: SuggestedJob[] = [
  {
    id: "j1", slug: "account-executive-mulesoft", title: "Account Executive, MuleSoft",
    companyName: "株式会社セールスフォース・ジャパン", companyLogoUrl: null,
    companyUrl: "https://www.salesforce.com/jp/",
    reasonText: "希望職種「フィールドセールス」に一致・希望年収の範囲内",
  },
  {
    id: "j2", slug: "solution-engineer-tableau", title: "Account Solution Engineer, Tableau",
    companyName: "富士フイルムビジネスイノベーションジャパン株式会社", companyLogoUrl: null,
    companyUrl: null,
    reasonText: "希望職種「セールスエンジニア」に一致",
  },
];

const SUGGESTED_COMPANIES: SuggestedCompany[] = [
  {
    id: "c1", slug: "andpad", name: "ANDPAD", tagline: "建設現場の施工管理を一つに",
    logoUrl: null, logoLetter: "A",
    logoGradient: "linear-gradient(135deg, var(--royal), #3B5FD9)",
    reason: "建設向けにサービスを提供しています",
  },
  {
    id: "c2", slug: "long", name: "富士フイルムビジネスイノベーションジャパン株式会社",
    tagline: null, logoUrl: null, logoLetter: "富",
    logoGradient: "linear-gradient(135deg, var(--royal), #3B5FD9)",
    reason: "製造業向けにサービスを提供しています",
  },
];

export default function ApplicationsPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="応募・面談（/mypage/applications）">
        <p>
          求人応募とカジュアル面談を1つの一覧に並べる画面。
          <strong>本番は両方とも0行</strong>（2026-09-13 実測）なので、
          実画面では空状態しか出ません。
        </p>
      </PreviewHeader>

      <Variant
        label="カジュアル面談 — 6状態"
        note="段は3段（申込・日程調整・面談）。見送りはバーごと出ない。scheduling が素の値のまま出ていないこと"
      >
        <div className="space-y-4">
          {CASUAL_MEETING_STATUSES.map((s) => (
            <ApplicationEntryCard key={s} entry={meeting(s)} />
          ))}
        </div>
      </Variant>

      <Variant
        label="求人応募 — 7状態"
        note="段は5段。不合格はバーごと出ない。内定は「要返答」が出る"
      >
        <div className="space-y-4">
          {["applied", "doc_review", "interview1", "interview_final", "offered", "accepted", "rejected"].map((s) => (
            <ApplicationEntryCard key={s} entry={application(s)} />
          ))}
        </div>
      </Variant>

      <Variant
        label="付帯情報のある行"
        note="求人を指定した面談・対話が生まれた面談。無い行と見比べる（無いときは行ごと出ない）"
      >
        <div className="space-y-4">
          <ApplicationEntryCard
            entry={meeting("scheduled", {
              id: "m-withjob",
              job: { id: "j1", slug: "ae", title: "Account Executive, MuleSoft" },
              conversationId: "conv-1",
            })}
          />
          <ApplicationEntryCard entry={meeting("pending", { id: "m-plain" })} />
        </div>
      </Variant>

      <Variant
        label="欠けている行・長い行"
        note="会社が引けない／求人が引けない行で落ちないこと。長い社名が枠を押し広げないこと"
      >
        <div className="space-y-4">
          <ApplicationEntryCard entry={meeting("pending", { id: "m-nocompany", company: null })} />
          <ApplicationEntryCard entry={application("applied", { id: "j-nojob", job: null })} />
          <ApplicationEntryCard entry={meeting("company_contacted", { id: "m-long", company: CO_LONG })} />
          <ApplicationEntryCard
            entry={application("doc_review", {
              id: "j-long", company: CO_LONG,
              job: { id: "j9", slug: "long", title: "エンタープライズ営業（製造業界担当・課長候補／ハイブリッド勤務可）" },
            })}
          />
        </div>
      </Variant>

      <Variant
        label="未知の状態"
        note="DB に想定外の値が入ったとき。既定値に倒さず素の値をそのまま出し、バーは出さない"
      >
        <ApplicationEntryCard entry={meeting("unknown_value", { id: "m-unknown" })} />
      </Variant>

      <Variant
        label="おすすめ — 求人と企業の両方"
        note="根拠の一文が両方に付いていること。マッチ度%も星も出ていないこと"
      >
        <SuggestionsSection jobs={SUGGESTED_JOBS} companies={SUGGESTED_COMPANIES} />
      </Variant>

      <Variant label="おすすめ — 企業だけ" note="求人が0件でも企業だけ出る（希望条件が未入力の人）">
        <SuggestionsSection jobs={[]} companies={SUGGESTED_COMPANIES} />
      </Variant>

      <Variant label="おすすめ — 0件" note="★この枠の中が空であること。「該当なし」も出さない">
        <SuggestionsSection jobs={[]} companies={[]} />
      </Variant>
    </div>
  );
}

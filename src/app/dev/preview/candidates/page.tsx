"use client";

import CandidatesClient, { type Candidate } from "@/app/biz/candidates/CandidatesClient";
import { PreviewApproachArea } from "@/components/approaches/PreviewApproachArea";
import { Variant, PreviewHeader } from "../Variant";

/**
 * 候補者を探す（/biz/candidates）のプレビュー（2026-09-20）。
 *
 * ⚠️★**実画面は誰も見られない。** 有料プランが**0社**（2026-09-20 実測）なので、
 *    `canUse(planType, "candidateSearch")` のゲートで全社が止まる。
 *    柴さんも一度も見たことがない画面で、**確認手段はここしかない。**
 *
 * ⚠️ 実データも薄い。企業に見えるのは「転職について」に答えた人だけで、
 *    2026-08-28 の実測では**実ユーザー2人**だった。
 *    0件・1件・条件を効かせた状態はここでしか作れない。
 *
 * ⚠️★**この配下で DB を読まないこと。** 固定データだけを渡す。
 * ⚠️ スカウトは 2026-10-08 に廃止した。カードの操作は「プロフィールを見る」だけ（実環境と同じ）。
 */

const IS_DEV = process.env.NODE_ENV !== "production";

const ROLE_TREE = [
  { id: "r-sales", name: "営業", children: [
    { id: "r-ae", name: "アカウントエグゼクティブ" },
    { id: "r-fs", name: "フィールドセールス" },
    { id: "r-is", name: "インサイドセールス" },
  ] },
  { id: "r-eng", name: "エンジニア", children: [
    { id: "r-be", name: "バックエンドエンジニア" },
    { id: "r-fe", name: "フロントエンドエンジニア" },
  ] },
  { id: "r-cs", name: "カスタマーサクセス", children: [] },
];

function cand(over: Partial<Candidate> & { id: string; name: string }): Candidate {
  return {
    /* ★既定は null（肩書きを書いていない人）。実データでは**こちらが普通**
          —— 2026-09-23 実測で肩書きを持つ実ユーザーは 0人。 */
    headline: null,
    location: null, isActivelyLooking: false,
    careerStance: "open", careerStanceUpdatedAt: null,
    tenureMonths: null, age: null, currentRole: null, currentCompany: null,
    employmentType: null, startedAt: null, roleName: null, topRoleName: null,
    desiredRoleIds: [], desiredRoleNames: [], workStyles: null,
    desiredPrefectures: null, desiredSalaryMin: null, desiredSalaryMax: null,
    onboardingCompleted: true,
    createdAt: "2026-09-01T00:00:00Z", autoSkills: [],
    ...over,
  };
}

const FULL: Candidate[] = [
  cand({
    id: "c1", name: "五十嵐 健二", location: "東京都渋谷区",
    /* ★★上限の40字ちょうど（`HEADLINE_MAX`）。⚠️ 実データで踏めないので**ここで見る**。
          ⚠️ 数え直すときは `[...s].length`（サロゲートペアを1文字と数える）。 */
    headline: "SaaSの法人営業／ISからFSまで10年。次はエンタープライズの立ち上げへ挑戦",
    isActivelyLooking: true, careerStance: "active",
    careerStanceUpdatedAt: new Date(Date.now() - 2 * 3600e3).toISOString(),
    tenureMonths: 148, currentRole: "エンタープライズ営業部 マネージャー",
    currentCompany: "株式会社セールスフォース・ジャパン", employmentType: "正社員",
    roleName: "アカウントエグゼクティブ", topRoleName: "営業",
    desiredRoleIds: ["r-sales", "r-ae"], desiredRoleNames: ["アカウントエグゼクティブ"],
    workStyles: ["hybrid"], desiredPrefectures: ["東京都", "神奈川県"],
    desiredSalaryMin: 900, desiredSalaryMax: 1200,
    createdAt: "2026-09-19T00:00:00Z",
    /* ★できること。⚠️ 帯の文言は `lib/profile/autoSkills.ts` の BANDS と同じもの。
          ⚠️★**上限の4件ちょうど**を入れてある（実画面はサーバーで `.slice(0, 4)`）。
             ここで5件に増やしても実画面とは一致しない —— 切るのはサーバー側なので、
             **このプレビューで上限そのものは検証できない。** */
    autoSkills: [
      { label: "アカウントエグゼクティブ", band: "10年以上" },
      { label: "営業", band: "10年以上" },
      { label: "インサイドセールス", band: "3年以上" },
      { label: "マネジメント", band: "1年以上" },
    ],
  }),
  cand({
    id: "c2", name: "安藤 誠司", location: "大阪府大阪市",
    /* ★短い肩書き。⚠️ c3 以降は `headline: null`（無い人）のまま残してある —— 
          **出さない側の見え方も同じ画面で並べて確かめるため。** */
    headline: "医療SaaSのフィールドセールス",
    careerStance: "researching",
    careerStanceUpdatedAt: new Date(Date.now() - 20 * 86400e3).toISOString(),
    tenureMonths: 40, currentRole: "フィールドセールス", currentCompany: "株式会社ZAP",
    employmentType: "正社員", roleName: "フィールドセールス", topRoleName: "営業",
    desiredRoleIds: ["r-sales", "r-fs"], desiredRoleNames: ["フィールドセールス"],
    workStyles: ["remote"], desiredSalaryMin: 600,
    createdAt: "2026-09-10T00:00:00Z",
    autoSkills: [
      { label: "フィールドセールス", band: "3年以上" },
      { label: "営業", band: "3年以上" },
    ],
  }),
  cand({
    /* ⚠️ 社会人年数が未算出（職歴0件）。**「0年」と出ないこと**／
          「社会人年数」で絞っても**落ちないこと**（注記が出る） */
    id: "c3", name: "中里 康貴", location: null,
    careerStance: "open", tenureMonths: null,
    desiredRoleIds: ["r-eng"], desiredRoleNames: ["バックエンドエンジニア"],
    createdAt: "2026-09-05T00:00:00Z",
  }),
  cand({
    /* ⚠️ 長い名前・長い役職・希望勤務地が多い。**操作列が押し出されないこと** */
    id: "c4", name: "グローバル・エンタープライズ 太郎",
    location: "神奈川県横浜市西区みなとみらい",
    isActivelyLooking: true, careerStance: "active",
    careerStanceUpdatedAt: new Date(Date.now() - 5 * 86400e3).toISOString(),
    tenureMonths: 11,
    currentRole: "グローバルエンタープライズセールス統括本部 アカウントエグゼクティブ",
    currentCompany: "アマゾンウェブサービスジャパン合同会社",
    employmentType: "契約社員", roleName: "インサイドセールス", topRoleName: "営業",
    desiredRoleIds: ["r-sales", "r-is"], desiredRoleNames: ["インサイドセールス", "フィールドセールス"],
    workStyles: ["office"],
    desiredPrefectures: ["東京都", "神奈川県", "千葉県", "埼玉県", "大阪府"],
    desiredSalaryMin: 1200, createdAt: "2026-08-20T00:00:00Z",
  }),
];

/* ★「すべてのフィルター」の件数を手で数えられる6名（2026-10-13 / ステップ5）。
      ⚠️ 実データでは経験職種・雇用形態・★の組み合わせが薄く、0件の灰色や「その軸以外」の数え方を踏めない。
      ⚠️ 雇用形態は DB の値（日本語）。経験・希望職種は親まで展開した形（load.ts と同じ） */
const H = 3600e3, D = 86400e3;
const tp = (n: number) => Array.from({ length: n }, (_, i) => ({ kind: "company_role" as const, text: `合うところ${i + 1}`, ref: null, weight: 5 - i,
  row: { item: "職種", person: i === 0 ? "営業（経験）" : "インサイドセールス（関心）", ours: "インサイドセールス（営業部）" } }));
const FACET: Candidate[] = [
  cand({ id: "f1", name: "青木 一郎", location: "東京都港区", careerStance: "active", careerStanceUpdatedAt: new Date(Date.now() - 2 * H).toISOString(),
    tenureMonths: 148, currentRole: "AE", currentCompany: "株式会社サンプル", employmentType: "正社員",
    expRoleIds: ["r-sales", "r-ae"], desiredRoleIds: ["r-sales", "r-ae"], desiredRoleNames: ["アカウントエグゼクティブ"],
    touchpoints: tp(2), starred: true, createdAt: "2026-10-01T00:00:00Z" }),
  cand({ id: "f2", name: "井上 二郎", location: "大阪府大阪市", careerStance: "researching", careerStanceUpdatedAt: new Date(Date.now() - 20 * D).toISOString(),
    tenureMonths: 40, currentRole: "FS", currentCompany: "株式会社ZAP", employmentType: "正社員",
    expRoleIds: ["r-sales", "r-fs"], desiredRoleIds: ["r-sales", "r-fs"], desiredRoleNames: ["フィールドセールス"],
    touchpoints: [], createdAt: "2026-09-30T00:00:00Z",
    approach: { eligible: false, sent: { id: "fa2", conversationId: null, sentAt: "2026-10-05T00:00:00Z", senderName: "山田 花子", state: "pending", resendAt: "2027-04-03T00:00:00Z" }, unreadCount: 0, unseenReply: false } }),
  cand({ id: "f3", name: "上田 三郎", location: null, careerStance: "open", tenureMonths: null,
    desiredRoleIds: ["r-eng", "r-be"], desiredRoleNames: ["バックエンドエンジニア"], createdAt: "2026-09-29T00:00:00Z" }),
  cand({ id: "f4", name: "江藤 四郎", location: "神奈川県横浜市", careerStance: "active", careerStanceUpdatedAt: new Date(Date.now() - 5 * D).toISOString(),
    tenureMonths: 11, currentRole: "IS", currentCompany: "株式会社アルファ", employmentType: "契約社員",
    expRoleIds: ["r-sales", "r-is"], desiredRoleIds: ["r-sales", "r-is"], desiredRoleNames: ["インサイドセールス"],
    touchpoints: tp(1), createdAt: "2026-09-28T00:00:00Z" }),
  cand({ id: "f5", name: "大野 五郎", location: "東京都新宿区", careerStance: "open", careerStanceUpdatedAt: new Date(Date.now() - 40 * D).toISOString(),
    tenureMonths: 70, currentRole: "バックエンド", currentCompany: "株式会社ベータ", employmentType: "正社員",
    expRoleIds: ["r-eng", "r-be"], desiredRoleIds: ["r-eng", "r-be"], desiredRoleNames: ["バックエンドエンジニア"],
    touchpoints: tp(1), starred: true, createdAt: "2026-09-27T00:00:00Z",
    approach: { eligible: false, sent: { id: "fa5", conversationId: "cv5", sentAt: "2026-10-02T00:00:00Z", senderName: "山田 花子", state: "accepted", resendAt: "2027-03-31T00:00:00Z" }, unreadCount: 1, unseenReply: false } }),
  cand({ id: "f6", name: "加藤 六郎", location: "福岡県福岡市", careerStance: "researching", careerStanceUpdatedAt: null,
    tenureMonths: 30, currentRole: "CS", currentCompany: "株式会社ガンマ", employmentType: "業務委託",
    expRoleIds: ["r-cs"], desiredRoleIds: ["r-cs", "r-sales"], desiredRoleNames: ["カスタマーサクセス", "営業"],
    touchpoints: tp(1), createdAt: "2026-09-26T00:00:00Z" }),
];

export default function CandidatesPreview() {
  if (!IS_DEV) return null;
  return (
    <div>
      <PreviewHeader title="候補者を探す（/biz/candidates）">
        有料プランのゲートの<strong>内側</strong>です。<strong>実画面は有料プラン0社で誰も開けません。</strong>
        <br />
        見るところ：条件が<strong>右のドロワー「すべてのフィルター」</strong>に畳まれていること（2026-10-13）／
        選択中の条件が<strong>チップの値</strong>と<strong>ボタンの数字</strong>で分かること／並び替えがあること／
        <strong>「転職検討中」が緑でない</strong>・<strong>「メンター」バッジが出ない</strong>こと／
        <strong>「できること」（職種 × 年数）</strong>が出ること（YOUTRUST を参考にした。
        ⚠️ 本人の入力ではなく<strong>職歴からの計算</strong>）。
      </PreviewHeader>

      <Variant
        label="4名（通常）"
        note="⚠️「すべてのフィルター」で右からドロワーが出ること"
      >
        <CandidatesClient candidates={FULL} roleFilterTree={ROLE_TREE} />
      </Variant>

      {/* ★すべてのフィルターの件数（2026-10-13 / ステップ5）。6名を手で数えて照合する */}
      <Variant
        label="すべてのフィルター（件数の数え方・6名）"
        note="⚠️ 件数は「その軸以外の条件を掛けたあとの人数」。例：転職への意向で「積極的」を選ぶと、経験職種の「営業」は2（青木・江藤）、意向の「積極的」自身は2のまま、「情報収集」は2（他の軸だけで数える）。0件は灰色で選べない。結果を表示（○名）は下書きで変わり、✕・Esc・外側で閉じると一覧は変わらない"
      >
        <CandidatesClient candidates={FACET} roleFilterTree={ROLE_TREE} companyShortName="Third Box" />
      </Variant>

      {/* ★右欄の2列表示の区切り線（2026-10-13）。⚠️ このページの枠（980px）では右欄が 680px に届かずタブになるので、
             この1つだけ画面の幅いっぱいに広げる。比率は localStorage（dev-preview のキー）に覚えるので、再読み込みで保たれる */}
      <Variant
        label="右欄の2列表示（プロフィール｜メッセージの区切り線）・画面いっぱい"
        note="⚠️ 1920px で開く。内側の線：ドラッグで動く・プロフィール 320px／メッセージ 300px で止まる・ダブルクリックで 55% に戻る・Tab → ←→ で 40px。外側の線を動かしても内側の比率が保たれる。右欄が 680px 未満になるとタブに変わり、内側の線は消える"
      >
        <div data-state="preview-fullbleed" style={{ width: "calc(100vw - 40px)", marginLeft: "calc(50% - 50vw + 20px)" }}>
          <CandidatesClient candidates={FACET} roleFilterTree={ROLE_TREE} companyShortName="Third Box"
            stageStorageKey="dev-preview-cand-stage" columnsStorageKey="dev-preview-cand-cols" />
        </div>
      </Variant>

      {/* ★送れない理由（2026-10-11 / 柴さんの指示）。実アカウントで検証用の会社を見た状態は、実アカウントでログインしないと
             実画面では作れない（実アカウントの状態を変えないため、ここで見る） */}
      <Variant
        label="検証用の会社を実アカウントで見た状態（一覧の上の1行）"
        note="⚠️ 一覧の上に灰色で「検証用の会社のため、このアカウントからは送れません」。「いま、メッセージを送れる候補者はいません。」が出ないこと"
      >
        <CandidatesClient candidates={FULL.map((c) => ({ ...c, approach: { eligible: false, sent: null, blocked: "test_company" as const } }))} roleFilterTree={ROLE_TREE} companyShortName="Third Box" />
      </Variant>
      <Variant
        label="右のプレビューのボタンの位置（状態ごと）"
        note="⚠️ 送れる人だけ主ボタン。送れない人は灰色の1行（バッジにしない）。「プロフィール全体を見る」は白地・枠線で横に並ぶ"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18, background: "#fff", padding: 16, border: "1px solid var(--line)", borderRadius: 12, maxWidth: 560 }}>
          {([
            ["送れる", { eligible: true, sent: null }, null],
            ["検証用の会社を実アカウントで見ている", { eligible: false, sent: null, blocked: "test_company" }, null],
            ["今は転職を考えていない", { eligible: false, sent: null, blocked: "not_looking" }, null],
            ["その他（範囲外など。区別しない）", { eligible: false, sent: null, blocked: "other" }, null],
          ] as const).map(([label, approach]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{label}</div>
              <PreviewApproachArea candidate={{ ...FULL[0], approach: approach as NonNullable<Candidate["approach"]> }} jobs={[]}
                profileLink={<span style={{ fontSize: 13, color: "var(--royal)", fontWeight: 700, padding: "9px 16px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff" }}>プロフィール全体を見る</span>} />
            </div>
          ))}
        </div>
      </Variant>

      {/* ★メッセージの状態と見送り（2026-10-13）。未読ありの人・見送った人は実データで作ると書き込みが要るので、ここで見る */}
      <Variant
        label="メッセージの状態と見送り（2026-10-13）"
        note="⚠️ カードに「送信済み」「返信あり」「返信あり・未読」（数字なし）。未読ありの人を選ぶとタブ「メッセージ」の右に小さな丸。末尾に「見送った1名は非表示 ／ 表示する」→ 押すと薄く「山田 花子さんが見送り・10/13」と「解除」"
      >
        <CandidatesClient candidates={[
          { ...FULL[0], approach: { eligible: false, sent: { id: "a1", conversationId: "cv1", sentAt: "2026-10-01T00:00:00Z", senderName: "山田 花子", state: "accepted", resendAt: "2027-03-30T00:00:00Z" }, unreadCount: 2, unseenReply: false } },
          { ...FULL[1], approach: { eligible: false, sent: { id: "a2", conversationId: "cv2", sentAt: "2026-10-02T00:00:00Z", senderName: "山田 花子", state: "accepted", resendAt: "2027-03-31T00:00:00Z" }, unreadCount: 0, unseenReply: false } },
          { ...FULL[2], approach: { eligible: false, sent: { id: "a3", conversationId: null, sentAt: "2026-10-05T00:00:00Z", senderName: "山田 花子", state: "pending", resendAt: "2027-04-03T00:00:00Z" }, unreadCount: 0, unseenReply: false } },
          { ...FULL[3], hidden: true, hiddenBy: { name: "山田 花子", at: "2026-10-13T03:00:00Z" }, approach: { eligible: true, sent: null } },
        ]} roleFilterTree={ROLE_TREE} companyShortName="Third Box" />
      </Variant>

      <Variant
        label="0名（母集合が空）"
        note="⚠️ 文言が「『転職について』に答えている求職者がまだいません」であること（古い『スカウトを受け取る設定』ではない）"
      >
        <CandidatesClient candidates={[]} roleFilterTree={ROLE_TREE} />
      </Variant>

      <Variant
        label="1名（職歴なし・年数が未算出）"
        note="⚠️ 「社会人0年」と出ないこと。所属が無くても行が崩れないこと"
      >
        <CandidatesClient candidates={[FULL[2]]} roleFilterTree={ROLE_TREE} />
      </Variant>
    </div>
  );
}

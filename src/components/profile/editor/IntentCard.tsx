"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileEditModal } from "./ProfileEditModal";
import { CollapsibleRow, FormGroup, selectStyle, inputStyle } from "./formKit";
import { PencilIcon } from "@/components/profile/view/RowActions";
import { CheckPillGroup, type CheckPillOption } from "@/components/ui/CheckPillGroup";
import { RoleSearchSelect } from "@/components/ui/RoleSearchSelect";
import { memberState, type CompanyMemberRow } from "@/lib/constants/companyMembers";
/* ⚠️ 会社名は必ずここを通す。法人格（株式会社…）と末尾の " Japan" が落ちる。
      ⚠️ 正規表現をコピーして持ってこないこと。3箇所に割れていたのを集約した経緯がある。 */
import { companyDisplayName } from "@/lib/companies/displayName";
import {
  DESIRED_WORK_STYLES, TRANSFER_TIMINGS, DESIRED_PHASES, SALARY_MAX_MAN,
  CAREER_STANCES, CAREER_STANCE_LABELS,
} from "@/lib/constants/careerPreferences";
import { COMMON_PREFECTURES, OTHER_PREFECTURES } from "@/lib/utils/location";

/**
 * 「意思表示」（`/mypage` 右カラム・**1枚だけ**）。
 *
 * ── なぜ1枚にしたか（2026-08-26 / フェーズ1・柴さんの指示）────────────────────
 * `StanceCard`（声をかけられてもよいか）/ `CareerIntentBox`（転職について）/
 * `TalkToMeCard`（話を聞かれてもよいか）の**3枚を統合した**。
 * 3枚とも「小見出し → 問い → 説明 → トグル → 結果文」の5段組みで、
 * **1つのスイッチに5段の文字が乗っていた**。272px（デスクトップの右カラム）では
 * 説明のほうが操作より大きく見え、何を決める画面なのか読めない。
 *
 * ★1行 = 「ラベル ＋ 右端にトグル」、その下に**状態**を1行。それだけ。
 *
 * ⚠️★**説明・注記を表示モードに書き足さないこと。** 説明は全部モーダル（✎）の中にある。
 *    ここに1文でも戻すと、統合前の5段組みに逆戻りする。
 *    ⚠️ 例外は**「状態」**。値が無い・保留中・会社が止めている、は説明ではなく状態なので
 *       下段に出す。とくに「転職について」の未設定は**必ず「未設定」と出す**
 *       （企業から声がかかるかどうかがこの値で決まるため）。
 *
 * ⚠️ **同じ列を触る操作を2つ作らない**（CLAUDE.md ルール⑧）。この画面での分担は:
 *    | 列 | 操作できる場所 |
 *    |---|---|
 *    | `ow_company_members`             | **カードのトグルだけ**（モーダルは説明のみ） |
 *    | `ow_profiles.career_stance`      | **モーダルだけ**（カードは値を出すだけ） |
 *    | `ow_profiles` の希望条件          | **モーダルだけ** |
 *
 * ⚠️ **API の呼び方と保存する中身は 2026-08-26 の統合で1つも変えていない。**
 *    | 系統 | 何を保存するか |
 *    |---|---|
 *    | `PUT /api/jobseeker/career-preferences`| **`career_stance`** ＋ 希望職種・勤務地・勤務スタイル・時期・年収・フェーズ |
 *    | `POST /api/mypage/ambassador-self-register` / `PATCH .../ambassador-visibility` | 面談対応者の行 |
 *
 * ⚠️ 「最終更新」の行は**フェーズ1では出さない**（柴さんの判断）。`stance_updated_at` は
 *    いまは「スカウト可否をいつ答えたか」だけを指しており、カード全体の最終更新ではない。
 *    フェーズ2で「転職について」の新しい列を入れてから、両方の保存で更新する形にして出す。
 */

export type IntentPrefs = {
  /** ★「転職について」の意思表示（2026-08-26 / フェーズ2）。
   *  ⚠️ `null` は「まだ答えていない」。**既定値に倒さないこと。** */
  career_stance: string | null;
  desired_role_ids: string[];
  desired_prefectures: string[] | null;
  desired_work_styles: string[] | null;
  transfer_timing: string | null;
  desired_salary_min: number | null;
  desired_salary_max: number | null;
  desired_phase: string[] | null;
};

const MAX_DESIRED_ROLES = 5;

/* ── 見た目の値。★1箇所に置く（行ごとに書き写さない）────────────────────────── */
const LABEL_SIZE = 14;   // 行のラベル
const SUB_SIZE = 13;     // 下段（状態）
const SUB_COLOR = "var(--ink-mute)";   // ⚠️ この設計に `--text-secondary` は無い。補足は --ink-mute

/** 行の区切り。⚠️ `CollapsibleRow` と同じ値にする（同じ画面で線の間隔が2種類になる） */
const DIVIDER: React.CSSProperties = {
  borderTop: "1px solid var(--line-soft)", paddingTop: 14, marginTop: 14,
};

/**
 * トグル1つ。**見た目は3枚のカードにあったものをそのまま持ってきている。**
 *
 * ⚠️ `role="switch"` ＋ `aria-checked` を必ず付ける（見た目だけで状態を伝えない）。
 * ⚠️ `.btn-fixed-size` を付けないこと。付けると `min-height: 0` になり、
 *    767px 以下でタップ対象が **22px** まで潰れる（統合前はこれで潰れていた）。
 *    代わりに `.tap-min-h` で 44px を確保する。
 */
function ToggleRow({
  label, on, busy, disabled = false, ariaLabel, onToggle,
}: {
  label: string; on: boolean; busy: boolean; disabled?: boolean;
  ariaLabel: string; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={busy || disabled}
      onClick={onToggle}
      className="tap-min-h"
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 12, width: "100%", padding: 0, background: "none", border: "none",
        cursor: disabled ? "default" : busy ? "wait" : "pointer",
        fontFamily: "inherit", textAlign: "left",
      }}
    >
      <span style={{ fontSize: LABEL_SIZE, fontWeight: 600, color: "var(--ink)" }}>
        {busy ? "保存中…" : label}
      </span>
      <span aria-hidden style={{
        width: 40, height: 22, borderRadius: 999, flexShrink: 0,
        background: on ? "var(--royal)" : "var(--line)",
        display: "inline-flex", alignItems: "center",
        justifyContent: on ? "flex-end" : "flex-start",
        padding: 2, transition: "background 0.15s",
        opacity: busy || disabled ? 0.5 : 1,
      }}>
        <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff" }} />
      </span>
    </button>
  );
}

/** 下段（状態）。⚠️ 説明を書かない。**値・保留・停止だけ** */
function SubLine({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "4px 0 0", fontSize: SUB_SIZE, lineHeight: 1.6, color: SUB_COLOR }}>
      {children}
    </p>
  );
}

export default function IntentCard({
  initialPrefs, stanceUpdatedAt, roles, roleAliases, desiredRoleOptions,
  currentCompanies, memberships,
}: {
  initialPrefs: IntentPrefs;
  /** 「意思表示を最後に答えた日」。⚠️ `null` なら**最終更新の行ごと出さない** */
  stanceUpdatedAt: string | null;
  roles: { id: string; name: string; parent_id: string | null; display_order: number }[];
  roleAliases: Record<string, string[]>;
  desiredRoleOptions?: { id: string; name: string; parent_id: string | null; display_order: number }[];
  /** 在籍中かつ企業マスタに紐づく会社。**0件なら「現職の話を聞かれる」の行ごと出ない**
   *
   * ⚠️ 在籍先が自由入力の人（2026-08-26 時点で実ユーザー11人中**5人**）には行が出ない。
   *    `ow_company_members.company_id` が `ow_companies` への FK なので行を作れないため。
   *    ⚠️ **理由を画面に出す案は採らなかった**（利用者側では直せず、案内先が無い）。 */
  currentCompanies: { id: string; name: string }[];
  memberships: CompanyMemberRow[];
}) {
  const router = useRouter();

  /* ⚠️★「企業から声をかけられる」のトグルは 2026-08-27 に**削除した**（フェーズ3）。
        スカウトの送信可否は「転職について」＝ `ow_profiles.career_stance` が決める
        （`いまは声をかけられたくない` と未設定だけが止める）。
        ⚠️ **同じ意思表示のスイッチを2つに戻さないこと。** 2つあると、
           どちらがオフでも届かないのに、画面はどちらか片方しか説明できない。
        ⚠️ `scout_enabled` の列は残っているが、**読む側も書く側もいない。**
           `PUT /api/jobseeker/scout-settings` も同時に削除した。 */

  /* ── ② 面談対応者（`ow_company_members`）──────────────────────────────────── */
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

  /* 在籍している会社と、その会社の行（あれば）を突き合わせる。
     ⚠️ 行があるが在籍申告が無い会社（退職済みなど）も**出す**。
        出さないと、行が残っているのに本人が始末できなくなる。
     ★`isCurrent` を持たせる。「話を聞ける人」は**現職についての話**なので、
       在籍が切れた行は公開側（`talkable.ts`）が既に降ろしている。 */
  const memberRows = useMemo(() => {
    const byCompany = new Map(memberships.map((m) => [m.company_id, m]));
    return [
      ...currentCompanies.map((c) => ({ company: c, m: byCompany.get(c.id) ?? null, isCurrent: true })),
      ...memberships
        .filter((m) => !currentCompanies.some((c) => c.id === m.company_id))
        .map((m) => ({ company: { id: m.company_id, name: m.company_name }, m, isCurrent: false })),
    ];
  }, [currentCompanies, memberships]);

  const runMember = useCallback((url: string, init: RequestInit, id: string) => {
    void (async () => {
      setMemberBusyId(id);
      setMemberError(null);
      try {
        const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          setMemberError(d?.message ?? "保存できませんでした。もう一度お試しください。");
          return;
        }
        /* ★「現職の話を聞かれる」も意思表示。ON / OFF の**どちらでも**進める
              （API 側も同じ）。⚠️ 片方だけにすると、止めた日が残らない。 */
        setStanceTs(new Date().toISOString());
        /* ⚠️ 楽観更新しない。サーバーの行を取り直してから表示を変える。 */
        router.refresh();
      } catch {
        setMemberError("保存できませんでした。もう一度お試しください。");
      } finally {
        setMemberBusyId(null);
      }
    })();
  }, [router]);

  /* ── ③ 転職について＋希望条件（モーダル）────────────────────────────────────
        ★保存済みの値。カードの下段はここだけを見る */
  const [saved, setSaved] = useState({ prefs: initialPrefs });

  /* ★「意思表示を最後に答えた日」。**保存できてから**進める（サーバーと同じ条件で動かす）。
     ⚠️ 値が実際に変わったときだけ進める。API 側も同じ条件なので、
        押し直しただけで日付が新しくなる形にしない。 */
  const [stanceTs, setStanceTs] = useState<string | null>(stanceUpdatedAt);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* 編集中の値 */
  const [stance, setStance] = useState<string | null>(saved.prefs.career_stance);
  const [roleIds, setRoleIds] = useState<string[]>(saved.prefs.desired_role_ids);
  const [prefectures, setPrefectures] = useState<string[]>(saved.prefs.desired_prefectures ?? []);
  const [workStyles, setWorkStyles] = useState<string[]>(saved.prefs.desired_work_styles ?? []);
  const [timing, setTiming] = useState(saved.prefs.transfer_timing ?? "");
  const [salaryMin, setSalaryMin] = useState(saved.prefs.desired_salary_min?.toString() ?? "");
  const [salaryMax, setSalaryMax] = useState(saved.prefs.desired_salary_max?.toString() ?? "");
  const [phase, setPhase] = useState<string[]>(saved.prefs.desired_phase ?? []);

  const roleNameById = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles]);

  /* ⚠️ 選択肢から外した値を今持っている人には足し戻す。
        出さないと画面から消えたまま保存され続け、別項目を保存した拍子に失われる。 */
  const workStyleOptions = useMemo<CheckPillOption[]>(() => {
    const base: CheckPillOption[] = DESIRED_WORK_STYLES.map((o) => ({ value: o.value, label: o.label }));
    const known = new Set(base.map((o) => o.value));
    return [...base, ...workStyles.filter((v) => !known.has(v)).map((v) => ({ value: v, label: v, legacy: true }))];
  }, [workStyles]);

  /** 開き直したときに保存済みの値へ戻す */
  const resetToSaved = useCallback(() => {
    setStance(saved.prefs.career_stance);
    setRoleIds(saved.prefs.desired_role_ids);
    setPrefectures(saved.prefs.desired_prefectures ?? []);
    setWorkStyles(saved.prefs.desired_work_styles ?? []);
    setTiming(saved.prefs.transfer_timing ?? "");
    setSalaryMin(saved.prefs.desired_salary_min?.toString() ?? "");
    setSalaryMax(saved.prefs.desired_salary_max?.toString() ?? "");
    setPhase(saved.prefs.desired_phase ?? []);
    setError(null);
  }, [saved]);

  /* ── 変更の有無を**系統ごと**に持つ。保存で呼ぶのは変わった系統だけ ────────── */
  const prefsPatch = useMemo(() => ({
    /* ⚠️ 「転職について」も**希望条件と同じ系統**（どちらも `ow_profiles`）。
          2026-08-26 まで `PUT /api/jobseeker/profile`（`ow_users.is_open_to_work`）に
          分かれていたが、列を `ow_profiles.career_stance` へ移したので1系統になった。 */
    career_stance:       stance,
    desired_role_ids:    roleIds,
    desired_prefectures: prefectures.length > 0 ? prefectures : null,
    desired_work_styles: workStyles,
    transfer_timing:     timing || null,
    desired_salary_min:  salaryMin ? parseInt(salaryMin, 10) : null,
    desired_salary_max:  salaryMax ? parseInt(salaryMax, 10) : null,
    desired_phase:       phase.length > 0 ? phase : null,
  }), [stance, roleIds, prefectures, workStyles, timing, salaryMin, salaryMax, phase]);
  const prefsDirty = JSON.stringify(prefsPatch) !== JSON.stringify({
    career_stance:       saved.prefs.career_stance,
    desired_role_ids:    saved.prefs.desired_role_ids,
    desired_prefectures: saved.prefs.desired_prefectures,
    desired_work_styles: saved.prefs.desired_work_styles ?? [],
    transfer_timing:     saved.prefs.transfer_timing,
    desired_salary_min:  saved.prefs.desired_salary_min,
    desired_salary_max:  saved.prefs.desired_salary_max,
    desired_phase:       saved.prefs.desired_phase,
  });
  const dirty = prefsDirty;

  /* ★系統ごとに独立して保存する。**失敗しても成功したものは残す。**
     巻き戻さない理由は2つ。①巻き戻しも書き込みなので同じように失敗しうる、
     ②列は系統ごとに独立していて、片方だけ保存された状態が壊れた状態ではない。 */
  const handleSave = useCallback(() => {
    void (async () => {
      setSaving(true);
      setError(null);
      const failed: string[] = [];
      const next = { ...saved };
      /* ★日付を進めてよいか。**保存前の値**と比べる（保存後だと必ず一致してしまう） */
      const stanceChanged = stance !== saved.prefs.career_stance;

      if (prefsDirty) {
        try {
          const res = await fetch("/api/jobseeker/career-preferences", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(prefsPatch),
          });
          if (!res.ok) {
            /* ★API はキー名入りの文言を返す（例: `desired_salary_min は 0〜…`）。丸めない */
            const json = await res.json().catch(() => null);
            throw new Error((json && typeof json.error === "string" && json.error) || "");
          }
          next.prefs = { ...prefsPatch };
          /* ★API は `career_stance` が実際に変わったときだけ `stance_updated_at` を打つ。
                画面も**同じ条件**で進める。条件を片方だけ変えないこと。
             ⚠️ 希望職種・年収だけを直したときは進めない（サーバーも進めない）。 */
          if (stanceChanged) setStanceTs(new Date().toISOString());
        } catch (e) {
          const msg = e instanceof Error && e.message ? `希望条件（${e.message}）` : "希望条件";
          failed.push(msg);
        }
      }

      setSaved(next);
      setSaving(false);

      if (failed.length > 0) {
        /* ⚠️ **閉じない。** 直せる状態のまま残す。 */
        setError(`${failed.join(" / ")}の保存に失敗しました。もう一度お試しください。`);
        return;
      }
      setJustSaved(true);
      setTimeout(() => { setJustSaved(false); setOpen(false); }, 800);
    })();
  }, [saved, prefsDirty, stance, prefsPatch]);

  /* ★4値のラベル（2026-08-26 / フェーズ2）。**日本語を DB に入れていない**ので、
        表示は必ず `CAREER_STANCE_LABELS` を通す。
     ⚠️ 「まだ答えていない」を既定の選択肢に倒さない。**「未設定」と出す。**
        2026-08-26 までは boolean だったので、触ったことのない人が全員
        「情報収集として」と表示されていた（本人が言っていないことを画面が言っていた）。 */
  const stanceText = (v: string | null) => (v ? CAREER_STANCE_LABELS[v] ?? v : "未設定");

  /* ⚠️ **タイムゾーンを明示する**。省くとサーバー（UTC）と手元（JST）で
        日付が1日ずれ、hydration mismatch になる。 */
  const stanceDate = stanceTs
    ? new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric",
      }).format(new Date(stanceTs))
    : null;

  return (
    <>
      {/* ⚠️ 幅を自分で決めない。器（`MypageLayout` の右カラム）の幅にそのまま従う。
             実測: デスクトップ 272px（320 − 24×2）/ 375px のとき 343px（375 − 16×2）。 */}
      <section style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
        padding: "16px 18px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
        position: "relative",
      }}>
        {/* ── 見出し ─────────────────────────────────────────────────────────
               ⚠️ ✎ は右上に絶対配置する。見出しの右端に置くと、幅の狭い右カラムで
                  ラベルがボタンのぶん詰まって折り返す。 */}
        <button
          type="button"
          className="tap-target tap-target-end"
          onClick={() => { resetToSaved(); setOpen(true); }}
          aria-label="意思表示を編集"
          title="意思表示を編集"
          style={{
            position: "absolute", top: 12, right: 14,
            color: "var(--royal)", background: "none", border: "none",
            cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", padding: 0,
          }}
        >
          <PencilIcon />
        </button>

        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
          意思表示
        </h2>

        {/* ── ② 現職の話を聞かれる（在籍している会社ごとに1行）──────────────────
               ⚠️ 会社が複数ある人は、**同じラベルの行を会社の数だけ並べる**。
                  下段の社名だけが変わる。0件なら行ごと出ない。 */}
        {memberRows.map(({ company, m, isCurrent }) => {
          const state = memberState(m);
          const busy = memberBusyId === (m?.id ?? company.id);
          /* ⚠️ 表示にも読み上げにも同じ名前を使う。法人格と " Japan" が落ちる */
          const brand = companyDisplayName(company.name, null).displayName;
          /* ★トグルの見た目は「本人の意思」。掲載されているかは下段が言う。
             ⚠️ `unlisted`（企業が非掲載）でも**ONのまま**にする。ここでOFFに見せると
                「自分で切ったのか会社が切ったのか」が分からなくなる。 */
          const on = state === "listed" || state === "unlisted";
          /* ⚠️ 在籍が切れている行は**ONにできない**（RLS の在籍チェックに弾かれる）。
                OFF にする更新は通るので、ONのときだけ操作させる。 */
          const disabled = !isCurrent && !on;
          /* ⚠️ 招待に未応答のときは既存の着地ページへ送る。**新しい承認導線を作らない。**
                依頼の中身（どの会社から・どんな依頼か）を見ないまま応じさせないため。 */
          const invitePending = isCurrent && state === "pending_user" && !!m;

          /* ★下段は**状態だけ**。⚠️ 分岐ごとに形を変えない（統合前は在籍切れの行だけ
                トグルの無いテキスト1行になっていた）。
             ⚠️★**社名と状態を「社名 ・ 状態」の1行にしない**（2026-08-26 / 実測で断念）。
                右カラムの下段に使える幅は **233px**（カード271 − 左右18）しかないのに、
                実在する社名だけで既に **182px**（伊藤忠テクノソリューションズ / 日本ヒューレット・パッカード）。
                残り 51px では「 ・ 非公開」（**最短の3文字**でも 241px）すら入らず、
                どの組み合わせも 2行に折り返した（実測 345〜371px）。
                → **社名を1行、状態を次の行**に分ける。こうすると状態は最長でも
                  169px（「会社から依頼が届いています」）で1行に収まる。
                ⚠️ 文言を削って1行に押し込む案は採らない。社名を5文字まで削るか、
                   状態を意味の分からない略語にするしかない。 */
          const stateLine =
            !isCurrent                 ? "職歴に在籍がありません"
            : state === "unlisted"     ? "会社が非公開にしています"
            : state === "pending_user" ? "会社から依頼が届いています"
            : null;

          return (
            <div key={company.id} style={DIVIDER}>
              {invitePending ? (
                /* ⚠️ トグルの代わりにリンク。**押した先で中身を読んでから**応じる。 */
                <a
                  href={`/mypage/ambassador-invite/${m!.invite_token}`}
                  className="tap-min-h"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 12, width: "100%", textDecoration: "none",
                  }}
                >
                  <span style={{ fontSize: LABEL_SIZE, fontWeight: 600, color: "var(--ink)" }}>
                    現職の話を聞かれる
                  </span>
                  <span style={{ fontSize: SUB_SIZE, fontWeight: 700, color: "var(--royal)", flexShrink: 0 }}>
                    確認する →
                  </span>
                </a>
              ) : (
                <ToggleRow
                  label="現職の話を聞かれる"
                  on={on}
                  busy={busy}
                  disabled={disabled}
                  /* ⚠️ 読み上げの文言も画面と合わせる。正式名称のままだと
                        「株式会社…ジャパンで…」と読まれ、画面の表示と一致しない。 */
                  ariaLabel={`${brand}について、現職の話を聞かれてもよい`}
                  onToggle={() => {
                    if (!m) {
                      /* 行がまだ無い＝はじめてON。作成と同時に掲載される */
                      runMember("/api/mypage/ambassador-self-register", {
                        method: "POST",
                        body: JSON.stringify({ company_id: company.id }),
                      }, company.id);
                      return;
                    }
                    runMember("/api/mypage/ambassador-visibility", {
                      method: "PATCH",
                      body: JSON.stringify({ member_id: m.id, enabled: !on }),
                    }, m.id);
                  }}
                />
              )}
              {/* ⚠️ 正式名称は `title` に残す（幅が足りないときは省略記号になるため）。
                     ⚠️ `nowrap` + 省略記号にしておく。社名が長い会社（「エヌ・ティ・ティ・データ」など）で
                        2行になると、下の状態行と区別がつかなくなる。 */}
              <p
                title={company.name}
                style={{
                  margin: "4px 0 0", fontSize: SUB_SIZE, lineHeight: 1.6, color: SUB_COLOR,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {brand}
              </p>
              {/* ⚠️ 状態は**あるときだけ**。掲載中・OFF はトグルが言っているので出さない。 */}
              {stateLine && <SubLine>{stateLine}</SubLine>}
            </div>
          );
        })}
        {memberError && (
          <p style={{ margin: "8px 0 0", fontSize: SUB_SIZE, fontWeight: 600, color: "var(--error)" }}>
            {memberError}
          </p>
        )}

        {/* ── ③ 転職について（トグルではなく値をそのまま出す）────────────────── */}
        <div style={DIVIDER}>
          <div style={{ fontSize: LABEL_SIZE, fontWeight: 600, color: "var(--ink)" }}>
            転職について
          </div>
          {/* ⚠️ 値は**そのまま短く**出す。「設定済み」のような抽象語にしない。
                 未設定は「未設定」と出す（✎ から答えられる）。 */}
          <SubLine>{stanceText(saved.prefs.career_stance)}</SubLine>
        </div>

        {/* ── 最終更新（2026-08-26 / フェーズ2）────────────────────────────────
               ⚠️ **値が無いときは行ごと出さない。** 「—」も出さない。
                  この列に値が入るのは「意思表示を答えた」ときだけなので、
                  空欄は「まだ何も答えていない」を意味する（埋めるものではない）。
               ⚠️ 打ち直すのは3つの意思表示の保存だけ。希望職種や年収を直しても動かない。 */}
        {stanceDate && (
          <div style={{ ...DIVIDER, fontSize: 12, color: "var(--ink-mute)" }}>
            最終更新 {stanceDate}
          </div>
        )}
      </section>

      {/* ── 編集モーダル ─────────────────────────────────────────────────────
             ⚠️★**説明はここにしか置かない。** カード側に戻さないこと。
             ⚠️ トグル（①②）の**操作はここに置かない**。同じ列を触る場所が2つになる。
                ここにあるのは「その設定が何をするか」の説明だけ。 */}
      <ProfileEditModal
        open={open}
        title="意思表示"
        dirty={dirty}
        saving={saving}
        justSaved={justSaved}
        error={error}
        onSave={handleSave}
        onClose={() => { setOpen(false); setError(null); }}
      >
        {/* ⚠️ `first` は**先頭の行だけ**に付ける（上の区切り線を出さないため）。
               「現職の話を聞かれる」は在籍中の会社が無い人には出ないので、
               その場合は次の「転職について」が先頭になる。 */}
        {memberRows.length > 0 && (
          <CollapsibleRow first label="現職の話を聞かれる" state={
            memberRows.some(({ m }) => memberState(m) === "listed") ? "ON" : "OFF"
          }>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
              ONにすると、その会社のページに「話を聞ける人」として出ます。
              仕事の内容や社内の様子について、転職を考えている人から聞かれる側になります。
              選考の面談ではありません。
              <br />
              OFFにしても登録は消えません。いつでもONに戻せます。
              <br />
              {/* ★なりすまし対策の3つ目（RLS の在籍チェック・企業側の非掲載トグルと合わせて3つ）。
                     ⚠️ **消さないこと。** ①②はコードで守れるが、これは文言でしか守れない。
                     ⚠️ 語彙は `/people` の注記と揃える。同じ事実を2つの画面で別々に言わない。 */}
              <strong style={{ color: "var(--ink)" }}>
                在籍は自己申告で、OPINIO は確認していません。会社の判断で出ないこともあります。
              </strong>
              <br />
              <strong style={{ color: "var(--ink)" }}>切り替えは、このカードのトグルから行えます。</strong>
            </p>
          </CollapsibleRow>
        )}

        {/* ★4択（2026-08-26 / フェーズ2）。**チェックボックス1つ（boolean）から変えた。**
               ⚠️ ラジオにする。選択肢を全部見せたいので `select` にしない
                  （4つのうちどれを選べるのかが、開くまで分からない形にしない）。
               ⚠️ **「未設定」という選択肢は置かない。** 一度答えた人が
                  「答えていないことにする」操作は要らないし、置くと
                  「未設定」が**選べる答え**に見える。
               ⚠️ 4つ目は本人の状態のラベルではなく**連絡の希望**。
                  「転職を考えていない」と書き換えないこと（転職しない人も登録する前提が壊れる）。 */}
        <CollapsibleRow first={memberRows.length === 0} defaultOpen label="転職について" state={stanceText(stance)}>
          {/* ★2026-08-27（フェーズ3）: **この設問がスカウトの可否そのものになった。**
                 ⚠️ 何が起きるかを**選ぶ前に**書く。以前は別のトグル
                    （「企業から声をかけられる」）が持っていた説明で、
                    そちらを消したので**ここに引き継いでいる。消さないこと。**
                 ⚠️ 「スカウト」という語は本文に出さない。送る側の意図
                    （まず面談から／いきなり選考）は受け手には判断できないので、
                    軸を「内容」ではなく**「相手が誰か」**にしている。 */}
          <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
            この答えで、<strong style={{ color: "var(--ink)" }}>企業の採用担当から声をかけられるかどうか</strong>が決まります。
            <br />
            「いまは声をかけられたくない」を選ぶと、企業からあなたに連絡は届きません。
            答えていないあいだも届きません。
            <br />
            いま在籍している会社と、職歴に書いた会社からは、答えにかかわらず届きません。
          </p>
          <div role="radiogroup" aria-label="転職について" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {CAREER_STANCES.map((o) => (
              <label
                key={o.value}
                className="tap-min-h"
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 0" }}
              >
                <input
                  type="radio"
                  name="career-stance"
                  value={o.value}
                  checked={stance === o.value}
                  onChange={() => setStance(o.value)}
                />
                <span style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>{o.label}</span>
              </label>
            ))}
          </div>
        </CollapsibleRow>

        <CollapsibleRow label="希望職種" state={roleIds.length > 0 ? `${roleIds.length}件` : "未設定"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <RoleSearchSelect
              roles={desiredRoleOptions ?? roles}
              aliases={roleAliases}
              value=""
              onSelect={(roleId) => {
                if (roleIds.includes(roleId)) return;
                if (roleIds.length >= MAX_DESIRED_ROLES) return;
                setRoleIds([...roleIds, roleId]);
              }}
              selectableParent
              clearOnSelect
              ariaLabel="希望職種を検索"
              disabled={roleIds.length >= MAX_DESIRED_ROLES}
              placeholder={roleIds.length >= MAX_DESIRED_ROLES
                ? `希望職種は ${MAX_DESIRED_ROLES} 件までです`
                : "職種名で検索（例: 法人営業、AE、営業）"}
            />
            {roleIds.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {roleIds.map((id) => (
                  <span key={id} style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    background: "var(--royal-50)", color: "var(--royal)",
                  }}>
                    {roleNameById.get(id) ?? id}
                    <button
                      type="button"
                      onClick={() => setRoleIds(roleIds.filter((r) => r !== id))}
                      aria-label={`${roleNameById.get(id) ?? id} を外す`}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", fontSize: 13, lineHeight: 1 }}
                    >×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </CollapsibleRow>

        <CollapsibleRow
          label="希望勤務地・勤務スタイル"
          state={[
            prefectures.length > 0 ? `勤務地${prefectures.length}件` : null,
            workStyles.length > 0 ? `スタイル${workStyles.length}件` : null,
          ].filter(Boolean).join(" / ") || "未設定"}
        >
          <FormGroup label="希望勤務地">
            <CheckPillGroup
              ariaLabel="希望勤務地"
              value={prefectures}
              options={[...COMMON_PREFECTURES, ...OTHER_PREFECTURES].map((p) => ({ value: p, label: p }))}
              onChange={setPrefectures}
            />
          </FormGroup>
          <FormGroup label="希望勤務スタイル">
            <CheckPillGroup
              ariaLabel="希望勤務スタイル"
              value={workStyles}
              options={workStyleOptions}
              onChange={setWorkStyles}
            />
          </FormGroup>
          <FormGroup label="転職検討時期" htmlFor="intent-timing">
            <select id="intent-timing" value={timing} onChange={(e) => setTiming(e.target.value)} style={selectStyle()}>
              <option value="">未設定</option>
              {TRANSFER_TIMINGS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FormGroup>
        </CollapsibleRow>

        <CollapsibleRow
          label="希望年収"
          state={salaryMin || salaryMax ? `${salaryMin || "—"}〜${salaryMax || "—"}万円` : "未設定"}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <FormGroup label="下限（万円）" htmlFor="intent-salary-min">
              <input
                id="intent-salary-min" type="number" min={0} max={SALARY_MAX_MAN}
                value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)}
                placeholder="例：600" style={inputStyle()}
              />
            </FormGroup>
            <FormGroup label="上限（万円）" htmlFor="intent-salary-max">
              <input
                id="intent-salary-max" type="number" min={0} max={SALARY_MAX_MAN}
                value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)}
                placeholder="例：900" style={inputStyle()}
              />
            </FormGroup>
          </div>
        </CollapsibleRow>

        <CollapsibleRow label="興味のある企業フェーズ" state={phase.length > 0 ? `${phase.length}件` : "未設定"}>
          <CheckPillGroup
            ariaLabel="興味のある企業フェーズ"
            value={phase}
            options={DESIRED_PHASES.map((p) => ({ value: p, label: p }))}
            onChange={setPhase}
          />
        </CollapsibleRow>
      </ProfileEditModal>
    </>
  );
}

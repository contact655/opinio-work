"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PROFILE_VISIBILITY_OPTIONS, type ProfileVisibility } from "@/lib/constants/profileVisibility";
import { isReachableByCompanies } from "@/lib/constants/careerPreferences";
import {
  COMPANY_VISIBILITY_OPTIONS,
  type CompanyVisibility,
} from "@/lib/constants/companyVisibility";
import { MASKED_COMPANY_LABEL } from "@/lib/experiences/companyName";
import { FormSection } from "@/components/profile/editor/formKit";

/**
 * `/mypage/settings` の「公開範囲」と「ブロック中の企業」（2026-08-20 / B-2）。
 *
 * ── なぜここに置くか ───────────────────────────────────────────────────────
 * ⚠️ **公開範囲は「未ログインから見えるか」を決める唯一のスイッチ。** 消さない。
 *    隠すと「なぜ自分は誰にも見つからないのか」が本人に分からなくなる。
 * ⚠️ **ブロック中の企業を出す画面が、2026-08-17 以降どこにも無かった**
 *    （`SettingsTab` がタブごと外れたため）。`get_blocked_companies` は
 *    2026-08-20 に直したが、**見る場所が無いままだった**。ここが置き場。
 *
 * ⚠️ **同じ列を触る画面を2つにしない。** 公開範囲は `IntentCard`（右カラムの
 *    「転職の希望」）から外してある。戻さないこと。
 */

type Block = {
  id: string | null;
  company_id: string | null;
  company_name: string;
  block_reason: "experience" | "manual";
};

type Suggestion = { id: string; name: string };

export default function PrivacySettings({
  initialVisibility,
  careerStance,
  careerStanceKnown,
  companyVisibility,
  hasExperiences,
  maskedSample,
}: {
  initialVisibility: ProfileVisibility;
  /** 「転職について」の意思表示。⚠️ null は「まだ答えていない」 */
  careerStance: string | null;
  /** ⚠️★取得に成功したか。false のときは節ごと出さない ——
   *  取れなかったのに「表示されています」と書くと嘘になる
   *  （CLAUDE.md「取得に失敗したら『0件』と表示しない」と同じ形）。 */
  careerStanceKnown: boolean;
  /** ★職歴全体に効く「会社名の公開範囲」。⚠️ 行ごとの値の共通値（割れていれば強いほう） */
  companyVisibility: CompanyVisibility;
  /** ⚠️★職歴0件なら入力欄を出さない。設定する行が無く、保存しても0行更新になる */
  hasExperiences: boolean;
  /** 「伏せるとどう出るか」の実物。⚠️ 作れなければ null（推測で例を作らない） */
  maskedSample: string | null;
}) {
  /* ★保存済みの値だけを見る（ルール⑦） */
  const [saved, setSaved] = useState<ProfileVisibility>(initialVisibility);
  const [visibility, setVisibility] = useState<ProfileVisibility>(initialVisibility);
  const [savingVis, setSavingVis] = useState(false);
  const [visError, setVisError] = useState<string | null>(null);
  const [visDone, setVisDone] = useState(false);

  /* ★会社名の公開範囲（2026-09-11）。⚠️ 保存済みの値だけを見る（ルール⑦）。 */
  const [savedVc, setSavedVc] = useState<CompanyVisibility>(companyVisibility);
  const [vc, setVc] = useState<CompanyVisibility>(companyVisibility);
  const [savingVc, setSavingVc] = useState(false);
  const [vcError, setVcError] = useState<string | null>(null);
  const [vcDone, setVcDone] = useState(false);

  async function saveCompanyVisibility() {
    setSavingVc(true); setVcError(null); setVcDone(false);
    try {
      const res = await fetch("/api/jobseeker/company-visibility", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visibility_company: vc }),
      });
      if (!res.ok) throw new Error();
      setSavedVc(vc); setVcDone(true);
    } catch {
      setVcError("保存できませんでした。");
    } finally {
      setSavingVc(false);
    }
  }

  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [blocksError, setBlocksError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busyCompanyId, setBusyCompanyId] = useState<string | null>(null);
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadBlocks = useCallback(async () => {
    try {
      const res = await fetch("/api/jobseeker/scout-settings");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { blocks?: Block[] };
      setBlocks(data.blocks ?? []);
      setBlocksError(null);
    } catch {
      /* ⚠️ 失敗を空リストにしない。「0件」と「取れなかった」を区別する
            （CLAUDE.md「★403 は『0件』として静かに素通りする」）。 */
      setBlocks(null);
      setBlocksError("ブロック中の企業を取得できませんでした。");
    }
  }, []);

  useEffect(() => { void loadBlocks(); }, [loadBlocks]);

  async function saveVisibility() {
    if (savingVis || visibility === saved) return;
    setSavingVis(true); setVisError(null); setVisDone(false);
    try {
      const res = await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
      if (!res.ok) throw new Error();
      setSaved(visibility);
      setVisDone(true);
      setTimeout(() => setVisDone(false), 2000);
    } catch {
      setVisError("保存できませんでした。もう一度お試しください。");
    } finally {
      setSavingVis(false);
    }
  }

  function onQueryChange(v: string) {
    setQ(v);
    if (qTimer.current) clearTimeout(qTimer.current);
    if (v.trim().length < 2) { setSuggestions([]); return; }
    qTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/companies/search?q=${encodeURIComponent(v.trim())}&limit=8`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { results?: Suggestion[] };
        setSuggestions(data.results ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  }

  async function addBlock(c: Suggestion) {
    setBusyCompanyId(c.id);
    try {
      const res = await fetch("/api/jobseeker/scout-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: c.id }),
      });
      if (!res.ok) throw new Error();
      setQ(""); setSuggestions([]);
      await loadBlocks();
    } catch {
      setBlocksError("追加できませんでした。");
    } finally {
      setBusyCompanyId(null);
    }
  }

  async function removeBlock(b: Block) {
    if (!b.id) return;
    setBusyCompanyId(b.company_id);
    try {
      const res = await fetch(`/api/jobseeker/scout-settings?id=${b.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await loadBlocks();
    } catch {
      setBlocksError("解除できませんでした。");
    } finally {
      setBusyCompanyId(null);
    }
  }

  const alreadyBlocked = new Set((blocks ?? []).map((b) => b.company_id));

  return (
    <>
      {/* ── 公開範囲 ───────────────────────────────────────────────────── */}
      <FormSection title="公開範囲">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {PROFILE_VISIBILITY_OPTIONS.map((o) => (
            <label
              key={o.value}
              style={{
                display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                border: `1.5px solid ${visibility === o.value ? "var(--royal)" : "var(--line)"}`,
                background: visibility === o.value ? "var(--royal-50)" : "#fff",
                borderRadius: 10, padding: "12px 14px",
              }}
            >
              <input
                type="radio"
                name="visibility"
                checked={visibility === o.value}
                onChange={() => setVisibility(o.value)}
                style={{ marginTop: 2, accentColor: "var(--royal)" }}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{o.label}</span>
                {/* ⚠️ `desc` は**同意の範囲そのもの**。ここで言い換えない
                       （lib/constants/profileVisibility.ts のコメント参照）。 */}
                <span style={{ display: "block", fontSize: 12, lineHeight: 1.7, color: "var(--ink-soft)", marginTop: 3 }}>
                  {o.desc}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <button
            type="button"
            onClick={() => void saveVisibility()}
            disabled={savingVis || visibility === saved}
            className="tap-min-h"
            style={{
              padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit",
              border: "none", cursor: visibility === saved ? "default" : "pointer",
              background: visibility === saved ? "var(--line)" : "var(--royal)",
              color: visibility === saved ? "var(--ink-mute)" : "#fff",
            }}
          >
            {savingVis ? "保存中…" : "保存する"}
          </button>
          {visDone && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--success-ink)" }}>保存しました</span>}
          {visError && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{visError}</span>}
        </div>
      </FormSection>

      {/* ── ★企業の候補者検索での見え方（2026-09-10）──────────────────────
             ⚠️★**「公開範囲」のすぐ下に置くこと。** あちらは「**誰に**見えるか」、
                ここは「**何が**見えるか」。同じ軸の続きとして読ませるために隣に置いてある。
                離すと、公開範囲を選ぶ人がここを読まない。
             ⚠️★**新しいカードにしないこと。** `FormSection` を1つ足すだけ
                （「ブロック中の企業」と同じ並び）。`/mypage` は 2026-08-16 に
                「プロフィールの入口を1つにする」で整理した画面。
             ⚠️★**`IntentCard` に書かないこと。** あそこは「答える／答えない」の
                意思表示で、見え方の説明を混ぜると問いがぼやける（あちらの注記も
                「一度に2つ言わない」）。導線だけを引いてある。

             ── ★3層を必ず全部出す（2026-09-10 の調査）────────────────────────
             企業に見えている範囲は3層ある。**1層目だけ出すと「思ったより少ない」と誤る。**
               ① 一覧の行に出るもの
               ② ★**画面に出ないが、絞り込みには使われるもの**
               ③ 一覧から1クリックで開ける `/u/{id}`
             ⚠️★**②を落とさないこと。本人にとって一番の新情報。**
                「表示されていない＝使われていない」と読まれるのが一番まずい。
             ⚠️★**③に年齢が出ることを書くこと。** 一覧には年齢を出さないし年齢で
                絞り込ませないが（労働施策総合推進法9条。`birth_date` を取っていない）、
                **`/u/` には出る**。方針は変えないが、事実は本人に伝える。

             ── ★文言は既存のものを使う ──────────────────────────────────────
             「非公開企業」＝ `MASKED_COMPANY_LABEL`、
             「見えるのは OPINIO にログインしている人だけです」＝ オンボーディングと
             `IntentCard` の一文、「企業の候補者検索に表示されていません」＝ `IntentCard`。
             ⚠️ **同じことを2通りで説明しないこと。**

             ⚠️★**未設定の人にも中身を見せること。** 隠すと「答えたら何が起きるか
                分からないまま答える」ことになる。**答える前に知りたいのがまさにこれ。**
                書き分けるのは前置きの1文だけ。 */}
      {careerStanceKnown && (
      <FormSection title="企業の候補者検索での見え方">
        {/* 前置き。⚠️ 状態で変わるのはここだけ */}
        <p style={{ margin: "0 0 12px", fontSize: 12.5, lineHeight: 1.8, color: "var(--ink-soft)" }}>
          {careerStance == null ? (
            <>
              <strong style={{ color: "var(--ink)" }}>いまは、企業の候補者検索に表示されていません。</strong>
              「転職について」に答えると、次のように表示されます。
            </>
          ) : !isReachableByCompanies(careerStance) ? (
            <>
              <strong style={{ color: "var(--ink)" }}>あなたの選択で、企業の候補者検索には表示されていません。</strong>
              表示される場合は、次のようになります。
            </>
          ) : (
            <>
              <strong style={{ color: "var(--ink)" }}>いま、企業の候補者検索に表示されています。</strong>
              企業からは次のように見えています。
            </>
          )}
        </p>

        <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* ① 一覧の行 */}
          <li style={{ fontSize: 12.5, lineHeight: 1.85, color: "var(--ink-soft)" }}>
            一覧には、<strong style={{ color: "var(--ink)" }}>お名前</strong>・現在の職種と会社名・
            社会人年数・お住まいの地域・希望職種・希望勤務地が並びます。
            {/* ★下の設定を変えると、ここの一文も変わる（2026-09-11）。
                   ⚠️★**説明と設定が食い違わないようにするための連動。** 片方だけ直さないこと。
                   ⚠️ 「非公開企業」は既存の語彙。ここで別の言い方を作らない。
                   ⚠️ `hidden` も候補者検索では `masked` と同じ表示になる（2026-09-10 の判断）。
                      ⚠️ **企業ページの現役社員・OB/OG からは `hidden` だけ消える。** そこは下の行で言う。 */}
            {savedVc === "real"
              ? <>会社名はそのまま表示されます。</>
              : <>いまは会社名を伏せているので、会社名の代わりに「{MASKED_COMPANY_LABEL}」と表示されます。</>}
          </li>

          {/* ② ★絞り込み。**落とさないこと** */}
          <li style={{ fontSize: 12.5, lineHeight: 1.85, color: "var(--ink-soft)" }}>
            <strong style={{ color: "var(--ink)" }}>一覧に出ていない項目も、企業が候補者を絞り込むときに使われます。</strong>
            希望年収・雇用形態・希望の働き方がこれにあたります。
            画面に表示されていなくても、これらの条件で探されています。
          </li>

          {/* ③ /u/ */}
          <li style={{ fontSize: 12.5, lineHeight: 1.85, color: "var(--ink-soft)" }}>
            一覧から<strong style={{ color: "var(--ink)" }}>あなたのプロフィールページを開けます</strong>。
            自己紹介・職歴・学歴・スキルのほか、
            <strong style={{ color: "var(--ink)" }}>生年月日を登録している場合は年齢も表示されます</strong>。
            {savedVc === "masked" && maskedSample && (
              <>そこでは会社名が「{maskedSample}」と表示されます。</>
            )}
            {savedVc === "hidden" && (
              <>いまは職歴を出さない設定なので、<strong style={{ color: "var(--ink)" }}>職歴はそこにも企業ページにも出ません</strong>。</>
            )}
            {/* ⚠️ この一文はオンボーディングと IntentCard と同じ。揃えてある */}
            見えるのは OPINIO にログインしている人だけです。
          </li>
        </ol>

        {/* ⚠️★**「職歴の各行から変更できます」と書かないこと**（2026-09-10 に一度書いて、その日に訂正）。
               会社名を伏せる設定（`visibility_company`）の**入力欄は 2026-08-16 に外されている。**
               列とデータは残っているが、**本人が画面から変える手段は無い**（実測: 本番29件すべて `real`）。
               ⚠️ 入力欄を戻すときに、この一文も戻すこと。 */}
        {/* ★会社名の公開範囲（2026-09-11）。**3層の説明と同じ節に置く。**
               ⚠️★**説明と設定を離さないこと。** 離すと、設定を変えたときに
                  上の説明のどこが変わるのかが分からなくなる。
               ⚠️★**職歴1件ずつの入力欄を復活させないこと**（`CareerHistoryEditor.tsx:1520`）。
                  1件ずつだと**選び忘れが同意なき公開になる**。ここは職歴全体の1設定。
               ⚠️★**既定は `real` のまま変えない。** 既存の状態を勝手に動かさない。
               ⚠️ 職歴が0件なら出さない（設定する行が無い）。 */}
        {hasExperiences && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-soft)" }}>
            <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
              会社名の公開範囲
            </p>
            <p style={{ margin: "0 0 10px", fontSize: 12, lineHeight: 1.8, color: "var(--ink-mute)" }}>
              すべての職歴にまとめて適用されます。あとから職歴を足したときも、この設定が引き継がれます。
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {COMPANY_VISIBILITY_OPTIONS.map((o) => (
                <label key={o.value} style={{
                  display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                  border: `1.5px solid ${vc === o.value ? "var(--royal)" : "var(--line)"}`,
                  background: vc === o.value ? "var(--royal-50)" : "#fff",
                  borderRadius: 10, padding: "11px 13px",
                }}>
                  <input
                    type="radio" name="visibility_company"
                    checked={vc === o.value}
                    onChange={() => setVc(o.value)}
                    style={{ marginTop: 2, accentColor: "var(--royal)" }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{o.label}</span>
                    <span style={{ display: "block", fontSize: 12, lineHeight: 1.7, color: "var(--ink-soft)", marginTop: 3 }}>
                      {o.desc}
                    </span>
                    {/* ★「伏せるとどう出るか」の実物。⚠️ 面ごとに文字列が違うので**両方**出す。
                           ⚠️ 規則をここに書き写さない（`generateMaskedCompanyLabel()` の結果をそのまま渡している）。 */}
                    {o.value === "masked" && (
                      <span style={{ display: "block", fontSize: 12, lineHeight: 1.7, color: "var(--ink-mute)", marginTop: 5 }}>
                        企業の候補者検索では「{MASKED_COMPANY_LABEL}」
                        {maskedSample && <>、プロフィールでは「{maskedSample}」</>}
                        と表示されます。
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => void saveCompanyVisibility()}
                disabled={savingVc || vc === savedVc}
                className="tap-min-h"
                style={{
                  padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                  border: "none", cursor: vc === savedVc ? "default" : "pointer",
                  background: vc === savedVc ? "var(--line)" : "var(--royal)",
                  color: vc === savedVc ? "var(--ink-mute)" : "#fff",
                }}
              >
                {savingVc ? "保存中…" : "保存する"}
              </button>
              {vcDone && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--success-ink)" }}>保存しました</span>}
              {vcError && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{vcError}</span>}
            </div>
          </div>
        )}
      </FormSection>
      )}

      {/* ── ブロック中の企業 ───────────────────────────────────────────── */}
      <FormSection title="ブロック中の企業">
        <p style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.8, color: "var(--ink-soft)" }}>
          ここに入っている企業からは声がかかりません。
          <br />
          <strong style={{ color: "var(--ink)" }}>現在お勤めの会社は自動的に含まれます。</strong>
          職歴の「現職」から判定しているので、ここで外すことはできません。
        </p>

        {blocksError && (
          <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{blocksError}</p>
        )}

        {blocks === null ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>読み込み中…</p>
        ) : blocks.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-mute)" }}>まだありません。</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {blocks.map((b) => (
              <div
                key={`${b.company_id}-${b.block_reason}`}
                style={{
                  display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                  border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", minWidth: 0, flex: 1 }}>
                  {b.company_name}
                </span>
                <span
                  style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 100, whiteSpace: "nowrap",
                    background: b.block_reason === "experience" ? "var(--royal-50)" : "var(--line-soft)",
                    color: b.block_reason === "experience" ? "var(--royal)" : "var(--ink-soft)",
                  }}
                >
                  {b.block_reason === "experience" ? "現職（自動）" : "自分で追加"}
                </span>
                {/* ⚠️ **在籍由来の行に解除ボタンを出さない。**
                       `can_send_scout()` は在籍を無条件で弾くので、ここで消せるようにしても
                       **消えたように見えるだけで結果は変わらない**（届かないまま）。
                       「解除したのに届かない」を作らないため、最初から出さない。 */}
                {b.block_reason === "manual" && b.id && (
                  <button
                    type="button"
                    onClick={() => void removeBlock(b)}
                    disabled={busyCompanyId === b.company_id}
                    className="tap-min-h"
                    style={{
                      fontSize: 12, fontWeight: 600, fontFamily: "inherit", color: "var(--ink-soft)",
                      background: "none", border: "1px solid var(--line)", borderRadius: 8,
                      padding: "5px 10px", cursor: "pointer",
                    }}
                  >
                    解除
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>
            企業を追加する
          </label>
          <input
            type="text"
            value={q}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="企業名で検索（2文字以上）"
            style={{
              width: "100%", height: 40, padding: "0 12px", borderRadius: 10,
              border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", color: "var(--ink)",
            }}
          />
          {suggestions.length > 0 && (
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {suggestions.map((c) => {
                const already = alreadyBlocked.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { if (!already) void addBlock(c); }}
                    disabled={already || busyCompanyId === c.id}
                    className="tap-min-h"
                    style={{
                      textAlign: "left", fontSize: 13, fontFamily: "inherit",
                      border: "1px solid var(--line)", borderRadius: 8, padding: "9px 12px",
                      background: already ? "var(--line-soft)" : "#fff",
                      color: already ? "var(--ink-mute)" : "var(--ink)",
                      cursor: already ? "default" : "pointer",
                    }}
                  >
                    {c.name}{already && "（追加済み）"}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </FormSection>
    </>
  );
}

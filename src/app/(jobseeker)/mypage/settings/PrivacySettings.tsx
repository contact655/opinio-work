"use client";

import { useCallback, useEffect, useState } from "react";
import { PROFILE_VISIBILITY_OPTIONS, type ProfileVisibility } from "@/lib/constants/profileVisibility";
import { isReachableByCompanies } from "@/lib/constants/careerPreferences";
import { FormSection } from "@/components/profile/editor/formKit";
import { useCompanyLookup, type CompanyLookupResult } from "@/components/companies/useCompanyLookup";

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

/* ⚠️★取得は `/api/companies/lookup`（**マスタの軸**）。
      `/api/companies/search` に戻さないこと ——あちらは**ディレクトリの軸**
      （`filterListedCompanies`）で、掲載中の企業しか返さない。
      2026-09-14 に61社を非掲載にしたとき、**88社中66社をブロックできない**状態になった。
   ⚠️★ブロックの目的は「**いまの勤務先に見られたくない**」。掲載の有無は無関係。
      実例（2026-09-14 実測）: 実ユーザー1名が在籍中の 海光電業株式会社 は非掲載で、
      **本人が自分の勤務先をブロックできなかった。** */
type Suggestion = CompanyLookupResult;

export default function PrivacySettings({
  initialVisibility,
  careerStance,
  careerStanceKnown,
}: {
  initialVisibility: ProfileVisibility;
  /** 「転職について」の意思表示。⚠️ null は「まだ答えていない」 */
  careerStance: string | null;
  /** ⚠️★取得に成功したか。false のときは節ごと出さない ——
   *  取れなかったのに「表示されています」と書くと嘘になる
   *  （CLAUDE.md「取得に失敗したら『0件』と表示しない」と同じ形）。 */
  careerStanceKnown: boolean;
}) {
  /* ★保存済みの値だけを見る（ルール⑦） */
  const [saved, setSaved] = useState<ProfileVisibility>(initialVisibility);
  const [visibility, setVisibility] = useState<ProfileVisibility>(initialVisibility);
  const [savingVis, setSavingVis] = useState(false);
  const [visError, setVisError] = useState<string | null>(null);
  const [visDone, setVisDone] = useState(false);


  const [blocks, setBlocks] = useState<Block[] | null>(null);
  const [blocksError, setBlocksError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [busyCompanyId, setBusyCompanyId] = useState<string | null>(null);
  /* ⚠️ **デバウンスの 250ms は変えない**（差し替え前の値をそのまま渡す）。
     ⚠️ フックに寄せたことで**古い応答で新しい候補を上書きしない**ようになった
        （自前の実装には連番の判定が無く、速く打つと1文字前の候補が残りえた）。 */
  const { results: suggestions, search: searchCompanies, clear: clearSuggestions } =
    useCompanyLookup({ debounceMs: 250 });

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
    /* ⚠️ 2文字未満では投げない。`/api/companies/lookup` も `MIN_QUERY_LENGTH = 2` で
          空を返すが、**手前で止めて無駄な往復を作らない**（差し替え前と同じ挙動）。 */
    if (v.trim().length < 2) { clearSuggestions(); return; }
    searchCompanies(v);
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
      setQ(""); clearSuggestions();
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
            {/* ⚠️★**会社名は常に実名。** 伏せる設定は 2026-09-15 に畳んだ（下の注記）。
                   条件分岐に戻さないこと ——戻すなら設定ごと戻す。 */}
            会社名はそのまま表示されます。
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
            {/* ⚠️ この一文はオンボーディングと IntentCard と同じ。揃えてある */}
            見えるのは OPINIO にログインしている人だけです。
          </li>
        </ol>

        {/* ★★会社名を伏せる設定（`visibility_company`）は **2026-09-15 に畳んだ**（柴さんの判断）。
               ⚠️★**入力欄を戻さないこと。** 戻すなら、下の3つを踏まえて改めて決めること。

               ① **理由がもう別の仕組みで満たされている。** この設定の根拠は
                  「**転職を考えていると今の会社に知られること**」を防ぐことだったが、
                  `can_send_scout()` の条件2・2b が **在籍企業には候補者一覧へそもそも出さない**
                  （`company_id` 一致に加え、**自由入力の社名も `normalize_company_name` で一致**させる）。
                  ⚠️ 社名だけ消すより強い。下の「ブロック中の企業」が
                     「**現在お勤めの会社は自動的に含まれます**」と書いているのがこれ。
               ② **守り切れていなかった。** 企業向けの画面が `visibility_company` を見落とす形の
                  漏れを**1か月で3件**直している（`/biz/employees` 2026-08-13 ／
                  `/biz/candidates` 2026-09-10 ／ `/api/biz/company/members` 2026-09-10）。
                  **既定で漏れる約束**で、企業向けの面が増えるたびに同じ形を踏む。
               ③ **効き目が弱い。** 氏名と顔写真は出るので、相手が本人を知っていれば意味がない。
                  ⚠️ LinkedIn にも「勤務先だけ伏せる」設定は無い。

               ⚠️★**「使われていないから外した」ではない。** 実測は35件すべて `real`（0人）だが、
                  **入口ができたのは 2026-09-11 で4日前**。0件は根拠に使っていない。

               ⚠️ **列・データ・API（`PUT /api/jobseeker/company-visibility`）・読み手は残してある。**
                  畳んだのは入力欄と説明文だけ。`MASKED_COMPANY_LABEL`（「非公開企業」）も
                  `/biz/candidates` が今も参照しているが、**設定できないので描画されない。**
                  ⚠️★**企業ページの「現役社員」から自分を外す手段も、これで無くなった。**
                     必要になったら**別の設定として**作ること（会社名を伏せる話とは別）。 */}
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

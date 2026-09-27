"use client";

import { useEffect, useRef, useState } from "react";
import { type IndustryOption } from "@/lib/companies/industries";
import { IndustrySelectOptions } from "./IndustrySelectOptions";
import type { CompanyLookupResult } from "./useCompanyLookup";
import { companyMatchLabelForUser } from "@/lib/companies/matchedOn";

/**
 * 「会社を登録する」— 経歴入力の途中で企業マスタを作る。
 *
 * ⚠️★**経歴編集とオンボーディングで同じものを使う。** ピッカー本体は
 *    見た目が意図的に違うので共通化していない（`useCompanyLookup` の冒頭を参照）が、
 *    **このダイアログは両方で同じ**。2回書かない。
 *
 * ── ⚠️★入力項目を増やさないこと ────────────────────────────────────────────
 * 聞くのは **会社名と業種の2つだけ**。URL・従業員数・所在地は取らない。
 * ここは職歴を書いている途中に挟まる画面で、項目が増えると入力が止まる
 * （2026-09-02 に「職務経歴書をそのまま入力させるのは負荷が高いのでは」という
 *  指摘が出ている）。**残りは運営が後から埋める前提**。
 *
 * ── なぜ業種だけは必須か ────────────────────────────────────────────────────
 * この入口は**業界マッチのために作る**。業種が無いと `ow_industries` を介した
 * 対象業界との突合に乗らず、作っても `company_text` と同じ結果になる。
 *
 * ── 重複 ──────────────────────────────────────────────────────────────────
 * 作る前に `GET /api/jobseeker/companies?name=` で照会し、候補があれば出す。
 * ⚠️ **選ばなくても作れる。止めない。** 同名の別会社は実在する
 *    （美容室・飲食店・地方の中小企業）。止めると正しい登録まで塞ぐ。
 */
/** `GET /api/jobseeker/companies?name=` が返す重複候補 */
type DuplicateCandidate = CompanyLookupResult & {
  /** どの列で一致したか。⚠️ 実装語なので**そのまま出さない**（`companyMatchLabelForUser` で畳む） */
  matchedOn?: string | null;
};

export function CompanyCreateDialog({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  /** 作成に成功した企業。呼び出し側はこれをそのまま選択済みとして扱う */
  onCreated: (company: CompanyLookupResult) => void;
}) {
  const [name, setName] = useState(initialName);
  const [industryId, setIndustryId] = useState<string>("");
  const [industries, setIndustries] = useState<IndustryOption[] | null>(null);
  const [industriesFailed, setIndustriesFailed] = useState(false);
  /* ★候補には「なぜ出たか」を添える（2026-09-05）。照合が brand_name / name_en /
        search_aliases まで広がったので、**名前が似ていない候補が出る**
        （「ANDPAD」→「株式会社アンドパッド」）。理由が無いと押してよいか分からない。 */
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // 業種の選択肢
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/industries");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { industries?: IndustryOption[] };
        if (!alive) return;
        setIndustries(data.industries ?? []);
      } catch (err) {
        /* ⚠️ 握りつぶさない。空配列にすると「業種が1つも無い」画面になり、
              利用者には壊れていることが分からない。 */
        console.error("[CompanyCreateDialog] 業種の取得に失敗:", err);
        if (alive) setIndustriesFailed(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  /* 重複の照会。⚠️ 名前を打ち替えたら引き直す（最初の1回だけにしない） */
  useEffect(() => {
    const q = name.trim();
    if (q.length < 2) { setCandidates([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/jobseeker/companies?name=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { candidates?: DuplicateCandidate[] };
        if (alive) setCandidates(data.candidates ?? []);
      } catch (err) {
        // ⚠️ 照会できなくても作成は止めない（候補が出ないだけ）。ログには残す
        console.error("[CompanyCreateDialog] 重複照会に失敗:", err);
      }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [name]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || !industryId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/jobseeker/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, industry_id: industryId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        /* ⚠️ 実装語（INVALID_INDUSTRY など）をそのまま出さない。
              message があればそれを、無ければ汎用文言。 */
        setError((data as { message?: string }).message ?? "登録できませんでした。時間をおいて試してください。");
        return;
      }
      onCreated((data as { company: CompanyLookupResult }).company);
    } catch (err) {
      console.error("[CompanyCreateDialog] 作成に失敗:", err);
      setError("通信に失敗しました。時間をおいて試してください。");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = name.trim().length > 0 && !!industryId && !submitting;

  return (
    <div
      style={{
        marginTop: 8, border: "1px solid var(--line)", borderRadius: 12,
        background: "#fff", padding: 16,
      }}
    >
      {/* ⚠️★見出しは「会社を登録する」（2026-09-28 / 柴さんの指示）。
             「この会社を**OPINIOに**登録する」から短くした。
             ⚠️ 開く前のボタンは「「◯◯」をOPINIOに登録する」のままでよい
                ——あちらは**社名が入る**ので、どの会社の話かが文で分かる。 */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
        会社を登録する
      </div>
      {/* ⚠️★**この1文を消さないこと。**「登録」だけだと**企業ページが公開される**と読まれる
             （2026-08-14 にオンボーディングで実際に誤解された）。

          ⚠️★**「あなたの経歴に会社として紐づきます。」は 2026-09-28 に外した**（柴さんの指摘）。
             職歴を書いている途中に社名を打って押すボタンなので、**押せば分かる**。
             `/mypage` の促しから説明文を外したのと同じ理由（2026-08-25）。
             ⚠️ **戻さないこと。** 残す1文とは役割が違う ——こちらは
                「**言わないと誤解される**」ほう。 */}
      <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "4px 0 14px", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--ink-soft)" }}>企業ページはすぐには公開されません</strong>
        （運営が内容を確認します）。
      </p>

      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
        会社名
      </label>
      <input
        ref={nameRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="株式会社〇〇"
        style={{
          width: "100%", padding: "11px 14px", border: "1px solid var(--line)",
          borderRadius: 10, fontSize: 14, fontFamily: "inherit", color: "var(--ink)",
          boxSizing: "border-box", background: "#fff",
        }}
      />

      {/* ★もしかしてこれ？ ——⚠️ 選ばなくても作れる。止めない */}
      {candidates.length > 0 && (
        <div style={{
          marginTop: 10, border: "1px solid var(--line-soft)", borderRadius: 10,
          background: "var(--bg-tint)", padding: "10px 12px",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
            もしかして、この会社ですか？
          </div>
          <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 6 }}>
            {candidates.map((c) => (
              <li key={c.id} style={{ minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => onCreated(c)}
                  style={{
                    width: "100%", textAlign: "left", background: "#fff",
                    border: "1px solid var(--line)", borderRadius: 8,
                    padding: "8px 10px", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <span style={{
                    display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {c.name}
                  </span>
                  {/* ★正式名を小さく添える（2026-09-28）。⚠️ 表示名と違うときだけ。
                         ⚠️★ピッカーの候補行と**同じ形**にしてある。片方だけ変えないこと。 */}
                  {c.formalName && (
                    <span style={{
                      display: "block", fontSize: 11, color: "var(--ink-mute)", marginTop: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {c.formalName}
                    </span>
                  )}
                  {/* ★なぜ候補に出たか。⚠️ 名前で一致したときは出さない
                         （見れば分かるので、当たり前のことを説明する行が増えるだけ）。 */}
                  {companyMatchLabelForUser(c.matchedOn ?? null) && (
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--royal)", marginTop: 1 }}>
                      {companyMatchLabelForUser(c.matchedOn ?? null)}
                    </span>
                  )}
                  {/* ⚠️★**「OPINIOに未掲載（企業ページはありません）」を戻さないこと**
                         （2026-09-14 / 柴さんの指示で削除）。理由は
                         `CareerHistoryEditor` の選択済みカードのコメントに書いてある。
                      ⚠️ このダイアログは**職歴エディタとオンボーディングの両方**から使われる。
                         **3箇所とも消してあるので、ここだけ戻さない。** */}
                </button>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 11.5, color: "var(--ink-mute)", margin: "8px 0 0", lineHeight: 1.7 }}>
            違う会社なら、そのまま下から登録してください。
          </p>
        </div>
      )}

      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", margin: "14px 0 6px" }}>
        業種
      </label>
      {industriesFailed ? (
        /* ⚠️ 「選択肢が0件」として黙って出さない。取得に失敗したと言い切る */
        <p role="alert" style={{ fontSize: 12, color: "var(--danger-ink, #991B1B)", lineHeight: 1.7 }}>
          業種の取得に失敗しました。画面を再読み込みしてください。
        </p>
      ) : industries === null ? (
        <p style={{ fontSize: 12, color: "var(--ink-mute)" }}>読み込み中…</p>
      ) : (
        /* ★★`select` 1つにする（2026-09-28 / 柴さんの指示。「縦に長すぎる」）。
              ⚠️★**縦リストに戻さないこと。** 2026-09-05 は大分類18件の縦リスト、
                 2026-09-20 に小分類をアコーディオンで畳んだが、**それでも長すぎた**
                 ——畳んでも**大分類18行が常に出る**ので、縦は縮まっていなかった。

              ── 実測（2026-09-28 / `/dev/preview/company-create` のダイアログ1枚）──
              ⚠️ **実ページとの絶対値の比較ではない**（preview の本文幅は最大980px）。
                 見るのは**前後の差**。375px は実ページとほぼ同じ幅になる。

              | | 375px | 1440px |
              |---|---|---|
              | 前（縦リスト＋アコーディオン） | **1,304px**（1.61画面） | 1,190px |
              | 後（この `select`） | **353px**（0.43画面） | 312px |

              ⚠️★375px では「この内容で登録する」が**ダイアログ上端から 1,241px 下**にあり、
                 **スクロールしないと押せなかった。** これが指摘の実体。

              ⚠️★**他の3画面（`/biz/companies/add/new` `/biz/company` `/admin`）は
                 最初から `select` ＋ `IndustrySelectOptions`。ここだけ違っていた。**
                 同じものを4画面で使う（`IndustrySelectOptions` の冒頭がそう書いている）。
              ⚠️ **親も選べる**（`optgroup` のラベルは選べないので、
                 グループ先頭に親自身の option が入っている）。分からない人は
                 「製造業」のままで進められる。この仕様は 2026-09-05 から変えていない。
                 実測（同日）: option 52件＝空の1件 ＋ 業種51件。うち大分類は
                 **optgroup 7 ＋ 素の option 11 ＝ 18件**で、どれも選べる。 */
        <>
          <select
            value={industryId}
            onChange={(e) => setIndustryId(e.target.value)}
            style={{
              width: "100%", padding: "11px 14px", border: "1px solid var(--line)",
              borderRadius: 10, fontSize: 14, fontFamily: "inherit", color: "var(--ink)",
              boxSizing: "border-box", background: "#fff",
            }}
          >
            <option value="">選択してください</option>
            <IndustrySelectOptions options={industries} />
          </select>

          {/* ★迷いやすい業種にだけ付いている説明（マスタの `description`）を、
                 **選んだものだけ**1行で出す。
                 ⚠️★全件ぶん常に出すと、それだけで縦が伸びる（それが長さの一因だった）。
                 ⚠️ `description` が無い業種では**行ごと出さない**。「—」を出さない。 */}
          {(() => {
            const d = industries.find((o) => o.id === industryId)?.description;
            if (!d) return null;
            return (
              <p style={{ fontSize: 11.5, color: "var(--ink-mute)", margin: "6px 0 0", lineHeight: 1.6 }}>
                {d}
              </p>
            );
          })()}
        </>
      )}

      {error && (
        <p role="alert" style={{
          fontSize: 12, color: "#991B1B", background: "#FEE2E2",
          border: "1px solid #FCA5A5", borderRadius: 8, padding: "8px 10px",
          marginTop: 12, lineHeight: 1.7,
        }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            flex: 1, padding: "11px 16px", borderRadius: 10, border: "none",
            background: canSubmit ? "var(--royal)" : "var(--line)",
            color: canSubmit ? "#fff" : "var(--ink-mute)",
            fontSize: 13, fontWeight: 700, fontFamily: "inherit",
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {submitting ? "登録中…" : "この内容で登録する"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "11px 16px", borderRadius: 10, border: "1px solid var(--line)",
            background: "#fff", color: "var(--ink-soft)", fontSize: 13, fontWeight: 600,
            fontFamily: "inherit", cursor: "pointer",
          }}
        >
          やめる
        </button>
      </div>
    </div>
  );
}

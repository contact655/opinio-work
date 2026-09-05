"use client";

import { useEffect, useRef, useState } from "react";
import type { IndustryOption } from "@/lib/companies/industries";
import type { CompanyLookupResult } from "./useCompanyLookup";
import { companyMatchLabelForUser } from "@/lib/companies/matchedOn";

/**
 * 「この会社をOPINIOに登録する」— 経歴入力の途中で企業マスタを作る。
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
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
        この会社をOPINIOに登録する
      </div>
      {/* ⚠️ 何が起きるかを先に言う。「登録」だけだと企業ページが公開されると読まれる
             （2026-08-14 にオンボーディングで実際に誤解された）。 */}
      <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "4px 0 14px", lineHeight: 1.7 }}>
        あなたの経歴に会社として紐づきます。
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
                  {/* ⚠️ lookup と同じ文言にする。ここだけ別の言い方にしない */}
                  {/* ★なぜ候補に出たか。⚠️ 名前で一致したときは出さない
                         （見れば分かるので、当たり前のことを説明する行が増えるだけ）。 */}
                  {companyMatchLabelForUser(c.matchedOn ?? null) && (
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--royal)", marginTop: 1 }}>
                      {companyMatchLabelForUser(c.matchedOn ?? null)}
                    </span>
                  )}
                  {!c.isListed && (
                    <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-mute)", marginTop: 1 }}>
                      OPINIOに未掲載（企業ページはありません）
                    </span>
                  )}
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
        <div style={{ display: "grid", gap: 6 }}>
          {industries.map((i) => {
            const active = industryId === i.id;
            return (
              <button
                key={i.id}
                type="button"
                aria-pressed={active}
                onClick={() => setIndustryId(i.id)}
                style={{
                  width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  padding: "9px 12px", borderRadius: 8,
                  border: active ? "2px solid var(--royal)" : "1px solid var(--line)",
                  background: active ? "var(--royal-50)" : "#fff",
                }}
              >
                <span style={{
                  display: "block", fontSize: 13, fontWeight: 600,
                  color: active ? "var(--royal)" : "var(--ink)",
                }}>
                  {i.name}
                </span>
                {/* ★迷いやすい組にだけ説明が付く（マスタの description）。
                       ⚠️ null のときは行ごと出さない。「—」を出さない */}
                {i.description && (
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--ink-mute)", marginTop: 2, lineHeight: 1.6 }}>
                    {i.description}
                  </span>
                )}
              </button>
            );
          })}
        </div>
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

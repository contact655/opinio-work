"use client";

import { useEffect, useRef, useState } from "react";
import { flattenIndustryOptions, type IndustryOption } from "@/lib/companies/industries";
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
  /* ★★小分類の開閉（2026-09-20 / 柴さんの指示）。**初期は全部閉じる。**
     ⚠️★**「選択」と「開閉」を同じタップにしない。**
        行そのものを押す＝その大分類を選ぶ（分からない人は親のままで進める。
        この仕様は 2026-09-05 から変えていない）。
        右端の ∨ を押す＝開閉。同じ場所を押して意味が2つあると、
        「選んだつもりが開いただけ」になる。
     ⚠️ 小分類を持たない大分類には ∨ を出さない（押せない印を出さない）。
     ⚠️ **選択済みの小分類がある大分類は開いた状態で描く**（下の `openParents`）。
        選んだものが畳まれて見えないと、何を選んだか分からなくなる。 */
  const [openParents, setOpenParents] = useState<Set<string>>(new Set());
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
        /* ⚠️ 2階層（製造業）。**親も選べる**（分からない人は「製造業」のままで進める）。
              ⚠️ `display_order` は**親ごとの相対順**なので `flattenIndustryOptions` を通す。
                 通さないと親子が混ざる。
              ⚠️ 子は左に余白を付け、親の名前を小さく添える。チップだけだと
                 「製造業」と「電機・機械」が対等に見える。 */
        <div style={{ display: "grid", gap: 6 }}>
          {(() => {
            /* ★選んだ小分類の親は開いておく（2026-09-20）。
                  ⚠️ state を触らずここで足す。state に書くと「閉じたのに
                     再描画で開き直す」形になり、閉じられなくなる。 */
            const selected = industries.find((o) => o.id === industryId);
            const forceOpen = selected?.parent_id ?? null;
            const isOpen = (parentId: string) =>
              openParents.has(parentId) || forceOpen === parentId;
            const hasChildren = (parentId: string) =>
              industries.some((o) => o.parent_id === parentId);

            return flattenIndustryOptions(industries)
              /* ★閉じている親の子は描かない。**これがアコーディオンの本体。**
                    ⚠️ 実測（2026-09-20 / 375px）: 全部出すと業種リストだけで
                       **1,305px＝画面1.6枚分**、小分類を足した後は約4枚分になる。
                       畳まないと選ぶ前にスクロールで力尽きる。 */
              .filter((i) => !i.parent_id || isOpen(i.parent_id))
              .map((i) => {
            const active = industryId === i.id;
            const showToggle = !i.parent_id && hasChildren(i.id);
            return (
              <div key={i.id} style={{ display: "flex", alignItems: "stretch", gap: 6,
                marginLeft: i.parent_id ? 16 : 0 }}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setIndustryId(i.id)}
                style={{
                  flex: 1, minWidth: 0,
                  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  padding: "9px 12px", borderRadius: 8,
                  border: active ? "2px solid var(--royal)" : "1px solid var(--line)",
                  background: active ? "var(--royal-50)" : "#fff",
                }}
              >
                {i.parent_id && (
                  <span style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.3 }}>
                    {industries.find((p) => p.id === i.parent_id)?.name ?? ""}
                  </span>
                )}
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

              {/* ★開閉（2026-09-20）。⚠️★**行の選択とは別のボタンにする。**
                     ⚠️ 小分類が無い大分類には出さない（押せない印を出さない）。
                     ⚠️ `aria-expanded` を付ける。読み上げで「開いているか」が分かる。 */}
              {showToggle && (
                <button
                  type="button"
                  aria-expanded={isOpen(i.id)}
                  aria-label={`${i.name}の小分類を${isOpen(i.id) ? "閉じる" : "開く"}`}
                  onClick={() => setOpenParents((prev) => {
                    const next = new Set(prev);
                    /* ⚠️ `forceOpen`（選択中の親）を閉じられるようにするため、
                          「開いている集合」ではなく**この親の状態**で分岐する。 */
                    if (isOpen(i.id)) next.delete(i.id); else next.add(i.id);
                    return next;
                  })}
                  style={{
                    flexShrink: 0, width: 40, cursor: "pointer", fontFamily: "inherit",
                    borderRadius: 8, border: "1px solid var(--line)", background: "#fff",
                    color: "var(--ink-mute)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    style={{ transform: isOpen(i.id) ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}
              </div>
            );
              });
          })()}
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

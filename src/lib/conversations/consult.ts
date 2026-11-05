/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripLegalSuffix } from "@/lib/companies/displayName";
import {
  CAREER_GENERAL_OPTION,
  consultSummary,
  parseConsultInput,
  type ConsultAboutOption,
  type ConsultPayload,
} from "@/lib/constants/careerConsult";

/**
 * ★キャリア相談の「聞きたい話」の選択肢と、送られてきた相談の確かめ（2026-11-05）。
 *   書く画面（GET /api/dm/start・GET /api/dm/consult-options）と、送るときの確かめ（POST /api/dm/start・/api/dm/message）が
 *   **同じ関数**を見る。条件を書き写さないこと。
 *
 * - 選択肢は相手の職歴の会社（会社名を出している職歴だけ。プロフィールで見える社名と同じ条件）＋「キャリア全般」
 * - 会社マスタの会社は会社ごとに1つ、自由入力の会社は職歴ごとに1つ。いまの勤務先が先、あとは入社が新しい順
 * - ⚠️ 職歴が無い相手は「キャリア全般」だけ
 * - ⚠️ 取得に失敗したら null（呼び出し側は止める。選択肢を黙って減らさない）
 */
export async function consultAboutOptions(recipientId: string): Promise<ConsultAboutOption[] | null> {
  const { data, error } = await createAdminClient()
    .from("ow_experiences")
    .select("id, company_id, company_text, started_at, ended_at, is_current, visibility_company, ow_companies!company_id(name)")
    .eq("user_id", recipientId)
    .order("started_at", { ascending: false, nullsFirst: false });
  if (error) {
    console.error("[consult] experiences:", error.message);
    return null;
  }
  type Row = { id: string; company_id: string | null; company_text: string | null; started_at: string | null; ended_at: string | null; is_current: boolean; visibility_company: string | null; ow_companies: { name: string } | null };
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.visibility_company === "real");

  type Acc = { key: string; companyId: string | null; label: string; isCurrent: boolean; from: string | null; to: string | null; latest: string; experienceIds: string[] };
  const byKey = new Map<string, Acc>();
  for (const r of rows) {
    const name = r.ow_companies?.name ? (stripLegalSuffix(r.ow_companies.name) || r.ow_companies.name) : (r.company_text?.trim() || null);
    if (!name) continue;
    const key = r.company_id ? `company:${r.company_id}` : `exp:${r.id}`;
    const from = r.started_at ? r.started_at.slice(0, 4) : null;
    const to = r.is_current ? null : (r.ended_at ? r.ended_at.slice(0, 4) : null);
    const cur = byKey.get(key);
    if (!cur) {
      byKey.set(key, { key, companyId: r.company_id, label: name, isCurrent: r.is_current, from, to, latest: r.started_at ?? "", experienceIds: [r.id] });
      continue;
    }
    cur.experienceIds.push(r.id);
    cur.isCurrent = cur.isCurrent || r.is_current;
    if (from && (!cur.from || from < cur.from)) cur.from = from;
    if (!r.is_current && to && (!cur.to || to > cur.to)) cur.to = to;
    if ((r.started_at ?? "") > cur.latest) cur.latest = r.started_at ?? "";
  }
  const companies: ConsultAboutOption[] = Array.from(byKey.values())
    .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.latest.localeCompare(a.latest))
    .map((c) => ({
      key: c.key, kind: "company", companyId: c.companyId, label: c.label,
      period: c.isCurrent ? "いま" : c.from || c.to ? `${c.from ?? ""}〜${c.to ?? ""}` : null,
      experienceIds: c.experienceIds,
    }));
  return [...companies, CAREER_GENERAL_OPTION];
}

/** 送るメッセージの列（相談でなければ空） */
export type ConsultColumns = { kind: "consult"; payload: ConsultPayload };

/**
 * 送られてきた相談を確かめて、メッセージの行にする（body は代わりの文・payload が中身）。
 * ⚠️ 不正な値は 400（黙って捨てない）。選択肢は相手ごとに作り直す（画面の申告を信じない）
 */
export async function resolveConsult(recipientId: string, raw: unknown):
  Promise<{ ok: true; body: string; cols: ConsultColumns } | { ok: false; status: number; error: string }> {
  const options = await consultAboutOptions(recipientId);
  if (!options) return { ok: false, status: 500, error: "送信に失敗しました。時間をおいて、もう一度お試しください" };
  const r = parseConsultInput(raw, options);
  if (!r.ok) return { ok: false, status: 400, error: r.message };
  return { ok: true, body: consultSummary(r.payload), cols: { kind: "consult", payload: r.payload } };
}

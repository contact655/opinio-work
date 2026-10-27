/* ★サーバー専用。admin クライアントを使う */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows, inChunks } from "@/lib/supabase/paging";
import { buildMoves, type TransitionExperience } from "@/lib/evidence/transitions";
import { AGGREGATE_USER_COLUMNS, isAggregatableUser, type AggregateUser } from "@/lib/aggregate/population";
import { MIN_AGGREGATE_COUNT } from "@/lib/constants/aggregate";
import { companyDisplayName } from "@/lib/companies/displayName";
import { flowLine, type CompanyContactItem } from "@/lib/business/candidates/candidateGroups";

/**
 * ★候補者を探すの「自社との接点」（2026-10-28 / 柴さんの指示）。**この欄の中身はこの関数だけが作る。**
 *   ① 元社員 … 本人の職歴にこの会社がある（社名を伏せていない職歴だけ）
 *   ② 「話を聞いてみたい」をこの会社に送っている（企業に届いたものだけ: delivered / replied / no_reply）
 *   ③ 人の流れ … 本人の今の（無ければ直前の）会社から、この会社に入社した人が5人以上いる
 *        「〇〇から御社に入社した人 N人」
 * ⚠️ ③の人数は isAggregatableUser の人だけ（検証用・非公開・統計利用を停止した人などは数えない）。下限は MIN_AGGREGATE_COUNT。
 * ⚠️ 検証用と実在を混ぜない: 検証用の会社には③を出さない（数えるのは実在の人だけなので、検証用の会社には実在の数を見せない）。
 *    ①②は見ている候補者本人の記録なので、一覧が見せてよい人（load.ts が is_test をそろえた人）だけに付く。
 * ⚠️ 保存（ブックマーク）は出さない（ポリシーの案で、保存は企業に何も渡さないと決めている）。
 * ⚠️ 取得に失敗したら null（画面は「—」。「なし」と言わない）。
 */

type Exp = TransitionExperience & { visibility_company: string | null };
const EXP_COLS = "id, user_id, company_id, company_text, role_category_id, started_at, ended_at, is_current, visibility_company" as const;
/** 企業に届いた「話を聞いてみたい」の状態（awaiting_contact は企業に届いていない・expired は取り下げ） */
const INTEREST_REACHED = ["delivered", "replied", "no_reply"];

/** 会社の同一性（transitions.ts の companyKey と同じ規則: マスタは id、自由入力は正規化した社名） */
function keyOf(companyId: string | null, text: string | null): string | null {
  if (companyId) return companyId;
  const t = text?.trim().toLowerCase();
  return t || null;
}

export async function getCompanyContacts(params: {
  companyId: string;
  companyIsTest: boolean;
  candidateIds: string[];
}): Promise<Map<string, CompanyContactItem[]> | null> {
  const { companyId, companyIsTest, candidateIds } = params;
  const out = new Map<string, CompanyContactItem[]>(candidateIds.map((id) => [id, []]));
  if (candidateIds.length === 0) return out;
  const db = createAdminClient();

  const [candExpR, interestR, intoR] = await Promise.all([
    /* 候補者の職歴（社名を伏せていないものだけ。①と③の起点に使う） */
    inChunks(candidateIds, (part, from, to) => db.from("ow_experiences").select(EXP_COLS)
      .in("user_id", part).eq("visibility_company", "real").order("id").range(from, to), "contacts candidate exps"),
    inChunks(candidateIds, (part, from, to) => db.from("ow_for_you_reactions").select("user_id")
      .eq("company_id", companyId).in("user_id", part).in("interest_status", INTEREST_REACHED).order("user_id").range(from, to), "contacts interest"),
    /* ③ この会社の職歴を持つ人（入社した人の候補）。検証用の会社では数えない */
    companyIsTest ? Promise.resolve({ data: [] as { user_id: string }[], error: null })
      /* ⚠️ 1,000 行で黙って切れないよう最後まで読む */
      : fetchAllRows((from, to) => db.from("ow_experiences").select("user_id").eq("company_id", companyId).eq("visibility_company", "real").order("id").range(from, to), "contacts joiners exps"),
  ]);
  if (candExpR.error || interestR.error || intoR.error) {
    console.error("[companyContacts] 取得:", candExpR.error ?? interestR.error ?? intoR.error);
    return null;
  }
  const candExps = (candExpR.data ?? []) as unknown as Exp[];

  // ① 元社員
  for (const e of candExps) {
    if (e.company_id === companyId) {
      const list = out.get(e.user_id);
      if (list && !list.some((x) => x.kind === "alumni")) list.push({ kind: "alumni", text: "元社員（職歴にこの会社があります）" });
    }
  }
  // ② 「話を聞いてみたい」
  for (const r of (interestR.data ?? []) as { user_id: string }[]) {
    out.get(r.user_id)?.push({ kind: "interest", text: "「話を聞いてみたい」を御社に送っています" });
  }

  // ③ 人の流れ
  if (!companyIsTest) {
    const joinerIds = Array.from(new Set(((intoR.data ?? []) as { user_id: string }[]).map((r) => r.user_id)));
    if (joinerIds.length > 0) {
      const { data: users, error: uErr } = await inChunks(joinerIds, (part, from, to) =>
        db.from("ow_users").select(`id, ${AGGREGATE_USER_COLUMNS}`).in("id", part).order("id").range(from, to), "contacts joiners");
      if (uErr) { console.error("[companyContacts] 入社した人:", uErr); return null; }
      const agg = ((users ?? []) as unknown as (AggregateUser & { id: string })[]).filter(isAggregatableUser).map((u) => u.id);
      if (agg.length > 0) {
        const { data: rows, error: eErr } = await inChunks(agg, (part, from, to) =>
          db.from("ow_experiences").select(EXP_COLS).in("user_id", part).order("id").range(from, to), "contacts joiner exps");
        if (eErr) { console.error("[companyContacts] 入社した人の職歴:", eErr); return null; }
        /* ⚠️ 社名を伏せた職歴は「どの会社か分からない」行にする（前後をつなぎ替えて別の会社から来たことにしない） */
        const masked = ((rows ?? []) as unknown as Exp[]).filter((e) => !!e.started_at).map((e) => (e.visibility_company === "real" ? e
          : { ...e, company_id: null, company_text: null }));
        const fromCount = new Map<string, Set<string>>();
        for (const m of buildMoves(masked)) {
          if (m.toCompanyId !== companyId) continue;
          const k = keyOf(m.fromCompanyId, m.fromCompanyText);
          if (!k) continue;
          if (!fromCount.has(k)) fromCount.set(k, new Set());
          fromCount.get(k)!.add(m.userId);
        }
        /* 候補者ごとの起点: 今の会社（現職）→ 無ければ直前の会社（いちばん新しく終わった職歴） */
        const baseByCand = new Map<string, { key: string; companyId: string | null; text: string | null }>();
        const byUser = new Map<string, Exp[]>();
        for (const e of candExps) { if (!byUser.has(e.user_id)) byUser.set(e.user_id, []); byUser.get(e.user_id)!.push(e); }
        for (const [uid, list] of Array.from(byUser.entries())) {
          const cur = list.find((e) => e.is_current && keyOf(e.company_id, e.company_text));
          const prev = cur ? null : [...list].filter((e) => !e.is_current && keyOf(e.company_id, e.company_text))
            .sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""))[0];
          const base = cur ?? prev;
          if (base && base.company_id !== companyId) {
            baseByCand.set(uid, { key: keyOf(base.company_id, base.company_text)!, companyId: base.company_id, text: base.company_text });
          }
        }
        const needNames = Array.from(new Set(Array.from(baseByCand.values())
          .filter((b) => b.companyId && (fromCount.get(b.key)?.size ?? 0) >= MIN_AGGREGATE_COUNT).map((b) => b.companyId as string)));
        const names = new Map<string, string>();
        if (needNames.length > 0) {
          const { data: cos, error: cErr } = await db.from("ow_companies").select("id, name, name_en").in("id", needNames);
          if (cErr) console.error("[companyContacts] 社名:", cErr.message);
          for (const c of cos ?? []) names.set(c.id as string, companyDisplayName(c.name as string, (c.name_en as string | null) ?? null).displayName);
        }
        for (const [uid, b] of Array.from(baseByCand.entries())) {
          const name = b.companyId ? names.get(b.companyId) ?? null : (b.text?.trim() || null);
          const line = flowLine(name, fromCount.get(b.key)?.size ?? 0, MIN_AGGREGATE_COUNT);
          if (line) out.get(uid)?.push({ kind: "flow", text: line });
        }
      }
    }
  }
  return out;
}

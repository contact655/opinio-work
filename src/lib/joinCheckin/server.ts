import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateAllowNone, mutateOne } from "@/lib/supabase/mutate";
import { companyBrandName } from "@/lib/companies/displayName";
import { companyKey, oldest, type ExpRow } from "@/lib/experiences/reasonAnswers";
import { loadMasters, type ReviewMasters } from "@/lib/workplaceReview/server";
import { computeTendency, type Tendency, type TendencyReview } from "@/lib/workplaceReview/tendency";
import {
  CHECKIN_GAP_KEYS, JOIN_CHECKPOINTS, canAnswerCheckpoint, checkpointOf, dueCheckpoint, latestAnsweredCheckpoint,
  type CheckinAnswers, type CheckinStatus, type CheckpointKey,
} from "./constants";

/**
 * ★入社後のふり返り（入社3か月・1年）の読み書き（2026-11-20）。API はここだけを呼ぶ。
 *
 * ⚠️★本人確認は呼び出し側が `requireOwnExperience` で済ませてから呼ぶこと。ここでも user_id で絞る。
 * ⚠️★表 ow_join_checkins / ow_join_checkin_axes は anon / authenticated に権限が無い（service role だけ）。
 * ⚠️ 単位 = その会社に入った職歴1件（同じ会社の職歴のうち、いちばん古い行）× 時点。入社の決め手と同じ単位。
 *    入社からの月数も、そのいちばん古い行の開始日（＝その会社に入った日）で数える。
 * ⚠️★個人の回答は本人にしか返さない。会社・他の利用者に出す画面・API を作らないこと。
 */

const EXP_COLS =
  "id, user_id, company_id, company_text, company_anonymized, started_at, ended_at, is_current, join_reasons, join_reason_primary, leave_reasons" as const;

type CheckinRow = {
  experience_id: string;
  checkpoint: CheckpointKey;
  fit_score: number | null;
  gap_job: number | null; gap_pay: number | null; gap_growth: number | null; gap_culture: number | null;
  customer: string | null;
  answered_at: string | null;
  skipped_at: string | null;
  updated_at: string;
};
const CHECKIN_COLS =
  "experience_id, checkpoint, fit_score, gap_job, gap_pay, gap_growth, gap_culture, customer, answered_at, skipped_at, updated_at" as const;

function statusOf(r: CheckinRow | undefined): CheckinStatus {
  if (!r) return "none";
  if (r.answered_at && r.fit_score !== null) return "answered";
  if (r.skipped_at) return "skipped";
  return "none";
}

async function userRows(owUserId: string): Promise<ExpRow[] | null> {
  const { data, error } = await createAdminClient().from("ow_experiences").select(EXP_COLS).eq("user_id", owUserId);
  if (error) { console.error("[joinCheckin] experiences:", error.message); return null; }
  return (data ?? []) as ExpRow[];
}

/** 同じ会社の行（役割）をまとめる。anchor = いちばん古い行、isCurrent = どれか1つでも現職 */
function companyGroups(all: ExpRow[]): { anchor: ExpRow; rows: ExpRow[]; isCurrent: boolean }[] {
  const byKey = new Map<string, ExpRow[]>();
  for (const r of all) {
    const k = companyKey(r);
    byKey.set(k, [...(byKey.get(k) ?? []), r]);
  }
  return Array.from(byKey.values()).map((rows) => ({ anchor: oldest(rows), rows, isCurrent: rows.some((r) => r.is_current) }));
}

async function loadRows(owUserId: string, anchorIds: string[]): Promise<CheckinRow[] | null> {
  if (anchorIds.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("ow_join_checkins").select(CHECKIN_COLS).eq("user_id", owUserId).in("experience_id", anchorIds);
  if (error) { console.error("[joinCheckin] checkins:", error.message); return null; }
  return (data ?? []) as CheckinRow[];
}

function statesFor(rows: CheckinRow[], anchorId: string): Partial<Record<CheckpointKey, CheckinStatus>> {
  const out: Partial<Record<CheckpointKey, CheckinStatus>> = {};
  for (const cp of JOIN_CHECKPOINTS) out[cp.key] = statusOf(rows.find((r) => r.experience_id === anchorId && r.checkpoint === cp.key));
  return out;
}

export type LoadedCheckin = {
  anchorId: string;
  checkpoint: CheckpointKey;
  status: CheckinStatus;
  /** その時点に答えてよいか（入社からその月数がたっている） */
  canAnswer: boolean;
  /** 答えてあれば中身。無ければ null */
  answers: CheckinAnswers | null;
  masters: Pick<ReviewMasters, "axes">;
};

/**
 * ★開いたときの初期値。checkpoint を渡さなければ「いま聞くべき時点」、それも無ければ答えられる中でいちばん新しい時点。
 *   どの時点にも答えられない（入社から3か月たっていない）ときは 3m を返し、canAnswer = false。
 */
export async function loadCheckin(owUserId: string, base: ExpRow, checkpoint?: CheckpointKey): Promise<LoadedCheckin | null> {
  const [all, masters] = await Promise.all([userRows(owUserId), loadMasters()]);
  if (!all || all.length === 0 || !masters) return null;
  const key = companyKey(base);
  const group = companyGroups(all).find((g) => companyKey(g.anchor) === key);
  if (!group) return null;
  const rows = await loadRows(owUserId, [group.anchor.id]);
  if (!rows) return null;
  const states = statesFor(rows, group.anchor.id);

  const startedAt = group.anchor.started_at;
  const cp: CheckpointKey = checkpoint
    ?? dueCheckpoint({ startedAt, isCurrent: group.isCurrent, states })
    ?? (JOIN_CHECKPOINTS.slice().reverse().find((c) => canAnswerCheckpoint(c.key, startedAt))?.key ?? "3m");

  const row = rows.find((r) => r.checkpoint === cp);
  const status = statusOf(row);
  let answers: CheckinAnswers | null = null;
  if (status === "answered" && row) {
    const { data, error } = await createAdminClient()
      .from("ow_join_checkin_axes").select("axis_key, value").eq("experience_id", group.anchor.id).eq("checkpoint", cp);
    if (error) { console.error("[joinCheckin] axes:", error.message); return null; }
    answers = {
      fitScore: row.fit_score as number,
      gaps: { gap_job: row.gap_job as number, gap_pay: row.gap_pay as number, gap_growth: row.gap_growth as number, gap_culture: row.gap_culture as number },
      axes: Object.fromEntries(((data ?? []) as { axis_key: string; value: number }[]).map((x) => [x.axis_key, x.value])),
      customer: row.customer,
    };
  }
  return { anchorId: group.anchor.id, checkpoint: cp, status, canAnswer: canAnswerCheckpoint(cp, startedAt), answers, masters: { axes: masters.axes } };
}

type WriteResult = { ok: true; anchorId: string } | { ok: false; status: 400 | 500; error: string };

async function anchorFor(owUserId: string, base: ExpRow): Promise<ExpRow | null> {
  const all = await userRows(owUserId);
  if (!all || all.length === 0) return null;
  const key = companyKey(base);
  return companyGroups(all).find((g) => companyKey(g.anchor) === key)?.anchor ?? null;
}

/**
 * ★答える。answered_at を必ず入れる。答えたら「今回は答えない」の記録は消す。
 * ⚠️ 軸はマスタにある有効な key だけを受ける。⚠️ 入社からその月数がたっていなければ 400
 */
export async function saveCheckin(owUserId: string, base: ExpRow, checkpoint: CheckpointKey, a: CheckinAnswers): Promise<WriteResult> {
  const [anchor, masters] = await Promise.all([anchorFor(owUserId, base), loadMasters()]);
  if (!anchor || !masters) return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" };
  if (!canAnswerCheckpoint(checkpoint, anchor.started_at)) {
    return { ok: false, status: 400, error: `${checkpointOf(checkpoint).label}のふり返りは、入社からその期間がたってから答えられます。` };
  }
  const axisKeys = new Set(masters.axes.map((x) => x.key));
  if (Object.keys(a.axes).some((k) => !axisKeys.has(k))) return { ok: false, status: 400, error: "「どちら寄りか」の回答が正しくありません。" };

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const up = await mutateOne(
    admin.from("ow_join_checkins").upsert({
      experience_id: anchor.id,
      checkpoint,
      user_id: owUserId,
      fit_score: a.fitScore,
      ...Object.fromEntries(CHECKIN_GAP_KEYS.map((k) => [k, a.gaps[k]])),
      customer: a.customer,
      answered_at: now,
      skipped_at: null,
      updated_at: now,
    }, { onConflict: "experience_id,checkpoint" }),
    "join checkin 保存",
    { returning: "experience_id" },
  );
  if (!up.ok) return { ok: false, status: 500, error: "保存に失敗しました。もう一度お試しください。" };

  /* 軸は入れ替え。⚠️ 消してから入れる。失敗したらその旨を返す（黙って成功にしない） */
  let m = await mutateAllowNone(
    admin.from("ow_join_checkin_axes").delete().eq("experience_id", anchor.id).eq("checkpoint", checkpoint),
    "join checkin 軸の掃除", { returning: "axis_key" },
  );
  if (!m.ok) return { ok: false, status: 500, error: "「どちら寄りか」の保存に失敗しました。" };
  const axes = Object.entries(a.axes);
  if (axes.length > 0) {
    m = await mutateAllowNone(
      admin.from("ow_join_checkin_axes").insert(axes.map(([axis_key, value]) => ({ experience_id: anchor.id, checkpoint, axis_key, value }))),
      "join checkin 軸", { returning: "axis_key" },
    );
    if (!m.ok) return { ok: false, status: 500, error: "「どちら寄りか」の保存に失敗しました。" };
  }
  return { ok: true, anchorId: anchor.id };
}

/** ★「今回は答えない」。⚠️ 答えてある行には何もしない（回答を消さない）。その時点はもう聞かない */
export async function skipCheckin(owUserId: string, base: ExpRow, checkpoint: CheckpointKey): Promise<WriteResult> {
  const anchor = await anchorFor(owUserId, base);
  if (!anchor) return { ok: false, status: 500, error: "取得に失敗しました" };
  const rows = await loadRows(owUserId, [anchor.id]);
  if (!rows) return { ok: false, status: 500, error: "取得に失敗しました" };
  if (statusOf(rows.find((r) => r.checkpoint === checkpoint)) === "answered") return { ok: true, anchorId: anchor.id };
  const now = new Date().toISOString();
  const r = await mutateOne(
    createAdminClient().from("ow_join_checkins").upsert(
      { experience_id: anchor.id, checkpoint, user_id: owUserId, skipped_at: now, updated_at: now },
      { onConflict: "experience_id,checkpoint" },
    ),
    "join checkin 答えない",
    { returning: "experience_id" },
  );
  if (!r.ok) return { ok: false, status: 500, error: r.error };
  return { ok: true, anchorId: anchor.id };
}

/**
 * ★ホームで聞くか。在籍中の会社のうち、いま聞くべき時点があるものを1つ返す（入社が新しい会社を先に）。
 *   ⚠️ 失敗・該当なしは null（ホームはカードを出さない）
 */
export async function currentCheckinPrompt(
  owUserId: string,
  now: Date = new Date(),
): Promise<{ experienceId: string; checkpoint: CheckpointKey } | null> {
  const all = await userRows(owUserId);
  if (!all) return null;
  const groups = companyGroups(all).filter((g) => g.isCurrent);
  if (groups.length === 0) return null;
  const rows = await loadRows(owUserId, groups.map((g) => g.anchor.id));
  if (!rows) return null;
  const sorted = groups.slice().sort((a, b) => (b.anchor.started_at ?? "").localeCompare(a.anchor.started_at ?? ""));
  for (const g of sorted) {
    const cp = dueCheckpoint({ startedAt: g.anchor.started_at, isCurrent: true, states: statesFor(rows, g.anchor.id) }, now);
    if (cp) return { experienceId: g.anchor.id, checkpoint: cp };
  }
  return null;
}

/**
 * ★本人の「あなたが合う職場の傾向」。⚠️★本人のふり返りだけを読む（user_id で絞る）。他人・他社の回答は使わない。
 *   1社につき新しい時点（1年 → 3か月）の回答を1つ使う。物差しは入社後レビューと同じなので computeTendency に渡せる。
 */
export async function loadCheckinTendency(owUserId: string): Promise<Tendency | null> {
  const admin = createAdminClient();
  const [masters, revs] = await Promise.all([
    loadMasters(),
    admin.from("ow_join_checkins").select(CHECKIN_COLS).eq("user_id", owUserId).not("answered_at", "is", null),
  ]);
  if (!masters || revs.error) { if (revs.error) console.error("[joinCheckin] tendency:", revs.error.message); return null; }
  const rows = (revs.data ?? []) as CheckinRow[];
  if (rows.length === 0) return computeTendency([], masters.axes);

  const anchors = Array.from(new Set(rows.map((r) => r.experience_id)));
  const picked = anchors
    .map((id) => ({ id, cp: latestAnsweredCheckpoint(statesFor(rows, id)) }))
    .filter((x): x is { id: string; cp: CheckpointKey } => x.cp !== null)
    .map((x) => rows.find((r) => r.experience_id === x.id && r.checkpoint === x.cp)!);

  const [ax, exps] = await Promise.all([
    admin.from("ow_join_checkin_axes").select("experience_id, checkpoint, axis_key, value").in("experience_id", anchors),
    admin.from("ow_experiences").select("id, company_text, ow_companies!company_id(name, name_en, brand_name)").eq("user_id", owUserId).in("id", anchors),
  ]);
  if (ax.error || exps.error) { console.error("[joinCheckin] tendency children:", ax.error?.message ?? exps.error?.message); return null; }
  const nameById = new Map(((exps.data ?? []) as unknown as { id: string; company_text: string | null; ow_companies: { name: string; name_en: string | null; brand_name: string | null } | null }[])
    .map((e) => [e.id, e.ow_companies ? companyBrandName(e.ow_companies) : (e.company_text ?? "")]));
  const axesOf = (id: string, cp: CheckpointKey) => Object.fromEntries(
    ((ax.data ?? []) as { experience_id: string; checkpoint: string; axis_key: string; value: number }[])
      .filter((x) => x.experience_id === id && x.checkpoint === cp)
      .map((x) => [x.axis_key, x.value]),
  );
  const reviews: TendencyReview[] = picked.map((r) => ({
    experienceId: r.experience_id,
    companyName: nameById.get(r.experience_id) ?? "",
    fitScore: r.fit_score,
    axes: axesOf(r.experience_id, r.checkpoint),
    updatedAt: r.updated_at,
  }));
  return computeTendency(reviews, masters.axes);
}

/**
 * ★職歴の会社が変わったとき、その職歴に付いたふり返りを消す（入社の決め手と同じ扱い。
 *   lib/joinDecision/server.ts の clearJoinDecisionForExperiences を読むこと）。消さないと元の会社への回答が新しい会社のものとして残る。
 *   ⚠️ 軸は FK の CASCADE で一緒に消える
 */
export async function clearJoinCheckinsForExperiences(owUserId: string, experienceIds: readonly string[]): Promise<boolean> {
  if (experienceIds.length === 0) return true;
  const r = await mutateAllowNone(
    createAdminClient().from("ow_join_checkins").delete().in("experience_id", [...experienceIds]).eq("user_id", owUserId),
    "join checkin 会社の変更で消す",
    { returning: "experience_id" },
  );
  return r.ok;
}

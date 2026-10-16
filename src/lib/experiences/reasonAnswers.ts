import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateAllowNone, mutateMany, mutateOne } from "@/lib/supabase/mutate";
import {
  EMPTY_REASON_ANSWERS_V2,
  EXPECTATION_UNRATED,
  VALID_EXPECTATIONS,
  VALID_LEAVE_REASONS,
  NOTE_CONSENT_VERSION,
  type ReasonAnswersV2,
} from "@/lib/constants/careerReasons";

/**
 * ★「この会社について」モーダル（新形式 reason_version = 2）の読み書き。**2つの API はここだけを呼ぶ。**
 *   設計は docs/phase0-reason-modal-20261016.md。表は migration 20261016120000。
 *
 * ── ★本人確認（`requireOwnExperience`）──────────────────────────────────────
 * 新しい6表は **service_role で書く**（RLS 有効・ポリシー0本・anon / authenticated に権限なし）。
 * ＝ **RLS が守ってくれない。** 「その職歴がログインしている本人のものか」を確かめるのは、この関数だけ。
 * ⚠️★**新しい経路を足すときも、必ずこの関数を通してから書くこと。** 書き写さない。
 *
 * ── ★回答の単位は「会社」────────────────────────────────────────────────────
 * 同じ会社の役割（職歴の行）が複数あるとき、回答は **1つの行にだけ** 置く。
 *   保存先 = その会社の行のうち **回答のある行**（`ow_experience_reviews` がある行）。無ければ **いちばん古い行**。
 * ⚠️ 「いちばん古い行」と決め打ちしないのは、入社年月を直して別の行が古くなっても回答が迷子にならないため。
 * ⚠️ 保存先の行を本人が削除すると、回答も消える（ON DELETE CASCADE）。付け替えはしない（2026-10-16 / 柴さんの判断）。
 *
 * ── 旧形式 ───────────────────────────────────────────────────────────────────
 * ⚠️★旧形式の列（join_reasons / join_reason_primary / leave_reasons / ow_experience_gaps）には**書かない**。
 *    旧の回答がある会社を開いたときは、旧の選択を**初期値として出すだけ**（キーが同じものだけ）。
 *    保存すると新しい表に入り、旧の列はそのまま残る。
 */

type ExpRow = {
  id: string;
  user_id: string;
  company_id: string | null;
  company_text: string | null;
  company_anonymized: string | null;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
  join_reasons: string[] | null;
  join_reason_primary: string | null;
  leave_reasons: string[] | null;
};

const EXP_COLS =
  "id, user_id, company_id, company_text, company_anonymized, started_at, ended_at, is_current, join_reasons, join_reason_primary, leave_reasons" as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OwnExperience =
  | { ok: true; owUserId: string; row: ExpRow }
  | { ok: false; status: 400 | 401 | 404 | 500; error: string };

/**
 * ★その職歴がログインしている本人のものかを確かめる。**見つからなければ 404**（他人の職歴の存在を区別させない）。
 */
export async function requireOwnExperience(experienceId: string): Promise<OwnExperience> {
  if (!UUID_RE.test(experienceId)) return { ok: false, status: 400, error: "Invalid id" };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  const admin = createAdminClient();
  const { data: owUser, error: uErr } = await admin.from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (uErr) { console.error("[reasonAnswers] ow_users:", uErr.message); return { ok: false, status: 500, error: "取得に失敗しました" }; }
  if (!owUser) return { ok: false, status: 404, error: "Not found" };

  const { data: row, error: eErr } = await admin
    .from("ow_experiences").select(EXP_COLS)
    .eq("id", experienceId)
    .eq("user_id", owUser.id as string)
    .maybeSingle();
  if (eErr) { console.error("[reasonAnswers] ow_experiences:", eErr.message); return { ok: false, status: 500, error: "取得に失敗しました" }; }
  if (!row) return { ok: false, status: 404, error: "Not found" };
  return { ok: true, owUserId: owUser.id as string, row: row as ExpRow };
}

/** 同じ会社かを決めるキー。⚠️ 匿名企業は名前で束ねる（入力欄は 2026-09-12 に削除済み・本番0件） */
function companyKey(r: Pick<ExpRow, "company_id" | "company_text" | "company_anonymized">): string {
  if (r.company_id) return `id:${r.company_id}`;
  if (r.company_text) return `text:${r.company_text.trim()}`;
  return `anon:${(r.company_anonymized ?? "").trim()}`;
}

/** 本人の、同じ会社の行（役割）をすべて */
async function companyRows(owUserId: string, base: ExpRow): Promise<ExpRow[] | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("ow_experiences").select(EXP_COLS).eq("user_id", owUserId);
  if (error) { console.error("[reasonAnswers] company rows:", error.message); return null; }
  const key = companyKey(base);
  return ((data ?? []) as ExpRow[]).filter((r) => companyKey(r) === key);
}

/** 終了した会社か = どの役割も現職でなく、終了年月が入っている（`hasLeftCompany` を会社に広げたもの） */
function hasLeft(rows: ExpRow[]): boolean {
  return rows.length > 0 && rows.every((r) => !r.is_current && !!r.ended_at);
}

function oldest(rows: ExpRow[]): ExpRow {
  return rows.slice().sort((a, b) => a.started_at.localeCompare(b.started_at) || a.id.localeCompare(b.id))[0];
}

type Resolved = {
  anchor: ExpRow;
  rows: ExpRow[];
  /** 保存先の行の見出し。無ければ null */
  version: 1 | 2 | null;
  canLeave: boolean;
};

async function resolveAnchor(owUserId: string, base: ExpRow): Promise<Resolved | null> {
  const rows = await companyRows(owUserId, base);
  if (!rows) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_experience_reviews").select("experience_id, reason_version")
    .in("experience_id", rows.map((r) => r.id));
  if (error) { console.error("[reasonAnswers] reviews:", error.message); return null; }
  const reviews = (data ?? []) as { experience_id: string; reason_version: number }[];
  /* 新形式の行を優先 → 旧形式の行 → いちばん古い行 */
  const v2 = reviews.find((r) => r.reason_version === 2);
  const any = v2 ?? reviews[0];
  const anchor = any ? rows.find((r) => r.id === any.experience_id)! : oldest(rows);
  return {
    anchor,
    rows,
    version: any ? (any.reason_version as 1 | 2) : null,
    canLeave: hasLeft(rows),
  };
}

export type LoadedAnswers = {
  /** 保存先の行 */
  anchorId: string;
  /** 2 = 新形式で答え済み ／ 1 = 旧形式だけ（答え直してもらう）／ null = 未回答 */
  version: 1 | 2 | null;
  canLeave: boolean;
  answers: ReasonAnswersV2;
};

/** モーダルを開いたときの初期値 */
export async function loadReasonAnswers(owUserId: string, base: ExpRow): Promise<LoadedAnswers | null> {
  const r = await resolveAnchor(owUserId, base);
  if (!r) return null;
  const id = r.anchor.id;

  if (r.version !== 2) {
    /* 旧形式（または旧形式の印の無い旧回答）を初期値に。⚠️ キーが新形式にあるものだけ。読み替えて保存はしない */
    const a = r.rows.find((x) => (x.join_reasons?.length ?? 0) > 0 || (x.leave_reasons?.length ?? 0) > 0) ?? r.anchor;
    const legacy = (a.join_reasons?.length ?? 0) > 0 || (a.leave_reasons?.length ?? 0) > 0;
    const expectations = (a.join_reasons ?? []).filter((v) => VALID_EXPECTATIONS.has(v)).slice(0, 3);
    const primary =
      expectations.length === 1 ? expectations[0]
        : a.join_reason_primary && expectations.includes(a.join_reason_primary) ? a.join_reason_primary : null;
    return {
      anchorId: id,
      version: r.version ?? (legacy ? 1 : null),
      canLeave: r.canLeave,
      answers: {
        ...EMPTY_REASON_ANSWERS_V2,
        expectations,
        primary,
        leaveReasons: r.canLeave ? (a.leave_reasons ?? []).filter((v) => VALID_LEAVE_REASONS.has(v)) : [],
      },
    };
  }

  const admin = createAdminClient();
  const [rev, exps, shifts, leaves, note] = await Promise.all([
    admin.from("ow_experience_reviews").select("fit_score").eq("experience_id", id).maybeSingle(),
    admin.from("ow_experience_expectations").select("reason, is_primary, rating, created_at").eq("experience_id", id),
    admin.from("ow_experience_gap_shifts").select("axis, value").eq("experience_id", id),
    admin.from("ow_experience_leave_reasons").select("reason, created_at").eq("experience_id", id),
    admin.from("ow_experience_notes").select("prompt, body, display_consent").eq("experience_id", id).maybeSingle(),
  ]);
  for (const [label, res] of [["reviews", rev], ["expectations", exps], ["shifts", shifts], ["leave", leaves], ["notes", note]] as const) {
    if (res.error) { console.error(`[reasonAnswers] load ${label}:`, res.error.message); return null; }
  }
  const expRows = ((exps.data ?? []) as { reason: string; is_primary: boolean; rating: number | null; created_at: string }[])
    .sort((x, y) => x.created_at.localeCompare(y.created_at));
  const n = note.data as { prompt: string; body: string; display_consent: boolean } | null;
  return {
    anchorId: id,
    version: 2,
    canLeave: r.canLeave,
    answers: {
      expectations: expRows.map((e) => e.reason),
      primary: expRows.find((e) => e.is_primary)?.reason ?? null,
      ratings: Object.fromEntries(expRows.filter((e) => e.rating !== null).map((e) => [e.reason, e.rating as number])),
      shifts: Object.fromEntries(((shifts.data ?? []) as { axis: string; value: number }[]).map((s) => [s.axis, s.value])),
      fitScore: (rev.data?.fit_score as number | null) ?? null,
      leaveReasons: ((leaves.data ?? []) as { reason: string; created_at: string }[])
        .sort((x, y) => x.created_at.localeCompare(y.created_at)).map((l) => l.reason),
      note: n ? { prompt: n.prompt, body: n.body, displayConsent: n.display_consent } : null,
    },
  };
}

/** 保存先の行と、終了した会社か（API が検証の前に要る） */
export async function resolveReasonTarget(owUserId: string, base: ExpRow) {
  return resolveAnchor(owUserId, base);
}

/**
 * 新形式の回答を保存する（入れ替え）。⚠️ 検証（`parseReasonAnswersV2`）は呼び出し側で済ませてから渡すこと。
 * ⚠️ 1回のトランザクションではない。**子の表を先に、見出し（reason_version = 2）を最後に**書く。
 *    途中で失敗したら見出しは書かれず、次に開いたときは前の状態から答え直せる。
 */
export async function saveReasonAnswers(anchorId: string, a: ReasonAnswersV2): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const fail = (error: string) => ({ ok: false as const, error });

  // A: 期待していたこと
  let r = await mutateAllowNone(admin.from("ow_experience_expectations").delete().eq("experience_id", anchorId), "reasons expectations 掃除", { returning: "reason" });
  if (!r.ok) return fail("期待していたことの保存に失敗しました。");
  if (a.expectations.length > 0) {
    r = await mutateMany(admin.from("ow_experience_expectations").insert(
      a.expectations.map((reason, i) => ({
        experience_id: anchorId,
        reason,
        is_primary: reason === a.primary,
        rating: EXPECTATION_UNRATED.has(reason) ? null : (a.ratings[reason] ?? null),
        /* 選んだ順を残す（created_at で並べ直す） */
        created_at: new Date(Date.now() + i).toISOString(),
      })),
    ), "reasons expectations 追加", { returning: "reason" });
    if (!r.ok) return fail("期待していたことの保存に失敗しました。");
  }

  // B: ずれの方向
  r = await mutateAllowNone(admin.from("ow_experience_gap_shifts").delete().eq("experience_id", anchorId), "reasons shifts 掃除", { returning: "axis" });
  if (!r.ok) return fail("入社前とのずれの保存に失敗しました。");
  const shifts = Object.entries(a.shifts);
  if (shifts.length > 0) {
    r = await mutateMany(admin.from("ow_experience_gap_shifts").insert(
      shifts.map(([axis, value]) => ({ experience_id: anchorId, axis, value })),
    ), "reasons shifts 追加", { returning: "axis" });
    if (!r.ok) return fail("入社前とのずれの保存に失敗しました。");
  }

  // 離れた理由
  r = await mutateAllowNone(admin.from("ow_experience_leave_reasons").delete().eq("experience_id", anchorId), "reasons leave 掃除", { returning: "reason" });
  if (!r.ok) return fail("離れた理由の保存に失敗しました。");
  if (a.leaveReasons.length > 0) {
    r = await mutateMany(admin.from("ow_experience_leave_reasons").insert(
      a.leaveReasons.map((reason, i) => ({ experience_id: anchorId, reason, created_at: new Date(Date.now() + i).toISOString() })),
    ), "reasons leave 追加", { returning: "reason" });
    if (!r.ok) return fail("離れた理由の保存に失敗しました。");
  }

  // D: ひとこと。⚠️ 本文か書き出しが変わったら運営の確認を「確認待ち」に戻す
  const { data: prevNote, error: pnErr } = await admin
    .from("ow_experience_notes").select("prompt, body, status, reviewed_at, reviewed_by, display_consent, display_consented_at, display_consent_version")
    .eq("experience_id", anchorId).maybeSingle();
  if (pnErr) { console.error("[reasonAnswers] notes 取得:", pnErr.message); return fail("ひとことの保存に失敗しました。"); }
  if (!a.note) {
    r = await mutateAllowNone(admin.from("ow_experience_notes").delete().eq("experience_id", anchorId), "reasons notes 削除", { returning: "experience_id" });
    if (!r.ok) return fail("ひとことの保存に失敗しました。");
  } else {
    const p = prevNote as null | {
      prompt: string; body: string; status: string; reviewed_at: string | null; reviewed_by: string | null;
      display_consent: boolean; display_consented_at: string | null; display_consent_version: number | null;
    };
    const changed = !p || p.prompt !== a.note.prompt || p.body !== a.note.body;
    const now = new Date().toISOString();
    /* 同意: 新しく同意したら日時と版を記録。同意し続けているなら前の日時と版のまま。取り消したら3つとも外す */
    const consent = a.note.displayConsent
      ? (p?.display_consent
          ? { display_consent: true, display_consented_at: p.display_consented_at, display_consent_version: p.display_consent_version }
          : { display_consent: true, display_consented_at: now, display_consent_version: NOTE_CONSENT_VERSION })
      : { display_consent: false, display_consented_at: null, display_consent_version: null };
    const row = {
      experience_id: anchorId,
      prompt: a.note.prompt,
      body: a.note.body,
      ...(changed ? { status: "pending", reviewed_at: null, reviewed_by: null } : {}),
      ...consent,
      updated_at: now,
    };
    r = await mutateOne(admin.from("ow_experience_notes").upsert(row, { onConflict: "experience_id" }), "reasons notes 保存", { returning: "experience_id" });
    if (!r.ok) return fail("ひとことの保存に失敗しました。");
  }

  // 見出し（最後）
  const now = new Date().toISOString();
  r = await mutateOne(admin.from("ow_experience_reviews").upsert({
    experience_id: anchorId,
    reason_version: 2,
    fit_score: a.fitScore,
    answered_at: now,
    updated_at: now,
  }, { onConflict: "experience_id" }), "reasons reviews 保存", { returning: "experience_id" });
  if (!r.ok) return fail("回答の保存に失敗しました。");
  return { ok: true };
}

/** 「あとで答える」と × で閉じたときの記録 */
export async function recordReasonClose(owUserId: string, experienceId: string, step: string, via: string) {
  const admin = createAdminClient();
  return mutateOne(
    admin.from("ow_reason_modal_closes").insert({ user_id: owUserId, experience_id: experienceId, step, via }),
    "reasons close 記録",
  );
}

/**
 * 本人の職歴ごとの回答の状態（会社単位に広げたもの）。⚠️ 同じ会社の役割はすべて同じ値になる。
 * 2 = 新形式で答え済み ／ 1 = 旧形式だけ ／ 返さない = 未回答
 */
export async function reasonStatusForUser(owUserId: string): Promise<Record<string, 1 | 2> | null> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("ow_experiences").select(EXP_COLS).eq("user_id", owUserId);
  if (error) { console.error("[reasonAnswers] status rows:", error.message); return null; }
  const list = (rows ?? []) as ExpRow[];
  if (list.length === 0) return {};
  const { data: revs, error: rErr } = await admin
    .from("ow_experience_reviews").select("experience_id, reason_version").in("experience_id", list.map((r) => r.id));
  if (rErr) { console.error("[reasonAnswers] status reviews:", rErr.message); return null; }
  const byRow = new Map(((revs ?? []) as { experience_id: string; reason_version: number }[]).map((r) => [r.experience_id, r.reason_version]));
  const byCompany = new Map<string, 1 | 2>();
  for (const r of list) {
    const v = byRow.get(r.id) as 1 | 2 | undefined
      /* 旧形式の印が無い旧回答（適用からデプロイまでの間に旧画面で答えたもの）も旧形式として扱う */
      ?? ((r.join_reasons?.length ?? 0) > 0 || (r.leave_reasons?.length ?? 0) > 0 ? 1 : undefined);
    if (!v) continue;
    const k = companyKey(r);
    if ((byCompany.get(k) ?? 0) < v) byCompany.set(k, v);
  }
  const out: Record<string, 1 | 2> = {};
  for (const r of list) { const v = byCompany.get(companyKey(r)); if (v) out[r.id] = v; }
  return out;
}

import { NextRequest, NextResponse } from "next/server";
import { requireBizAction } from "@/lib/auth/companyAccess";
import { getJobManagerOptions, setJobHiringManagers } from "@/lib/nextManager/server";
import { isUuid, parseUuidList, MAX_MANAGERS_PER_JOB } from "@/lib/nextManager/constants";

export const dynamic = "force-dynamic";

/**
 * ★募集の Hiring Manager（Next Manager / 2026-11-13）。求人編集の画面から、その募集を担当するマネージャーを選ぶ。
 *   GET → { options: [{ userId, name, isHiring, selected }] } ／ PUT { userIds } → 入れ替え（すぐ保存）
 * ⚠️ 権限は求人の編集と同じ（jobs.edit）。会社は「いま選んでいる会社」。募集がその会社のものかは server.ts が確かめる。
 * ⚠️ 求人ページに出るのは、本人が「採用中」にしている人だけ（ここで紐づけただけでは公開しない）。
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireBizAction("jobs.edit");
  if (!a.ok) return a.response;
  if (!isUuid(params.id)) return NextResponse.json({ error: "募集が見つかりません" }, { status: 404 });
  const options = await getJobManagerOptions(a.actor.companyId, params.id);
  if (!options) return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  return NextResponse.json({ options }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireBizAction("jobs.edit");
  if (!a.ok) return a.response;
  if (!isUuid(params.id)) return NextResponse.json({ error: "募集が見つかりません" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const userIds = parseUuidList(body?.userIds, MAX_MANAGERS_PER_JOB);
  if (!userIds) return NextResponse.json({ error: `Hiring Manager が正しくありません（${MAX_MANAGERS_PER_JOB}人まで）` }, { status: 400 });
  const r = await setJobHiringManagers({ companyId: a.actor.companyId, jobId: params.id, userIds, actorOwUserId: a.actor.owUserId });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true });
}

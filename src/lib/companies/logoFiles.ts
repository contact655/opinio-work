import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * ★企業ロゴの不要なファイルを消す（2026-10-12 / 柴さんの指示）。
 *
 * ロゴは**アップロードのたびに別のファイル名**（`companies/logos/{企業id}/logo-{日時}.{拡張子}`）で入れ、
 * 下書きに新しい URL を持たせる（`lib/business/photos.ts` の uploadCompanyLogo）。
 * それまでの固定名（`logo.{拡張子}` を上書き）だと、**「公開する」の前に公開ページのロゴが変わっていた**。
 *
 * 消すのは `companies/logos/{企業id}/` の中で、次の**両方**を満たすファイルだけ:
 *   ① この仕組みで付けた名前（`logo-{13桁の日時}.{拡張子}`。GENERATED_LOGO_RE）
 *   ② 公開中のロゴ（logo_url）にも下書きのロゴにも使われていない
 *   ＝ 公開したときの古いロゴ・公開しないまま差し替えた／取り消したロゴ
 * ⚠️★**それ以前からあるファイル（固定名の `logo.png` など）は、使われていなくても消さない**（2026-10-12 / 柴さんの指示）。
 *    一括投入スクリプト（scripts/upload-logos-*.mjs）が入れたもので、消すかどうかは別に判断する。
 * ⚠️ 消したファイル名はログに残す（`[logoFiles:…] 削除:`）。後から追えるように。
 * 呼ぶ場所: 下書きの反映（applyDraft.ts）の後、運営が企業情報を保存した後（PUT /api/admin/companies/[id]）。
 *
 * ⚠️★Storage は日次バックアップに含まれない。**消すと戻せない**ので、次の場合は何も消さない:
 *    ・企業の行・フォルダの一覧が取れなかった
 *    ・公開中のロゴがこのフォルダのファイルなのに、一覧の中に見つからない（判定がずれている）
 * ⚠️ 他の企業のフォルダは触らない（パスは企業 id から組み立てる）。
 * ⚠️ best-effort。失敗しても呼び出し元の処理は成功のまま（ログに出す）。
 */
const BUCKET = "ow-uploads";

/** ★この仕組みで付けたファイル名（photos.ts の uploadCompanyLogo と揃える）。これに当たらないファイルは消さない */
export const GENERATED_LOGO_RE = /^logo-\d{13}\.[a-z0-9]+$/;

/** 公開 URL → バケット内のパス（クエリを落とす）。このバケットの URL でなければ null */
function storagePathOf(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0].split("#")[0]);
}

export async function cleanupCompanyLogoFiles(companyId: string, label: string): Promise<number> {
  const admin = createAdminClient();
  const folder = `companies/logos/${companyId}`;

  const { data: row, error } = await admin.from("ow_companies").select("logo_url, draft_data").eq("id", companyId).maybeSingle();
  if (error || !row) {
    console.error(`[logoFiles:${label}] 企業の取得に失敗（何も消さない）:`, error?.message);
    return 0;
  }
  const draft = (row.draft_data ?? null) as Record<string, unknown> | null;
  const keep = new Set<string>();
  const live = storagePathOf(row.logo_url);
  if (live) keep.add(live);
  const draftLogo = draft && "logo_url" in draft ? storagePathOf(draft.logo_url) : null;
  if (draftLogo) keep.add(draftLogo);

  const { data: files, error: listErr } = await admin.storage.from(BUCKET).list(folder, { limit: 1000 });
  if (listErr) {
    console.error(`[logoFiles:${label}] 一覧の取得に失敗（何も消さない）:`, listErr.message);
    return 0;
  }
  const paths = (files ?? []).filter((f) => f.name && f.id).map((f) => `${folder}/${f.name}`);
  /* ★消してよいのは、この仕組みで付けた名前のファイルだけ */
  const generated = (files ?? []).filter((f) => f.name && f.id && GENERATED_LOGO_RE.test(f.name)).map((f) => `${folder}/${f.name}`);

  /* ⚠️ 公開中のロゴがこのフォルダにあるはずなのに見つからない → 判定がずれているので消さない */
  if (live && live.startsWith(`${folder}/`) && !paths.includes(live)) {
    console.error(`[logoFiles:${label}] 公開中のロゴが一覧に無い（何も消さない）: ${live}`);
    return 0;
  }

  const remove = generated.filter((p) => !keep.has(p));
  if (remove.length === 0) return 0;
  const { error: rmErr } = await admin.storage.from(BUCKET).remove(remove);
  if (rmErr) {
    console.error(`[logoFiles:${label}] 削除に失敗:`, rmErr.message, remove.join(", "));
    return 0;
  }
  /* ⚠️ 後から追えるように、消したファイル名を必ず残す */
  console.log(`[logoFiles:${label}] 削除: company=${companyId} ${remove.join(", ")}`);
  return remove.length;
}

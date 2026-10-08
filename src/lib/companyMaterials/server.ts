/**
 * 企業資料（依頼② フェーズ1a / 2026-10-09）の読み書き。**サーバー専用。**
 *
 * ── ★権限の形（柴さんの決定。`ow_proposals` と同じ）─────────────────────────
 * `ow_company_material_documents` / `ow_company_material_items` は
 * **RLS 有効・ポリシー0本・anon / authenticated に GRANT なし**。
 * 読み書きは**ここの admin クライアントだけ**で行う。
 * ⚠️★**このファイルの関数は「呼び出し側が所属と権限を確かめた」前提で動く。**
 *    法人の API は `lib/companyMaterials/access.ts` の `resolveMaterialsActor` を通すこと。
 *    ⚠️ `companyId` を必ず条件に入れている。id だけで引く関数を足さないこと
 *       （他社の id を渡されたときに通ってしまう）。
 *
 * ── ★求職者に出す経路は2本だけ ───────────────────────────────────────────
 *   ① `getPublicMaterialItemsCached` … 企業ページ（公開・確定済み・restricted でない）
 *   ② `getMaterialsForMatching`      … マッチング用（`canUse(…, "companyMaterials")` で閉じる）
 *   ⚠️★**これ以外の経路で項目を読ませないこと。** 条件（`visibility` / `confirmed_at` /
 *      `restricted_flag`）を呼び出し側に書き写すと、必ずどこかで1つ落ちる。
 *
 * ⚠️ `server-only` パッケージは入っていないので、**クライアントコンポーネントから
 *    import しないこと**（admin クライアントがバンドルに混ざる）。規約で守る。
 */
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { canUse, type PlanType } from "@/lib/constants/plans";
import {
  MATERIAL_BUCKET,
  MATERIAL_CATEGORIES,
  MATERIAL_SIGNED_URL_SECONDS,
  type MaterialCategory,
  type MaterialDocumentStatus,
  type MaterialSourceType,
  type MaterialVisibility,
} from "@/lib/constants/companyMaterials";

// ── 型 ──────────────────────────────────────────────────────────────────────

export type MaterialDocument = {
  id: string;
  title: string;
  sourceType: MaterialSourceType;
  sourceUrl: string | null;
  mimeType: string | null;
  byteSize: number | null;
  status: MaterialDocumentStatus;
  errorMessage: string | null;
  createdAt: string;
  /** この資料にぶら下がる項目の数 */
  itemCount: number;
};

export type MaterialItem = {
  id: string;
  documentId: string | null;
  category: MaterialCategory;
  content: string;
  visibility: MaterialVisibility;
  aiSuggestedVisibility: MaterialVisibility | null;
  confirmedAt: string | null;
  restrictedFlag: boolean;
  restrictedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 求職者向けの企業ページに出してよい項目。⚠️ 公開・確定済み・restricted でないものだけ */
export type PublicMaterialItem = {
  id: string;
  category: MaterialCategory;
  content: string;
};

const DOC_COLS =
  "id, title, source_type, source_url, mime_type, byte_size, status, error_message, created_at" as const;
const ITEM_COLS =
  "id, document_id, category, content, visibility, ai_suggested_visibility, confirmed_at, restricted_flag, restricted_reason, created_at, updated_at" as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
function toItem(r: any): MaterialItem {
  return {
    id: r.id,
    documentId: r.document_id ?? null,
    category: r.category,
    content: r.content,
    visibility: r.visibility,
    aiSuggestedVisibility: r.ai_suggested_visibility ?? null,
    confirmedAt: r.confirmed_at ?? null,
    restrictedFlag: r.restricted_flag === true,
    restrictedReason: r.restricted_reason ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const categoryOrder = (c: string) => {
  const i = (MATERIAL_CATEGORIES as readonly string[]).indexOf(c);
  return i < 0 ? 999 : i;
};

// ── 法人画面の一覧 ────────────────────────────────────────────────────────────

/**
 * その会社の資料と項目をすべて返す（法人画面用）。
 * ⚠️ 失敗したら null。**空配列に倒さない**（「0件」と「取れなかった」を区別する）。
 */
export async function listMaterials(companyId: string): Promise<{
  documents: MaterialDocument[];
  items: MaterialItem[];
} | null> {
  const db = createAdminClient();
  const [docs, items] = await Promise.all([
    db.from("ow_company_material_documents").select(DOC_COLS)
      .eq("company_id", companyId).order("created_at", { ascending: false }),
    db.from("ow_company_material_items").select(ITEM_COLS)
      .eq("company_id", companyId).order("created_at", { ascending: true }),
  ]);
  if (docs.error || items.error) {
    console.error("[companyMaterials] listMaterials:", docs.error?.message ?? items.error?.message);
    return null;
  }
  const itemRows = (items.data ?? []).map(toItem);
  const countByDoc = new Map<string, number>();
  for (const it of itemRows) {
    if (it.documentId) countByDoc.set(it.documentId, (countByDoc.get(it.documentId) ?? 0) + 1);
  }
  return {
    documents: (docs.data ?? []).map((d) => ({
      id: d.id as string,
      title: d.title as string,
      sourceType: d.source_type as MaterialSourceType,
      sourceUrl: (d.source_url as string | null) ?? null,
      mimeType: (d.mime_type as string | null) ?? null,
      byteSize: (d.byte_size as number | null) ?? null,
      status: d.status as MaterialDocumentStatus,
      errorMessage: (d.error_message as string | null) ?? null,
      createdAt: d.created_at as string,
      itemCount: countByDoc.get(d.id as string) ?? 0,
    })),
    items: itemRows,
  };
}

/**
 * 未確定の項目の数（ホームの「やること」）。
 * ⚠️ 失敗したら null。0 に倒すと「壊れているのに要対応が消える」。
 */
export async function countUnconfirmedMaterialItems(companyId: string): Promise<number | null> {
  const { count, error } = await createAdminClient()
    .from("ow_company_material_items")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("confirmed_at", null);
  if (error) {
    console.error("[companyMaterials] countUnconfirmed:", error.message);
    return null;
  }
  return count ?? 0;
}

// ── 資料の登録・削除・読み出し ────────────────────────────────────────────────

type Result<T = undefined> = { ok: true; value: T } | { ok: false; status: number; error: string };

/** URL をリンクとして保存する。⚠️ 1a では**中身を取りに行かない**（SSRF 対策ごと 1b） */
export async function createUrlDocument(
  companyId: string, owUserId: string, title: string, url: string,
): Promise<Result<{ id: string }>> {
  const { data, error } = await createAdminClient()
    .from("ow_company_material_documents")
    .insert({
      company_id: companyId, source_type: "url", title, source_url: url,
      status: "uploaded", created_by_ow_user_id: owUserId,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[companyMaterials] createUrlDocument:", error?.message);
    return { ok: false, status: 500, error: "リンクを登録できませんでした。" };
  }
  return { ok: true, value: { id: data.id as string } };
}

/**
 * ファイルを Storage に置いてから行を作る。
 * ⚠️ パスに資料 id が要るので、id をここで先に決める。
 * ⚠️ 行の作成に失敗したら**置いたファイルを消す**（宙に浮いたファイルを残さない）。
 */
export async function createFileDocument(
  companyId: string, owUserId: string, title: string,
  file: { name: string; storedMime: string; bytes: ArrayBuffer },
): Promise<Result<{ id: string }>> {
  const db = createAdminClient();
  const id = crypto.randomUUID();
  /* ⚠️ ファイル名は Storage のキーに使えない文字を落とす。元の名前は title に残っている */
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "file";
  const path = `${companyId}/${id}/${safeName}`;

  const up = await db.storage.from(MATERIAL_BUCKET).upload(path, file.bytes, {
    contentType: file.storedMime, upsert: false,
  });
  if (up.error) {
    console.error("[companyMaterials] upload:", up.error.message);
    return { ok: false, status: 500, error: "ファイルを保存できませんでした。" };
  }

  const { error } = await db.from("ow_company_material_documents").insert({
    id, company_id: companyId, source_type: "file", title, storage_path: path,
    mime_type: file.storedMime, byte_size: file.bytes.byteLength,
    status: "uploaded", created_by_ow_user_id: owUserId,
  });
  if (error) {
    console.error("[companyMaterials] insert document:", error.message);
    const rm = await db.storage.from(MATERIAL_BUCKET).remove([path]);
    if (rm.error) console.error("[companyMaterials] 片付けに失敗（ファイルが残っている）:", path, rm.error.message);
    return { ok: false, status: 500, error: "資料を登録できませんでした。" };
  }
  return { ok: true, value: { id } };
}

/**
 * 資料を消す。⚠️ 項目は消さない（`document_id` が外れるだけ。確定済みの公開項目を守るため）。
 * ⚠️ Storage のファイルを先に消す。行を先に消すとパスが分からなくなる。
 */
export async function deleteDocument(companyId: string, documentId: string): Promise<Result> {
  const db = createAdminClient();
  const { data: doc, error } = await db.from("ow_company_material_documents")
    .select("id, storage_path").eq("id", documentId).eq("company_id", companyId).maybeSingle();
  if (error) {
    console.error("[companyMaterials] deleteDocument lookup:", error.message);
    return { ok: false, status: 500, error: "資料を確認できませんでした。" };
  }
  if (!doc) return { ok: false, status: 404, error: "資料が見つかりません。" };

  if (doc.storage_path) {
    const rm = await db.storage.from(MATERIAL_BUCKET).remove([doc.storage_path as string]);
    if (rm.error) {
      console.error("[companyMaterials] remove file:", rm.error.message);
      return { ok: false, status: 500, error: "ファイルを削除できませんでした。" };
    }
  }
  const r = await mutateOne(
    db.from("ow_company_material_documents").delete().eq("id", documentId).eq("company_id", companyId),
    "companyMaterials deleteDocument",
  );
  if (!r.ok) return { ok: false, status: r.status, error: "資料を削除できませんでした。" };
  return { ok: true, value: undefined };
}

/** ファイルの短時間の署名 URL。⚠️ 長くしない（`MATERIAL_SIGNED_URL_SECONDS`） */
export async function signedUrlForDocument(companyId: string, documentId: string): Promise<Result<{ url: string }>> {
  const db = createAdminClient();
  const { data: doc, error } = await db.from("ow_company_material_documents")
    .select("storage_path, source_type").eq("id", documentId).eq("company_id", companyId).maybeSingle();
  if (error) {
    console.error("[companyMaterials] signedUrl lookup:", error.message);
    return { ok: false, status: 500, error: "資料を確認できませんでした。" };
  }
  if (!doc || doc.source_type !== "file" || !doc.storage_path) {
    return { ok: false, status: 404, error: "ファイルが見つかりません。" };
  }
  const s = await db.storage.from(MATERIAL_BUCKET)
    .createSignedUrl(doc.storage_path as string, MATERIAL_SIGNED_URL_SECONDS);
  if (s.error || !s.data) {
    console.error("[companyMaterials] createSignedUrl:", s.error?.message);
    return { ok: false, status: 500, error: "ファイルを開けませんでした。" };
  }
  return { ok: true, value: { url: s.data.signedUrl } };
}

// ── 項目 ────────────────────────────────────────────────────────────────────

/** 手入力の項目を作る。⚠️ 作った時点では**未確定・内部のみ** */
export async function createItem(
  companyId: string, owUserId: string,
  input: { category: MaterialCategory; content: string; documentId: string | null },
): Promise<Result<{ id: string }>> {
  const db = createAdminClient();
  if (input.documentId) {
    /* 他社の資料に紐づけさせない（DB の複合 FK も止めるが、先に分かりやすく断る） */
    const { data: doc, error } = await db.from("ow_company_material_documents")
      .select("id").eq("id", input.documentId).eq("company_id", companyId).maybeSingle();
    if (error) return { ok: false, status: 500, error: "資料を確認できませんでした。" };
    if (!doc) return { ok: false, status: 404, error: "資料が見つかりません。" };
  }
  const { data, error } = await db.from("ow_company_material_items").insert({
    company_id: companyId, document_id: input.documentId, category: input.category,
    content: input.content, visibility: "internal", created_by_ow_user_id: owUserId,
  }).select("id").single();
  if (error || !data) {
    console.error("[companyMaterials] createItem:", error?.message);
    return { ok: false, status: 500, error: "項目を追加できませんでした。" };
  }
  return { ok: true, value: { id: data.id as string } };
}

/**
 * ★項目を直す。**「本文（か区分）を直したら確定を外す」はここ1か所。**（柴さんの決定）
 *    トリガーにしない（後から読む人が気づけない隠れた挙動になるため）。
 *
 * ・`content` か `category` が変わったら → `visibility = 'internal'`・未確定に戻す
 *   （確定したときと中身が違うものを、確定済みとして出し続けないため）
 * ・`restricted` を true にしたら → `visibility = 'internal'`（DB の CHECK も同じことを要求する）
 *
 * @returns `affectsPublic` … 変更前か変更後のどちらかが「公開・確定済み」だった
 *          ＝企業ページを作り直す必要がある
 */
export async function updateItem(
  companyId: string, itemId: string,
  patch: {
    content?: string;
    category?: MaterialCategory;
    restricted?: { flag: boolean; reason: string | null };
  },
): Promise<Result<{ affectsPublic: boolean }>> {
  const db = createAdminClient();
  const { data: cur, error } = await db.from("ow_company_material_items")
    .select("id, content, category, visibility, confirmed_at, restricted_flag")
    .eq("id", itemId).eq("company_id", companyId).maybeSingle();
  if (error) return { ok: false, status: 500, error: "項目を確認できませんでした。" };
  if (!cur) return { ok: false, status: 404, error: "項目が見つかりません。" };

  const wasPublic = cur.visibility === "public" && cur.confirmed_at != null && cur.restricted_flag !== true;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const contentChanged = patch.content !== undefined && patch.content !== cur.content;
  const categoryChanged = patch.category !== undefined && patch.category !== cur.category;
  if (patch.content !== undefined) update.content = patch.content;
  if (patch.category !== undefined) update.category = patch.category;
  if (contentChanged || categoryChanged) {
    update.visibility = "internal";
    update.confirmed_at = null;
    update.confirmed_by_ow_user_id = null;
  }
  if (patch.restricted) {
    update.restricted_flag = patch.restricted.flag;
    update.restricted_reason = patch.restricted.flag ? patch.restricted.reason : null;
    if (patch.restricted.flag) update.visibility = "internal";
  }

  const r = await mutateOne(
    db.from("ow_company_material_items").update(update).eq("id", itemId).eq("company_id", companyId),
    "companyMaterials updateItem",
  );
  if (!r.ok) return { ok: false, status: r.status, error: "項目を保存できませんでした。" };

  /* ⚠️ この関数で新しく公開になることは無い（公開にするのは `confirmItems` だけ）。
        したがって「変更前に公開だったか」だけで足りる。 */
  return { ok: true, value: { affectsPublic: wasPublic } };
}

/**
 * ★区分を決めて確定する（1件でも複数でも）。
 * ⚠️ restricted の項目は `internal` 以外で確定させない（DB の CHECK も止めるが、先に断る）。
 * ⚠️ 途中で失敗したら、そこまでの分は確定済みのまま返す（何件確定したかを返す）。
 */
export async function confirmItems(
  companyId: string, owUserId: string,
  entries: { id: string; visibility: MaterialVisibility }[],
): Promise<Result<{ confirmed: number; affectsPublic: boolean }>> {
  const db = createAdminClient();
  const ids = entries.map((e) => e.id);
  const { data: rows, error } = await db.from("ow_company_material_items")
    .select("id, visibility, confirmed_at, restricted_flag")
    .eq("company_id", companyId).in("id", ids);
  if (error) return { ok: false, status: 500, error: "項目を確認できませんでした。" };
  const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
  if (byId.size !== new Set(ids).size) return { ok: false, status: 404, error: "見つからない項目があります。" };

  for (const e of entries) {
    if (byId.get(e.id)?.restricted_flag === true && e.visibility !== "internal") {
      return { ok: false, status: 400, error: "選考に使ってはいけない内容として印のある項目は「内部のみ」でしか確定できません。" };
    }
  }

  const now = new Date().toISOString();
  let confirmed = 0;
  let affectsPublic = false;
  for (const e of entries) {
    const before = byId.get(e.id)!;
    if (before.visibility === "public" && before.confirmed_at != null) affectsPublic = true;
    if (e.visibility === "public") affectsPublic = true;
    const r = await mutateOne(
      db.from("ow_company_material_items")
        .update({ visibility: e.visibility, confirmed_at: now, confirmed_by_ow_user_id: owUserId, updated_at: now })
        .eq("id", e.id).eq("company_id", companyId),
      "companyMaterials confirmItems",
    );
    if (!r.ok) {
      return { ok: false, status: r.status, error: `${confirmed}件まで確定しました。残りは保存できませんでした。` };
    }
    confirmed += 1;
  }
  return { ok: true, value: { confirmed, affectsPublic } };
}

export async function deleteItem(companyId: string, itemId: string): Promise<Result<{ affectsPublic: boolean }>> {
  const db = createAdminClient();
  const { data: cur, error } = await db.from("ow_company_material_items")
    .select("visibility, confirmed_at").eq("id", itemId).eq("company_id", companyId).maybeSingle();
  if (error) return { ok: false, status: 500, error: "項目を確認できませんでした。" };
  if (!cur) return { ok: false, status: 404, error: "項目が見つかりません。" };
  const r = await mutateOne(
    db.from("ow_company_material_items").delete().eq("id", itemId).eq("company_id", companyId),
    "companyMaterials deleteItem",
  );
  if (!r.ok) return { ok: false, status: r.status, error: "項目を削除できませんでした。" };
  return { ok: true, value: { affectsPublic: cur.visibility === "public" && cur.confirmed_at != null } };
}

// ── ★求職者向け①: 企業ページの公開項目 ─────────────────────────────────────────

/**
 * 求職者向けの企業ページに出してよい項目。**条件はここ1か所。**
 *   visibility = 'public' ∧ confirmed_at IS NOT NULL ∧ restricted_flag = false
 * ⚠️★**3つのうち1つでも外すと、未確定や選考に使えない内容が公開される。**
 *    DB の CHECK（未確定・restricted は internal のみ）も同じことを守っているが、二重にしておく。
 * ⚠️ 取れなかったら空配列（企業ページを落とさない）。ただしログは出す。
 */
async function getPublicMaterialItems(companyId: string): Promise<PublicMaterialItem[]> {
  const { data, error } = await createAdminClient()
    .from("ow_company_material_items")
    .select("id, category, content, created_at")
    .eq("company_id", companyId)
    .eq("visibility", "public")
    .not("confirmed_at", "is", null)
    .eq("restricted_flag", false)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[companyMaterials] getPublicMaterialItems:", error.message);
    return [];
  }
  return (data ?? [])
    .map((r) => ({ id: r.id as string, category: r.category as MaterialCategory, content: r.content as string }))
    .sort((a, b) => categoryOrder(a.category) - categoryOrder(b.category));
}

/**
 * ISR の企業ページから呼ぶ版。⚠️ 中で no-store のクライアントを使わない（CLAUDE.md）。
 * ⚠️ 確定・変更・削除のあとは `revalidateCompanyPages(companyId)` を呼ぶこと
 *    （ページの描画中に作られた `unstable_cache` も一緒に落ちる。2026-09-08 実測）。
 */
export const getPublicMaterialItemsCached = (companyId: string) =>
  unstable_cache(
    () => getPublicMaterialItems(companyId),
    ["company-material-items-public", companyId],
    { revalidate: 300 },
  )();

// ── ★求職者向け②: マッチング用（依頼③で提案の根拠に組み込む）─────────────────

/*
 * ★公開範囲を**型で区別**して返す（柴さんの指示）。
 *   依頼③で求職者向けの文章を組むとき、内部の項目を渡せないようにするため。
 *   ⚠️ 3つの型は形が同じでも**互いに代入できない**（`kind` の値が違う）。
 *      求職者に見せる文章を作る関数は `PublicMaterial | AfterMutualMaterial` だけを受け取ること。
 */
export type PublicMaterial = { readonly kind: "public"; id: string; category: MaterialCategory; content: string };
export type AfterMutualMaterial = { readonly kind: "after_mutual"; id: string; category: MaterialCategory; content: string };
/** ⚠️★求職者に見せてはいけない。マッチングの処理の中だけで使う */
export type InternalMaterial = {
  readonly kind: "internal"; id: string; category: MaterialCategory; content: string;
  /** 未確定の項目は内部のみとして扱う（柴さんの決定）ので、ここに入る。区別できるよう印を付ける */
  confirmed: boolean;
};

export type MaterialsForMatching = {
  public: PublicMaterial[];
  afterMutual: AfterMutualMaterial[];
  internal: InternalMaterial[];
};

/**
 * マッチングの材料。★**`canUse(planType, "companyMaterials")` で閉じる**（ゲートはここ1か所）。
 * ⚠️ 閉じているときは null（「材料が無い」と区別する）。
 * ⚠️ restricted の項目は**マッチングからも外す**（選考に使ってはいけない内容のため）。
 * ⚠️ 未確定の項目は「内部のみ」として扱う（公開・合意後には決して入れない）。
 * ⚠️ 2026-10-09 時点で**呼び出し元は無い**（提案の根拠への組み込みは依頼③）。
 */
export async function getMaterialsForMatching(
  companyId: string, planType: PlanType | null,
): Promise<MaterialsForMatching | null> {
  if (!canUse(planType, "companyMaterials")) return null;
  const { data, error } = await createAdminClient()
    .from("ow_company_material_items")
    .select("id, category, content, visibility, confirmed_at")
    .eq("company_id", companyId)
    .eq("restricted_flag", false)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[companyMaterials] getMaterialsForMatching:", error.message);
    return null;
  }
  const out: MaterialsForMatching = { public: [], afterMutual: [], internal: [] };
  for (const r of data ?? []) {
    const base = { id: r.id as string, category: r.category as MaterialCategory, content: r.content as string };
    const confirmed = r.confirmed_at != null;
    if (confirmed && r.visibility === "public") out.public.push({ kind: "public", ...base });
    else if (confirmed && r.visibility === "after_mutual") out.afterMutual.push({ kind: "after_mutual", ...base });
    else out.internal.push({ kind: "internal", ...base, confirmed });
  }
  return out;
}

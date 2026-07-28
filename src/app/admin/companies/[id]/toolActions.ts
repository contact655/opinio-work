"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
}

export type ToolMaster = {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  sort_order: number;
};

export type CompanyToolRow = {
  id: string;
  tool_id: string;
  note: string | null;
  sort_order: number;
  created_at: string;
  name: string;
  category: string;
};

export async function getAllToolMasters(): Promise<ToolMaster[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_tool_masters")
    .select("id, name, aliases, category, sort_order")
    .eq("is_active", true)
    .order("category")
    .order("sort_order");
  if (error) {
    console.error("[getAllToolMasters]", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    aliases: (row.aliases as string[]) ?? [],
    category: row.category,
    sort_order: row.sort_order,
  }));
}

export async function getCompanyToolsForAdmin(companyId: string): Promise<CompanyToolRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ow_company_tools")
    .select("id, tool_id, note, sort_order, created_at, ow_tool_masters!tool_id(name, category, sort_order)")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[getCompanyToolsForAdmin]", error.message);
    return [];
  }
  return (data ?? []).map((row) => {
    const master = (row as unknown as { ow_tool_masters: { name: string; category: string; sort_order: number } | null }).ow_tool_masters;
    return {
      id: row.id,
      tool_id: row.tool_id,
      note: row.note,
      sort_order: row.sort_order,
      created_at: row.created_at,
      name: master?.name ?? "",
      category: master?.category ?? "",
    };
  });
}

export async function addCompanyTool(
  companyId: string,
  toolId: string,
  note: string,
): Promise<{ error?: string }> {
  if (!UUID_RE.test(companyId) || !UUID_RE.test(toolId)) return { error: "Invalid ID" };
  await assertAdmin();
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("ow_company_tools")
    .select("sort_order")
    .eq("company_id", companyId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = ((existing?.[0]?.sort_order as number | undefined) ?? 0) + 1;
  const { error } = await admin.from("ow_company_tools").insert({
    company_id: companyId,
    tool_id: toolId,
    note: note.trim() || null,
    sort_order: nextOrder,
  });
  if (error) {
    if (error.code === "23505") return { error: "このツールは既に追加されています" };
    return { error: error.message };
  }
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath(`/companies/${companyId}`);
  return {};
}

export async function removeCompanyTool(
  companyId: string,
  rowId: string,
): Promise<{ error?: string }> {
  if (!UUID_RE.test(companyId) || !UUID_RE.test(rowId)) return { error: "Invalid ID" };
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("ow_company_tools")
    .delete()
    .eq("id", rowId)
    .eq("company_id", companyId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath(`/companies/${companyId}`);
  return {};
}

export async function updateCompanyToolNote(
  companyId: string,
  rowId: string,
  note: string,
): Promise<{ error?: string }> {
  if (!UUID_RE.test(companyId) || !UUID_RE.test(rowId)) return { error: "Invalid ID" };
  await assertAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("ow_company_tools")
    .update({ note: note.trim() || null })
    .eq("id", rowId)
    .eq("company_id", companyId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath(`/companies/${companyId}`);
  return {};
}

export async function createToolMasterAndAdd(
  companyId: string,
  name: string,
  category: string,
  aliasesRaw: string,
  note: string,
): Promise<{ error?: string }> {
  const trimmedName = name.trim();
  if (!trimmedName) return { error: "ツール名を入力してください" };
  if (!UUID_RE.test(companyId)) return { error: "Invalid companyId" };
  await assertAdmin();
  const admin = createAdminClient();

  // 重複チェック（name の大文字小文字無視）
  const { data: nameDup } = await admin
    .from("ow_tool_masters")
    .select("id, name")
    .ilike("name", trimmedName)
    .limit(1);
  if (nameDup && nameDup.length > 0) {
    return { error: `「${nameDup[0].name}」として既に登録されています。検索欄でそちらを選択してください。` };
  }

  const aliases = aliasesRaw
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const { data: newMaster, error: insertError } = await admin
    .from("ow_tool_masters")
    .insert({ name: trimmedName, category, aliases, sort_order: 999, is_active: true })
    .select("id")
    .single();
  if (insertError) return { error: insertError.message };

  return addCompanyTool(companyId, newMaster.id, note);
}

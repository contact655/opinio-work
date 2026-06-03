import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "ファイルがありません" }, { status: 400 });

  // 拡張子取得
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const storagePath = `mentors/photos/mentor-${params.id}.${ext}`;

  // Supabase Storage にアップロード
  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("ow-uploads")
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage
    .from("ow-uploads")
    .getPublicUrl(storagePath);

  // DB 更新
  const { error: dbError } = await supabase
    .from("ow_mentors")
    .update({ photo_url: publicUrl })
    .eq("id", params.id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ photo_url: publicUrl });
}

import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAIL_SETTING_KEYS, type EmailSettingKey } from "@/lib/constants/emailSettings";

/**
 * ★メールから、ログインせずにそのお知らせだけを止める（2026-10-20 / 柴さんの判断）。
 *
 * それまでメール末尾の「設定」リンクはログインが要り、止めたい人がその場で止められなかった
 * （＝迷惑メールとして報告されやすく、報告が増えるとほかのメールも届きにくくなる）。
 *
 * ── 仕組み ──────────────────────────────────────────────────────────────────
 * - リンクは `/unsubscribe?t=<トークン>`。トークンは「誰の（auth の user id）・どの設定か」に
 *   HMAC の署名を付けたもの。**改ざんすると通らない。** 止められるのはその人のその設定だけ
 * - ⚠️★**GET では止めない。** メールの安全確認ツールがリンクを先に開くことがあるので、
 *   ページで「止める」を押した POST で初めて止める（`/api/unsubscribe`）
 * - Gmail などの「配信停止」ボタンには `List-Unsubscribe` ＋ `List-Unsubscribe-Post`（RFC 8058）。
 *   こちらはメールソフトが POST してくるので、そのまま止める
 * - 期限は付けない（古いメールからでも止められるように）。止めるだけで、オンに戻すことはできない
 *   （戻すのは設定画面。ログインが要る）
 *
 * ⚠️ 署名の鍵は `UNSUBSCRIBE_SECRET`。無ければ service role の鍵から派生させる（新しい環境変数を
 *    必須にしないため）。⚠️ 鍵そのものは使わず、HMAC で用途を分けた値を使う。
 *    どちらも無ければリンクを作らない（null）。そのときメールには従来の「設定」リンクだけが出る。
 * ⚠️ `ow_profiles.user_id` は **auth 空間**。トークンに入れるのも auth の user id。
 */

const SITE = "https://opinio.jp";

function signingKey(): Buffer | null {
  const own = process.env.UNSUBSCRIBE_SECRET;
  if (own) return Buffer.from(own, "utf8");
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) return null;
  return createHmac("sha256", base).update("opinio-unsubscribe-v1").digest();
}

const b64url = (b: Buffer) => b.toString("base64url");

function sign(payload: string, key: Buffer): string {
  return b64url(createHmac("sha256", key).update(payload).digest());
}

/** トークンを作る。鍵が無ければ null */
export function unsubscribeToken(authUserId: string, setting: EmailSettingKey): string | null {
  const key = signingKey();
  if (!key) return null;
  const payload = b64url(Buffer.from(JSON.stringify({ u: authUserId, k: setting, v: 1 }), "utf8"));
  return `${payload}.${sign(payload, key)}`;
}

/** トークンを確かめる。正しければ誰のどの設定か、だめなら null */
export function verifyUnsubscribeToken(token: string | null | undefined): { authUserId: string; setting: EmailSettingKey } | null {
  if (!token || token.length > 1000) return null;
  const key = signingKey();
  if (!key) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const obj = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: unknown; k?: unknown; v?: unknown };
    if (obj.v !== 1 || typeof obj.u !== "string" || typeof obj.k !== "string") return null;
    if (!(EMAIL_SETTING_KEYS as readonly string[]).includes(obj.k)) return null;
    return { authUserId: obj.u, setting: obj.k as EmailSettingKey };
  } catch {
    return null;
  }
}

/**
 * メールに付けるもの（本文のリンクと、メールソフトの「配信停止」用のヘッダー）。
 * 鍵が無いときは null（呼び出し側は従来どおり設定画面へのリンクだけを出す）。
 */
export function unsubscribeFor(authUserId: string, setting: EmailSettingKey): { url: string; headers: Record<string, string> } | null {
  const t = unsubscribeToken(authUserId, setting);
  if (!t) return null;
  const q = encodeURIComponent(t);
  return {
    url: `${SITE}/unsubscribe?t=${q}`,
    headers: {
      "List-Unsubscribe": `<${SITE}/api/unsubscribe?t=${q}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/** 止める。⚠️ 設定画面（/api/jobseeker/email-settings）と同じ書き方（行が無ければ作る） */
export async function applyUnsubscribe(authUserId: string, setting: EmailSettingKey): Promise<boolean> {
  const admin = createAdminClient();
  const { data: existing, error: eErr } = await admin.from("ow_profiles").select("id").eq("user_id", authUserId).maybeSingle();
  if (eErr) { console.error("[unsubscribe] ow_profiles:", eErr.message); return false; }
  const patch = { [setting]: false } as Partial<Record<EmailSettingKey, boolean>>;
  const { error } = existing
    ? await admin.from("ow_profiles").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", authUserId)
    : await admin.from("ow_profiles").insert({ user_id: authUserId, ...patch });
  if (error) { console.error("[unsubscribe] update:", error.message); return false; }
  console.log(`[unsubscribe] 止めた setting=${setting}`);
  return true;
}

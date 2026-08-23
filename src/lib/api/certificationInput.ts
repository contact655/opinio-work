import { NextResponse } from "next/server";
import { optionalText } from "@/lib/api/normalize";

/**
 * 資格（`ow_user_certifications`）のリクエスト検証（2026-08-24）。
 *
 * ⚠️ **POST と PUT で同じものを使う。** 片方にだけ検証を書くと、
 *    「新規では弾かれるのに編集では通る」形の穴ができる。
 *    `awards` は POST / PUT に同じ検証を**コピーして**持っており、
 *    実際に `awarded_at` の扱いが両方に重複している。そこは真似しない。
 *
 * ⚠️ **400 は `{ error: コード, message: 画面に出す文 }`。**
 *    `message` を省かない（省くと画面に「保存に失敗しました」としか出ず、
 *     何を直せばよいか分からない。2026-08-16 に content-links で踏んでいる）。
 */

/** 保存に使う値。`sort_order` と `user_id` は呼び出し側が付ける */
export type CertificationInput = {
  name: string;
  issuer: string | null;
  issued_at: string | null;
  credential_id: string | null;
  credential_url: string | null;
};

/** `YYYY-MM` か `YYYY-MM-DD` を受ける。⚠️ 画面は年月までしか入力させない */
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/;

export function parseCertificationBody(
  body: Record<string, unknown>
): CertificationInput | NextResponse {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 200) {
    return NextResponse.json(
      { error: "INVALID_NAME_LENGTH", message: "資格名は1〜200字で入力してください。" },
      { status: 400 }
    );
  }

  /* ★発行日は **`YYYY-MM-01` に正規化してから**入れる。
        ⚠️ Postgres は `'2025-01'::date` を **22007 で拒否する**（実測 2026-08-24）。
           年月だけを受け取ってそのまま渡すと INSERT が 500 になる。
        ⚠️ `ow_user_awards` の API は正規化しておらず、この形の不具合を抱えている
           （画面が日まで送っているので今は表面化していない）。docs/todo.md 参照。 */
  let issuedAt: string | null = null;
  if (typeof body.issued_at === "string" && body.issued_at.trim() !== "") {
    const raw = body.issued_at.trim();
    if (!MONTH_RE.test(raw)) {
      return NextResponse.json(
        { error: "INVALID_ISSUED_AT", message: "発行日は年と月を選んでください。" },
        { status: 400 }
      );
    }
    issuedAt = raw.length === 7 ? `${raw}-01` : raw;
  }

  /* ★認証URL。**https のみ**（content-links と同じ判定に揃える）。
        ⚠️ 空は正常（任意項目なので null）。不正は 400。この2つを混同しない。 */
  let credentialUrl: string | null = null;
  if (typeof body.credential_url === "string" && body.credential_url.trim() !== "") {
    const raw = body.credential_url.trim();
    if (raw.length > 2048) {
      return NextResponse.json(
        { error: "INVALID_URL", message: "認証URLは2048字以内で入力してください。" },
        { status: 400 }
      );
    }
    try {
      if (new URL(raw).protocol !== "https:") {
        return NextResponse.json(
          { error: "INVALID_URL", message: "認証URLは https:// で始まるURLを入力してください。" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "INVALID_URL", message: "認証URLの形式が正しくありません。" },
        { status: 400 }
      );
    }
    credentialUrl = raw;
  }

  return {
    name,
    issuer: optionalText(body.issuer, 100),
    issued_at: issuedAt,
    credential_id: optionalText(body.credential_id, 100),
    credential_url: credentialUrl,
  };
}

/** SELECT で返す列。⚠️ `.select()` を引数なしで呼ばない（列単位 GRANT に弾かれる） */
export const CERTIFICATION_COLS =
  "id, name, issuer, issued_at, credential_id, credential_url, sort_order" as const;

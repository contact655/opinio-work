/**
 * ★職歴を「作る」ときの body の型と、唯一の送信口（2026-09-11）。
 *
 * ── なぜ型を分けたか ──────────────────────────────────────────────────────
 * ⚠️★**作成時の公開設定（`visibility_company`）は、呼び出し側が決めてはいけない。**
 *    値は API が1箇所で決める（**既存の職歴から引き継ぐ／無ければ `real``**）。
 *
 *    2026-09-11 に実際に踏んだ: API に引き継ぎを入れたのに、**入口3つすべてが
 *    `visibility_company` を明示的に送っていて、その分岐に一度も到達していなかった。**
 *    結果、**会社名を伏せている人が職歴を1件足すと、その1件だけ実名で出る**状態だった。
 *
 * ⇒ **この型に `visibility_company` を持たせない。** 4つ目の入口が直書きしたら
 *    **TypeScript の余剰プロパティ検査でビルドが落ちる**
 *    （`EXPERIENCE_EDITOR_COLS` で採った「型で気づかせる」と同じ考え方）。
 *
 * ⚠️★**ただし型だけでは止まらない。** 余剰プロパティ検査が効くのは
 *    **オブジェクトリテラルを直接渡したときだけ**で、`Record<string, unknown>` を
 *    組み立ててから渡すと素通りする。**だからサーバー側も読まない**（二重の守り）。
 *    サーバー側の扱いは `POST /api/jobseeker/experiences` を参照。
 *
 * ⚠️ **更新（PUT）はこの型を使わない。** あちらは本人が公開範囲を変える経路なので、
 *    `visibility_company` を受け取ってよい。**作成時に受け付けないだけ。**
 */
import type { GapInput } from "@/lib/constants/careerReasons";

export const EXPERIENCE_CREATE_PATH = "/api/jobseeker/experiences";

/** 会社の指定。⚠️ **XOR**。2つ以上入れると API が 400 を返す。 */
export type ExperienceCompanyBody =
  | { company_id: string; company_text?: never; company_anonymized?: never }
  | { company_text: string; company_id?: never; company_anonymized?: never }
  | { company_anonymized: string; company_id?: never; company_text?: never };

/** 入社理由まわり（`parseReasonFields` が読む範囲）。 */
export type ExperienceReasonBody = {
  prefecture?: string | null;
  remote_work_status?: string | null;
  join_reasons?: string[];
  join_reason_primary?: string | null;
  leave_reasons?: string[];
  /** ⚠️ `rating` は **string**（`GapInput` と同じ）。数値にしないこと */
  gaps?: GapInput[];
};

/**
 * ★作成時に送ってよいもの。**`visibility_company` は入っていない（意図的）。**
 * ⚠️ ここに足す前に、上のコメントを読むこと。
 */
export type CreateExperienceBody = ExperienceReasonBody & {
  role_category_id: string;
  /** 複数職種。⚠️ 1つだけのときは送らない（`role_category_id` と重複する） */
  role_category_ids?: string[];
  role_title?: string;
  /** "YYYY-MM" */
  started_at: string;
  /** "YYYY-MM"。⚠️ 現職なら送らない */
  ended_at?: string;
  is_current?: boolean;
  description?: string;
  join_reason?: string;
  employment_type?: string;
  display_order?: number;
  department?: string | null;
  rank?: string | null;
  visibility_reason?: boolean;
} & Partial<ExperienceCompanyBody>;

/**
 * 職歴を作る。⚠️★**作成はこの関数だけを通すこと。**
 * `fetch("/api/jobseeker/experiences", { method: "POST" })` を新しく書かない。
 */
export async function postExperience(body: CreateExperienceBody): Promise<Response> {
  return fetch(EXPERIENCE_CREATE_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

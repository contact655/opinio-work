"use client";

import { useState } from "react";
import { FormSection } from "@/components/profile/editor/formKit";
import { GENDER_OPTIONS, type Gender } from "@/lib/constants/gender";
import { PHONE_MAX, isValidPhone } from "@/lib/constants/personName";
import { RESIDENCE_OPTION_GROUPS } from "@/lib/utils/location";

/**
 * `/mypage/settings` の「基本情報」（2026-09-14 / 柴さんの指示）。
 * **居住地・性別・電話番号**。どれも**任意**。
 *
 * ── ⚠️★なぜオンボーディングの冒頭に置かないか ────────────────────────────────
 * 氏名・ふりがな・生年月日は入口で必須にしたが、この3つは**ここに置いた**。
 *   ・**電話番号はいま使い道が無い**（スカウトは停止中、応募も面談も0件）。
 *     使わないのに登録直後に求めると、不信感のわりに得るものがない。
 *     **実際に要る場面ができたら、その場で聞く**ほうが答えてもらえる。
 *   ・**性別は絞り込みに使わない**と決めたので、入口で聞く価値が小さいわりに
 *     離脱要因になりやすい。
 *
 * ── ⚠️★★出していい場所・いけない場所 ──────────────────────────────────────
 * **性別は年齢とまったく同じ扱い**（`lib/constants/gender.ts` に理由がある）。
 *   ○ 本人のこの画面 ／ ✗ 一覧 ／ ✗ 企業に絞り込ませない
 * **電話番号は企業に出さない。本人と運営だけ。**
 * ⚠️★守り方は「規約」ではなく**型**。一覧用の型（`PeopleCard` / `CompanyEmployee` /
 *    `biz/candidates` の `Candidate`）に `gender` や `phone` を**持たせないこと**。
 *    型に無ければ表示も絞り込みも書けない。
 *
 * ⚠️ 居住地は既存の `ow_users.location` を再利用している。
 *    ⚠️★**この列は anon にも SELECT が配られており、`/u/[id]` に表示される。**
 *       つまり**公開項目**。性別・電話番号と同じ箱に並んでいるが**扱いが違う**ので、
 *       画面にもその旨を書いてある。**注記を消さないこと。**
 */
export default function BasicInfoSettings({
  initialLocation, initialGender, initialPhone,
}: {
  initialLocation: string | null;
  initialGender: Gender | null;
  initialPhone: string | null;
}) {
  const [location, setLocation] = useState(initialLocation ?? "");
  const [gender, setGender] = useState<string>(initialGender ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");

  const [saved, setSaved] = useState({
    location: initialLocation ?? "", gender: (initialGender ?? "") as string, phone: initialPhone ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ⚠️ dirty は**保存済みの値**と比べる（CLAUDE.md「保存済みの値を、唯一の基準にする」）。
        マウント時に控えた値やプロップを基準にすると、開き直したときに 食い違う。 */
  const dirty = location !== saved.location || gender !== saved.gender || phone !== saved.phone;

  async function save() {
    if (saving || !dirty) return;
    /* ⚠️ 形式の判定は `personName.ts` の1箇所。ここに正規表現を書き写さない。 */
    if (phone.trim() && !isValidPhone(phone)) {
      setError("電話番号の形式が正しくありません。");
      return;
    }
    setSaving(true); setError(null); setDone(false);
    try {
      const res = await fetch("/api/jobseeker/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        /* ⚠️ 空文字は「消した」＝ null。API 側で `optionalText` が畳む。
              ⚠️★姓名はここから送らない（この画面に入力欄が無い）。送ると `name` を
                 空から作り直すことになる。 */
        body: JSON.stringify({
          location: location.trim(),
          gender: gender,
          phone: phone.trim(),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j?.message === "string" ? j.message : "");
      }
      setSaved({ location: location.trim(), gender, phone: phone.trim() });
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "保存できませんでした。もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormSection title="基本情報" desc="どれも任意です。あとから変更できます。">
      <div style={{ display: "grid", gap: 18 }}>
        <div>
          <label htmlFor="bi-location" style={labelStyle}>お住まい</label>
          <select id="bi-location" value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle}>
            <option value="">選択しない</option>
            {/* ⚠️★選択肢は `RESIDENCE_OPTION_GROUPS` の1箇所だけ。ここで展開し直さない
                   （並びが割れる。CLAUDE.md）。見出しも同じ文言を使う。
                ⚠️★**絞り込み用の `PREFECTURE_FILTER_GROUPS` に戻さないこと**（2026-09-15）。
                   あれは47件で「海外」「非公開」を持たない。戻すと `/mypage` の
                   「所在地」で選べる2つがここで**空欄に見え、保存で消える。** */}
            {RESIDENCE_OPTION_GROUPS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.prefectures.map((p) => <option key={p} value={p}>{p}</option>)}
              </optgroup>
            ))}
          </select>
          {/* ⚠️★**この一文を消さないこと。** 居住地だけ公開項目で、下の2つと扱いが違う。 */}
          <p style={noteStyle}>プロフィールページに表示されます。</p>
        </div>

        <div>
          <label htmlFor="bi-gender" style={labelStyle}>性別</label>
          <select id="bi-gender" value={gender} onChange={(e) => setGender(e.target.value)} style={inputStyle}>
            <option value="">選択しない</option>
            {/* ⚠️ 語彙は `lib/constants/gender.ts`。ここに選択肢を書かない。
                   ⚠️★「回答しない」を外さないこと。 */}
            {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {/* ⚠️★**この一文を消さないこと。** 年齢と同じ約束をここでしている。 */}
          <p style={noteStyle}>ユーザー一覧には表示されません。企業が性別で絞り込むことはできません。</p>
        </div>

        <div>
          <label htmlFor="bi-phone" style={labelStyle}>電話番号</label>
          <input
            id="bi-phone" type="tel" inputMode="tel" autoComplete="tel"
            value={phone} maxLength={PHONE_MAX}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="090-1234-5678" style={inputStyle}
          />
          {/* ⚠️★**この一文を消さないこと。** 企業に出さないという約束がここにしか無い。 */}
          <p style={noteStyle}>企業には表示されません。OPINIO の運営から連絡するときに使います。</p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
        <button
          type="button" onClick={save} disabled={saving || !dirty}
          className="btn-fixed-size"
          style={{
            fontSize: 13, fontWeight: 700, fontFamily: "inherit",
            padding: "10px 22px", borderRadius: 8, border: "none",
            background: dirty ? "var(--royal)" : "var(--line)",
            color: dirty ? "#fff" : "var(--ink-mute)",
            cursor: saving ? "wait" : dirty ? "pointer" : "default",
          }}
        >
          {saving ? "保存中..." : "保存する"}
        </button>
        {done && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)" }}>保存しました</span>}
        {error && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--error)" }}>{error}</span>}
      </div>
    </FormSection>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%", maxWidth: 320, fontSize: 14, fontFamily: "inherit", color: "var(--ink)",
  padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, background: "#fff",
};
const noteStyle: React.CSSProperties = {
  fontSize: 12, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.7,
};

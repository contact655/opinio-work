"use client";

import { useMemo } from "react";

export type PickerRole = { id: string; name: string; parent_id: string | null };

/**
 * 職種の選択（大分類の親チップ → その親の小分類が下に開く）。
 *
 * ⚠️★**154件をフラットに並べないこと。** 2026-08-06 に職歴エディタで
 *    「105件を目視で探させる UI が機能していなかった」と分かっている。
 *
 * ── 2026-09-04: 親と子の関係が画面から読めていなかった（柴さんの指摘）────────
 * 親を2つ選ぶと、**子チップが1続きの塊**（営業14件＋エンジニア14件＝28件）に見え、
 * どこまでが「営業の子」なのかが分からなかった。見出しは
 * 「さらに近いものがあれば選んでください（任意）。」が**全体で1つ**しかなく、
 * 親チップ列と子チップ列が**同じ平面**に並ぶので、上下関係も伝わらない。
 *
 * → 直したのは3つ。**どれも「親の名前をどこに出すか」の話で、判定は変えていない。**
 *   ① 子の並びを**親ごとの箱**にして、箱に**その親の名前**を書く
 *   ② 箱を**左のレールで字下げ**して、親チップ列の下位だと分かるようにする
 *   ③ 子を開いている親チップに**下向きシェブロン**を付ける（開閉印。`4faefe4c` と同じ語彙）
 *
 * ⚠️★**親チップに子の名前を出さないこと**（2026-08-29 に一度やって戻した）。
 *    子を選ぶと親チップと子チップが**同じラベルで2つ並び**、どちらを押しているのか
 *    分からなくなる。①で出すのは**親の名前**であり、しかも**押せない見出し**にしてある
 *    （チップの形にしない・`<button>` にしない）。ここを押せる形に変えないこと。
 */
export function RolePicker({
  roles, value, onChange, max,
}: {
  roles: PickerRole[];
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
}) {
  const topRoles = useMemo(() => roles.filter((r) => !r.parent_id), [roles]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, PickerRole[]>();
    for (const r of roles) {
      if (!r.parent_id) continue;
      const arr = m.get(r.parent_id) ?? [];
      arr.push(r);
      m.set(r.parent_id, arr);
    }
    return m;
  }, [roles]);

  /* 親そのものを選んでいる場合と、その配下の子を選んでいる場合の両方で開く */
  const openParents = topRoles.filter((p) => {
    const ids = (childrenOf.get(p.id) ?? []).map((c) => c.id);
    return ids.length > 0 && (value.includes(p.id) || value.some((x) => ids.includes(x)));
  });

  return (
    <>
      <p style={{ fontSize: 12, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.6 }}>
        当てはまるものを選んでください（{max}つまで）。あとから詳しく設定できます。
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: openParents.length ? 14 : 20 }}>
        {topRoles.map((r) => {
          /* ★その親の**子が選ばれていても親を選択中として見せる**（2026-08-29）。
                こうしないと、子を選んだ瞬間に**画面から選択が消える**
                （親チップ列に子は無いため）。実際にテストで踏んだ。 */
          const childIds = (childrenOf.get(r.id) ?? []).map((c) => c.id);
          const active = value.includes(r.id) || value.some((id) => childIds.includes(id));
          /* 下に小分類の箱を開いている親だけ、開閉印を出す */
          const opened = active && childIds.length > 0;
          return (
            <button
              key={r.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(
                /* 選択中なら、親も配下の子もまとめて外す */
                active
                  ? value.filter((x) => x !== r.id && !childIds.includes(x))
                  /* ⚠️ 上限を超えたら足さない。API 側も5件で切るので、
                        ここで通すと「選べたのに保存されない」になる。 */
                  : value.length >= max ? value : [...value, r.id]
              )}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "7px 13px", borderRadius: 100,
                border: `1px solid ${active ? "var(--royal)" : "var(--line)"}`,
                background: active ? "var(--royal-50)" : "#fff",
                color: active ? "var(--royal)" : "var(--ink-soft)",
                fontSize: 13, fontWeight: active ? 700 : 500,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              {/* ⚠️★**親チップに子の名前を出さないこと**（2026-08-29 に一度やって戻した）。
                     子を選ぶと親チップと子チップが**同じラベルで2つ並び**、
                     どちらを押しているのか分からなくなる（テストでも取り違えた）。
                     選ばれた子は**下の箱でハイライト**して示す。 */}
              {r.name}
              {opened && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* ★選んだ親の小分類（2026-08-29）。⚠️ 選ばなくても進める。
             子を選ぶと親の選択は外し、子に置き換える（親と子が両方付くと
             「職種 × 年数」の集計で重複して見えるため）。 */}
      {openParents.length > 0 && (
        <div style={{ marginBottom: 20, display: "grid", gap: 10 }}>
          {openParents.map((p) => (
            /* ⚠️★**親ごとに箱を分ける。** 1続きの並びに戻さないこと（2026-09-04）。
                  親を2つ選ぶと28件が地続きになり、どこからが別の親の子か読めなくなる。 */
            <div
              key={p.id}
              style={{
                /* ⚠️ 白のままだと親チップ列と同じ平面に見える。**薄く敷いて1段下げる。**
                      チップは白のままなので、敷いたぶんだけ子チップが浮いて見える。 */
                background: "var(--bg-tint)",
                border: "1px solid var(--line-soft)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              {/* ⚠️ 押せる見た目にしないこと（チップの形・枠・背景を付けない）。
                     親チップと取り違える。ここは「どの親の話か」を示す見出し。 */}
              <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: "0 0 7px", lineHeight: 1.6 }}>
                <strong style={{ color: "var(--ink-soft)", fontWeight: 700 }}>{p.name}</strong>
                {" "}のなかで、さらに近いものがあれば（任意）
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(childrenOf.get(p.id) ?? []).map((c) => {
                  const on = value.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onChange(
                        on
                          /* もう一度押したら親に戻す（選択が空になる状態を作らない） */
                          ? [...value.filter((x) => x !== c.id), p.id]
                          /* 親を外して子に差し替える。⚠️ 上限は親を外したぶん空くので超えない */
                          : [...value.filter((x) => x !== p.id), c.id].slice(0, max)
                      )}
                      style={{
                        padding: "5px 11px", borderRadius: 100,
                        border: `1px solid ${on ? "var(--royal)" : "var(--line)"}`,
                        background: on ? "var(--royal-50)" : "#fff",
                        color: on ? "var(--royal)" : "var(--ink-soft)",
                        fontSize: 12, fontWeight: on ? 700 : 500,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

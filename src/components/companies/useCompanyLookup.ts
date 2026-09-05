"use client";

import { useCallback, useRef, useState } from "react";

/**
 * 企業ピッカーの**取得ロジック**（`/api/companies/lookup`）を1箇所にする。
 *
 * ── ⚠️★なぜ「見た目ごと共通部品にする」ではないのか（2026-09-05）──────────────
 * 経歴編集（`CareerHistoryEditor` の `CompanySearch`）とオンボーディング
 * （`OnboardingClient` の `CompanyPicker`）は、**意図的に見た目と文言が違う。**
 * 差分には日付入りの根拠が残っている:
 *   ・オンボーディングは選択後の「OPINIOに掲載中の企業と連携します」を
 *     **2026-08-15 に意図して削除**した（「掲載」は運営側の事情で、
 *     本人の職歴を書く欄には関係が無い）。経歴編集には**ある**
 *   ・0件のときの文言もオンボーディングだけが持つ
 *     （「このまま進めて大丈夫です」。2026-08-13 に「候補が見つかりません」から変えた）
 *   ・自由入力の説明文も別（「OPINIO 未掲載の企業として記録します」/
 *     「あなたの経歴にこの社名で保存します」。後者は 2026-08-14 の判断）
 *   ・アバターの大きさ・色・角丸、候補行の要素（→ の有無）、
 *     検索アイコン／スピナーの有無、ドロップダウンの角丸と影
 *
 * **1つの部品に畳むと、このどれかを黙って捨てることになる。**
 * だから**共通化するのは「同じであるべきもの」だけ**にした ——
 * すなわち取得の仕方（エンドポイント・デバウンス・失敗時の扱い）。
 *
 * ⚠️ 見た目を揃えたくなったら、**それは別タスクとして提案する。**
 *    リファクタのついでに文言を1つでも変えない。
 *
 * ── 何をここに寄せたか ────────────────────────────────────────────────────
 *   ・叩く先（`/api/companies/lookup`）。2箇所に URL を書かない
 *   ・デバウンス（呼び出し側が ms を指定する。既存の値を変えないため）
 *   ・**失敗を握りつぶさない**。⚠️ オンボーディング側は `try { } finally { }` で
 *     catch が無く、ネットワーク断で**未処理の rejection**になっていた
 *   ・★**後から来た古い応答で新しい結果を上書きしない**（連番で判定）。
 *     どちらにも無かった。速く打つと「1文字前の候補」が残ることがある。
 *     ⚠️ 正常時の見え方は変わらない（同じ応答が同じ順で返るため）
 */

/** ⚠️★`/api/companies/lookup` の返り値。**id / name / isListed の3つだけ**。
       未掲載の企業も引けるようにしたぶん、返す情報を絞ってある
       （「掲載していない」という状態そのものが運営の情報なので、
        名前を引ける以上のことをさせない。2026-09-04 / 柴さんの条件）。
    ⚠️ ロゴ・業種・従業員数は**返らない**。 */
export type CompanyLookupResult = {
  id: string;
  name: string;
  /** 掲載中か。⚠️ false は「OPINIOに未掲載」＝企業ページが無い（または一覧に出していない） */
  isListed: boolean;
};

export function useCompanyLookup(options: {
  /** ⚠️ 既定値を置かない。呼び出し側の既存の値をそのまま渡させる（勝手に揃えない） */
  debounceMs: number;
  /** 取得できたときに呼ぶ。オンボーディングはこれでドロップダウンを開く */
  onResults?: (results: CompanyLookupResult[]) => void;
}) {
  const { debounceMs, onResults } = options;

  const [results, setResults] = useState<CompanyLookupResult[]>([]);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** ★発行した検索の連番。応答が返ったとき、これが最新でなければ捨てる */
  const seqRef = useRef(0);
  /* ⚠️ コールバックを deps に入れると、呼び出し側がインラインで渡したときに
        `search` の同一性が毎描画で壊れる。ref に逃がす。 */
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;

  /** 空文字なら即座に空にして返す（デバウンスを待たない。既存の挙動と同じ） */
  const search = useCallback(
    (raw: string) => {
      const q = raw.trim();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      // ⚠️ 進行中の検索を無効化する。空にした直後に古い応答が届くのを防ぐ
      seqRef.current += 1;
      if (q.length === 0) {
        setResults([]);
        return;
      }
      const seq = seqRef.current;
      debounceRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/companies/lookup?q=${encodeURIComponent(q)}`);
          if (!res.ok) {
            // ⚠️ 401（未ログイン）もここに来る。空にはするが、候補以外の導線は消さない
            console.error("[useCompanyLookup] lookup failed:", res.status);
            return;
          }
          const data = (await res.json()) as { results?: CompanyLookupResult[] };
          // ★自分より新しい検索が始まっていたら捨てる
          if (seq !== seqRef.current) return;
          const next = data.results ?? [];
          setResults(next);
          onResultsRef.current?.(next);
        } catch (err) {
          /* ⚠️ 握りつぶさない。オンボーディング側は catch が無く、
                ネットワーク断で未処理の rejection になっていた。
                ⚠️ ただし results は**触らない** —— 消すと自由入力の導線まで消える。 */
          console.error("[useCompanyLookup] lookup error:", err);
        } finally {
          if (seq === seqRef.current) setLoading(false);
        }
      }, debounceMs);
    },
    [debounceMs],
  );

  /** 選択・解除のあとに候補を畳む */
  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    seqRef.current += 1;
    setResults([]);
    setLoading(false);
  }, []);

  return { results, loading, search, clear };
}

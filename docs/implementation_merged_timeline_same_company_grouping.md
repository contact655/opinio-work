# 実装指示：MergedTimeline 同社グループ化機能

## ゴール

3画面（/profile/edit / /mypage / /u/[id]）のうち、`/mypage` と `/u/[id]` で
経歴が「会社単位でグループ化されずフラット表示」になっている問題を解消する。

CareerHistoryEditor で実装済みの「同社グループ化」を MergedTimeline でも実現し、
3画面で一貫した経歴表示を提供する。

## 前提（確定済み方針）

- **実装場所**: MergedTimeline.tsx 内部で完結（career.ts は触らない）
- **型統一**: snake_case の CareerEntry を維持（3画面で既に統一済み確認済み）
- **グループ化キー**: company_id ベース（master）+ company_name（custom）+ id（anon）
- **出戻りパターン**: 連続走査でグループ化（出戻りは自然に別グループになる、handover 低優先タスクに既載）
- **並行職グループ化との順序**: 並行職グループ化を先、同社グループ化を後（並行職は同社グループ化の対象外として通過）

## スコープ（3ファイル）

### ファイル1: `src/lib/utils/timeline.ts`

`buildTimelineCareerEntriesFromRaw` の return オブジェクトに `company_id` を追加する。

**変更箇所**: 行91〜103 の return オブジェクト

```typescript
// 変更前
return {
  id:            r.id,
  company_name,
  logo_url:      companyInfo?.logoUrl ?? null,
  ...
};

// 変更後
return {
  id:            r.id,
  company_id:    r.company_id,        // ← この1行を追加
  company_name,
  logo_url:      companyInfo?.logoUrl ?? null,
  ...
};
```

これだけ。他の修正不要。

### ファイル2: `src/components/profile/MergedTimeline.tsx`

#### 2-1: `CareerEntry` インターフェースに company_id を追加

**変更箇所**: 行8〜26 の CareerEntry interface

```typescript
export interface CareerEntry {
  id: string;
  /** 企業マスタID（master 企業の場合のみ存在、custom/anon は null） */
  company_id?: string | null;   // ← この行を追加
  /** 表示用企業名（匿名化済みの場合は "非公開" 等） */
  company_name: string;
  // ... 以降は既存のまま
}
```

#### 2-2: `RenderEntry` 型に新バリアントを追加

**変更箇所**: 行72〜76 の RenderEntry type

```typescript
type RenderEntry =
  | { kind: "future" }
  | { kind: "career";              data: CareerEntry; isParallel: boolean }
  | { kind: "career-group";        items: CareerEntry[] }
  | { kind: "career-same-company"; items: CareerEntry[]; companyKey: string }  // ← 追加
  | { kind: "education";           data: EducationEntry };
```

#### 2-3: グループ化ヘルパー関数を新規追加

`groupParallelEntries` 関数の **直後**（行末尾の `// ─── Badge sub-components ───` の直前）に
以下2関数を追加する。

```typescript
/**
 * 同社グループ化のためのキー生成。
 *
 * - master 企業（company_id あり）: `m:${company_id}` で確実に同一企業を識別
 * - custom 企業（company_id なし、company_text あり）: `c:${company_name}` で文字列一致
 * - anon 企業（company_anonymized）: `a:${id}` で個別扱い（"非公開企業"の誤統合を防ぐ）
 *
 * CareerHistoryEditor の groupStints と同じ規約。
 */
function getCompanyKey(c: CareerEntry): string {
  if (c.company_id) return `m:${c.company_id}`;
  // company_id なし & "非公開企業" 表記 = 匿名企業（XOR 制約により company_anonymized が NOT NULL）
  if (c.company_name === "非公開企業") return `a:${c.id}`;
  return `c:${c.company_name}`;
}

/**
 * RenderEntry[] を走査し、連続する同一会社の単独 career エントリを
 * "career-same-company" バリアントにまとめた RenderEntry[] を返す。
 *
 * 設計:
 * - 入力は groupParallelEntries の出力（並行グループ化済み）
 * - "career-group" バリアント（並行職）はそのまま通過（同社グループ化の対象外）
 * - 単独 "career" エントリのうち、ソート順で連続する同社のものをグループ化
 * - 2件以上が連続する場合のみ "career-same-company" に集約、1件のみは "career" のまま
 * - 出戻りパターン（連続しない同社）は自然に別グループになる（意図通り）
 *
 * 注意: ソート順を変えない走査のため、is_current DESC → started_at DESC が維持される。
 */
function groupSameCompanyEntries(entries: RenderEntry[]): RenderEntry[] {
  const result: RenderEntry[] = [];
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];

    // career-group / education / future は対象外、そのまま通過
    if (entry.kind !== "career") {
      result.push(entry);
      i++;
      continue;
    }

    const key = getCompanyKey(entry.data);
    const group: CareerEntry[] = [entry.data];
    let j = i + 1;
    while (j < entries.length) {
      const next = entries[j];
      if (next.kind === "career" && getCompanyKey(next.data) === key) {
        group.push(next.data);
        j++;
      } else {
        break;
      }
    }

    if (group.length >= 2) {
      result.push({ kind: "career-same-company", items: group, companyKey: key });
    } else {
      result.push(entry);
    }
    i = j;
  }
  return result;
}
```

#### 2-4: メインコンポーネントのパイプラインに組み込み

**変更箇所**: メインコンポーネント（行末尾近く）の以下の3行：

```typescript
// 変更前
const parallelIds = buildParallelMap(careers);
const entries = buildTimeline(careers, educations, hasFuture, parallelIds);
const renderEntries = groupParallelEntries(entries);

// 変更後
const parallelIds = buildParallelMap(careers);
const entries = buildTimeline(careers, educations, hasFuture, parallelIds);
const renderEntries = groupSameCompanyEntries(groupParallelEntries(entries));  // ← 関数で wrap
```

#### 2-5: レンダリングロジックに `"career-same-company"` ケースを追加

**変更箇所**: メインコンポーネント内、`if (entry.kind === "career-group") { ... }` の
**直後**（`if (entry.kind === "education") { ... }` の直前）に以下を追加。

UI 設計（/profile/edit 案②と整合）:
- 左 4px の会社色ボーダー（最初のエントリの logo_gradient 由来。なければ var(--royal)）
- コンテナ背景は淡色（会社色 6% 透過。logo_gradient がない場合は var(--bg-tint)）
- 会社ヘッダー（会社名 + アバター + 在籍期間合計）+ ぶら下がるポジションカード
- アイコン列は CompanyLogoIcon を最初のエントリのロゴで表示
- DateCol は「最古開始月 〜 最新終了月（is_current あれば現在）」と合計期間
- 各ポジションカードは内側に役職名 + 期間 + description

```typescript
if (entry.kind === "career-same-company") {
  const items = entry.items;
  // ソートは is_current DESC → started_at DESC で来ているため、items[0] が「最新ポジション」
  // グループ全体の代表として items[0] の会社情報を使う
  const head = items[0];
  const anyIsCurrent = items.some((c) => c.is_current);

  // グループ全体の期間: 最古 started_at 〜 最新 ended_at（any is_current なら null）
  const earliestStart = items.reduce((earliest, c) =>
    c.started_at < earliest ? c.started_at : earliest, items[0].started_at);
  const latestEnd = anyIsCurrent
    ? null
    : items.reduce<string | null>((latest, c) => {
        if (!c.ended_at) return latest;
        return !latest || c.ended_at > latest ? c.ended_at : latest;
      }, null);

  const startLabel = formatYM(earliestStart);
  const endLabel = anyIsCurrent ? "現在" : latestEnd ? formatYM(latestEnd) : "";
  const duration = formatDuration(earliestStart, latestEnd);

  // 会社色（logo_gradient の最初の色を抽出。フォールバックは royal 系）
  // logo_gradient の形式例: "linear-gradient(135deg, #002366, #3B5FD9)"
  const accentColor = head.logo_gradient
    ? (head.logo_gradient.match(/#[0-9a-fA-F]{3,6}/)?.[0] ?? "var(--royal)")
    : "var(--royal)";
  // 背景: 会社色 6% 透過（CSS で rgba 変換は煩雑なので、accentColor + 16進数透過で表現）
  const bgTint = head.logo_gradient
    ? `${accentColor}0F`  // 0F = 約 6% 透過
    : "var(--bg-tint)";

  return (
    <div key={`same-company-${entry.companyKey}`} className="tl-row">
      <div className="tl-date-col">
        <DateCol startLabel={startLabel} endLabel={endLabel} duration={duration} />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 8,
        }}
      >
        <CompanyLogoIcon
          isCurrent={anyIsCurrent}
          logo_url={head.logo_url}
          logo_letter={head.logo_letter}
          logo_gradient={head.logo_gradient}
        />
      </div>
      <div style={{ paddingTop: 8, paddingBottom: 20, paddingLeft: 12 }}>
        <div
          style={{
            background: bgTint,
            borderLeft: `4px solid ${accentColor}`,
            borderRadius: 8,
            padding: "12px 14px",
          }}
        >
          {/* 会社名ヘッダー */}
          <div style={{ marginBottom: 10 }}>
            <span
              style={{
                fontFamily: "'Noto Serif JP', serif",
                fontSize: 16,
                fontWeight: 700,
                color: "var(--ink)",
              }}
            >
              {head.company_name}
            </span>
            {anyIsCurrent && <CurrentBadge />}
          </div>

          {/* ポジションカード群 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((c) => {
              const posDuration = formatDuration(c.started_at, c.ended_at);
              return (
                <div
                  key={c.id}
                  style={{
                    background: "#fff",
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    padding: "10px 12px",
                  }}
                >
                  {/* role label + role title */}
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink)",
                      marginBottom: c.role_title ? 2 : 0,
                    }}
                  >
                    {c.role_label}
                  </div>
                  {c.role_title && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--ink-mute)",
                        marginBottom: 4,
                      }}
                    >
                      {c.role_title}
                    </div>
                  )}
                  {/* 期間 */}
                  {posDuration && (
                    <div
                      style={{
                        fontFamily: "Inter, sans-serif",
                        fontSize: 11,
                        color: "var(--ink-mute)",
                        marginBottom: c.description ? 4 : 0,
                      }}
                    >
                      {formatYM(c.started_at)}
                      {" — "}
                      {c.is_current ? "現在" : c.ended_at ? formatYM(c.ended_at) : ""}
                      {" "}（{posDuration}）
                    </div>
                  )}
                  {/* description */}
                  {c.description && (
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--ink-soft)",
                        lineHeight: 1.75,
                        margin: "6px 0 0",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {c.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## 実装手順

1. ファイル1（timeline.ts）の1行追加
2. ファイル2（MergedTimeline.tsx）の 2-1, 2-2 の型追加
3. ファイル2の 2-3 のヘルパー関数追加（既存 `groupParallelEntries` の直後）
4. ファイル2の 2-4 のパイプライン1行修正
5. ファイル2の 2-5 のレンダリングケース追加
6. `npm run build` で TypeScript エラーなしを確認
7. ローカル `npm run dev` で /profile/edit / /mypage / /u/[id] の3画面確認
8. git push origin main → Vercel デプロイ
9. 本番でも3画面動作確認

---

## 動作確認チェックリスト（実装後）

実装後、以下のシナリオで動作確認してください。

### シナリオ1: 単一企業1ポジション（最も基本的なケース）
- /u/[id] と /mypage で従来通り単一カードで表示される
- 既存の挙動が壊れていない

### シナリオ2: 同一企業で複数ポジション（昇進・異動）
- 例: A社 IS(2018-2020) → A社 FS(2020-現在)
- グループヘッダー（A社 + 在籍期間合計）+ 2つのポジションカードが表示される
- 在籍中バッジは会社ヘッダーに1つだけ表示

### シナリオ3: 出戻りパターン
- 例: A社(2018-2020) → B社(2020-2023) → A社(2023-現在)
- A社が**2つの別グループ**として表示される（B社を挟んで上下に分かれる）
- グループ内で誤統合されない

### シナリオ4: 並行職パターン（既存挙動の維持）
- 例: 同一開始月に A社と B社に同時所属
- "career-group" バリアントで横並びカード表示（既存挙動）

### シナリオ5: 並行職 + 同社の混在
- 例: A社(2018-2020) → A社(2020-現在) + B社(2020-現在)
- A社 2件は同社グループ、A社(2020-現在) + B社(2020-現在) は並行グループ
- パイプライン上、並行グループが先に発火するため A社(2020-現在) は並行扱いになり、
  A社の同社グループには A社(2018-2020) のみ残る → 期待通り

### シナリオ6: 匿名企業の扱い
- 例: 非公開企業(2018-2020) + 非公開企業(2020-現在)（2つは別企業）
- それぞれ単独カードで表示される（誤統合されない）
- グループ化キーが `a:${id}` で個別扱いされていることの検証

---

## 注意事項（絶対遵守）

- **1タスクだけ**: 上記スコープ外の改修は行わない
- **想定外の挙動があれば即停止**: 動作確認で意図と異なる表示が出たら、勝手に直さず柴さんに報告
- **「〜のはず」禁止**: 不確実な箇所があれば SQL や grep で確認してから進める
- **npm run build を push 前に必ず実行**: TypeScript エラーで Vercel デプロイ失敗を防ぐ
- **コミットメッセージ**: `feat(timeline): MergedTimeline で同社経歴をグループ化（/mypage と /u/[id] 横断対応）`

---

## 完了時の報告フォーマット

実装完了後、以下を報告してください：

```
## 完了報告

### 変更ファイル
- src/lib/utils/timeline.ts: +1行
- src/components/profile/MergedTimeline.tsx: +N行 / -N行

### コミットハッシュ
<commit hash>

### npm run build 結果
<成功/失敗 + エラーがあれば全文>

### Vercel デプロイ結果
<commit hash の Ready 確認 + 本番 URL でのスモークテスト結果>

### 動作確認6シナリオ
- シナリオ1: ✅/❌
- シナリオ2: ✅/❌
- シナリオ3: ✅/❌
- シナリオ4: ✅/❌
- シナリオ5: ✅/❌
- シナリオ6: ✅/❌

### 想定外の挙動・気付き
<あれば全部記述>
```

---
description: 画面まわりの計測と切り分け。速度の前後比較、フォントの重さ、横はみ出し、インライン style と CSS の優先順位 — いずれも「測り方を間違えると逆の結論が出る」ものだけを集めてある。
paths: ["**/*.tsx", "**/*.jsx", "**/*.css"]
---

### ⚠️ 速度の前後比較で踏んだ罠（2026-08-09 確立）

同じ日に**4回**、誤った結論を出しかけた。どれも「測り方」が原因。

| # | 何をした | 何が起きたか |
|---|---|---|
| ① | 変更後だけ `curl --compressed` を付けた | 309KB→34KB（89%減）と出た。**圧縮後と非圧縮を比べていた**。同条件では 309→299KB |
| ② | 変更前は2秒間隔、変更後は60秒間隔で測った | 「悪化した」と出た。60秒空くとコールドスタートに当たる |
| ③ | 「文字列が**無い**こと」を反映の証拠にした | HTMLに元から無い文字列で判定し、毎回「反映済み」になった。**肯定形で判定する**こと |
| ④ | CSSファイルを連結して grep した | ループが1ファイル取りこぼし、「本番にCSSが無い」と誤検知。`--royal` すら0件という**不自然さ**で気づいた |
| ⑤ | **status を見ずに時間だけ測った** | ベースラインにした `/api/stats` が**既に削除されていて 404**。「認証なしAPIは0.067秒」と誤認し、「認証だけが重い」と誤った結論を書いた |

#### 守ること

- **対照を取る。** 変更していないページを交互に測る。
  両方ブレていれば環境ノイズ、片方だけ変われば本物
- **中央値で見る。** 本番の TTFB は 0.3〜4.6秒とブレるので、1〜3サンプルでは判断できない
- **同条件で測る。** 圧縮・間隔・キャッシュ避けの有無を前後で揃える
- **健全性チェックを1つ入れる。** 「あるはずのもの」（`--royal` など）が
  取れているかを先に確かめる。取れていなければ計測自体が壊れている
- **HTTP status を必ず一緒に取る。** 404 やリダイレクトは速いので、
  時間だけ見ていると「速い」と誤読する（⑤で実際に踏んだ）

⚠️ **並列で走っている問い合わせを1本減らしても速くならない。**
その段の時間は最も遅い1本で決まる。段数（`await` の直列数）を数えること。
2026-08-09 に企業詳細のブックマーク／フォローを外したが、
`activityPosts` と並列だったため待ち時間は変わらなかった。

### ⚠️ フォントは「ウェイトを減らせば軽くなる」が成り立たない（2026-08-09 確立）

**next/font の Google Fonts は可変フォント（variable font）で配信される。
`weight: ["400","500","600","700","800"]` の5ウェイトは、
すべて同じ実ファイルを共有している。ウェイトを削っても1バイトも減らない。**

2026-08-09 に「和文5ウェイトは多すぎる。3つに減らせば250KB落ちる」と提案し、
実装直前に測って**効果ゼロ**と判明した。

実測（`.next/static/css` の `@font-face` を全部突き合わせた結果）:

| ファミリ | @font-face 宣言 | ウェイト | **固有ファイル** |
|---|---|---|---|
| Noto Sans JP | 620件 | 5種 | **124個** |
| Noto Serif JP | 496件 | 4種 | **124個** |
| Inter | 35件 | 5種 | **7個** |

**宣言数 ÷ ウェイト数 = 固有ファイル数**なら、全ウェイトが同じ実体を指している。

#### 確かめ方

```bash
node -e '
const fs=require("fs");
let css="";for(const f of fs.readdirSync(".next/static/css")) if(f.endsWith(".css")) css+=fs.readFileSync(".next/static/css/"+f,"utf8");
const faces=[...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(m=>m[1]);
const byFile={};
for(const b of faces){
 const w=(b.match(/font-weight:\s*(\d+)/)||[])[1];
 const file=((b.match(/url\(([^)]+)\)/)||[])[1]||"").split("/").pop();
 (byFile[file]=byFile[file]||new Set()).add(w);
}
const multi=Object.values(byFile).filter(s=>s.size>1).length;
console.log(multi+" / "+Object.keys(byFile).length+" ファイルが複数ウェイトで共有されている");
'
```

⚠️ **ビルド後（`.next` がある状態）でないと測れない。**

#### 重さの正体はサブセット数

和文は **124個の `unicode-range` サブセット**に分割される。
ページ上の文字が属する範囲だけが落ちるため、**本文に使うと34個・635KB**、
**見出しだけに使うと1個・33KB**になる。ここは制御できない。

したがって和文Webフォントの選択肢は実質2つしかない。

| | 効果 |
|---|---|
| 本文に使う | 635KB。**減らす手段は「使わない」以外に無い** |
| 見出しだけに使う | 33KB。安いので残してよい |

2026-08-09 に本文（Noto Sans JP）をやめ、OS標準の和文ゴシックにした。
`/companies` のフォントは **35ファイル → 2ファイル**。
見出しの Noto Serif JP と数字の Inter は残している。

⚠️ **`--font-noto` という変数名は残してある。** 100箇所が参照しており、
中身がシステムフォントに変わっただけで意味（本文の和文）は同じ。
定義は `globals.css` の `:root`。

⚠️ **macOS ではヒラギノ、Windows では游ゴシックになる。**
macOS の見た目はほぼ変わらないことを実測で確認したが、
**Windows は未確認**。和文の字面が変わる可能性がある。

#### ついでに見つかったもの

**`--font-noto-sans` が32箇所で使われているのに、どこにも定義が無かった。**
未定義の `var()` は**宣言ごと無効**になるため、それらの `font-family` は
何も効かず body から継承していた。実害は無かった（継承先が同じ和文フォントだった）が、
**「指定したつもりで効いていない」形**なので `globals.css` で別名として定義した。

⚠️ 新しく書くときは `--font-noto` を使うこと。

### ⚠️ 横はみ出しは「ページのスクロール幅」で測らない（2026-08-08 確立）

**`document.documentElement.scrollWidth > innerWidth` で測ると見逃す。**
途中の要素に `overflow: hidden` があると、内側がどれだけはみ出していても
ページ全体のスクロール幅は増えないため。

2026-08-08 に `/companies/[id]` を「375px で横スクロールなし」と**何度も報告した**が、
実際には `<main>` が **835px**（親は375px）で、400px を超える要素が202個あった。
ページがスクロールしないので気づけなかった。

#### 測り方

**各要素が親の `clientWidth` を超えていないか**で見る。
親に `overflow-x: auto|scroll` があるものは、横スクロールを意図した行なので除外する。

```js
// DevTools のコンソールに貼る
(()=>{const out=[];
  (function walk(e){const p=e.parentElement;
    // ⚠️ offsetWidth で測る。getBoundingClientRect は transform: scale を含むので、
    //    拡大したアイコンが偽陽性になる（実際に踏んだ）
    if(p && e.offsetWidth!==undefined && p.clientWidth>0){
      const ox=getComputedStyle(p).overflowX;
      if(e.offsetWidth>p.clientWidth+1 && ox!=="auto" && ox!=="scroll"){
        out.push({tag:e.tagName,cls:String(e.className).slice(0,40),
                  幅:e.offsetWidth,親:p.clientWidth,
                  抜粋:(e.textContent||"").trim().slice(0,30)});
        return; /* ⚠️ 最も外側だけ報告し、その配下は辿らない */}}
    for(const c of e.children) walk(c);})(document.body);
  return {幅:innerWidth,件数:out.length,犯人:out.slice(0,5)};})()
```

⚠️ **配下を辿らないのが肝。** はみ出しは連鎖するので、全部出すと数百件になり原因が埋もれる。
   **最も外側の1つ**を直せば、その配下は連鎖的に収まることが多い
   （実際 `/companies/[id]` は grid 2箇所を直しただけで 202件 → 0件になった）。

⚠️ `offsetWidth` は HTMLElement にしか無い（SVG には無い）。上の判定はそれを利用して
   SVG の中身を自動的に除外している。

#### よくある原因（この順で疑う）

| # | 原因 | 直し方 |
|---|---|---|
| 1 | **grid トラックが `1fr`**（`minmax(0, 1fr)` でない） | `minmax(0, 1fr)` にする |
| 2 | **`flex: 1` の item に `min-width: 0` が無い** | `minWidth: 0` を足す |
| 3 | `white-space: nowrap` の可変長テキスト | `minWidth: 0` ＋ `overflow: hidden` ＋ `textOverflow: ellipsis` |
| 4 | `flex-shrink: 0` を付けた可変長テキスト | 外す。固定してよいのはアイコンとバッジだけ |

**1 と 2 は同じ理屈**。grid item も flex item も既定が `min-width: auto` で、
**中身の min-content より小さくならない**。これが親を押し広げる。

⚠️ **`overflow: hidden` と `text-overflow: ellipsis` を書いても、`min-width: 0` が無いと効かない。**
   「省略記号を書いたのに切れて出る」はこれ。

⚠️ **`overflow: hidden` で蓋をしない。** 見えなくなるだけで中身は切れたまま出る。
   上の1〜4の原因側を直すこと。

⚠️ 省略記号で切るときは **`title` 属性で全文を読めるように**する。

#### 2026-08-08 時点の残存（参考）

`1fr`（`minmax(0,` 無し）は全体で **150箇所**、`flex: 1` で `minWidth: 0` が無いものは **209箇所**ある。
**すべてが問題なわけではない**（中身が短ければ膨らまない）。上の測り方で
**実際にはみ出しているものだけ**直すこと。予防的に全部書き換える必要は無い。

ただし **`textOverflow: ellipsis` を書いているのに `minWidth: 0` が無いファイル**は
省略が効いていない可能性が高い。2026-08-08 時点で6ファイル:
`articles/(list)/page.tsx` / `companies/[id]/OrgTeamsSectionClient.tsx`（修正済み） /
`feed/(list)/FeedClient.tsx` / `mypage/conversations/ConversationsClient.tsx` /
`biz/members/MembersClient.tsx` / `components/business/OfficePhotoSection.tsx`

---

### ⚠️ インラインstyle と CSS の優先順位（2026-08-04 確立）

このプロジェクトは「インライン style + CSS 変数」を正式採用しているため、
**インライン style と CSS クラス／メディアクエリの衝突が構造的に起きやすい。**
本セッションだけで3回踏んだ。**毎回症状が違うので同じ原因だと気づきにくい。**

#### 原則

**レスポンシブで変えたい値・状態で切り替えたい値を、インライン style に書かない。**

具体的には以下をインラインに置かないこと。CSS クラス側に持たせる。

| 書かない | 理由 |
|---|---|
| `fontSize` / `padding` | メディアクエリで縮められなくなる |
| `display` | メディアクエリで `display: none` にできなくなる |
| `flexDirection` / `gridTemplateColumns` | 折り返し・段組みを切り替えられなくなる |
| `width` / `maxWidth` | 狭幅での調整が効かなくなる |

色・背景・borderRadius など**ブレークポイントで変えないもの**はインラインで構わない。

#### 方向が2つあり、これが分かりにくさの原因

優先順位は「**自要素へのインライン > 自要素への CSS ルール > 親からの継承**」。
インラインが**自要素**にあるか**親**にあるかで、勝ち負けが逆転する。

| # | どこにインラインがあるか | 結果 | 実際に起きたこと |
|---|---|---|---|
| 1 | **親**に `color`（子は継承） | **CSS が勝つ** | `globals.css` の `h3 { color: #0f172a }` `p { color: #334155 }` が、親のインライン `color` を上書き。3ステップカードの文字が背景と同化して読めなくなった |
| 2 | **自要素**に `fontSize` / `padding` | **インラインが勝つ** | `HeroSearch` の入力欄。`@media (max-width: 560px)` の縮小指定が一切効かず、375px でプレースホルダーが切れ続けた |
| 3 | **自要素**に `display: flex` | **インラインが勝つ** | `GridSortBar` のラベル。`@media` の `display: none` が効かず、狭幅で隠れないまま要素が重なった |

**1 は「CSS を書いたのに親の指定が効かない」、2・3 は「CSS を書いたのに効かない」。**
逆向きに見えるが、どちらも同じ優先順位規則の帰結。

#### 見つけ方

「CSS を書いたのに効かない」と思ったら、まず**その要素自身の `style` 属性**を見る。

```js
// ブラウザで
const el = document.querySelector('.対象クラス');
console.log(el.getAttribute('style'));           // インラインに同じプロパティが無いか
console.log(getComputedStyle(el).display);       // 実際に効いている値
console.log(window.matchMedia('(max-width: 560px)').matches);  // MQ自体は当たっているか
```

MQ が `true` なのに computed が変わっていなければ、インラインが勝っている。

逆に「親でインラインの色を指定したのに子が別の色」なら、
`globals.css` の要素セレクタ（`h1`〜`h3` / `p` / `.description` / `.desc`）を疑う。
これらは詳細度 0-0-1 と低いが、**継承より強い**。

##### ⚠️ `min-height` は `height` に勝つ（2026-08-11 確立）

**`globals.css` の `button, [role="button"] { min-height: 36px }`（タップ領域用）が、
36px 未満の正方形アイコンボタンを「縦長の楕円」に潰していた。**

`/companies` の「気になる」ハートは `width: 26, height: 26, borderRadius: "50%"` の
指定なのに **26×36** で描画されていた（40個すべて）。

⚠️ **インラインの `height` では勝てない。** 上の「インラインstyle と CSS の優先順位」は
   *同じプロパティ*の綱引きの話だが、これは**別プロパティ**の話。
   `min-height` は常に `height` に優先するので、詳細度をいくら上げても直らない。

⚠️ しかも**幅は変わらない**ので、狙っていた 36×36 のタップ領域にもなっていない。
   見た目を壊すだけで目的も達成していなかった。

#### 直し方

自分でサイズを決めるボタンには **`.btn-fixed-size`**（`min-height: 0`）を付けて外す。

```tsx
<button className="btn-fixed-size" style={{ width: 26, height: 26, borderRadius: "50%" }}>
```

⚠️ グローバルルール自体は残す。テキストボタンには意味があるため。

#### 見つけ方

**指定値ではなく実測値で見る。** コードを読んでも分からない。

```js
document.querySelectorAll('button,[role="button"]').forEach(b=>{
  const w=parseFloat(b.style.width), h=parseFloat(b.style.height);
  if(w&&h&&w===h){ const r=b.getBoundingClientRect();
    if(Math.abs(r.width-r.height)>1) console.log(b, `${w}x${h} → ${r.width}x${r.height}`); }
});
```

2026-08-11 時点で該当は `/companies` のみ（`/jobs` `/people` `/articles` `/feed` `/salary` は0件）。
`CompanyCardList`(26×26) と `CompanyCardCompact`(28×28) の2箇所に付与済み。

### やってはいけない回避策

`!important` で殴らないこと。詳細度の綱引きが増えるだけで、
次に触る人が同じ罠を踏む。**インラインから外して CSS に寄せる**のが正しい直し方。


---

## ⚠️ 画面を操作して確かめるときの手順（2026-08-15 確立）

### ① セッション衛生（**検証の先頭に必ず置く**）

1. **`sb-` で始まるクッキーを全部消す**
2. 目的のアカウントでログインする
3. **★保存する前に「今どのユーザーとして操作しているか」を確かめる。**
   画面のヘッダーか、API のレスポンスで見る

⚠️ **この手順を踏まずに出した結果は「検証した」と書かない。**
   ブラウザに残っていた別セッションが優先され、意図と違うアカウントの行が
   書き換わる（`@supabase/ssr` は非チャンクのクッキーを優先する）。

### ② `<select>` に値を代入するときは、実在する `option[value]` を使う

代入する前に **JSX を読み、ゼロ埋めの有無を確認する**（`"4"` なのか `"04"` なのか）。

⚠️ **存在しない値を代入すると `value` は空文字のままになる。**
   画面上は何も起きず、**保存だけが静かに欠ける**。エラーも出ない。

**代入したあと `value` が空でないことを確かめてから次に進む。**

```js
el.value = "4";
if (!el.value) throw new Error("option に存在しない値を入れた");
```

### ③ 操作対象は、まず親要素で絞ってから探す

**ページ全体から「保存」のような汎用ラベルで要素を探さない。**
DOM 順で別の場所の同名ボタンを掴む。

**掴んだ要素が意図したカード・セクションの中にあることを、押す前に確認する。**

```js
const card = document.querySelector("#edu-school").closest("section");
const save = [...card.querySelectorAll("button")].find(b => b.innerText.trim() === "保存");
if (!save) throw new Error("そのカードに保存ボタンが無い");
```

⚠️ カード内に保存ボタンを移すと DOM 順が変わる。
   **前に通った手順が、そのままでは別のボタンを押すようになる。**

### ④ 「保存されない」を見たら、まず既存データを数える

実装を疑う前に、**その列が他の行で埋まっているかを1クエリで見る。**

```sql
select count(*) as total, count(対象列) as filled, max(created_at) from 対象テーブル;
```

大半が埋まっていれば保存経路は動いていたことになり、疑う対象を
**検証手段か直近の変更**に絞れる。コードを読む前にこれをやると調査が短くなる。

### ⑤ URL とファイル名を突き合わせるときは、クエリ文字列を落としてから比較する

`?t=1781261252894` のようなキャッシュ回避クエリが付いた URL は、
`url LIKE '%' || object_name` から**外れる**。
その結果、**現役のファイルが「どこからも参照されていない孤児」に見える。**

```sql
-- ✗ 付いているクエリのぶんだけ取りこぼす
where url like '%' || o.name
-- ✓ クエリとフラグメントを落としてから比べる
where split_part(split_part(url,'?',1),'#',1) like '%' || o.name
```

⚠️ 2026-08-15 に実際に踏んだ。Storage の孤児を数えたら
   **実在する利用者のアバターが孤児に混ざっていた**（`avatar_url` が `?t=…` 付きだった）。
   削除の直前に気づいた。

### ⑥ 消す前の確認は、**違う方法で2回**やる

同じ突き合わせをもう一度走らせても、**前提が同じなら同じ答えしか出ない。**
「念のため再実行」は確認になっていない。

ファイル名や id を消すなら、2つ目の方法は**全 text 列の横断検索**にする。
どの列に埋まっていても引っかかるので、突き合わせの式を間違えていても気づける。

```sql
select table_name, column_name, (xpath('/row/cnt/text()', x))[1]::text::int as hits
from (
  select c.table_name, c.column_name,
    query_to_xml(format('select count(*) as cnt from public.%I where %I like ''%%対象文字列%%''',
      c.table_name, c.column_name), false, true, '') as x
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public' and c.data_type in ('text','character varying')
) s
where (xpath('/row/cnt/text()', x))[1]::text::int > 0;
```

⚠️ ⑤で助かったのはこの方法。1つ目（列を列挙した突き合わせ）は「参照0」と言い、
   2つ目（全文検索）が `ow_users.avatar_url` に1件を見つけた。

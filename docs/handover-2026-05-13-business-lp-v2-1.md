# Handover: Business LP v2.1 — Section 4 統計数字削除

実装日: 2026-05-13  
commit: 996f7a0  
Vercel: ● Ready 確認済み

---

## 1. 変更の目的

v2 で「人材紹介を完全に出さない」方針を確定したが、
Section 4「なぜ採用ミスマッチが起きないのか？」に残っていた統計数字が
いずれも**人材紹介事業の実績**だったため削除。

---

## 2. 削除した要素（src/app/business/page.tsx）

### 削除した HTML ブロック全体

```jsx
{/* Stats: "Opinio が選ばれる理由" */}
<div id="results" style={{ marginTop: 8 }}>
  <p style={{ ... }}>Opinio が選ばれる理由</p>
  <div style={{ display: "grid", ... }}>
    {[
      { num: "120社+", label: "IT/SaaS企業が活用中" },
      { num: "200名+", label: "キャリア意思決定をサポート" },
      { num: "99%+",  label: "早期離職率を業界平均より大幅に下回る※" },
    ].map(...)}
  </div>
  <p style={{ ... }}>※自社調べ</p>
</div>
```

### あわせて調整したスタイル

2カードグリッドの `marginBottom: 64` → `0` に変更（削除後の余白調整）

---

## 3. Section 4 の新しい構成

```
【Section 4: なぜ採用ミスマッチが起きないのか？】

  見出し: なぜ採用ミスマッチが起きないのか？
  サブ: Opinio には、他の求人媒体にはない2つの仕組みがあります。

  ┌─────────────────────────────┐  ┌─────────────────────────────┐
  │ 🤝 メンターが間に立つから   │  │ 💼 IT業界職経ありユーザーが │
  │                             │  │    中心                     │
  │ IT業界のメンターが在籍。    │  │ 登録ユーザーの大多数が      │
  │ 応募前に必ずメンター面談。  │  │ IT業界で実務経験を持つ      │
  │ 本気度の高い候補者のみ届く  │  │ 即戦力人材。                │
  └─────────────────────────────┘  └─────────────────────────────┘

  ※統計数字なし
```

---

## 4. BusinessHeader のナビゲーション変更

### src/components/business/BusinessHeader.tsx

```diff
const NAV_LINKS = [
  { href: "#features", label: "サービス" },
  { href: "#pricing",  label: "料金" },
- { href: "#results",  label: "実績" },   // 削除（飛び先がなくなったため）
  { href: "#faq",      label: "FAQ" },
];
```

**変更後のナビ:** サービス / 料金 / FAQ（3項目）

---

## 5. 残存するアンカー ID

| ID | 場所 | 状態 |
|----|------|------|
| `#features` | Section 4 `<section>` | ✅ 維持 |
| `#pricing` | Section 2 `<section>` | ✅ 維持 |
| `#faq` | Section 7 `<section>` | ✅ 維持 |
| `#results` | Section 4 内の stats ブロック | **削除済み** |

---

**作成者**: Claude Code  
**作成日**: 2026-05-13

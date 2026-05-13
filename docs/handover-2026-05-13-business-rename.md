# Handover: /for-companies → /business リネーム

実装日: 2026-05-13  
commit: (本 commit)

---

## 1. 変更理由

`/for-companies` は意味的に正しいが印象が古い。  
`/business` はよりモダンで global standard（LinkedIn Business, Stripe Business 等の慣例）に近い表現。

---

## 2. 変更ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/app/for-companies/page.tsx` | → `src/app/business/page.tsx` に `git mv` |
| `src/components/jobseeker/JobseekerHeader.tsx` | `/for-companies` → `/business`、テキストも「企業の方へ →」に変更 |
| `src/components/jobseeker/JobseekerFooter.tsx` | `/for-companies` → `/business` |
| `src/components/Header.tsx` | `/for-companies` → `/business` |
| `next.config.mjs` | 301 リダイレクト `/for-companies` → `/business` 追加 |

---

## 3. リダイレクト設定

```javascript
// next.config.mjs
async redirects() {
  return [
    {
      source: "/for-companies",
      destination: "/business",
      permanent: true, // 301
    },
  ];
},
```

`permanent: true` = HTTP 301（恒久的リダイレクト）。  
検索インデックスも `/business` に転送される。

---

## 4. ヘッダーテキスト変更

| Before | After |
|--------|-------|
| 「採用担当の方はこちら →」 | 「企業の方へ →」 |

理由: `/business` という URL に合わせ、よりシンプルで端的な表現に統一。

---

**作成者**: Claude Code  
**作成日**: 2026-05-13

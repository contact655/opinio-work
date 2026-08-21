import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/LegalDocument";

/*
 * ⚠️ **これは現行の規約ではない。** 2026-08-14 に「掲載利用規約」（/terms/listing）と
 *    「人材紹介利用規約」（/terms/placement）の2本に分割された、分割前の全文。
 *
 * ⚠️ **本文（content/legal/terms-of-service-business.md）は書き換えないこと。**
 *    `ow_terms_agreements` に `terms_type='business'` の同意記録が残っており、
 *    書き換えるとその同意が指す文書の中身が変わってしまう。
 *    「そのとき何に同意したか」を保存するためのページなので、内容は凍結する。
 *
 * ⚠️ そのため 2026-08-21 の成功報酬の廃止も**この文書には反映していない。**
 *    現行の定めは /terms/listing にある。
 *
 * ⚠️ **noindex にしてある。** どこからも導線を張っていない孤児ページなので、
 *    検索結果から現行規約と誤認されるのを防ぐ。外さないこと。
 */

export const metadata: Metadata = {
  title: { absolute: "掲載・人材紹介利用規約（分割前・企業向け） | OPINIO" },
  description:
    "2026年8月14日に「掲載利用規約」と「人材紹介利用規約」に分割される前の、OPINIO 掲載・人材紹介利用規約（企業向け）です。現行の規約ではありません。",
  alternates: { canonical: "https://opinio.jp/terms/business" },
  robots: { index: false, follow: false },
};

/**
 * 冒頭に出す注記。
 * ⚠️ .md 本体には書かない（本文を凍結するため）。表示側で足す。
 */
const SUPERSEDED_NOTICE = `> **この規約は現行のものではありません**
>
> 本規約は、2026年8月14日に「掲載利用規約」と「人材紹介利用規約」に分割される前のものです。
> 現行の規約は [掲載利用規約](/terms/listing) および [人材紹介利用規約](/terms/placement) をご確認ください。
>
> 本ページは、分割前にご同意いただいた内容を確認できるようにするために公開しています。
> 2026年8月21日の改定（掲載サービスにおける成功報酬の廃止）は、本ページには反映されていません。

---

`;

export default function TermsBusinessPage() {
  const filePath = path.join(process.cwd(), "content/legal/terms-of-service-business.md");
  const content = fs.readFileSync(filePath, "utf-8");

  return <LegalDocument content={SUPERSEDED_NOTICE + content} />;
}

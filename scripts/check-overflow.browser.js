/*
 * 横はみ出しの検査（ブラウザで実行する）。2026-10-09 に陽性対照を足して1本にした。
 *
 * 使い方: 測りたいページを開き、DevTools のコンソール（またはブラウザ操作ツールの
 *         JavaScript 実行）にこのファイルの中身を貼る。結果は JSON で返る。
 *
 * ★必ず自己テスト付きで走らせる（既定）。手順は3段:
 *   ① いまのページを数える（baseline）
 *   ② わざと親より 200px 広い要素（陽性対照）を本文に1つ差し込んで数える
 *      → **差し込んだ要素が検出されること**（検出器が効いている証拠）
 *   ③ 取り除いてもう一度数える → **① と同じ数に戻ること**
 *   ②か③が満たされないときは `ok: false`。そのときの baseline（「0件」）は信じない。
 *
 * 判定の中身（.claude/rules/ui-debugging.md「横はみ出しは『ページのスクロール幅』で測らない」）:
 *   各要素の offsetWidth が親の clientWidth を超えていたら1件。親が overflow-x: auto|scroll
 *   （横スクロールを意図した行）は除外。はみ出しは連鎖するので最も外側だけ数える。
 */
(() => {
  const PROBE_ID = "__overflow_probe__";

  function scan() {
    const out = [];
    (function walk(e) {
      const p = e.parentElement;
      if (p && e.offsetWidth !== undefined && p.clientWidth > 0) {
        const ox = getComputedStyle(p).overflowX;
        if (e.offsetWidth > p.clientWidth + 1 && ox !== "auto" && ox !== "scroll") {
          out.push({ id: e.id || null, tag: e.tagName, cls: String(e.className).slice(0, 40), 幅: e.offsetWidth, 親: p.clientWidth });
          return; // 最も外側だけ
        }
      }
      for (const c of e.children) walk(c);
    })(document.body);
    return out;
  }

  // ⚠️ 幅 0 で測ると全部 0 になって「0件」に見える（ui-debugging ⑨）。計測できる状態かを先に見る
  if (!innerWidth) return JSON.stringify({ ok: false, reason: "innerWidth が 0（ペインが非表示）。測れていない" });

  const baseline = scan();

  const host = document.querySelector("main") || document.body;
  const probe = document.createElement("div");
  probe.id = PROBE_ID;
  probe.style.cssText = `width:${host.clientWidth + 200}px;height:1px;`;
  host.appendChild(probe);
  const withProbe = scan();
  const detected = withProbe.some((r) => r.id === PROBE_ID);
  probe.remove();
  const after = scan();

  const ok = detected && after.length === baseline.length;
  return JSON.stringify({
    w: innerWidth,
    path: location.pathname,
    ok,
    件数: baseline.length,
    自己テスト: { 差し込んだ要素を検出: detected, 差し込み中の件数: withProbe.length, 取り除いた後: after.length },
    犯人: baseline.slice(0, 5),
  });
})();

/**
 * 社長図鑑の本文で「写真 → 直後の斜体1行」を `<figure>` ＋ `<figcaption>` にまとめる rehype プラグイン。
 *
 * 書き方（note と同じ）は次の2通りを受ける。どちらも同じ見た目になる。
 *
 *   ![alt](/zukan/slug/photo1.jpg)        ![alt](/zukan/slug/photo1.jpg)
 *   *キャプション*                         （空行）
 *                                         *キャプション*
 *
 * ⚠️ 左（空行なし）は remark-breaks によって「画像・改行・斜体」が1つの段落になる。
 *    右（空行あり）は「画像だけの段落」と「斜体だけの段落」の2つになる。両方を拾う。
 * ⚠️ 写真の直後に無い斜体の行は**そのまま**（本文中の斜体として出す）。
 * ⚠️ 依存を増やさないため、hast の型はここで最小限だけ定義している。
 */

interface HastText { type: "text"; value: string }
interface HastElement {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children: HastNode[];
}
type HastNode = HastText | HastElement | { type: string; children?: HastNode[] };
interface HastParent { children: HastNode[] }

function isElement(n: HastNode | undefined, tag?: string): n is HastElement {
  return !!n && n.type === "element" && (tag === undefined || (n as HastElement).tagName === tag);
}

function isBlankText(n: HastNode): boolean {
  return n.type === "text" && (n as HastText).value.trim() === "";
}

/** 段落の中身から、空白文字と <br> を除いたもの */
function meaningful(p: HastElement): HastNode[] {
  return p.children.filter((c) => !isBlankText(c) && !isElement(c, "br"));
}

function figure(img: HastElement, caption: HastElement | null): HastElement {
  return {
    type: "element",
    tagName: "figure",
    properties: {},
    children: caption
      ? [img, { type: "element", tagName: "figcaption", properties: {}, children: caption.children }]
      : [img],
  };
}

export function rehypeZukanFigure() {
  return (tree: HastParent) => {
    const out: HastNode[] = [];
    const kids = tree.children;
    for (let i = 0; i < kids.length; i++) {
      const node = kids[i];
      if (!isElement(node, "p")) { out.push(node); continue; }

      const sig = meaningful(node);
      const img = sig[0];
      if (!isElement(img, "img")) { out.push(node); continue; }

      // 「画像・改行・斜体」が1つの段落（空行なしで書いた場合）
      if (sig.length === 2 && isElement(sig[1], "em")) {
        out.push(figure(img, sig[1] as HastElement));
        continue;
      }
      if (sig.length !== 1) { out.push(node); continue; }

      // 「画像だけの段落」→ 次の段落が「斜体だけ」ならキャプションにする（空行ありで書いた場合）
      let j = i + 1;
      while (j < kids.length && isBlankText(kids[j])) j++;
      const next = kids[j];
      if (isElement(next, "p")) {
        const nsig = meaningful(next);
        if (nsig.length === 1 && isElement(nsig[0], "em")) {
          out.push(figure(img, nsig[0] as HastElement));
          i = j;
          continue;
        }
      }
      out.push(figure(img, null));
    }
    tree.children = out;
  };
}

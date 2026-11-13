/**
 * ★「メッセージ」ボタンを出すか（2026-11-05。/api/dm/availability と未ログインのプロフィールが同じ関数を見る）。
 *   ・自分自身・見られない人には出さない
 *   ・★検証用と実在のアカウントの組み合わせには出さない。送る段で lib/conversations/contactGate.ts が必ず止めるので、
 *     押せるのに送れないボタンになる（2026-11-03 に実在のアカウントから検証用の人を開いて踏んだ）
 *   ・★個人のブロックは 2026-11-13 に外した（柴さんの指示）。ブロックで出し分けない
 *   viewerIsTest = 見ている人が検証用か。未ログインは null（実在の人として扱う。ログインして押すのはふつう実在の人）
 *
 * ⚠️ 2026-11-03〜11-05 は、相手の「話を聞ける」設定（受け付けているか）も見ていた。外した（柴さんの指示）。戻さないこと。
 * ⚠️ 何も import しない（`npm test` が直接読む）。
 */
export function messageButtonVisible(p: {
  isSelf: boolean;
  targetVisible: boolean;
  viewerIsTest: boolean | null;
  targetIsTest: boolean;
}): boolean {
  if (p.isSelf || !p.targetVisible) return false;
  return (p.viewerIsTest === true) === (p.targetIsTest === true);
}

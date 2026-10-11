/**
 * 求人の禁止表現（wordingCheck.ts）のテスト。
 *
 *     npm test
 *
 * ⚠️★**誤検知しない例を必ず一緒に置く。** 英字の語（OL）は TOOL・SOLUTION・CONTROL の中に現れるので、
 *    当たるべき例だけでは「当たりすぎ」に気づけない。全角・半角の両方で確かめる。
 * ⚠️ 語を足したら、当たる例と当たらない例を両方ここに足すこと。
 */

import test from "node:test";
import assert from "node:assert/strict";
import { checkWording, WORDING_LIST_CONFIRMED } from "./wordingCheck.ts";

const hits = (text) => checkWording([{ field: "仕事内容", text }]);

test("リストは確定済み（本番でも有効）", () => {
  assert.equal(WORDING_LIST_CONFIRMED, true);
});

const SHOULD_HIT = [
  ["35歳まで", "age"], ["30歳以下の方", "age"], ["２０代のみ", "age"], ["30代まで", "age"], ["20代〜30代の方を募集", "age"], ["25歳〜35歳の方", "age"], ["20代から30代まで", "age"], ["２０〜３０代", "age"], ["チームリーダー30代まで", "age"], ["20代〜30代の方を募集。在籍メンバーも同年代", "age"], ["20代〜30代限定、活躍できます", "age"], ["20代歓迎", "age"], ["若手限定", "age"], ["年齢制限あり", "age"],
  ["男性のみ", "gender"], ["女性 歓迎", "gender"], ["営業マン募集", "gender"], ["ウェイトレス", "gender"],
  ["OL", "gender"], ["元OLの方", "gender"], ["ＯＬ経験者", "gender"], ["事務職(OL)", "gender"], ["Excel OL経験", "gender"],
  ["日本人のみ", "nationality"], ["外国籍NG", "nationality"],
  ["荷物の受け取り", "suspicious"], ["闇バイト", "suspicious"], ["即日 高額報酬", "suspicious"], ["日給10万", "suspicious"],
  ["口座の貸し出し", "suspicious"], ["携帯の契約代行", "suspicious"],
];

for (const [text, category] of SHOULD_HIT) {
  test(`当たる: ${text}`, () => {
    const h = hits(text);
    assert.ok(h.length > 0, `${text} が当たらなかった`);
    assert.equal(h[0].category, category);
  });
}

const SHOULD_NOT_HIT = [
  "TOOL", "ＴＯＯＬ", "SOLUTION", "ＳＯＬＵＴＩＯＮ", "CONTROL", "ＣＯＮＴＲＯＬ", "PROTOCOL", "OLAP", "COOL",
  "Salesforce Solution Engineer", "社内ツール（TOOL）の開発", "ol", "Ol",
  "ホワイトボード", "男性社員が活躍しています", "女性の管理職比率", "日本人と外国籍のメンバー",
  "35歳で入社", "20代から50代まで幅広く活躍しています", "20〜50代まで活躍中", "平均年齢は20代〜30代です", "在籍メンバーは20代〜40代", "20歳から50歳まで幅広く在籍", "荷物", "日給制", "口座振込",
];

for (const text of SHOULD_NOT_HIT) {
  test(`当たらない: ${text}`, () => {
    assert.deepEqual(hits(text), [], `${text} が当たった: ${JSON.stringify(hits(text))}`);
  });
}

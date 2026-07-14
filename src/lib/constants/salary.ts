/** 職種・企業ごとの給与データを表示するのに必要な最低投稿件数。
 *  初期フェーズは 1 件から表示（投稿が反映される実感を優先）。
 *  データが溜まりユーザー投稿が20〜30件を超えたら 3〜5 に引き上げを検討。 */
export const SALARY_MIN_REPORTS_TO_DISPLAY = 1;

/** この件数未満は「参考値」として注記を表示する（統計的信頼性の目安）。 */
export const SALARY_REFERENCE_THRESHOLD = 5;

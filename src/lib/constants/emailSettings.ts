/**
 * メール配信設定の許容キー。
 *
 * ⚠️ **UI と API が同じ定数を見ること。** route の中に許容値を直接書かない
 *    （CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」）。
 *
 * ⚠️ **実在するメールと1対1で対応させること。** 2026-08-10 に直すまで、
 *    UI には送っているメールが存在しない項目が2つ並び、逆に実在する
 *    新着求人メールには項目が無かった。
 *
 *    email_weekly_enabled … 週次ダイジェスト（weekly-jobs / weekly-match）
 *    email_scout_enabled  … スカウトが届いたとき（sendScoutEmail）
 *
 * 項目を足すときは DB の列・API・UI の3つを同時に足す。
 */
export const EMAIL_SETTING_KEYS = ["email_weekly_enabled", "email_scout_enabled"] as const;

export type EmailSettingKey = (typeof EMAIL_SETTING_KEYS)[number];

/** 既定値。⚠️ DB の DEFAULT と一致させること（migration 20260810111308） */
export const EMAIL_SETTING_DEFAULTS: Record<EmailSettingKey, boolean> = {
  email_weekly_enabled: true,
  email_scout_enabled: true,
};

/**
 * ★画面の中で知らせ合うイベントの名前（2026-10-22）。送り手と受け手で同じ定数を使う（綴りが割れると黙って届かない）。
 */

/** 顔写真を変えた（detail は新しい URL か null）。送り手: ProfileTab ／ 受け手: JobseekerHeader */
export const AVATAR_CHANGED_EVENT = "opinio:avatar-changed";

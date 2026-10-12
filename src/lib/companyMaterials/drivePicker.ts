"use client";

/**
 * ★Google ドライブから資料を選ぶ（Google Picker。2026-10-12 / 柴さんの指示）。**ブラウザ専用。**
 *
 * ・権限は `drive.file` だけ（ユーザーが Picker で選んだファイルだけに触れる）。
 *   ⚠️ OPINIO のログイン（Supabase の Google ログイン）とは別に、ここで Google の同意画面が出る。
 *      ログインの範囲（email / profile）は広げない。
 * ・保存するのはファイル名・種類（mimeType）・リンク（url ＝ webViewLink）だけ。**中身はコピーしない。**
 * ・必要な設定（3つとも無ければボタンを出さない）:
 *     NEXT_PUBLIC_GOOGLE_PICKER_API_KEY   … Picker 用の API キー（HTTP リファラで opinio.jp / localhost に制限）
 *     NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID  … OAuth クライアント ID（ウェブ。JavaScript 生成元に opinio.jp / localhost:3000）
 *     NEXT_PUBLIC_GOOGLE_CLOUD_APP_ID     … Google Cloud のプロジェクト番号
 * ⚠️ next.config.mjs の CSP に apis.google.com / accounts.google.com / docs.google.com 等を足してある。消さないこと。
 */

export type PickedDriveFile = { id: string; name: string; mimeType: string; url: string };

const CFG = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY ?? "",
  clientId: process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? "",
  appId: process.env.NEXT_PUBLIC_GOOGLE_CLOUD_APP_ID ?? "",
};

export const DRIVE_PICKER_ENABLED = !!(CFG.apiKey && CFG.clientId && CFG.appId);

const SCOPE = "https://www.googleapis.com/auth/drive.file";

/* eslint-disable @typescript-eslint/no-explicit-any */
type G = any;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`読み込めませんでした: ${src}`));
    document.head.appendChild(s);
  });
}

let pickerReady: Promise<void> | null = null;
function ensureLoaded(): Promise<void> {
  if (!pickerReady) {
    pickerReady = Promise.all([
      loadScript("https://apis.google.com/js/api.js"),
      loadScript("https://accounts.google.com/gsi/client"),
    ]).then(() => new Promise<void>((resolve) => (window as G).gapi.load("picker", () => resolve())));
    pickerReady.catch(() => { pickerReady = null; });
  }
  return pickerReady;
}

let token: { value: string; expiresAt: number } | null = null;
function getToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return Promise.resolve(token.value);
  return new Promise((resolve, reject) => {
    const client = (window as G).google.accounts.oauth2.initTokenClient({
      client_id: CFG.clientId,
      scope: SCOPE,
      callback: (res: G) => {
        if (res?.error || !res?.access_token) { reject(new Error(res?.error ?? "Google の許可が得られませんでした")); return; }
        token = { value: res.access_token as string, expiresAt: Date.now() + Number(res.expires_in ?? 3600) * 1000 };
        resolve(token.value);
      },
      error_callback: (e: G) => reject(new Error(e?.type === "popup_closed" ? "キャンセルしました" : "Google の許可が得られませんでした")),
    });
    client.requestAccessToken({ prompt: token ? "" : "consent" });
  });
}

/** Picker を開いて、選ばれたファイルを返す（キャンセルなら空配列） */
export async function openDrivePicker(): Promise<PickedDriveFile[]> {
  if (!DRIVE_PICKER_ENABLED) throw new Error("Google ドライブとの連携が設定されていません");
  await ensureLoaded();
  const accessToken = await getToken();
  const g = (window as G).google;
  return new Promise((resolve) => {
    const view = new g.picker.DocsView(g.picker.ViewId.DOCS).setIncludeFolders(false).setSelectFolderEnabled(false);
    const picker = new g.picker.PickerBuilder()
      .setDeveloperKey(CFG.apiKey)
      .setAppId(CFG.appId)
      .setOAuthToken(accessToken)
      .setLocale("ja")
      .addView(view)
      .enableFeature(g.picker.Feature.MULTISELECT_ENABLED)
      .setTitle("登録する資料を選んでください")
      .setCallback((data: G) => {
        const action = data[g.picker.Response.ACTION];
        if (action === g.picker.Action.PICKED) {
          const docs = (data[g.picker.Response.DOCUMENTS] ?? []) as G[];
          resolve(docs.map((d) => ({
            id: String(d[g.picker.Document.ID]),
            name: String(d[g.picker.Document.NAME] ?? ""),
            mimeType: String(d[g.picker.Document.MIME_TYPE] ?? ""),
            url: String(d[g.picker.Document.URL] ?? ""),
          })).filter((f) => f.url.startsWith("https://")));
        } else if (action === g.picker.Action.CANCEL) {
          resolve([]);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

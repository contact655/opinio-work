"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CareerTurnModal } from "@/components/profile/editor/CareerTurnModal";

/**
 * ★ホームの「振り返りの1問目」（状態 B。2026-10-27 / 柴さんの決定 7）。
 *   直近の会社の転機（3問）を、マイページと同じモーダルで答えてもらう。閉じたらホームを読み直す（状態が変わるため）
 *
 * ★★閉じたらその場で C/D に切り替える（2026-10-27）。
 *   答えたあとで閉じると、読み直しの結果ではこのカードは出ない（答えた会社は B に戻らない）。
 *   ⚠️ 1度、読み直しが画面に反映されず B のまま残り、再読み込みでやっと D になったことがある（原因は特定できず。再現もしなかった）。
 *      そこで読み直しを transition で待ち、終わってもこのカードが残っていたら（＝反映されなかった）ページごと読み直す。
 */
export default function HomeTurnCard({ experienceId, companyName }: { experienceId: string; companyName: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  /** このカードを開いてから何か保存したか（「この転機は答えない」も含む）。保存していなければ閉じても状態は変わらない */
  const savedRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!refreshing || pending) return;
    /* 読み直しが終わったのにまだ描かれている＝反映されていない。⚠️ 少し待ってから（描き替えの途中で読まない） */
    const t = setTimeout(() => {
      console.warn("[home] 読み直しが反映されなかったので、ページごと読み直します");
      window.location.reload();
    }, 300);
    return () => clearTimeout(t);
  }, [refreshing, pending]);

  function close() {
    setOpen(false);
    if (!savedRef.current) return;
    setRefreshing(true);
    startTransition(() => router.refresh());
  }

  return (
    <section data-state="home-turn" className="home-box">
      <h2 className="home-h2">{companyName}を選んだ決め手は？</h2>
      <p className="home-lead">
        3つの質問に答えると、あなたに合う会社の理由が、あなたの選び方に合わせて変わります。回答は公開されず、会社にも伝わりません。
      </p>
      {refreshing ? (
        <p data-state="home-turn-refreshing" className="home-lead" style={{ marginTop: 12, fontWeight: 600 }}>反映しています…</p>
      ) : (
        <button type="button" onClick={() => setOpen(true)} data-action="home-turn-open"
          style={{ marginTop: 12, padding: "9px 18px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
          答える
        </button>
      )}
      <CareerTurnModal
        open={open}
        experienceId={experienceId}
        companyName={companyName}
        onNext={null}
        /* ⚠️ 保存では読み直さない。読み直すと状態が C/D に変わってこのカードごと消え、
              モーダルの続き（任意の段・傾向）が出ないまま閉じる（2026-10-27 に踏んだ）。閉じたときに読み直す */
        onSaved={() => { savedRef.current = true; }}
        onClose={close}
      />
    </section>
  );
}

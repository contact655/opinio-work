"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminHost, AdminRoute } from "@/lib/careerRoutes/server";
import { ROUTE_HOST_MESSAGE_MAX, ROUTE_TALK_TAGS, routeTitle, type RouteTalkTag } from "@/lib/constants/careerRoutes";
import { addHost, deleteHost, saveRoute, setHostListed, updateHost, type RouteActionResult } from "./actions";

/**
 * ★転職ルートの運営画面の中身（2026-11-11）。書き込みは Server Action（actions.ts）だけ。
 * ⚠️ 取得に失敗したら「0件」と見せない（routes が null）。
 */
const box: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 12, background: "#fff", padding: 16 };
const input: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", minWidth: 0, boxSizing: "border-box" };
const btn = (primary = false): React.CSSProperties => ({
  padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
  border: primary ? "none" : "1px solid var(--line)", background: primary ? "var(--royal)" : "#fff", color: primary ? "#fff" : "var(--ink)",
});

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<RouteActionResult>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error); return; }
      after?.();
      router.refresh();
    });
  };
  return { pending, error, run };
}

export function RoutesAdminClient({ routes }: { routes: AdminRoute[] | null }) {
  const [adding, setAdding] = useState(false);
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1000 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>転職ルート</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          ルートのページ（/routes/…）に出るのは、公開範囲が「公開」・相談を受け付ける・運営が承認済み の3つを満たす経験者だけです。
          職歴とは自動で照合しません。承認する前に、下に出る職歴を目で確かめてください。
        </p>
      </div>
      {routes === null ? (
        <p data-state="routes-admin-error" style={{ color: "var(--error)", fontWeight: 600 }}>読み込みに失敗しました（0件という意味ではありません）。</p>
      ) : (
        <>
          {adding ? <RouteForm route={null} onDone={() => setAdding(false)} /> : (
            <div><button type="button" style={btn(true)} onClick={() => setAdding(true)}>＋ ルートを追加</button></div>
          )}
          {routes.length === 0 && <p data-state="routes-admin-empty" style={{ color: "var(--ink-soft)" }}>まだルートがありません。</p>}
          {routes.map((r) => <RouteBlock key={r.id} route={r} />)}
        </>
      )}
    </div>
  );
}

function RouteForm({ route, onDone }: { route: AdminRoute | null; onDone: () => void }) {
  const [slug, setSlug] = useState(route?.slug ?? "");
  const [fromLabel, setFrom] = useState(route?.fromLabel ?? "");
  const [toLabel, setTo] = useState(route?.toLabel ?? "");
  const [order, setOrder] = useState(String(route?.displayOrder ?? 0));
  const [published, setPublished] = useState(route?.isPublished ?? false);
  const { pending, error, run } = useAction();
  return (
    <div data-state="route-form" style={{ ...box, display: "grid", gap: 10 }}>
      <label style={{ display: "grid", gap: 4, fontSize: 13 }}>URL の名前（/routes/ の後ろ）
        <input style={input} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="hr-sales-to-foreign-saas" />
      </label>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>出発点
          <input style={input} value={fromLabel} onChange={(e) => setFrom(e.target.value)} placeholder="人材の法人営業" />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>行き先
          <input style={input} value={toLabel} onChange={(e) => setTo(e.target.value)} placeholder="外資SaaSの営業" />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>表示順（小さいほど上）
          <input style={input} value={order} onChange={(e) => setOrder(e.target.value)} inputMode="numeric" />
        </label>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />公開する（掲載できる経験者が0人なら、ページは「準備中です」になります）
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" style={btn(true)} disabled={pending}
          onClick={() => run(() => saveRoute(route?.id ?? null, { slug, fromLabel, toLabel, displayOrder: order, isPublished: published }), onDone)}>
          {pending ? "保存中…" : "保存"}
        </button>
        <button type="button" style={btn()} disabled={pending} onClick={onDone}>やめる</button>
        {error && <span role="alert" style={{ color: "var(--error)", fontSize: 13, fontWeight: 600 }}>{error}</span>}
      </div>
    </div>
  );
}

function RouteBlock({ route }: { route: AdminRoute }) {
  const [editing, setEditing] = useState(false);
  const [userKey, setUserKey] = useState("");
  const { pending, error, run } = useAction();
  if (editing) return <RouteForm route={route} onDone={() => setEditing(false)} />;
  return (
    <section data-state="route-admin" style={{ ...box, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{routeTitle(route)}</h2>
        <span data-state={route.isPublished ? "route-published" : "route-unpublished"} style={{ fontSize: 12, fontWeight: 700, color: route.isPublished ? "var(--royal)" : "var(--ink-mute)" }}>
          {route.isPublished ? "公開" : "非公開"}
        </span>
        <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>掲載中 {route.listedCount}人 / 登録 {route.hosts.length}人</span>
        <a href={`/routes/${route.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--royal)" }}>/routes/{route.slug}</a>
        <span style={{ flex: 1 }} />
        <button type="button" style={btn()} onClick={() => setEditing(true)}>編集</button>
      </div>

      {route.hosts.map((h) => <HostRow key={h.hostId} host={h} />)}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input style={{ ...input, flex: "1 1 240px" }} value={userKey} onChange={(e) => setUserKey(e.target.value)} placeholder="経験者を登録（メールアドレス・username・id）" />
        <button type="button" style={btn(true)} disabled={pending || !userKey.trim()} onClick={() => run(() => addHost(route.id, userKey), () => setUserKey(""))}>
          {pending ? "登録中…" : "登録"}
        </button>
        {error && <span role="alert" style={{ color: "var(--error)", fontSize: 13, fontWeight: 600 }}>{error}</span>}
      </div>
    </section>
  );
}

function HostRow({ host }: { host: AdminHost }) {
  const [year, setYear] = useState(host.movedYear == null ? "" : String(host.movedYear));
  const [tags, setTags] = useState<RouteTalkTag[]>(host.talkTags);
  const [message, setMessage] = useState(host.message ?? "");
  const [accepting, setAccepting] = useState(host.acceptingConsult);
  const { pending, error, run } = useAction();
  const listed = host.blockers.length === 0;
  const toggle = (t: RouteTalkTag) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  return (
    <div data-state={listed ? "host-listed" : "host-unlisted"} style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <a href={`/u/${encodeURIComponent(host.profileKey)}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "var(--ink)" }}>{host.name}</a>
        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{host.email ?? "（メールなし）"}</span>
        {host.isTest && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>検証用アカウント</span>}
        <span style={{ fontSize: 12, fontWeight: 700, color: listed ? "var(--royal)" : "var(--ink-soft)" }}>
          {listed ? "ルートのページに掲載中" : `掲載していない：${host.blockers.join("・")}`}
        </span>
      </div>

      <div style={{ background: "var(--bg-tint)", borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>職歴（古い順・運営の確認用。会社名は伏せずに出しています）</div>
        {host.experiences.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>職歴が登録されていません</div>
        ) : (
          <ol data-state="host-experiences" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 13, lineHeight: 1.6 }}>
            {host.experiences.map((e) => (
              <li key={e.id}>
                {(e.startedAt ?? "?").slice(0, 7)}〜{e.isCurrent ? "現在" : (e.endedAt ?? "?").slice(0, 7)}　{e.company}{e.role ? ` ／ ${e.role}` : ""}
                {e.visibilityCompany && e.visibilityCompany !== "real" && <span style={{ color: "var(--ink-mute)" }}>（公開では会社名を伏せている）</span>}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>転職した年
          <input style={{ ...input, width: 100 }} value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" placeholder="2023" />
        </label>
        <div style={{ fontSize: 13 }}>話せること
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {ROUTE_TALK_TAGS.map((t) => (
              <button key={t.value} type="button" aria-pressed={tags.includes(t.value)} onClick={() => toggle(t.value)}
                style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12.5, fontFamily: "inherit", cursor: "pointer",
                  border: `1.5px solid ${tags.includes(t.value) ? "var(--royal)" : "var(--line)"}`, background: tags.includes(t.value) ? "var(--royal-50)" : "#fff",
                  color: tags.includes(t.value) ? "var(--royal)" : "var(--ink-soft)", fontWeight: tags.includes(t.value) ? 700 : 500 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>本人のひとこと（{message.length} / {ROUTE_HOST_MESSAGE_MAX}）
          <textarea style={{ ...input, resize: "vertical" }} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={accepting} onChange={(e) => setAccepting(e.target.checked)} />
          相談を受け付ける（本人の同意を確かめてから入れる）
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" style={btn()} disabled={pending}
          onClick={() => run(() => updateHost(host.hostId, { movedYear: year, talkTags: tags, message, acceptingConsult: accepting }))}>
          内容を保存
        </button>
        {host.isListed ? (
          <button type="button" data-action="host-unlist" style={btn()} disabled={pending} onClick={() => run(() => setHostListed(host.hostId, false))}>承認を取り消す</button>
        ) : (
          <button type="button" data-action="host-approve" style={btn(true)} disabled={pending} onClick={() => run(() => setHostListed(host.hostId, true))}>経歴を確かめたので承認する</button>
        )}
        <button type="button" style={{ ...btn(), color: "var(--error)" }} disabled={pending}
          onClick={() => { if (window.confirm(`${host.name} さんをこのルートの経験者から外しますか？（プロフィールや職歴には触りません）`)) run(() => deleteHost(host.hostId)); }}>
          登録を外す
        </button>
        {host.approvedAt && <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>承認日 {host.approvedAt.slice(0, 10)}</span>}
        {error && <span role="alert" style={{ color: "var(--error)", fontSize: 13, fontWeight: 600 }}>{error}</span>}
      </div>
    </div>
  );
}

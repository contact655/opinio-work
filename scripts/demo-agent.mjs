#!/usr/bin/env node
/**
 * ★株式会社エージェント（検証用・デモ用の企業）の見本データを作る／消す（2026-10-11 / 柴さんの指示）
 *
 *   node scripts/demo-agent.mjs create    # 消してから作り直す（何度流しても同じ状態になる）
 *   node scripts/demo-agent.mjs destroy   # 見本データを消し、会社ページを作る前の中身に戻す
 *   node scripts/demo-agent.mjs check     # 件数を出すだけ（書き込まない）
 *
 * ⚠️★本番の Supabase に書く（ローカルの dev も本番 DB）。次の3つを守っている:
 *   ① 相手は **検証用の求職者（is_test）だけ**。メールで明示列挙し、1人でも is_test でなければ書く前に止める
 *   ② 企業が **is_test であること**を書く前に確かめる（migration 20261011010000）。実在の企業には書かない
 *   ③ **通知（ow_notifications）もメールも作らない。** アプリの経路（API・lib）を通さず、表に直接入れる
 * ⚠️ 消すのは「この会社に紐づく行」だけ（company_id で絞る）。この会社は見本専用なので、まるごと消してよい。
 * ⚠️ 日付は「流した時点からの相対」で入れる（送って3日・25日 など）。日が経ったら create を流し直す。
 */
import { readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const envText = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(envText.split("\n").filter((l) => l.indexOf("=") > 0).map((l) => {
  const i = l.indexOf("=");
  return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
}));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const COMPANY_ID = "7a048a8e-2c44-4f09-a727-8d7e6350851c";
const COMPANY_NAME = "株式会社エージェント";
/** 担当者（どちらも検証用） */
const STAFF = { shiba: "hshiba@opinio.co.jp", suzuki: "d1872303951587@gmail.com" };
/** 相手（検証用の求職者）。⚠️ 企業の担当者を兼ねていない人・転職意欲が「連絡しない」でない人だけ */
const CANDIDATES = {
  pend3: "contact+15@opinio.co.jp",
  pend25: "contact+27@opinio.co.jp",
  unread: "contact+37@opinio.co.jp",
  slots: "contact+38@opinio.co.jp",
  confirmed: "contact+43@opinio.co.jp",
  acc4: "contact+24@opinio.co.jp",
  acc5: "contact+28@opinio.co.jp",
  acc6: "contact+30@opinio.co.jp",
  acc7: "contact+33@opinio.co.jp",
  acc8: "contact+35@opinio.co.jp",
  acc9: "contact+40@opinio.co.jp",
  acc10: "contact+46@opinio.co.jp",
  expired: "contact+48@opinio.co.jp",
  propWaiting: "contact+11@opinio.co.jp",
  propTheirs: "contact+25@opinio.co.jp",
  propMutual: "contact+04@opinio.co.jp",
  propEnded: "contact+03@opinio.co.jp",
};

/** 会社ページの列。★`original` は見本を入れる前の値（destroy で戻す）。2026-10-11 実測 */
const PROFILE = {
  tagline: { v: "キャリアの「次の一歩」を、事実で選べるように", original: null },
  description: {
    v: "IT・SaaS 業界に特化した人材紹介と採用支援を行っています。\n\n候補者一人ひとりの経験と志向を丁寧に聞き取り、入社後に活躍できる企業との出会いをつくることを大切にしています。",
    original: null,
  },
  founded_year: { v: 2019, original: null },
  employee_count: { v: "約30名", original: "1-10名" },
  employee_count_band: { v: "11-50", original: "1-10" },
  headquarters_address: { v: "東京都渋谷区（見本）", original: null },
  location: { v: "東京都", original: null },
  ceo_name: { v: "見本 太郎", original: null },
  phase: { v: "non_listed", original: null },
  capital_type: { v: "japanese_independent", original: null },
  capital_notes: { v: "見本データです。実在の資本関係を示すものではありません。", original: null },
  branch_locations: { v: ["大阪", "福岡"], original: null },
  avg_age: { v: 32, original: null },
  female_ratio: { v: "男女比 約5:5", original: null },
  benefits: {
    v: [{ name: "フレックスタイム制" }, { name: "リモートワーク可（週2日）" }, { name: "書籍・研修費補助" }, { name: "資格取得支援" }, { name: "誕生日休暇" }],
    original: null,
  },
  culture_description: { v: "候補者の利益を最優先にする文化です。数字よりも「入社後に活躍できたか」を振り返り、チームで知見を共有します。", original: null },
  culture_keywords: { v: ["候補者ファースト", "ナレッジ共有", "少人数で裁量が大きい"], original: null },
  company_features: { v: ["IT・SaaS特化", "少数精鋭", "リモート併用"], original: null },
  why_join: { v: "立ち上げ期の組織で、採用支援の仕組みづくりから関われます。経験の浅い領域でも先輩が伴走します。", original: null },
  mission: { v: "納得してキャリアを選べる人を増やす", original: null },
  main_products: { v: ["人材紹介（IT・SaaS 領域の中途採用支援）", "採用コンサルティング（採用計画と面接設計の支援）"], original: null },
  main_customers: { v: ["SaaS スタートアップ", "外資系 IT 企業の日本法人"], original: null },
  customer_cases: {
    v: [
      { name: "SaaS企業A社（見本）", industry: "IT・ソフトウェア", usecase: "インサイドセールス組織の立ち上げに合わせ、半年で5名の採用を支援。", result: "採用した5名全員が1年後も在籍。", products: ["人材紹介"] },
      { name: "IT企業B社（見本）", industry: "IT・ソフトウェア", usecase: "面接官ごとに評価がばらつく課題に対し、評価項目と面接設計を整理。", result: "内定承諾率が向上。", products: ["採用コンサルティング"] },
      { name: "外資系C社（見本）", industry: "IT・ソフトウェア", usecase: "日本法人の立ち上げ期に、営業とカスタマーサクセスの初期メンバーを採用。", result: "3か月で中核メンバーがそろった。", products: ["人材紹介"] },
    ],
    original: null,
  },
  market_customer_size: { v: ["mid_market", "smb"], original: null },
  market_note: { v: "従業員50〜500名規模の IT 企業が中心です。", original: null },
  biz_model_types: { v: ["transaction"], original: null },
  biz_model_note: { v: "採用が決まったときに成果報酬をいただく形です（見本）。", original: null },
  org_teams: {
    v: [
      { name: "キャリアアドバイザー", division: "人材紹介", mission: "候補者の志向に合う企業を一緒に探す", roles: ["キャリアアドバイザー"], description: "面談から入社後のフォローまで担当します。" },
      { name: "リクルーティングアドバイザー", division: "人材紹介", mission: "企業の採用課題を言語化する", roles: ["法人営業"], description: "企業の採用計画づくりから関わります。" },
    ],
    original: null,
  },
  jobs_public: { v: true, original: false },
};

const DEPARTMENTS = ["人材紹介事業部", "マーケティング部"];
const COMPANY_ROLES = [
  { name: "インサイドセールス", standard: "d1724303-7ca2-4cbe-a16b-f15d5a2476b8", dept: 0 },
  { name: "マーケティング責任者", standard: "4492d281-d7b0-472d-9ca8-979d893c7782", dept: 1 },
];
const JOBS = [
  { key: "is", slug: "agent-demo-inside-sales", title: "インサイドセールス（IT・SaaS 領域の法人開拓）", role: "d1724303-7ca2-4cbe-a16b-f15d5a2476b8", category: "インサイドセールス", companyRole: 0, dept: 0, min: 450, max: 650 },
  { key: "fs", slug: "agent-demo-field-sales", title: "フィールドセールス（リクルーティングアドバイザー）", role: "133c74c0-e432-4c52-8235-7ad9bc7d96b8", category: "フィールドセールス", companyRole: null, dept: 0, min: 500, max: 800 },
  { key: "mk", slug: "agent-demo-marketing-manager", title: "マーケティング責任者（候補者集客）", role: "4492d281-d7b0-472d-9ca8-979d893c7782", category: "マーケティング責任者（マネージャー）", companyRole: 1, dept: 1, min: 700, max: 1000 },
];

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const ago = (d) => new Date(now - d * DAY).toISOString();
const later = (d) => new Date(now + d * DAY).toISOString();
/** 日本時間の日付と時刻を指定して ISO を作る（面談の候補日）。⚠️ 土日に当たったら次の月曜へずらす */
function jstAt(daysFromToday, hour) {
  const d = new Date(now + 9 * 60 * 60 * 1000 + daysFromToday * DAY);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour - 9, 0, 0)).toISOString();
}

/** ⚠️ `lib/constants/meetings.ts` の formatMeetingDateTime と同じ形（画面と同じ文面にする） */
function formatMeetingDateTime(iso) {
  const f = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.month}月${p.day}日(${p.weekday}) ${p.hour}:${p.minute}`;
}

function must(r, label) {
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  return r.data;
}

async function guard() {
  const c = must(await db.from("ow_companies").select("id, name, is_test").eq("id", COMPANY_ID).single(), "company");
  if (c.name !== COMPANY_NAME || c.is_test !== true) throw new Error(`中止: ${COMPANY_NAME} が is_test でない（${JSON.stringify(c)}）`);
  const emails = [...Object.values(STAFF), ...Object.values(CANDIDATES)];
  const users = must(await db.from("ow_users").select("id, email, name, is_test").in("email", emails), "users");
  const byEmail = new Map(users.map((u) => [u.email, u]));
  for (const e of emails) {
    const u = byEmail.get(e);
    if (!u) throw new Error(`中止: ${e} が見つからない`);
    if (u.is_test !== true) throw new Error(`中止: ${e} が検証用でない`);
  }
  if (new Set(Object.values(CANDIDATES)).size !== Object.values(CANDIDATES).length) throw new Error("中止: 相手が重複している");
  const id = (e) => byEmail.get(e).id;
  const name = (e) => byEmail.get(e).name;
  return { id, name };
}

async function destroy() {
  await guard();
  /* 子 → 親の順。会話の参加者・メッセージ・面談・通知は会話の CASCADE で消える */
  const del = async (table, col = "company_id") => {
    const r = must(await db.from(table).delete().eq(col, COMPANY_ID).select("*"), `delete ${table}`);
    return r.length;
  };
  const out = {};
  out.notifications = must(await db.from("ow_notifications").delete().eq("actor_company_id", COMPANY_ID).select("id"), "delete notifications").length;
  out.meetings = await del("ow_meetings");
  out.approaches = await del("ow_company_approaches");
  out.proposals = await del("ow_proposals");
  out.conversations = await del("ow_conversations");
  out.saved_searches = await del("ow_saved_candidate_searches");
  out.jobs = await del("ow_jobs");
  out.job_role_departments = await del("ow_company_job_role_departments");
  out.company_job_roles = await del("ow_company_job_roles");
  out.departments = await del("ow_company_departments");
  out.posts = await del("ow_company_posts");
  out.tools = await del("ow_company_tools");
  const restore = Object.fromEntries(Object.entries(PROFILE).map(([k, x]) => [k, x.original]));
  must(await db.from("ow_companies").update(restore).eq("id", COMPANY_ID).eq("is_test", true).select("id"), "restore profile");
  return out;
}

async function create() {
  const removed = await destroy();
  const { id, name } = await guard();
  const shiba = id(STAFF.shiba);
  const suzuki = id(STAFF.suzuki);

  /* ── 会社ページ ── */
  const profile = Object.fromEntries(Object.entries(PROFILE).map(([k, x]) => [k, x.v]));
  must(await db.from("ow_companies").update(profile).eq("id", COMPANY_ID).eq("is_test", true).select("id"), "profile");
  const tools = [
    ["d559c80c-a2c8-4c13-b169-a39f0db1c1b5", "社内の連絡はすべて Slack"],
    ["efa627a3-55f4-46a9-8bbb-258f0805936f", null],
    ["a34b134c-9817-4472-8cad-6c2ebf692ee9", "面談記録と社内ナレッジ"],
    ["c5e039ab-0c03-424a-b1f7-65e8aec3481b", null],
  ];
  must(await db.from("ow_company_tools").insert(tools.map(([tool_id, note], i) => ({ company_id: COMPANY_ID, tool_id, note, sort_order: i }))).select("id"), "tools");
  must(await db.from("ow_company_posts").insert({
    company_id: COMPANY_ID, author_user_id: shiba, title: "見本：入社3か月のキャリアアドバイザーに聞きました",
    body: "見本の記事です。入社のきっかけ、最初の3か月で任された仕事、チームの雰囲気について聞きました。",
    category: "interview", is_published: true, published_at: ago(20),
  }).select("id"), "post");

  /* ── 部門と職種（2件） ── */
  const depts = must(await db.from("ow_company_departments").insert(DEPARTMENTS.map((n, i) => ({ company_id: COMPANY_ID, name: n, display_order: i }))).select("id, name"), "departments");
  const deptId = (i) => depts.find((d) => d.name === DEPARTMENTS[i]).id;
  const roles = must(await db.from("ow_company_job_roles").insert(COMPANY_ROLES.map((r, i) => ({ company_id: COMPANY_ID, name: r.name, standard_role_id: r.standard, display_order: i }))).select("id, name"), "company roles");
  const roleId = (i) => roles.find((r) => r.name === COMPANY_ROLES[i].name).id;
  must(await db.from("ow_company_job_role_departments").insert(COMPANY_ROLES.map((r, i) => ({ company_id: COMPANY_ID, job_role_id: roleId(i), department_id: deptId(r.dept) }))).select("job_role_id"), "role departments");

  /* ── 求人（3件・職種マスタに紐づける） ── */
  const jobIds = {};
  for (const j of JOBS) {
    const row = must(await db.from("ow_jobs").insert({
      company_id: COMPANY_ID, slug: j.slug, title: j.title, job_category: j.category, employment_type: "正社員",
      status: "published", published_at: ago(40), salary_min: j.min, salary_max: j.max,
      location: "東京都", work_style: "hybrid", remote_work_status: "hybrid",
      catch_copy: "見本の求人です", description: `見本の求人です。${j.title}として、IT・SaaS 領域の採用支援に関わります。`,
      required_skills: ["法人営業の経験（1年以上）", "IT 業界への関心"], preferred_skills: ["SaaS 企業での勤務経験"],
      selection_steps: ["書類選考", "カジュアル面談", "一次面接", "最終面接"],
      role_category_id: j.role, company_job_role_id: j.companyRole === null ? null : roleId(j.companyRole),
      department_id: deptId(j.dept), is_test: true,
    }).select("id").single(), `job ${j.key}`);
    jobIds[j.key] = row.id;
    must(await db.from("ow_job_roles").insert({ job_id: row.id, role_id: j.role, is_primary: true }).select("job_id"), `job role ${j.key}`);
  }

  /* ── 会話（企業 × 求職者） ── */
  async function openConversation(candEmail, createdAt, firstText, senderId, { seenByCandidate = true } = {}) {
    const conv = must(await db.from("ow_conversations").insert({
      kind: "company", stage: "active", company_id: COMPANY_ID, candidate_user_id: id(candEmail), status: "active", created_at: createdAt,
    }).select("id").single(), "conversation");
    const parts = must(await db.from("ow_conversation_participants").insert([
      { conversation_id: conv.id, user_id: id(candEmail), role: "candidate", joined_at: createdAt, last_read_at: seenByCandidate ? createdAt : null },
      { conversation_id: conv.id, user_id: senderId, role: "company_admin", joined_at: createdAt },
    ]).select("id, role"), "participants");
    const cp = parts.find((p) => p.role === "candidate").id;
    const sp = parts.find((p) => p.role === "company_admin").id;
    if (firstText) must(await db.from("ow_conversation_messages").insert({ conversation_id: conv.id, sender_participant_id: sp, body: firstText, sent_at: createdAt }).select("id"), "first message");
    return { id: conv.id, cp, sp };
  }
  const msg = async (convId, participantId, body, sentAt, extra = {}) =>
    must(await db.from("ow_conversation_messages").insert({ conversation_id: convId, sender_participant_id: participantId, body, sent_at: sentAt, ...extra }).select("id").single(), "message").id;

  /* ── 声かけ ── */
  const R = (s) => s; // 理由（30〜200字）
  const approaches = [
    { c: CANDIDATES.pend3, by: shiba, sent: 3, job: "is", reason: R("インサイドセールスとして SaaS の新規開拓に取り組まれてきた経歴を拝見しました。当社の法人開拓チームの立ち上げについてお話を伺いたいです。") },
    { c: CANDIDATES.pend25, by: suzuki, sent: 25, job: null, reason: R("エンタープライズ営業の経験を、当社のリクルーティングアドバイザーの仕事に活かしていただけると考えました。まずは情報交換からお願いします。") },
    { c: CANDIDATES.unread, by: shiba, sent: 6, accepted: 1, seen: false, job: "fs", reason: R("法人営業で大手企業を担当されてきたご経験を拝見し、企業の採用課題を一緒に整理する仕事に関心を持っていただけるのではと考えました。") },
    { c: CANDIDATES.slots, by: shiba, sent: 12, accepted: 9, seen: true, job: "mk", reason: R("マーケティングで集客の仕組みをつくられてきた経歴を拝見しました。候補者集客の責任者としてのお考えを伺いたいです。"), meeting: "slots" },
    { c: CANDIDATES.confirmed, by: suzuki, sent: 18, accepted: 15, seen: true, job: "is", reason: R("カスタマーサクセスで顧客の声を拾い上げてこられたご経験は、候補者との面談にも活きると考えました。ぜひ一度お話しさせてください。"), meeting: "confirmed" },
    { c: CANDIDATES.acc4, by: shiba, sent: 34, accepted: 30, seen: true, unreplied: true, job: null, reason: R("スタートアップでの立ち上げ経験を拝見しました。少人数の組織で仕組みをつくるところからご一緒できればと考えています。") },
    { c: CANDIDATES.acc5, by: suzuki, sent: 41, accepted: 38, seen: true, job: "fs", reason: R("関西エリアでの法人営業のご経験を拝見しました。大阪拠点の立ち上げについて、率直なご意見を伺えればうれしいです。") },
    { c: CANDIDATES.acc6, by: shiba, sent: 48, accepted: 44, seen: true, job: null, reason: R("転職を具体的に検討されていると拝見しました。IT 業界の採用支援という仕事について、選択肢の一つとしてお話しさせてください。") },
    { c: CANDIDATES.acc7, by: suzuki, sent: 55, accepted: 52, seen: true, job: "is", reason: R("営業として数字を積み上げてこられたご経験は、当社のインサイドセールスでもそのまま活きると考え、ご連絡しました。") },
    { c: CANDIDATES.acc8, by: shiba, sent: 63, accepted: 60, seen: true, job: null, reason: R("人事の立場で採用に関わってこられたご経験を拝見しました。企業側の視点をお持ちの方と一緒に働きたいと考えています。") },
    { c: CANDIDATES.acc9, by: suzuki, sent: 70, accepted: 66, seen: true, job: "mk", reason: R("Web マーケティングの運用経験を拝見しました。候補者に届く発信の仕組みづくりを一緒に考えていただけないでしょうか。") },
    { c: CANDIDATES.acc10, by: shiba, sent: 78, accepted: 75, seen: true, job: "fs", reason: R("無形商材の提案営業を続けてこられた経歴を拝見しました。採用という無形の価値を企業に伝える仕事にも通じると考えました。") },
    { c: CANDIDATES.expired, by: suzuki, sent: 40, job: null, reason: R("キャリアの選択肢を広く情報収集されていると拝見しました。採用支援の現場で見えている IT 業界の動きをお伝えできればと思います。") },
  ];
  let conversations = 0;
  let slotsMessageId = null;
  for (const a of approaches) {
    const createdAt = ago(a.sent);
    let conversationId = null;
    let acceptedAt = null;
    if (a.accepted !== undefined) {
      acceptedAt = ago(a.accepted);
      const first = `【声をかけた理由】\n${a.reason}`;
      const conv = await openConversation(a.c, acceptedAt, first, a.by);
      conversationId = conv.id;
      conversations++;
      /* 返信していない会話（候補者の発言が最後）を1本つくる */
      if (a.unreplied) await msg(conv.id, conv.cp, "ご連絡ありがとうございます。来週であれば平日の夜に時間が取れます。", ago(2));
      if (a.meeting) {
        await msg(conv.id, conv.cp, "ご連絡ありがとうございます。ぜひ一度お話を伺いたいです。", new Date(Date.parse(acceptedAt) + 2 * 60 * 60 * 1000).toISOString());
        const slots = [jstAt(5, 10), jstAt(6, 15), jstAt(9, 11)];
        const attendees = [name(STAFF.shiba)];
        const body = ["面談の候補日をお送りします。ご都合のよい日時を1つ選んでください。", ...slots.map((s) => `・${formatMeetingDateTime(s)}`), `形式：オンライン／時間：30分／同席：${attendees.join("、")}`].join("\n");
        const sentAt = new Date(Date.parse(acceptedAt) + 26 * 60 * 60 * 1000).toISOString();
        const mid = await msg(conv.id, conv.sp, body, sentAt, { kind: "meeting_slots", payload: { slots, format: "online", duration: 30, attendees, status: "open" } });
        if (a.meeting === "slots") slotsMessageId = mid;
        if (a.meeting === "confirmed") {
          const m = must(await db.from("ow_meetings").insert({
            conversation_id: conv.id, company_id: COMPANY_ID, candidate_user_id: id(a.c), starts_at: slots[1], duration_minutes: 30,
            format: "online", attendees, status: "scheduled", source: "slots", slots_message_id: mid, created_by: id(a.c),
            created_at: new Date(Date.parse(sentAt) + 3 * 60 * 60 * 1000).toISOString(),
          }).select("id").single(), "meeting");
          must(await db.from("ow_conversation_messages").update({ payload: { slots, format: "online", duration: 30, attendees, status: "confirmed", chosenIndex: 1, meetingId: m.id } }).eq("id", mid).select("id"), "confirm payload");
        }
      }
    }
    must(await db.from("ow_company_approaches").insert({
      company_id: COMPANY_ID, candidate_user_id: id(a.c), sender_user_id: a.by, reason: a.reason,
      body: a.sent <= 6 ? "ご都合のよいときに、30分ほどオンラインでお話しできればうれしいです。" : null,
      created_at: createdAt, accepted_at: acceptedAt, conversation_id: conversationId,
      company_seen_at: acceptedAt && a.seen ? new Date(Date.parse(acceptedAt) + 60 * 60 * 1000).toISOString() : null,
      job_id: a.job ? jobIds[a.job] : null,
    }).select("id"), "approach");
  }

  /* ── 提案（4件） ── */
  const evidence = (jobKey, months) => [
    { kind: "job_role", n: 1, fact: { kind: "job_role", jobId: jobIds[jobKey], jobTitle: JOBS.find((j) => j.key === jobKey).title, months }, sourceQuery: "touchpoints:job_role" },
    { kind: "company_role", n: 1, fact: { kind: "company_role", companyJobRoleId: roleId(0), roleName: COMPANY_ROLES[0].name, departments: [DEPARTMENTS[0]], byExperience: true, byDesired: true }, sourceQuery: "touchpoints:company_role" },
  ];
  const counter = [{ kind: "unknown", label: "都合の悪い点は確かめていません（在籍期間・年収・勤務形態のデータが足りていません）" }];
  const proposal = async (cand, createdDays, extra) =>
    must(await db.from("ow_proposals").insert({
      candidate_user_id: id(cand), company_id: COMPANY_ID, job_id: jobIds.is, evidence: evidence("is", 30), counter_evidence: counter,
      computed_at: ago(createdDays), created_at: ago(createdDays), respond_by: new Date(now - createdDays * DAY + 30 * DAY).toISOString(), ...extra,
    }).select("id").single(), "proposal").id;
  /* 回答待ち（候補者は「会いたい」。企業の回答を待っている） */
  await proposal(CANDIDATES.propWaiting, 4, { candidate_response: "interested", candidate_responded_at: ago(2) });
  /* 相手の回答待ち（企業は「会いたい」。候補者の回答を待っている） */
  await proposal(CANDIDATES.propTheirs, 7, { company_response: "want_to_meet", company_responded_at: ago(5) });
  /* 両方が会いたい（紹介済み・会話あり） */
  const mutualConv = await openConversation(CANDIDATES.propMutual, ago(1), null, shiba);
  conversations++;
  await proposal(CANDIDATES.propMutual, 9, { candidate_response: "interested", candidate_responded_at: ago(3), company_response: "want_to_meet", company_responded_at: ago(1), introduced_at: ago(1), conversation_id: mutualConv.id });
  /* 終了（候補者が見送り。企業には「この提案は終了しました」とだけ出る） */
  const endedId = await proposal(CANDIDATES.propEnded, 12, { candidate_response: "declined", candidate_responded_at: ago(8) });
  must(await db.from("ow_proposal_declines").insert({ proposal_id: endedId, side: "candidate", reason: "timing" }).select("id"), "decline");

  /* ── 保存した条件（2件。1件は新着あり） ── */
  const searches = must(await db.from("ow_saved_candidate_searches").insert([
    { owner_user_id: shiba, company_id: COMPANY_ID, name: "見本：転職を考えている人（すべて）", filters: {}, notify_frequency: "none", is_shared: true, created_at: ago(60) },
    { owner_user_id: shiba, company_id: COMPANY_ID, name: "見本：営業経験・東京", filters: { q: "営業", prefectures: ["東京都"] }, notify_frequency: "none", is_shared: true, created_at: ago(10) },
  ]).select("id, name"), "saved searches");
  /* 新着あり ＝ 前回見た日時を古くしておく（候補者の行は触らない）。もう1件は今見たことにする */
  must(await db.from("ow_saved_search_views").upsert([
    { search_id: searches[0].id, viewer_user_id: shiba, last_viewed_at: ago(60) },
    { search_id: searches[0].id, viewer_user_id: suzuki, last_viewed_at: ago(60) },
    { search_id: searches[1].id, viewer_user_id: shiba, last_viewed_at: new Date(now).toISOString() },
    { search_id: searches[1].id, viewer_user_id: suzuki, last_viewed_at: new Date(now).toISOString() },
  ], { onConflict: "search_id,viewer_user_id" }).select("search_id"), "search views");

  return { removed, created: { jobs: 3, departments: 2, company_job_roles: 2, approaches: approaches.length, proposals: 4, conversations, saved_searches: 2, slotsMessageId: !!slotsMessageId } };
}

async function check() {
  const count = async (table, col = "company_id") => {
    const r = await db.from(table).select("*", { count: "exact", head: true }).eq(col, COMPANY_ID);
    if (r.error) throw new Error(`${table}: ${r.error.message}`);
    return r.count;
  };
  const out = {};
  for (const t of ["ow_jobs", "ow_company_departments", "ow_company_job_roles", "ow_company_approaches", "ow_proposals", "ow_conversations", "ow_meetings", "ow_saved_candidate_searches", "ow_company_posts", "ow_company_tools"]) out[t] = await count(t);
  out.notifications = await count("ow_notifications", "actor_company_id");
  return out;
}

const cmd = process.argv[2];
const run = { create, destroy, check }[cmd];
if (!run) {
  console.error("使い方: node scripts/demo-agent.mjs create|destroy|check");
  process.exit(1);
}
run().then((r) => console.log(JSON.stringify(r, null, 2))).catch((e) => { console.error(e.message); process.exit(1); });

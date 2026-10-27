/**
 * ★検索の「会社・業界・職種の移動」の読み取り（2026-10-27 / 柴さんの決定）。**純粋な関数。何も import しない**（node のテストから直接読むため）。
 *
 *   「Salesforceを出た人」「Salesforce出身」「Salesforceから転職した人」 … left（その会社の職歴が全部終わっている人）
 *   「Salesforceを出て事業会社のカスタマーサクセスに行った人」              … left ＋ 行き先（直後の会社の業界・職種）
 *   「Salesforceに入った人の前職」                                         … prevOf（検索では出さず、企業ページの「人の流れ」へ案内する）
 *   「IT以外から来た人」「未経験から営業」「異業界に移った人」              … move（会社を指定しない移動）
 *
 * ⚠️ 読み取りは決まり（正規表現と辞書）だけ。AI は使っていない。
 * ⚠️ 業界の語（「金融」「IT」など）は**移動の文の中でだけ**読む。普通の条件にはしない
 *    （掲載企業のほとんどが IT・インターネットで、業界は絞り込みとして効かないため。interpretQuery.ts ③）
 * ⚠️ 「事業会社」は IT・インターネット以外の業界として読む（柴さんの決定）
 * ⚠️ 「未経験」は後ろの言葉で決める（業界・会社の言葉なら業界の未経験、職種なら職種の未経験）
 * ⚠️ 年齢つきの言い方（「30歳を過ぎて」）は読まない。読めなかった語として返す（ageSpans）
 */

export type Span = { start: number; end: number };

/** 移動の片側（移る前／移った先）の条件。どれも任意 */
export type TransitionSide = {
  /** 業界の大分類の id */
  industryId?: string;
  industryLabel?: string;
  /** 「〜以外」 */
  notIndustry?: boolean;
  foreign?: boolean;
  /** 職種（祖先展開しない元の id と、照合に使う id） */
  roleIds?: string[];
  roleLabel?: string;
};

export type TransitionIntent =
  | { kind: "left"; companyId: string; companyLabel: string; to?: TransitionSide; label: string }
  | { kind: "prevOf"; companyId: string; companyLabel: string; label: string }
  | {
      kind: "move";
      from?: TransitionSide;
      to?: TransitionSide;
      /** 「未経験から」。何の未経験か（後ろの言葉で決めた結果） */
      firstTime?: "industry" | "role" | "foreign";
      /** 「異業界に移った」 */
      crossIndustry?: boolean;
      label: string;
    };

export type IndustryVocab = { id: string; name: string; terms: string[] }[];

export type ParseInput = {
  normalized: string;
  companies: { span: Span; companyId: string; label: string }[];
  roles: { span: Span; roleIds: string[]; label: string; index: number }[];
  foreign: { span: Span; isForeign: boolean; index: number } | null;
  industries: IndustryVocab;
  /** IT・インターネットの大分類の id（「事業会社」「IT以外」に使う） */
  itIndustryId: string | null;
  /** すでに条件に使った範囲（社名・職種など） */
  consumed: Span[];
  /** 会社を指定しない移動（「IT以外から」「未経験から」「異業界に」）も読むか */
  moves: boolean;
};

export type ParseResult = {
  intent: TransitionIntent | null;
  /** 読み取りに使った範囲（移動の言葉・業界の語）。読めなかった語から外す */
  consumed: Span[];
  /** 移動の片側に吸い込んだ条件（interpretQuery の conditions の添字）。普通の条件から外す */
  absorbedConditionIndexes: number[];
  /** 年齢の言い方。読めなかった語として出す */
  ageSpans: Span[];
};

const LEFT_AFTER =
  /^(?:の会社)?(?:を|から)?(?:出た|出て|でた|でて|辞めた|辞めて|やめた|やめて|退職した|退職して|退職|卒業した|卒業して|卒業|離れた|離れて)/;
const SOURCE_AFTER =
  /^(?:出身|から来た|からきた|から転職した|から転職して|から転職|から移った|から移ってきた|から移って|を経て|を経由して)/;
const SOURCE_BEFORE = /(?:元|前職が|前職は)$/;
const PREV_OF_AFTER =
  /^(?:に|へ)(?:入った|はいった|入社した|転職した|移った|来た|きた)(?:人)?の(?:前職|前の会社|前)|^の前職|^に入る前/;
/** 移った先の終わり（「〜に行った」）。ここまでを行き先の言葉として読む */
const TO_VERB =
  /(?:に|へ)?(?:行った|いった|行って|移った|うつった|転職した|転職|入った|はいった|来た|きた|就職した|なった)/;
const AGE_RE = /\d+\s*(?:歳|才)(?:を過ぎて|をすぎて|を超えて|以上|以下|未満|前後|代|まで|から|で)?|\d0代/g;
const CROSS_RE = /(?:異業界|異業種|別の業界|違う業界|他業界)(?:に|へ|から)?/;
const NOT_SUFFIX = /^(?:以外|じゃない|でない|ではない)/;
const UNEXPERIENCED = "未経験";

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

/**
 * ★業界の言い方の辞書。大分類の名前に加えて、短い呼び方を足す。
 *   ⚠️ 移動の文の中でだけ使う（ほかの条件にしない）。
 *   ⚠️ 英字の「it」は前後が英数字でないときだけ当てる（findTerm）
 */
export function industryTermsFor(name: string): string[] {
  const extra: Record<string, string[]> = {
    "IT・インターネット": ["it業界", "it企業", "it", "インターネット業界", "web業界", "ネット業界"],
    メーカー: ["メーカー", "製造業", "製造"],
    "商社・小売・流通": ["商社", "小売", "流通"],
    金融: ["金融", "銀行", "証券", "保険"],
    "不動産・建設": ["不動産", "建設"],
    "医療・介護": ["医療", "介護"],
    人材サービス: ["人材業界", "人材サービス", "人材会社", "人材"],
    コンサルティング: ["コンサル業界", "コンサルティング業界", "コンサルファーム", "コンサルティングファーム"],
    "広告・メディア": ["広告", "メディア"],
    "官公庁・団体・教育": ["官公庁", "公務員", "教育"],
    "生活・サービス": ["サービス業"],
  };
  return Array.from(new Set([name.toLowerCase(), ...(extra[name] ?? [])]));
}

function findTerm(hay: string, term: string, from = 0): number {
  for (let i = hay.indexOf(term, from); i >= 0; i = hay.indexOf(term, i + 1)) {
    if (/^[a-z0-9]+$/.test(term)) {
      const before = hay[i - 1] ?? "";
      const after = hay[i + term.length] ?? "";
      if (/[a-z0-9]/.test(before) || /[a-z0-9]/.test(after)) continue;
    }
    return i;
  }
  return -1;
}

/** 範囲の中にある業界の語（最長一致）。見つからなければ null */
function industryIn(
  s: string, range: Span, vocab: IndustryVocab, consumed: Span[],
): { span: Span; id: string; name: string } | null {
  let best: { span: Span; id: string; name: string } | null = null;
  for (const ind of vocab) {
    for (const term of ind.terms) {
      for (let i = findTerm(s, term, range.start); i >= 0 && i + term.length <= range.end; i = findTerm(s, term, i + 1)) {
        const span = { start: i, end: i + term.length };
        if (consumed.some((c) => overlaps(c, span))) continue;
        if (!best || term.length > best.span.end - best.span.start) best = { span, id: ind.id, name: ind.name };
        break;
      }
    }
  }
  return best;
}

function sideLabel(side: TransitionSide | undefined): string {
  if (!side) return "";
  const parts: string[] = [];
  if (side.notIndustry && side.industryLabel === "IT・インターネット" && side.foreign === undefined && !side.roleLabel) return "IT・インターネット以外";
  if (side.foreign) parts.push("外資系");
  if (side.industryLabel) parts.push(side.notIndustry ? `${side.industryLabel}以外` : side.industryLabel);
  if (side.roleLabel) parts.push(side.roleLabel);
  return parts.join("の");
}

/** 行き先の範囲から、業界（「事業会社」を含む）・外資・職種を集める */
function readSide(input: ParseInput, range: Span, consumed: Span[], absorbed: number[]): { side: TransitionSide; spans: Span[] } {
  const s = input.normalized;
  const side: TransitionSide = {};
  const spans: Span[] = [];
  const jigyou = s.indexOf("事業会社", range.start);
  if (jigyou >= 0 && jigyou + 4 <= range.end && input.itIndustryId) {
    side.industryId = input.itIndustryId;
    side.industryLabel = "IT・インターネット";
    side.notIndustry = true;
    spans.push({ start: jigyou, end: jigyou + 4 });
  } else {
    const ind = industryIn(s, range, input.industries, [...consumed, ...spans]);
    if (ind) {
      side.industryId = ind.id;
      side.industryLabel = ind.name;
      spans.push(ind.span);
      const rest = s.slice(ind.span.end);
      const not = rest.match(NOT_SUFFIX);
      if (not) { side.notIndustry = true; spans.push({ start: ind.span.end, end: ind.span.end + not[0].length }); }
    }
  }
  if (input.foreign && input.foreign.isForeign && input.foreign.span.start >= range.start && input.foreign.span.end <= range.end) {
    side.foreign = true;
    absorbed.push(input.foreign.index);
  }
  const role = input.roles.find((r) => r.span.start >= range.start && r.span.end <= range.end);
  if (role) {
    side.roleIds = role.roleIds;
    side.roleLabel = role.label;
    absorbed.push(role.index);
  }
  return { side, spans };
}

const isEmptySide = (side: TransitionSide) =>
  !side.industryId && side.foreign === undefined && !side.roleIds;

export function parseTransition(input: ParseInput): ParseResult {
  const s = input.normalized;
  const consumed: Span[] = [];
  const absorbed: number[] = [];
  const ageSpans: Span[] = [];
  for (const m of Array.from(s.matchAll(AGE_RE))) {
    ageSpans.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  const done = (intent: TransitionIntent | null): ParseResult => ({ intent, consumed, absorbedConditionIndexes: absorbed, ageSpans });

  // ── 会社を起点にした言い方 ──────────────────────────────────────────────
  for (const c of input.companies) {
    const after = s.slice(c.span.end);
    const prev = after.match(PREV_OF_AFTER);
    if (prev) {
      consumed.push({ start: c.span.end, end: c.span.end + prev[0].length });
      return done({ kind: "prevOf", companyId: c.companyId, companyLabel: c.label, label: `${c.label}に入った人の前職` });
    }
    const left = after.match(LEFT_AFTER);
    const source = after.match(SOURCE_AFTER);
    const before = s.slice(0, c.span.start).match(SOURCE_BEFORE);
    if (!left && !source && !before) continue;
    if (before) consumed.push({ start: c.span.start - before[0].length, end: c.span.start });
    const m = left ?? source;
    const markerEnd = m ? c.span.end + m[0].length : c.span.end;
    if (m) consumed.push({ start: c.span.end, end: markerEnd });
    /* 「出て〜に行った」。行き先の言葉を読む */
    let to: TransitionSide | undefined;
    if (left && /[て]$/.test(left[0])) {
      const rest = s.slice(markerEnd);
      const verb = rest.match(TO_VERB);
      const range = { start: markerEnd, end: verb && verb.index !== undefined ? markerEnd + verb.index : s.length };
      const { side, spans } = readSide(input, range, [...input.consumed, ...consumed], absorbed);
      consumed.push(...spans);
      if (verb && verb.index !== undefined) consumed.push({ start: markerEnd + verb.index, end: markerEnd + verb.index + verb[0].length });
      if (!isEmptySide(side)) to = side;
    }
    const label = to ? `${c.label}を出て${sideLabel(to)}へ移った人` : `${c.label}を出た人`;
    return done({ kind: "left", companyId: c.companyId, companyLabel: c.label, ...(to ? { to } : {}), label });
  }

  if (!input.moves) return done(null);

  // ── 異業界に移った ──────────────────────────────────────────────────────
  const cross = s.match(CROSS_RE);
  if (cross && cross.index !== undefined) {
    const span = { start: cross.index, end: cross.index + cross[0].length };
    if (!input.consumed.some((x) => overlaps(x, span))) {
      consumed.push(span);
      const rest = s.slice(span.end);
      const verb = rest.match(TO_VERB);
      if (verb && verb.index === 0) consumed.push({ start: span.end, end: span.end + verb[0].length });
      return done({ kind: "move", crossIndustry: true, label: "業界をまたいで移った人" });
    }
  }

  // ── 「〜から（来た）」：会社を指定しない移動 ─────────────────────────────
  for (let k = s.indexOf("から"); k >= 0; k = s.indexOf("から", k + 1)) {
    const kSpan = { start: k, end: k + 2 };
    if ([...input.consumed, ...consumed].some((x) => overlaps(x, kSpan))) continue;
    const head = s.slice(0, k);
    let from: TransitionSide | undefined;
    let firstTime = false;
    const fromSpans: Span[] = [];
    if (head.endsWith(UNEXPERIENCED)) {
      firstTime = true;
      fromSpans.push({ start: k - UNEXPERIENCED.length, end: k });
    } else {
      /* 「IT以外から」「金融から」：「から」の直前で終わる業界の語 */
      const notM = head.match(/(?:以外|じゃない|でない|ではない)$/);
      const headEnd = notM ? k - notM[0].length : k;
      let found: { span: Span; id: string; name: string } | null = null;
      for (const ind of input.industries) {
        for (const term of ind.terms) {
          const st = headEnd - term.length;
          if (st < 0 || s.slice(st, headEnd) !== term) continue;
          if (/^[a-z0-9]+$/.test(term) && /[a-z0-9]/.test(s[st - 1] ?? "")) continue;
          if (!found || term.length > found.span.end - found.span.start) found = { span: { start: st, end: headEnd }, id: ind.id, name: ind.name };
        }
      }
      if (!found && s.slice(0, headEnd).endsWith("事業会社") && input.itIndustryId) {
        found = { span: { start: headEnd - 4, end: headEnd }, id: input.itIndustryId, name: "IT・インターネット" };
        from = { industryId: found.id, industryLabel: found.name, notIndustry: !notM };
      } else if (found) {
        from = { industryId: found.id, industryLabel: found.name, ...(notM ? { notIndustry: true } : {}) };
      }
      if (!found) continue;
      fromSpans.push(found.span);
      if (notM) fromSpans.push({ start: headEnd, end: k });
    }
    consumed.push(...fromSpans, kSpan);
    const rest = s.slice(k + 2);
    const verb = rest.match(TO_VERB);
    const range = { start: k + 2, end: verb && verb.index !== undefined ? k + 2 + verb.index : s.length };
    const { side, spans } = readSide(input, range, [...input.consumed, ...consumed], absorbed);
    consumed.push(...spans);
    if (verb && verb.index !== undefined) consumed.push({ start: k + 2 + verb.index, end: k + 2 + verb.index + verb[0].length });
    const to = isEmptySide(side) ? undefined : side;
    if (firstTime) {
      if (!to) continue; // 「未経験から」だけでは何の未経験か決まらない
      const ft: "industry" | "role" | "foreign" = to.industryId ? "industry" : to.roleIds ? "role" : "foreign";
      return done({ kind: "move", to, firstTime: ft, label: `未経験から${sideLabel(to)}へ移った人` });
    }
    const label = `${sideLabel(from)}から${to ? `${sideLabel(to)}へ` : ""}移った人`;
    return done({ kind: "move", from, ...(to ? { to } : {}), label });
  }

  return done(null);
}

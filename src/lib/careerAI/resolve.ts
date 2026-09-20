/**
 * ① キャリアAI — **マスタ解決**。設計は [docs/career-ai-design-20260921.md](../../../docs/career-ai-design-20260921.md) §5-1。
 *
 * ── ★このファイルが何も import しない理由 ───────────────────────────────────
 * `evidence/engine.ts` と同じ。テストを `node --test` で**素の Node から直接**走らせる。
 * 1つでも `@/...` を import すると、そこから `createAdminClient` まで芋づるで
 * 引き込まれて**テストが起動しない。**
 * ⚠️★**このファイルに import を足さないこと。** マスタは呼び出し側が `ResolveMasters` で渡す。
 *
 * ── ★なぜ「解決」が要るのか ─────────────────────────────────────────────────
 * LLM が返した語を**そのまま条件にしない**。`interpretQuery` の約束（④）と同じで、
 * **出力はマスタに解決してから**使う。
 * ⚠️★**部分一致を使わない。** 根拠は実測済みの事故 ——
 *    `'東京都' LIKE '%京都%'` が true で、掲載79社の**全件**が「京都の企業」として返った。
 *    ここでも「東京」で「京都」に当ててはいけない。**完全一致だけ。**
 *
 * ── ★解決できなかったものは捨てない ────────────────────────────────────────
 * `unresolved` に理由つきで入れて返す。**画面に必ず出す**（`InterpretResult.unresolved` と同じ）。
 * ⚠️★**黙って落とすと、本人が言ったのに反映されていないことに誰も気づけない。**
 *
 * ── ★推測しない ────────────────────────────────────────────────────────────
 * 単位の分からない年収、上下が逆の範囲、上限を超えた件数は**埋めも丸めもしない**。
 * CLAUDE.md「値が無いことを、ある値に置き換えない」の、いちばん効く場所。
 */

// ── 入出力 ───────────────────────────────────────────────────────────────────

/** LLM が返した「こう聞こえた」。★すべて任意。言われていない項目は無い */
export type DesiredDraft = {
  /** 職種。マスタ名または別名（例: 「アカウントエグゼクティブ」「AE」） */
  roles?: readonly string[];
  /** 都道府県（例: 「東京」「東京都」） */
  prefectures?: readonly string[];
  /** フェーズ。⚠️ `ow_profiles.desired_phase` は**日本語ラベル**が入る列 */
  phases?: readonly string[];
  /** 勤務スタイル。値（`full_remote`）でもラベル（「フルリモート希望」）でもよい */
  workStyles?: readonly string[];
  /** 希望年収の下限（万円）。「600万」のような文字列も受ける */
  salaryMin?: string | number | null;
  salaryMax?: string | number | null;
};

/** 解決に使うマスタ。⚠️ 呼び出し側（`fetchMasters`）が DB から組み立てて渡す */
export type ResolveMasters = {
  /** ★希望職種の候補だけを渡すこと（`isDesiredRoleCandidate` を通したもの） */
  roles: readonly { id: string; name: string; aliases?: readonly string[] }[];
  /** 47都道府県 */
  prefectures: readonly string[];
  /** ★`DESIRED_PHASES`（日本語4値）。`PHASE_OPTIONS` の slug ではない */
  phases: readonly string[];
  /** `DESIRED_WORK_STYLES` ＋ legacy */
  workStyles: readonly { value: string; label: string }[];
  /** `SALARY_MAX_MAN` */
  salaryMaxMan: number;
  /** `MAX_DESIRED_ROLES` */
  maxRoles: number;
};

export type UnresolvedReason =
  /** マスタに無い */
  | "not_found"
  /** 数として読めない／範囲外（★単位を推測しない） */
  | "out_of_range"
  /** 下限 > 上限（★入れ替えない） */
  | "range_inverted"
  /** 上限件数を超えた（★黙って切らない） */
  | "over_limit";

export type Unresolved = {
  field: keyof DesiredDraft;
  /** 本人／LLM が言ったままの文字列。★整形しない（画面にそのまま出す） */
  value: string;
  reason: UnresolvedReason;
};

export type ResolvedDesired = {
  /** `ow_profile_desired_roles` に入れる role_id */
  roleIds: string[];
  prefectures: string[];
  phases: string[];
  workStyles: string[];
  salaryMin: number | null;
  salaryMax: number | null;
  /** ★画面に必ず出す。空配列なら全部解決できた */
  unresolved: Unresolved[];
};

// ── 正規化 ───────────────────────────────────────────────────────────────────

/**
 * 照合用に潰す。**表示には使わない。**
 *
 * ⚠️ 全角→半角（NFKC）／前後の空白／内部の空白・中黒・括弧・ハイフンを落とす／小文字化。
 * ⚠️★**これ以上は潰さない。** 潰すほど「東京」と「京都」のような**別物が当たる**方向へ近づく。
 */
function norm(s: string): string {
  return s
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s　・()（）\-ー_/]/g, "");
}

/** 完全一致の索引を作る。⚠️ 同じキーが2つ来たら**先に入ったほうを残す**（マスタの並び順が正） */
function indexBy<T>(rows: readonly T[], keys: (r: T) => readonly string[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) {
    for (const k of keys(r)) {
      const n = norm(k);
      if (n && !m.has(n)) m.set(n, r);
    }
  }
  return m;
}

// ── 年収 ─────────────────────────────────────────────────────────────────────

/**
 * 希望年収（万円）として読む。読めなければ `null`。
 *
 * ⚠️★**単位を推測しない。** `6000000`（円のつもり）は**万円として範囲外**なので弾く。
 *    10000 で割って「たぶん円だろう」と直すのは、**本人が言っていない値を作る**こと。
 *    弾いて `unresolved` に出し、本人に直してもらう。
 * ⚠️ 「600万」「600万円」「1,000」は読む（単位の語と桁区切りだけ落とす）。
 */
function parseSalaryMan(raw: string | number | null | undefined, maxMan: number): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).normalize("NFKC").trim().replace(/[,，]/g, "").replace(/(万円|万|円)$/, "");
  if (s === "") return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  /* ⚠️ API 側の検証（0〜SALARY_MAX_MAN）と同じ範囲にする。片方だけ広げない */
  if (n < 0 || n > maxMan) return null;
  return Math.round(n);
}

// ── 本体 ─────────────────────────────────────────────────────────────────────

/**
 * LLM が返した語をマスタに解決する。**純粋関数。**
 *
 * @param draft LLM の出力（★信用しない）
 * @param masters 呼び出し側が DB と定数から組み立てたもの
 */
export function resolveDesired(draft: DesiredDraft, masters: ResolveMasters): ResolvedDesired {
  const unresolved: Unresolved[] = [];

  /* ── 職種 ──────────────────────────────────────────────────────────────
     ⚠️ 名前と別名の両方で引く。**部分一致は使わない。** */
  const roleIndex = indexBy(masters.roles, (r) => [r.name, ...(r.aliases ?? [])]);
  const roleIds: string[] = [];
  for (const raw of draft.roles ?? []) {
    const hit = roleIndex.get(norm(raw));
    if (!hit) {
      unresolved.push({ field: "roles", value: raw, reason: "not_found" });
      continue;
    }
    if (roleIds.includes(hit.id)) continue; // 重複は静かに畳んでよい（同じものを2回言っただけ）
    /* ⚠️★**上限を超えたぶんを黙って切らない。** 理由つきで返す */
    if (roleIds.length >= masters.maxRoles) {
      unresolved.push({ field: "roles", value: raw, reason: "over_limit" });
      continue;
    }
    roleIds.push(hit.id);
  }

  /* ── 都道府県 ──────────────────────────────────────────────────────────
     ⚠️ 「東京」→「東京都」は**接尾辞を補うだけ**の完全一致にする。
        ★部分一致にしない（`'東京都' LIKE '%京都%'` の事故と同じ形になる）。 */
  const prefIndex = indexBy(masters.prefectures, (p) => [p, p.replace(/[都道府県]$/, "")]);
  const prefectures: string[] = [];
  for (const raw of draft.prefectures ?? []) {
    const hit = prefIndex.get(norm(raw));
    if (!hit) {
      unresolved.push({ field: "prefectures", value: raw, reason: "not_found" });
      continue;
    }
    if (!prefectures.includes(hit)) prefectures.push(hit);
  }

  /* ── フェーズ ──────────────────────────────────────────────────────────
     ⚠️★`ow_profiles.desired_phase` は**日本語ラベル**（「シリーズA」「上場」）。
        `PHASE_OPTIONS` の slug（`series_a`）ではない。混ぜないこと。 */
  const phaseIndex = indexBy(masters.phases, (p) => [p]);
  const phases: string[] = [];
  for (const raw of draft.phases ?? []) {
    const hit = phaseIndex.get(norm(raw));
    if (!hit) {
      unresolved.push({ field: "phases", value: raw, reason: "not_found" });
      continue;
    }
    if (!phases.includes(hit)) phases.push(hit);
  }

  /* ── 勤務スタイル ──────────────────────────────────────────────────────
     ⚠️ 値（`full_remote`）でもラベル（「フルリモート希望」）でも受ける。
        LLM がどちらを返すかに依存させない。 */
  const wsIndex = indexBy(masters.workStyles, (w) => [w.value, w.label]);
  const workStyles: string[] = [];
  for (const raw of draft.workStyles ?? []) {
    const hit = wsIndex.get(norm(raw));
    if (!hit) {
      unresolved.push({ field: "workStyles", value: raw, reason: "not_found" });
      continue;
    }
    if (!workStyles.includes(hit.value)) workStyles.push(hit.value);
  }

  /* ── 年収 ──────────────────────────────────────────────────────────────
     ⚠️★**片方だけでよい**（「600万以上」だけ言われたら下限だけ入れる）。
        上限を勝手に作らない。 */
  let salaryMin = parseSalaryMan(draft.salaryMin, masters.salaryMaxMan);
  let salaryMax = parseSalaryMan(draft.salaryMax, masters.salaryMaxMan);
  if (draft.salaryMin !== null && draft.salaryMin !== undefined && draft.salaryMin !== "" && salaryMin === null) {
    unresolved.push({ field: "salaryMin", value: String(draft.salaryMin), reason: "out_of_range" });
  }
  if (draft.salaryMax !== null && draft.salaryMax !== undefined && draft.salaryMax !== "" && salaryMax === null) {
    unresolved.push({ field: "salaryMax", value: String(draft.salaryMax), reason: "out_of_range" });
  }
  /* ⚠️★**上下が逆でも入れ替えない。** どちらを言い間違えたかは分からない。
        両方落として理由を返し、本人に直してもらう。 */
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax) {
    unresolved.push({ field: "salaryMin", value: String(salaryMin), reason: "range_inverted" });
    unresolved.push({ field: "salaryMax", value: String(salaryMax), reason: "range_inverted" });
    salaryMin = null;
    salaryMax = null;
  }

  return { roleIds, prefectures, phases, workStyles, salaryMin, salaryMax, unresolved };
}

/** 1件も解決できていないか（＝書き戻す価値が無い）。画面の出し分けに使う */
export function isEmptyResolved(r: ResolvedDesired): boolean {
  return (
    r.roleIds.length === 0 &&
    r.prefectures.length === 0 &&
    r.phases.length === 0 &&
    r.workStyles.length === 0 &&
    r.salaryMin === null &&
    r.salaryMax === null
  );
}

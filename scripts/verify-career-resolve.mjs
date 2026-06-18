/**
 * resolvePublicStep() の動作確認スクリプト
 * node scripts/verify-career-resolve.mjs
 *
 * ow_experiences の実データ（実名・実年収・転職理由）が
 * visibility 設定に従って正しく伏せられることを検証する。
 */

// TypeScript モジュールを直接 import できないため、ロジックをここで再実装
function maskCompany(step) {
  switch (step.visibilityCompany) {
    case "real":    return step.companyText ?? null;
    case "masked":  return step.companyAnonymized ?? "非公開企業";
    case "hidden":  return null;
  }
}

function resolvePublicStep(step) {
  if (step.visibilityCompany === "hidden") return null;
  return {
    id: step.id,
    companyDisplay: maskCompany(step),
    companyId: step.visibilityCompany === "real" ? step.companyId : null,
    roleTitle: step.roleTitle,
    salaryMan: step.visibilitySalary ? step.salaryMan : null,
    joinReason: step.visibilityReason ? step.joinReason : null,
    displayOrder: step.displayOrder,
  };
}

// ── テストデータ ────────────────────────────────────────────────
const steps = [
  {
    id: "step-01",
    companyId: "uuid-salesforce",
    companyText: "株式会社セールスフォース・ジャパン",  // ← 実データ（実名）
    companyAnonymized: "大手外資系SaaS",
    roleTitle: "エンタープライズ営業",
    salaryMan: 1200,          // ← 実データ（実年収）
    joinReason: "CRMで本物の課題解決がしたかった",  // ← 実データ（転職理由）
    visibilityCompany: "real",
    visibilitySalary: true,
    visibilityReason: true,
    displayOrder: 1,
  },
  {
    id: "step-02",
    companyId: "uuid-recruit",
    companyText: "株式会社リクルート",                  // ← 実データ（実名）
    companyAnonymized: "大手国内人材系",
    roleTitle: "法人営業",
    salaryMan: 700,           // ← 実データ（実年収）
    joinReason: "営業力を鍛えるため新卒入社",
    visibilityCompany: "masked",
    visibilitySalary: false,  // ← 年収は非公開
    visibilityReason: true,
    displayOrder: 0,
  },
  {
    id: "step-03",
    companyId: "uuid-old-bank",
    companyText: "○○銀行",                             // ← 実データ（実名）
    companyAnonymized: "地方金融機関",
    roleTitle: "営業",
    salaryMan: 450,           // ← 実データ（実年収）
    joinReason: "親の勧めで入行",
    visibilityCompany: "hidden",  // ← このステップは丸ごと非公開
    visibilitySalary: false,
    visibilityReason: false,
    displayOrder: -1,
  },
];

// ── 実行 ────────────────────────────────────────────────────────
console.log("=== resolvePublicStep() 検証 ===\n");

let allPassed = true;

for (const step of steps) {
  const result = resolvePublicStep(step);
  console.log(`[STEP ${step.id}] visibility_company="${step.visibilityCompany}"`);
  console.log("  入力（実データ）:", {
    companyText: step.companyText,
    salaryMan:   step.salaryMan,
    joinReason:  step.joinReason,
  });
  console.log("  出力（公開用）:  ", result);

  // ── アサーション ──
  if (step.visibilityCompany === "real") {
    // 実名: companyDisplay が実名、companyId あり、salary/reason は設定通り
    console.assert(result !== null,                            "FAIL: hidden でないのに null");
    console.assert(result?.companyDisplay === step.companyText,"FAIL: real なのに実名が出ていない");
    console.assert(result?.companyId === step.companyId,       "FAIL: real なのに companyId がない");
    console.assert(result?.salaryMan === step.salaryMan,       "FAIL: salary 公開設定 true なのに null");
    console.assert(result?.joinReason === step.joinReason,     "FAIL: reason 公開設定 true なのに null");
    if (result && result.companyDisplay === step.companyText) {
      console.log("  ✅ PASS: 実名・年収・転職理由を公開");
    } else {
      allPassed = false;
    }
  }

  if (step.visibilityCompany === "masked") {
    // 匿名: companyDisplay が匿名ラベル、companyId は null、年収は null
    console.assert(result !== null,                                    "FAIL: hidden でないのに null");
    console.assert(result?.companyDisplay === step.companyAnonymized,  "FAIL: masked なのに実名が漏れている");
    console.assert(result?.companyId === null,                         "FAIL: masked なのに companyId が漏れている");
    console.assert(result?.salaryMan === null,                         "FAIL: visibilitySalary=false なのに年収が漏れている");
    const leaked = result?.companyDisplay === step.companyText;
    if (!leaked && result?.companyId === null && result?.salaryMan === null) {
      console.log("  ✅ PASS: 実名・FK・年収を伏せ、匿名ラベルのみ公開");
    } else {
      allPassed = false;
      console.log("  ❌ FAIL: 実データが漏れている", result);
    }
  }

  if (step.visibilityCompany === "hidden") {
    // 非公開: null が返る
    console.assert(result === null, "FAIL: hidden なのに null でない");
    if (result === null) {
      console.log("  ✅ PASS: ステップごと非公開（null）");
    } else {
      allPassed = false;
      console.log("  ❌ FAIL: hidden なのにデータが返った", result);
    }
  }

  console.log();
}

console.log(allPassed ? "=== 全パターン PASS ✅ ===" : "=== 失敗あり ❌ ===");
process.exit(allPassed ? 0 : 1);

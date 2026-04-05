/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Starting seed with Supabase client...");

  // ─── 1. 企業データ更新（UPDATE） ───
  // NOTE: brand_color, avg_salary 等のカラムが存在しない場合はエラーになる
  // その場合は先に 007_all_pending.sql を Supabase Dashboard で実行してください

  const companies = [
    { name: "株式会社kubell", brand_color: "#7C3AED", founded_year: 2011, avg_salary: "600万〜900万", remote_rate: 100, avg_overtime: 15, paid_leave_rate: 80, avg_age: 32, phase: "上場企業" },
    { name: "株式会社LayerX", brand_color: "#6B4FBB", founded_year: 2018, avg_salary: "600万〜950万", remote_rate: 100, avg_overtime: 20, paid_leave_rate: 75, avg_age: 29, funding_total: "32億円", phase: "シリーズB" },
    { name: "Ubie株式会社", brand_color: "#1D9E75", founded_year: 2017, avg_salary: "500万〜800万", remote_rate: 100, avg_overtime: 18, paid_leave_rate: 80, avg_age: 30, funding_total: "43億円", phase: "シリーズC" },
    { name: "株式会社PKSHA Technology", brand_color: "#7C3AED", founded_year: 2012, avg_salary: "600万〜1000万", remote_rate: 60, avg_overtime: 20, paid_leave_rate: 85, avg_age: 33, phase: "上場企業" },
    { name: "Sansan株式会社", brand_color: "#0066CC", founded_year: 2007, avg_salary: "650万〜950万", remote_rate: 80, avg_overtime: 20, paid_leave_rate: 85, avg_age: 33, phase: "上場企業" },
    { name: "フリー株式会社", brand_color: "#FF4B00", founded_year: 2012, avg_salary: "600万〜900万", remote_rate: 80, avg_overtime: 18, paid_leave_rate: 90, avg_age: 32, phase: "上場企業" },
    { name: "Google Japan合同会社", brand_color: "#EA4335", founded_year: 2001, avg_salary: "900万〜1500万", remote_rate: 60, avg_overtime: 20, paid_leave_rate: 90, avg_age: 35, phase: "上場企業" },
    { name: "Amazon Japan合同会社", brand_color: "#FF9900", founded_year: 2000, avg_salary: "700万〜1200万", remote_rate: 50, avg_overtime: 25, paid_leave_rate: 80, avg_age: 36, phase: "上場企業" },
    { name: "日本マイクロソフト株式会社", brand_color: "#00A4EF", founded_year: 1986, avg_salary: "800万〜1300万", remote_rate: 70, avg_overtime: 18, paid_leave_rate: 90, avg_age: 38, phase: "上場企業" },
    { name: "Salesforce Japan株式会社", brand_color: "#00A1E0", founded_year: 2000, avg_salary: "800万〜1400万", remote_rate: 70, avg_overtime: 20, paid_leave_rate: 90, avg_age: 36, phase: "上場企業" },
    { name: "株式会社マネーフォワード", brand_color: "#003B87", founded_year: 2012, avg_salary: "650万〜1000万", remote_rate: 75, avg_overtime: 20, paid_leave_rate: 85, avg_age: 33, phase: "上場企業" },
    { name: "株式会社SmartHR", brand_color: "#00C4CC", founded_year: 2013, avg_salary: "600万〜900万", remote_rate: 80, avg_overtime: 18, paid_leave_rate: 85, avg_age: 31, funding_total: "156億円", phase: "上場企業" },
    { name: "Opinio株式会社", brand_color: "#1D9E75", founded_year: 2023, avg_salary: "500万〜800万", remote_rate: 80, avg_overtime: 15, paid_leave_rate: 80, avg_age: 32, phase: "シード" },
    { name: "株式会社Third Box", brand_color: "#7C3AED", founded_year: 2021, avg_salary: "500万〜750万", remote_rate: 60, avg_overtime: 20, paid_leave_rate: 75, avg_age: 30, phase: "シリーズA" },
  ];

  let companyUpdateSuccess = 0;
  let companyUpdateFailed = 0;

  for (const { name, ...data } of companies) {
    const { error } = await supabase.from("ow_companies").update(data).eq("name", name);
    if (error) {
      console.error(`  ❌ ${name}: ${error.message}`);
      companyUpdateFailed++;
    } else {
      console.log(`  ✅ ${name}`);
      companyUpdateSuccess++;
    }
  }
  console.log(`\n企業データ更新: ${companyUpdateSuccess} 成功 / ${companyUpdateFailed} 失敗\n`);

  // ─── 2. NEWバッジリセット ───
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { error: resetErr } = await supabase
    .from("ow_companies")
    .update({ created_at: thirtyDaysAgo })
    .neq("name", "Opinio株式会社");
  if (resetErr) console.error("Badge reset error:", resetErr.message);
  else console.log("✅ NEWバッジリセット: 全社を30日前に設定");

  const { error: opinioErr } = await supabase
    .from("ow_companies")
    .update({ created_at: threeDaysAgo })
    .eq("name", "Opinio株式会社");
  if (opinioErr) console.error("Opinio badge error:", opinioErr.message);
  else console.log("✅ Opinio株式会社を3日前に設定（NEWバッジ表示）\n");

  // ─── 3. メンターデータ投入 ───
  const mentors = [
    { name: "田中 美咲", avatar_initial: "田", avatar_color: "#1D9E75", current_company: "Salesforce Japan", current_role: "エンタープライズ営業", previous_career: "大手メーカー営業", current_career: "外資SaaS営業", roles: ["営業"], worries: ["転職タイミング", "年収交渉", "外資転職"], bio: "外資SaaSへの転職で年収300万円アップを経験。エンタープライズ営業歴5年。外資転職のリアルを詳しく話せます。", concerns: ["外資SaaSへの転職の進め方", "年収交渉で失敗したくない", "転職のタイミングがわからない"], calendly_url: "https://calendly.com/dummy/30min", is_available: true, display_order: 1 },
    { name: "佐藤 健", avatar_initial: "佐", avatar_color: "#00A1E0", current_company: "HubSpot Japan", current_role: "カスタマーサクセス", previous_career: "SIer営業", current_career: "SaaS CS", roles: ["CS"], worries: ["キャリアチェンジ", "転職タイミング", "スタートアップ"], bio: "SIer営業からSaaS CSへのキャリアチェンジを経験。CSとして3年、現在はチームリード。", concerns: ["営業からCSに転身できるの？", "CSのキャリアパスが知りたい", "SaaS CSの実際の仕事内容"], calendly_url: "https://calendly.com/dummy/30min", is_available: true, display_order: 2 },
    { name: "鈴木 陽子", avatar_initial: "鈴", avatar_color: "#FF7A59", current_company: "Zoho Japan", current_role: "インサイドセールス", previous_career: "人材業界IS", current_career: "SaaS IS", roles: ["営業"], worries: ["転職タイミング", "スタートアップ", "年収交渉"], bio: "人材業界ISからSaaS ISに転職。BDRチームのリードとして活躍中。", concerns: ["IS経験でSaaSに転職できる？", "ベンチャーと大手どっちがいい？", "年収を維持しながら転職したい"], calendly_url: "https://calendly.com/dummy/30min", is_available: true, display_order: 3 },
    { name: "高橋 翔太", avatar_initial: "高", avatar_color: "#7C3AED", current_company: "SmartHR", current_role: "BizDev / 事業開発", previous_career: "総合商社", current_career: "SaaS事業開発", roles: ["事業開発"], worries: ["キャリアチェンジ", "スタートアップ", "転職タイミング"], bio: "総合商社からSaaSスタートアップへ転身。事業開発として新規プロダクトの立ち上げを担当。", concerns: ["商社からSaaSに行けるの？", "スタートアップの働き方のリアル", "事業開発の仕事内容を知りたい"], calendly_url: "https://calendly.com/dummy/30min", is_available: true, display_order: 4 },
    { name: "山田 恵理", avatar_initial: "山", avatar_color: "#EC4899", current_company: "HubSpot Japan", current_role: "マーケティングマネージャー", previous_career: "広告代理店", current_career: "SaaSマーケ", roles: ["マーケ"], worries: ["キャリアチェンジ", "年収交渉", "外資転職"], bio: "広告代理店からSaaSマーケへ。デマンドジェネレーション領域で5年の経験。", concerns: ["代理店経験はSaaSで活かせる？", "マーケのキャリアパス", "外資SaaSマーケの実際"], calendly_url: "https://calendly.com/dummy/30min", is_available: true, display_order: 5 },
    { name: "中村 大輔", avatar_initial: "中", avatar_color: "#F97316", current_company: "マネーフォワード", current_role: "フィールドセールス", previous_career: "金融機関営業", current_career: "SaaS営業", roles: ["営業"], worries: ["転職タイミング", "年収交渉", "キャリアチェンジ"], bio: "銀行の法人営業からSaaS営業に転職。金融知識を活かしてFinTech SaaSで活躍中。", concerns: ["金融業界からSaaSに転職できる？", "年収は下がる？", "30代でも転職できる？"], calendly_url: "https://calendly.com/dummy/30min", is_available: true, display_order: 6 },
    { name: "伊藤 麻衣", avatar_initial: "伊", avatar_color: "#14B8A6", current_company: "Ubie", current_role: "カスタマーサクセス", previous_career: "コンサル", current_career: "SaaS CS", roles: ["CS"], worries: ["外資転職", "キャリアチェンジ", "スタートアップ"], bio: "コンサルファームからヘルステックSaaSのCSに転身。スタートアップでのCS立ち上げ経験あり。", concerns: ["コンサルからCSへの転身", "スタートアップCSの立ち上げ方", "CS組織のキャリアパス"], calendly_url: "https://calendly.com/dummy/30min", is_available: true, display_order: 7 },
    { name: "小林 慎一", avatar_initial: "小", avatar_color: "#6366F1", current_company: "LayerX", current_role: "インサイドセールス", previous_career: "IT営業", current_career: "SaaS IS", roles: ["営業"], worries: ["スタートアップ", "転職タイミング", "年収交渉"], bio: "IT企業の営業からSaaSスタートアップのISへ。急成長フェーズでのIS組織構築を経験。", concerns: ["スタートアップISのリアル", "IS→AEへのキャリアパス", "急成長企業で働く面白さ"], calendly_url: "https://calendly.com/dummy/30min", is_available: true, display_order: 8 },
    { name: "渡辺 あかり", avatar_initial: "渡", avatar_color: "#F43F5E", current_company: "Sansan", current_role: "コンテンツマーケティング", previous_career: "出版業界", current_career: "SaaSマーケ", roles: ["マーケ"], worries: ["キャリアチェンジ", "転職タイミング"], bio: "出版社の編集者からSaaSコンテンツマーケへ転身。ライティングスキルを活かした転職事例。", concerns: ["編集経験はSaaSで活かせる？", "コンテンツマーケの具体的な仕事", "異業種からSaaSへの転職方法"], calendly_url: "https://calendly.com/dummy/30min", is_available: true, display_order: 9 },
    { name: "柴 久人", avatar_initial: "柴", avatar_color: "#1D9E75", current_company: "Opinio株式会社", current_role: "CEO / キャリアコンサルタント", previous_career: "Recruit · Salesforce", current_career: "起業", roles: ["営業", "CS", "事業開発"], worries: ["転職タイミング", "年収交渉", "外資転職", "キャリアチェンジ", "スタートアップ"], bio: "Recruit4年・Salesforce 6年を経て独立。国家資格キャリアコンサルタント・ICFコーチ。IT/SaaS転職全般の相談を受付。", concerns: ["転職すべきか迷っている", "どの会社が自分に合うか", "年収を大幅に上げたい"], calendly_url: "https://calendly.com/hshiba/30min", is_available: true, display_order: 10 },
  ];

  let mentorSuccess = 0;
  let mentorFailed = 0;

  for (const mentor of mentors) {
    const { error } = await supabase.from("mentors").insert(mentor);
    if (error) {
      // Might be duplicate - try upsert or just log
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        console.log(`  ⏭️  ${mentor.name} (already exists)`);
      } else {
        console.error(`  ❌ ${mentor.name}: ${error.message}`);
        mentorFailed++;
      }
    } else {
      console.log(`  ✅ ${mentor.name}`);
      mentorSuccess++;
    }
  }
  console.log(`\nメンターデータ: ${mentorSuccess} 成功 / ${mentorFailed} 失敗`);

  console.log("\n🎉 Seed complete!");
}

main().catch(console.error);

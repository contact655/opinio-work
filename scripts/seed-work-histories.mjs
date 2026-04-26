import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envContent = readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Get companies
  const { data: companies } = await supabase.from("ow_companies").select("id, name").order("name");
  const companyMap = {};
  for (const c of companies) {
    const n = c.name;
    if (n.includes("Salesforce")) companyMap.SALESFORCE = c.id;
    if (n.includes("HubSpot")) companyMap.HUBSPOT = c.id;
    if (n.includes("Sansan")) companyMap.SANSAN = c.id;
    if (n.includes("freee") || n.includes("フリー")) companyMap.FREEE = c.id;
    if (n.includes("Ubie")) companyMap.UBIE = c.id;
  }
  console.log("企業マッピング:", companyMap);

  // Get sample users
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const sampleEmails = [
    "tanaka.shota@example.com", "sato.misaki@example.com", "suzuki.kenta@example.com",
    "yamamoto.yuki@example.com", "ito.ryota@example.com", "watanabe.haruka@example.com",
    "nakamura.takuya@example.com", "kobayashi.megumi@example.com", "kato.sho@example.com",
    "yoshida.ai@example.com", "yamada.kenji@example.com", "sasaki.nana@example.com",
    "inoue.daisuke@example.com", "kimura.yoko@example.com", "hayashi.takeshi@example.com",
    "shimizu.rina@example.com", "yamaguchi.sota@example.com", "matsumoto.sakura@example.com",
    "ikeda.hiroshi@example.com", "ogawa.mai@example.com",
  ];
  const userIds = sampleEmails.map(email => {
    const u = usersData.users.find(u => u.email === email);
    return u?.id;
  });
  console.log(`${userIds.filter(Boolean).length}/20 ユーザーID取得`);

  const U = (idx) => userIds[idx];
  const workHistories = [
    { user_id: U(0), company_id: companyMap.SALESFORCE, status: "current", role: "エンタープライズ営業", department: "大手企業営業部", joined_year: 2021, left_year: null, good_points: "プロダクトの知名度が高く初回アポが取りやすい。外資なので英語力も自然に身につく。フルリモートで働きやすい。", hard_points: "目標設定が高く四半期ごとのプレッシャーがある。英語でのコミュニケーションが必須。", is_public: true },
    { user_id: U(1), company_id: companyMap.HUBSPOT, status: "alumni", role: "カスタマーサクセス", department: "SMBカスタマーサクセス", joined_year: 2019, left_year: 2023, good_points: "CSの型が整っていて体系的に学べる。チームの雰囲気がフラットで意見を言いやすい環境だった。", hard_points: "担当社数が多いため一社一社に深く入り込む時間が取りにくい。", is_public: true },
    { user_id: U(2), company_id: companyMap.SANSAN, status: "alumni", role: "インサイドセールス", department: "IS部門", joined_year: 2020, left_year: 2022, good_points: "ISとしての基礎力が鍛えられる。データドリブンなIS手法を実践できる環境。", hard_points: "ルーティン業務が多くなりやすい。FSへの異動タイミングは会社状況に左右される。", is_public: true },
    { user_id: U(3), company_id: companyMap.FREEE, status: "current", role: "カスタマーサクセス", department: "エンタープライズCS", joined_year: 2022, left_year: null, good_points: "会計SaaSとして中小企業から大企業まで幅広い顧客を経験できる。プロダクト改善への関与度が高い。", hard_points: "会計の専門知識が必要で習得に時間がかかる。顧客の繁忙期（決算期）は業務量が増える。", is_public: true },
    { user_id: U(4), company_id: companyMap.SALESFORCE, status: "alumni", role: "ソリューションエンジニア", department: "SE本部", joined_year: 2018, left_year: 2022, good_points: "技術×営業のハイブリッドスキルが身につく。外資SaaSとして年収水準が高い。", hard_points: "顧客対応と技術検証の両立が求められる。出張やデモ対応で時間の自由度が下がることも。", is_public: true },
    { user_id: U(5), company_id: companyMap.UBIE, status: "current", role: "フィールドセールス", department: "医療機関営業", joined_year: 2023, left_year: null, good_points: "社会課題解決に直結するプロダクトで営業できる。シリーズCフェーズで成長を実感できる。", hard_points: "医療機関特有の意思決定の遅さがある。専門用語の習得に時間がかかる。", is_public: true },
    { user_id: U(6), company_id: companyMap.SANSAN, status: "current", role: "エンタープライズ営業", department: "大手企業営業部", joined_year: 2021, left_year: null, good_points: "知名度の高いプロダクトで提案しやすい。上場企業で安定感があり副業・リモートも認められている。", hard_points: "名刺管理市場の成熟化により新規開拓の難易度が上がっている。", is_public: true },
    { user_id: U(7), company_id: companyMap.FREEE, status: "alumni", role: "マーケティング", department: "BtoBマーケティング部", joined_year: 2019, left_year: 2023, good_points: "BtoBマーケの幅広い施策（SEO・広告・イベント）を経験できる。スタートアップならではのスピード感。", hard_points: "組織拡大に伴い役割が細分化されていく。マーケから他部署への異動機会は限られる。", is_public: true },
    { user_id: U(8), company_id: companyMap.HUBSPOT, status: "current", role: "ソリューションエンジニア", department: "Solution Engineering", joined_year: 2022, left_year: null, good_points: "外資トップのMarketing SaaS企業として、最先端のマーケ手法を学べる。英語力が大きく伸びる。", hard_points: "英語でのコミュニケーションが日常的に必要。グローバル基準の目標設定でプレッシャーがある。", is_public: true },
    { user_id: U(9), company_id: companyMap.UBIE, status: "alumni", role: "カスタマーサクセス", department: "CS部門", joined_year: 2021, left_year: 2023, good_points: "医療×AIという最前線の領域でCSを経験できた。顧客（医師・看護師）との信頼関係構築が深く学べた。", hard_points: "スタートアップのため営業ツール・プロセスを自分で整備する姿勢が必要。", is_public: true },
    { user_id: U(10), company_id: companyMap.SALESFORCE, status: "current", role: "カスタマーサクセスマネージャー", department: "CS本部", joined_year: 2020, left_year: null, good_points: "世界トップクラスのSaaS企業でCSの型を学べる。キャリアパスが明確で成長しやすい環境。", hard_points: "グローバルの方針変更が突然来ることがある。日本独自の対応が難しいケースも。", is_public: true },
    { user_id: U(11), company_id: companyMap.SANSAN, status: "alumni", role: "カスタマーサクセス", department: "SMB CS", joined_year: 2020, left_year: 2023, good_points: "Eight・Sansanの2プロダクトを扱えるのでキャリアの幅が広がる。CSの型が整っている。", hard_points: "担当社数が多いため深く関わる時間が取りにくい。プロダクトの成熟化が課題。", is_public: true },
    { user_id: U(12), company_id: companyMap.FREEE, status: "current", role: "フィールドセールス", department: "中小企業営業", joined_year: 2023, left_year: null, good_points: "中小企業オーナーと直接向き合えるやりがいがある。プロダクト改善のフィードバックが活かされる文化。", hard_points: "会計知識が必要で最初の学習コストが高い。競合（弥生・マネーフォワード）との差別化説明が必要。", is_public: true },
    { user_id: U(13), company_id: companyMap.HUBSPOT, status: "alumni", role: "インサイドセールス", department: "Inside Sales", joined_year: 2020, left_year: 2022, good_points: "IS→FSへのキャリアパスが明確。英語力・SaaS営業の基礎が身につく。", hard_points: "グローバル基準の目標設定でプレッシャーが高い。日本市場特有の事情が反映されにくいことも。", is_public: true },
    { user_id: U(14), company_id: companyMap.UBIE, status: "current", role: "事業開発", department: "事業開発部", joined_year: 2022, left_year: null, good_points: "医療×AIのパイオニア企業で事業の立ち上げに関われる。成長フェーズの醍醐味を味わえる。", hard_points: "医療業界特有の規制・専門用語の理解が必要。意思決定者が多く商談サイクルが長い。", is_public: true },
    { user_id: U(15), company_id: companyMap.SALESFORCE, status: "alumni", role: "マーケティング", department: "Demand Generation", joined_year: 2019, left_year: 2023, good_points: "世界最大のSaaS企業のマーケ手法を学べる。グローバルキャンペーンへの参画機会がある。", hard_points: "グローバルの方針に沿った施策が中心で日本独自の動きが取りにくいことも。", is_public: true },
    { user_id: U(16), company_id: companyMap.SANSAN, status: "current", role: "フィールドセールス", department: "エンタープライズ営業", joined_year: 2022, left_year: null, good_points: "大手企業へのエンタープライズ提案を経験できる。上場企業で福利厚生がしっかりしている。", hard_points: "名刺管理カテゴリの啓蒙が必要な場面もあり提案に時間がかかることがある。", is_public: true },
    { user_id: U(17), company_id: companyMap.FREEE, status: "alumni", role: "プロダクトマネージャー", department: "プロダクト本部", joined_year: 2020, left_year: 2024, good_points: "会計SaaSのPMとして複雑な業務要件を扱える。エンジニア・デザイナーとの密な協働ができる。", hard_points: "会計・税務の専門知識が必要。法改正への対応が多く、スピード感を出しにくい場面がある。", is_public: true },
    { user_id: U(18), company_id: companyMap.HUBSPOT, status: "current", role: "エンタープライズ営業", department: "Enterprise Sales", joined_year: 2021, left_year: null, good_points: "Marketing SaaSとして大手企業のデジタルマーケを支援できる。外資の営業スキルが身につく。", hard_points: "エンタープライズは意思決定者が多く案件化に時間がかかる。英語対応が日常的に必要。", is_public: true },
    { user_id: U(19), company_id: companyMap.UBIE, status: "alumni", role: "カスタマーサクセス", department: "CS・オンボーディング", joined_year: 2022, left_year: 2024, good_points: "医療DXの最前線でCSを経験できた。顧客（医療従事者）から深く感謝される仕事ができた。", hard_points: "スタートアップのため役割が流動的。CSとオンボーディングを兼務することも多かった。", is_public: true },
  ];

  const valid = workHistories.filter(wh => wh.user_id);
  console.log(`${valid.length}件投入中...`);

  let ok = 0;
  for (const wh of valid) {
    const { error } = await supabase.from("work_histories").insert(wh);
    if (error) {
      console.log(`  失敗: ${error.message}`);
    } else {
      ok++;
    }
  }
  console.log(`${ok}/${valid.length}件 成功`);

  // 確認
  const { data: check } = await supabase
    .from("work_histories")
    .select("id, status, role, joined_year, left_year, ow_companies(name)")
    .order("created_at", { ascending: false })
    .limit(20);
  if (check) {
    console.log("\n投入データ:");
    check.forEach(wh => console.log(`  ${wh.ow_companies?.name} | ${wh.role} | ${wh.status} | ${wh.joined_year}〜${wh.left_year || "現在"}`));
  }
}

main().catch(console.error);

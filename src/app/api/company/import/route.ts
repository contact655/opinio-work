import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const CATEGORIES: Record<string, string> = {
  overview: "会社概要・ミッション・事業内容",
  numbers: "社員数・平均年齢・設立年・資金調達額などの数字データ",
  culture: "カルチャー・働き方・リモート・副業・フレックスなど",
  job_description: "求人票・職種・年収・必須スキル・業務内容",
  hiring_flow: "選考フロー・面接回数・期間",
  ideal_person: "求める人物像・マインドセット",
  interview: "社員インタビュー・入社理由・やりがい",
  voices: "社員の声・口コミ・雰囲気",
  daily_schedule: "1日のスケジュール・仕事の様子",
  benefits: "福利厚生・手当・休暇制度",
  salary: "給与・昇給制度・評価制度",
  training: "研修・育成制度・オンボーディング",
};

export async function POST(req: Request) {
  try {
    const { text, fileName } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "テキストが空です" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `
以下の企業資料を読んで、各カテゴリに該当する情報を抽出してください。
情報がない場合は null にしてください。

カテゴリ一覧:
${Object.entries(CATEGORIES)
  .map(([key, desc]) => `- ${key}: ${desc}`)
  .join("\n")}

資料:
${text}

以下のJSON形式で返してください。情報がないカテゴリはnullにしてください:
{
  "overview": "抽出した内容またはnull",
  "numbers": "抽出した内容またはnull",
  "culture": "抽出した内容またはnull",
  "job_description": "抽出した内容またはnull",
  "hiring_flow": "抽出した内容またはnull",
  "ideal_person": "抽出した内容またはnull",
  "interview": "抽出した内容またはnull",
  "voices": "抽出した内容またはnull",
  "daily_schedule": "抽出した内容またはnull",
  "benefits": "抽出した内容またはnull",
  "salary": "抽出した内容またはnull",
  "training": "抽出した内容またはnull"
}

JSONのみ返してください。説明文は不要です。
`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const extracted = JSON.parse(jsonStr);
    return NextResponse.json({ extracted, fileName });
  } catch (err: any) {
    console.error("[company/import] Error:", err.message);
    return NextResponse.json(
      { error: err.message || "AI解析に失敗しました" },
      { status: 500 }
    );
  }
}

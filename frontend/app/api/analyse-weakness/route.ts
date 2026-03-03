import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGeminiModel } from "@/lib/gemini";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { description, scores } = await request.json();

  if (!description || !scores || !Array.isArray(scores)) {
    return NextResponse.json(
      { error: "description and scores array are required" },
      { status: 400 }
    );
  }

  const scoresText = scores
    .map(
      (s: { question: string; score: number; maxScore: number }) =>
        `- ${s.question}: ${s.score}/${s.maxScore}`
    )
    .join("\n");

  const prompt = `You are an expert academic tutor. Based on the following exam/assignment description and scores, identify the student's weaknesses and provide targeted study advice.

Subject/Description: ${description}

Scores by question:
${scoresText}

Analyze the scores to identify weak areas. For each weakness, provide:
- The topic area
- Priority level (high, medium, low)
- Why this is a weakness
- Specific study tips to improve

Return your response as JSON with this exact structure:
{
  "weaknesses": [
    {
      "topic": "string - the topic area",
      "priority": "string - high, medium, or low",
      "reason": "string - why this is identified as a weakness",
      "studyTips": "string - specific actionable study advice"
    }
  ]
}`;

  const model = getGeminiModel();
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const text = result.response.text();
  const parsed = JSON.parse(text);

  return NextResponse.json(parsed);
}

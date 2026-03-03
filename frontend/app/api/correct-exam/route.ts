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

  const { documentId, description } = await request.json();

  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required" },
      { status: 400 }
    );
  }

  // Fetch document metadata (RLS ensures ownership)
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Download file from Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("uploads")
    .download(doc.stored_filename);

  if (downloadError || !fileData) {
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const base64 = buffer.toString("base64");

  const prompt = `You are an expert exam corrector. Analyze the attached exam/assignment document and provide detailed corrections.
${description ? `Additional context: ${description}` : ""}

For each question or section that has issues, provide:
- The question number or identifier
- What the issue is
- A model answer
- A brief explanation

Return your response as JSON with this exact structure:
{
  "corrections": [
    {
      "question": "string - question number or identifier",
      "issue": "string - what is wrong or could be improved",
      "modelAnswer": "string - the correct or improved answer",
      "explanation": "string - why this is the correct approach"
    }
  ],
  "overallFeedback": "string - general feedback on the exam performance"
}`;

  try {
    const model = getGeminiModel();
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: doc.mimetype,
                data: base64,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const text = result.response.text();
    console.log("[correct-exam] Gemini raw response:", text);
    const parsed = JSON.parse(text);

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    console.error("[correct-exam] Error:", err);
    if (err instanceof Error) {
      console.error("[correct-exam] Message:", err.message);
      console.error("[correct-exam] Stack:", err.stack);
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

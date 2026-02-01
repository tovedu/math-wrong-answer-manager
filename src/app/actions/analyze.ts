'use server';

import { ProblemLevel, QuestionType } from '../../types';

// Force usage of Node.js runtime (not Edge) to ensure compatibility with Google AI SDK
// removed runtime export to fix build error

// Define return type with success/error pattern
interface AnalysisResult {
    problemLevel: ProblemLevel;
    questionType: QuestionType;
}

type ActionResponse =
    | { success: true; data: AnalysisResult }
    | { success: false; error: string };

export async function analyzeImage(imageBase64: string): Promise<ActionResponse> {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("Server Error: GEMINI_API_KEY is missing.");
            return { success: false, error: "Vercel 환경 변수에 GEMINI_API_KEY가 설정되지 않았습니다." };
        }

        console.log("Starting Analysis via RAW FETCH (No SDK)...");

        const model = "gemini-1.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const prompt = `
        Analyze this math problem image (Korean elementary school math) and categorize it.

        Fields to determine:
        1. problemLevel:
           - "Low": Basic simple problems
           - "Mid": Standard textbook problems
           - "High": Challenging problems requiring multiple steps
           - "Top": Olympiad or very difficult problems

        2. questionType:
           - "Concept": Asking for definitions or basic properties
           - "Computation": Pure calculation
           - "Application": Word problems, applying concepts to situations
           - "ProblemSolving": Complex reasoning, spatial puzzle, or deep logic

        Return ONLY a raw JSON string (no markdown formatting) with this structure:
        { "problemLevel": "...", "questionType": "..." }
        `;

        const body = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: imageBase64
                        }
                    }
                ]
            }]
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google API Error (${response.status}): ${errorText}`);
        }

        const json = await response.json();
        console.log("Gemini Raw Response:", JSON.stringify(json, null, 2));

        // Extract text from response structure
        // Response format: { candidates: [ { content: { parts: [ { text: "..." } ] } } ] }
        const candidate = json.candidates?.[0];
        const textPart = candidate?.content?.parts?.[0]?.text;

        if (!textPart) {
            throw new Error("No text content found in AI response");
        }

        const jsonStr = textPart.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);
        console.log("Parsed Analysis Data:", data);

        const validLevels: ProblemLevel[] = ['Low', 'Mid', 'High', 'Top'];
        const validTypes: QuestionType[] = ['Concept', 'Computation', 'Application', 'ProblemSolving'];

        const mappedLevel = validLevels.includes(data.problemLevel) ? data.problemLevel : 'Mid';
        const mappedType = validTypes.includes(data.questionType) ? data.questionType : 'Computation';

        return {
            success: true,
            data: {
                problemLevel: mappedLevel,
                questionType: mappedType
            }
        };

    } catch (error: any) {
        console.error("AI Analysis Failed:", error);

        // Debug info: Show first 5 chars of the key
        const keyPrefix = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + "..." : "undefined";

        return {
            success: false,
            error: `AI 분석 실패 (Key: ${keyPrefix}): ${error.message || '알 수 없는 오류'}`
        };
    }
}

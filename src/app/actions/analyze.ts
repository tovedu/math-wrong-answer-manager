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

        // Sanitize Key: Remove any whitespace/newlines that might have been pasted
        const validApiKey = apiKey.trim();

        console.log("Starting Analysis via RAW FETCH (Multi-Strategy)...");

        // Strategy Definition: specific model + api version
        const strategies = [
            { model: "gemini-2.0-flash", version: "v1beta" }, // Verified available for this user
            { model: "gemini-1.5-flash", version: "v1beta" },
            { model: "gemini-1.5-flash", version: "v1" }, // GA endpoint
            { model: "gemini-1.5-flash-001", version: "v1beta" },
            { model: "gemini-1.5-flash-002", version: "v1beta" },
            { model: "gemini-1.5-pro", version: "v1beta" },
            { model: "gemini-1.5-pro", version: "v1" },
            { model: "gemini-pro-vision", version: "v1beta" } // Legacy backup
        ];

        let finalJson = null;
        let lastError = null;

        for (const strategy of strategies) {
            try {
                console.log(`Attempting strategy: ${strategy.model} (${strategy.version})`);

                const url = `https://generativelanguage.googleapis.com/${strategy.version}/models/${strategy.model}:generateContent?key=${apiKey}`;

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
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    // If 404, valid key but wrong model/version -> continue
                    if (response.status === 404) {
                        console.warn(`Strategy ${strategy.model} (${strategy.version}) failed: ${errorText}`);
                        lastError = `[404] ${errorText}`;
                        continue;
                    }
                    throw new Error(`Google API Error (${response.status}): ${errorText}`);
                }

                finalJson = await response.json();
                console.log(`Success with strategy: ${strategy.model} (${strategy.version})`);
                break; // Success!

            } catch (e: any) {
                console.warn(`Strategy failed:`, e.message);
                lastError = e.message;
            }
        }

        if (!finalJson) {
            // Debug: If all failed, try listing available models to see what IS allowed
            try {
                console.log("All strategies failed. Attempting to list available models...");
                const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${validApiKey}`;
                const listResp = await fetch(listUrl);
                if (listResp.ok) {
                    const listJson = await listResp.json();
                    const modelNames = listJson.models?.map((m: any) => m.name) || [];
                    console.log("Available Models for this Key:", modelNames);
                    throw new Error(`사용 가능한 모델이 없습니다. (Available: ${modelNames.join(', ') || 'None'})`);
                } else {
                    const listErr = await listResp.text();
                    console.error("Failed to list models:", listErr);
                    throw new Error(`모델 목록 조회 실패 (${listResp.status}): ${listErr}`);
                }
            } catch (debugErr: any) {
                // Throw the original error combined with debug info if available
                if (debugErr.message.includes("사용 가능한 모델") || debugErr.message.includes("조회 실패")) {
                    throw debugErr;
                }
                throw new Error(`All strategies failed. Last error: ${lastError}`);
            }
        }

        console.log("Gemini Raw Response:", JSON.stringify(finalJson, null, 2));

        // Extract text from response structure
        const candidate = finalJson.candidates?.[0];
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
        const key = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
        const keyPrefix = key.length > 5 ? key.substring(0, 5) + "..." : "short/undefined";

        return {
            success: false,
            error: `AI 분석 실패 (Key: ${keyPrefix}): ${error.message || '알 수 없는 오류'}`
        };
    }
}

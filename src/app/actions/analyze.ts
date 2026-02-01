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

        // Strategy Definition: specific model + api version
        const strategies = [
            { model: "gemini-2.0-flash-lite", version: "v1beta" }, // Backup: Has remaining quota
            { model: "gemini-2.5-flash-lite", version: "v1beta" }, // Backup: Has remaining quota
            { model: "gemini-2.0-flash", version: "v1beta" },
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

                const url = `https://generativelanguage.googleapis.com/${strategy.version}/models/${strategy.model}:generateContent?key=${validApiKey}`;



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
            console.log("Static strategies failed. Attempting DYNAMIC MODEL DISCOVERY...");

            try {
                // 1. Fetch available models
                const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${validApiKey}`;
                const listResp = await fetch(listUrl);

                if (!listResp.ok) {
                    throw new Error(`Model listing failed: ${listResp.statusText}`);
                }

                const listJson = await listResp.json();
                const availableModels = listJson.models || [];

                // 2. Filter and Sort candidates
                // Priority: Flash > Pro > others. prefer latest/newer versions.
                const candidates = availableModels
                    .map((m: any) => m.name.replace('models/', '')) // Remove prefix for consistency
                    .filter((name: string) => name.includes('gemini') && !name.includes('embedding') && !name.includes('imagen'))
                    .sort((a: string, b: string) => {
                        // Sort logic: Put 'flash' first, then 'pro'
                        const aScore = (a.includes('flash') ? 2 : 0) + (a.includes('pro') ? 1 : 0);
                        const bScore = (b.includes('flash') ? 2 : 0) + (b.includes('pro') ? 1 : 0);
                        return bScore - aScore;
                    });

                console.log("Discovered Candidates:", candidates);

                if (candidates.length === 0) {
                    throw new Error("No suitable Gemini text-generation models found in account.");
                }

                // 3. Dynamic Retry Loop
                for (const modelName of candidates) {
                    try {
                        console.log(`Dynamic Attempt: ${modelName}`);
                        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${validApiKey}`;

                        const response = await fetch(url, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(body) // Reuse same body
                        });

                        if (!response.ok) {
                            const err = await response.text();
                            console.warn(`Dynamic ${modelName} failed: ${err}`);
                            continue;
                        }

                        finalJson = await response.json();
                        console.log(`Success with DYNAMIC model: ${modelName}`);
                        break; // Success!

                    } catch (innerErr) {
                        console.warn(`Dynamic attempt error for ${modelName}`, innerErr);
                    }
                }

                if (!finalJson) {
                    throw new Error(`All dynamic candidates failed. Available: ${candidates.join(', ')}`);
                }

            } catch (discoveryErr: any) {
                console.error("Dynamic discovery failed:", discoveryErr);
                // If discovery fails, throw the original error + discovery error
                throw new Error(`All strategies failed. Discovery also failed: ${discoveryErr.message}`);
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

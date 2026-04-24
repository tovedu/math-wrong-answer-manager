'use server';

import { ProblemLevel, QuestionType } from '../../types';
import { ErrorTypeCode, ERROR_TYPE_OPTIONS, getErrorTypeByCode } from '../../data/errorTypes';

// Force usage of Node.js runtime (not Edge) to ensure compatibility with Google AI SDK
// removed runtime export to fix build error

interface AnalysisResult {
    problemLevel: ProblemLevel;
    questionType: QuestionType;
    /**
     * AI가 추론한 오답 원인 코드.
     * 사용자가 이미 수동 선택한 경우에는 이 값을 무시합니다.
     */
    errorTypeCode?: ErrorTypeCode;
    /** errorTypeCode를 value 형식("[코드]|[풀네임]")으로 변환한 값 */
    errorTypeValue?: string;
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

        const validApiKey = apiKey.trim();

        console.log("Starting Analysis via RAW FETCH (Multi-Strategy)...");

        // 오답 원인 코드 목록을 문자열로 변환하여 프롬프트에 주입
        const errorCodeList = ERROR_TYPE_OPTIONS
            .map(item => `"${item.code}" (${item.label})`)
            .join(', ');

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

                3. errorTypeCode: The most likely reason a student got this wrong.
                Choose EXACTLY ONE code from this list: ${errorCodeList}
                Return only the single character code (e.g., "계", "개", "문", "논", "식", "응").

                Return ONLY a raw JSON string (no markdown formatting) with this structure:
                { "problemLevel": "...", "questionType": "...", "errorTypeCode": "..." }
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

        const strategies = [
            { model: "gemini-2.0-flash-lite", version: "v1beta" },
            { model: "gemini-2.5-flash-lite", version: "v1beta" },
            { model: "gemini-2.0-flash", version: "v1beta" },
            { model: "gemini-1.5-flash", version: "v1beta" },
            { model: "gemini-1.5-flash", version: "v1" },
            { model: "gemini-1.5-flash-001", version: "v1beta" },
            { model: "gemini-1.5-flash-002", version: "v1beta" },
            { model: "gemini-1.5-pro", version: "v1beta" },
            { model: "gemini-1.5-pro", version: "v1" },
            { model: "gemini-pro-vision", version: "v1beta" }
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
                    if (response.status === 404) {
                        console.warn(`Strategy ${strategy.model} (${strategy.version}) failed: ${errorText}`);
                        lastError = `[404] ${errorText}`;
                        continue;
                    }
                    throw new Error(`Google API Error (${response.status}): ${errorText}`);
                }

                finalJson = await response.json();
                console.log(`Success with strategy: ${strategy.model} (${strategy.version})`);
                break;

            } catch (e: any) {
                console.warn(`Strategy failed:`, e.message);
                lastError = e.message;
            }
        }

        if (!finalJson) {
            console.log("Static strategies failed. Attempting DYNAMIC MODEL DISCOVERY...");

            try {
                const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${validApiKey}`;
                const listResp = await fetch(listUrl);

                if (!listResp.ok) {
                    throw new Error(`Model listing failed: ${listResp.statusText}`);
                }

                const listJson = await listResp.json();
                const availableModels = listJson.models || [];

                const candidates = availableModels
                    .map((m: any) => m.name.replace('models/', ''))
                    .filter((name: string) => name.includes('gemini') && !name.includes('embedding') && !name.includes('imagen'))
                    .sort((a: string, b: string) => {
                        const aScore = (a.includes('flash') ? 2 : 0) + (a.includes('pro') ? 1 : 0);
                        const bScore = (b.includes('flash') ? 2 : 0) + (b.includes('pro') ? 1 : 0);
                        return bScore - aScore;
                    });

                console.log("Discovered Candidates:", candidates);

                if (candidates.length === 0) {
                    throw new Error("No suitable Gemini text-generation models found in account.");
                }

                for (const modelName of candidates) {
                    try {
                        console.log(`Dynamic Attempt: ${modelName}`);
                        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${validApiKey}`;

                        const response = await fetch(url, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(body)
                        });

                        if (!response.ok) {
                            const err = await response.text();
                            console.warn(`Dynamic ${modelName} failed: ${err}`);
                            continue;
                        }

                        finalJson = await response.json();
                        console.log(`Success with DYNAMIC model: ${modelName}`);
                        break;

                    } catch (innerErr) {
                        console.warn(`Dynamic attempt error for ${modelName}`, innerErr);
                    }
                }

                if (!finalJson) {
                    throw new Error(`All dynamic candidates failed. Available: ${candidates.join(', ')}`);
                }

            } catch (discoveryErr: any) {
                console.error("Dynamic discovery failed:", discoveryErr);
                throw new Error(`All strategies failed. Discovery also failed: ${discoveryErr.message}`);
            }
        }

        console.log("Gemini Raw Response:", JSON.stringify(finalJson, null, 2));

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

        // errorTypeCode 검증: ERROR_TYPE_OPTIONS 목록에 있는 코드인지 확인
        const rawCode = data.errorTypeCode as string | undefined;
        const matchedErrorType = rawCode ? getErrorTypeByCode(rawCode) : undefined;
        const errorTypeCode = matchedErrorType?.code;
        const errorTypeValue = matchedErrorType?.value;

        console.log("Mapped errorType:", errorTypeCode, "→", errorTypeValue);

        return {
            success: true,
            data: {
                problemLevel: mappedLevel,
                questionType: mappedType,
                errorTypeCode,
                errorTypeValue,
            }
        };

    } catch (error: any) {
        console.error("AI Analysis Failed:", error);

        const key = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
        const keyPrefix = key.length > 5 ? key.substring(0, 5) + "..." : "short/undefined";

        return {
            success: false,
            error: `AI 분석 실패 (Key: ${keyPrefix}): ${error.message || '알 수 없는 오류'}`
        };
    }
}

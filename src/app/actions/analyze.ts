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
        if (!process.env.GEMINI_API_KEY) {
            console.error("Server Error: GEMINI_API_KEY is missing.");
            return { success: false, error: "Vercel 환경 변수에 GEMINI_API_KEY가 설정되지 않았습니다." };
        }

        console.log("Dynamically importing Gemini Client...");
        const { GoogleGenerativeAI } = await import('@google/generative-ai');

        console.log("Initializing Gemini Client...");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        // List of models to try in order of preference (Exhaustive list)
        const modelsToTry = [
            "gemini-1.5-flash",
            "gemini-1.5-flash-001",
            "gemini-1.5-flash-002",
            "gemini-1.5-pro",
            "gemini-1.5-pro-001",
            "gemini-1.5-pro-002",
            "gemini-2.0-flash-exp" // Try experimental as last resort
        ];

        let result;
        let lastError;

        for (const modelName of modelsToTry) {
            try {
                console.log(`Attempting analysis with model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });

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

                const imagePart = {
                    inlineData: {
                        data: imageBase64,
                        mimeType: "image/jpeg",
                    },
                };

                const generateResult = await model.generateContent([prompt, imagePart]);
                const response = await generateResult.response;
                const text = response.text();

                // If successful, assign to result and break
                result = text;
                break;
            } catch (e: any) {
                console.warn(`Model ${modelName} failed:`, e.message);
                lastError = e;
                // Continue to next model
            }
        }

        if (!result) {
            throw new Error(`All models failed. Last error: ${lastError?.message}`);
        }

        const text = result;
        console.log("Gemini Raw Response:", text);

        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
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

'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProblemLevel, QuestionType } from '../../types';

// Removed top-level init

interface AnalysisResult {
    problemLevel: ProblemLevel;
    questionType: QuestionType;
}

export async function analyzeImage(imageBase64: string): Promise<AnalysisResult> {
    try {
        if (!process.env.GEMINI_API_KEY) {
            console.error("Server Error: GEMINI_API_KEY is missing.");
            throw new Error("Vercel 환경 변수에 GEMINI_API_KEY가 설정되지 않았습니다.");
        }

        console.log("Initializing Gemini Client...");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

        console.log("Starting Analysis with model: gemini-1.5-flash");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

        // Note: The base64 string passed here should NOT include the data URL prefix
        const imagePart = {
            inlineData: {
                data: imageBase64,
                mimeType: "image/jpeg", // Defaulting to jpeg; API is generally flexible with this
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        console.log("Gemini Raw Response:", text); // Debug Log

        // Clean potential markdown wrappers
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);
        console.log("Parsed Analysis Data:", data); // Debug Log

        // Validation / Fallback
        const validLevels: ProblemLevel[] = ['Low', 'Mid', 'High', 'Top'];
        const validTypes: QuestionType[] = ['Concept', 'Computation', 'Application', 'ProblemSolving'];

        const mappedLevel = validLevels.includes(data.problemLevel) ? data.problemLevel : 'Mid';
        const mappedType = validTypes.includes(data.questionType) ? data.questionType : 'Computation';

        return {
            problemLevel: mappedLevel,
            questionType: mappedType
        };

    } catch (error: any) {
        console.error("AI Analysis Failed:", error);
        // Throw the error so the client knows it failed
        throw new Error(`AI 분석 실패: ${error.message || '알 수 없는 오류'}`);
    }
}

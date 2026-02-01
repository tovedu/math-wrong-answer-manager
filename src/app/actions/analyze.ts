'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProblemLevel, QuestionType } from '../../types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface AnalysisResult {
    problemLevel: ProblemLevel;
    questionType: QuestionType;
}

export async function analyzeImage(imageBase64: string): Promise<AnalysisResult> {
    if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is missing");
        throw new Error("Server configuration error: API Key missing");
    }

    try {
        // Use gemini-1.5-flash for speed and cost efficiency
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

        // Clean potential markdown wrappers
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        // Validation / Fallback
        const validLevels: ProblemLevel[] = ['Low', 'Mid', 'High', 'Top'];
        const validTypes: QuestionType[] = ['Concept', 'Computation', 'Application', 'ProblemSolving'];

        return {
            problemLevel: validLevels.includes(data.problemLevel) ? data.problemLevel : 'Mid',
            questionType: validTypes.includes(data.questionType) ? data.questionType : 'Computation'
        };

    } catch (error) {
        console.error("AI Analysis Failed:", error);
        // Fallback defaults in case of error, to prevent blocking the flow
        return {
            problemLevel: 'Mid',
            questionType: 'Computation'
        };
    }
}

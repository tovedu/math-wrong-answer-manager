'use server';

import { ProblemLevel, QuestionType } from '../../types';

interface AnalysisResult {
    problemLevel: ProblemLevel;
    questionType: QuestionType;
}

export async function analyzeImage(imageUrl: string): Promise<AnalysisResult> {
    // Simulate AI processing delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock Analysis Logic: Randomly select values (or deterministic based on input length logic if preferred)
    // For now, let's pick random valid values to demonstrate the UI update.
    const levels: ProblemLevel[] = ['Low', 'Mid', 'High', 'Top'];
    const types: QuestionType[] = ['Concept', 'Computation', 'Application', 'ProblemSolving'];

    const randomLevel = levels[Math.floor(Math.random() * levels.length)];
    const randomType = types[Math.floor(Math.random() * types.length)];

    return {
        problemLevel: randomLevel,
        questionType: randomType,
    };
}

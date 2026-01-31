import { CurriculumTerm } from '../data/curriculum';

export type ProblemLevel = 'Low' | 'Mid' | 'High' | 'Top';
export type QuestionType = 'Concept' | 'Computation' | 'Application' | 'ProblemSolving';

export interface Student {
    id: string;
    name: string;
    grade: number;
}

export interface WrongAnswer {
    id: string;
    studentId: string;
    date: string; // ISO format YYYY-MM-DD
    grade: number;
    term: number;
    chapter: string;
    problemLevel: ProblemLevel;
    questionType: QuestionType;
    imageUrl?: string;
    memo?: string;
    isResolved: boolean;
}

export type { CurriculumTerm };

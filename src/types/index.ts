import { CurriculumTerm } from '../data/curriculum';

export type ProblemLevel = 'Low' | 'Mid' | 'High' | 'Top';
export type QuestionType = 'Concept' | 'Computation' | 'Application' | 'ProblemSolving';

// 오답 원인 타입 — errorTypes.ts 에서 중앙 관리
export type { ErrorTypeCode, ErrorTypeItem } from '../data/errorTypes';

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
    /**
     * 오답 원인 — 저장 형식: "[코드]|[풀네임]"
     * @example "개|개념 부족"
     * 기존 데이터는 이 값이 없을 수 있음 (undefined 허용)
     */
    errorType?: string;
    imageUrl?: string;
    memo?: string;
    isResolved: boolean;
}

export type { CurriculumTerm };

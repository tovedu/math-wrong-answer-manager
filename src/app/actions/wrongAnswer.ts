'use server';

import { ERROR_TYPE_OPTIONS, getErrorTypeByCode } from '../../data/errorTypes';

const GAS_API_URL = process.env.NEXT_PUBLIC_GAS_URL || 'https://script.google.com/macros/s/AKfycbyj0bkb5lQHHFmxRk6PVoNd8e6jfPVJTT6ZuJra9A9lWfJHCNdgokg9kSDJPcedDm2Y/exec';

export interface WrongAnswer {
    id: string;
    studentId: string;
    date: string;
    grade: number;
    term: number;
    chapter: string;
    problemLevel: 'Low' | 'Mid' | 'High' | 'Top';
    questionType: 'Concept' | 'Computation' | 'Application' | 'ProblemSolving';
    /**
     * 오답 원인 — 저장 형식: "[코드]|[풀네임]"
     * @example "개|개념 부족"
     * 기존 데이터는 이 값이 없을 수 있음 (undefined/빈 문자열 허용)
     */
    errorType?: string;
    memo?: string;
    imageUrl?: string;
    isResolved: boolean;
}

export interface FilterOptions {
    studentId?: string;
    startDate?: string;
    endDate?: string;
    grade?: number;
    chapter?: string;
}

/** 오답 원인별 집계 결과 타입 */
export interface ErrorTypeData {
    code: string;
    label: string;
    count: number;
}

export async function saveWrongAnswer(data: Omit<WrongAnswer, 'id' | 'isResolved'> & { imageBase64?: string, imageName?: string, imageType?: string }) {
    if (!GAS_API_URL) throw new Error('GAS_API_URL is not defined');

    const payload = {
        ...data,
        id: crypto.randomUUID(),
        isResolved: false
    };

    const response = await fetch(GAS_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'save_answer',
            payload: payload
        })
    });

    const result = await response.json();
    if (result.status === 'error') {
        throw new Error(result.message);
    }

    return result.savedData;
}

export async function updateWrongAnswerStatus(id: string, isResolved: boolean) {
    if (!GAS_API_URL) throw new Error('GAS_API_URL is not defined');

    const response = await fetch(GAS_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            action: 'update_status',
            payload: { id, isResolved }
        })
    });

    const result = await response.json();
    if (result.status === 'error') {
        throw new Error(result.message);
    }
    return result;
}

export async function getWrongAnswers(filters?: FilterOptions): Promise<WrongAnswer[]> {
    if (!GAS_API_URL) return [];

    const response = await fetch(`${GAS_API_URL}?action=get_answers`, {
        method: 'GET',
        cache: 'no-store'
    });

    const result = await response.json();
    if (result.status === 'error') {
        console.error(result.message);
        return [];
    }

    let answers: WrongAnswer[] = result.data;

    if (filters) {
        if (filters.studentId) {
            answers = answers.filter(a => a.studentId.includes(filters.studentId!));
        }
        if (filters.grade) {
            answers = answers.filter(a => a.grade === filters.grade);
        }
        if (filters.startDate) {
            answers = answers.filter(a => a.date >= filters.startDate!);
        }
        if (filters.endDate) {
            answers = answers.filter(a => a.date <= filters.endDate!);
        }
        if (filters.chapter && filters.chapter !== '전체') {
            answers = answers.filter(a => a.chapter === filters.chapter);
        }
    }

    return answers;
}

export interface AnalysisStats {
    totalWrong: number;
    resolved: number;
    resolutionRate: number;
    worstChapter: string;
    radarData: { subject: string; A: number; fullMark: number }[];
    barData: { name: string; count: number }[];
    pieData: { name: string; value: number }[];
    recentWrongs: WrongAnswer[];
    /** 오답 원인별 집계 (ERROR_TYPE_OPTIONS 순서 기준, errorType 없는 데이터 제외) */
    errorTypeData: ErrorTypeData[];
}

export async function getAnalysisStats(filters?: FilterOptions): Promise<AnalysisStats> {
    const answers = await getWrongAnswers(filters);

    const totalWrong = answers.length;
    const resolved = answers.filter(a => a.isResolved).length;
    const resolutionRate = totalWrong === 0 ? 0 : Math.round((resolved / totalWrong) * 100);

    // Worst Chapter
    const chapterCounts: Record<string, number> = {};
    answers.forEach(a => {
        chapterCounts[a.chapter] = (chapterCounts[a.chapter] || 0) + 1;
    });
    let worstChapter = '-';
    let maxCount = 0;
    for (const [chapter, count] of Object.entries(chapterCounts)) {
        if (count > maxCount) {
            maxCount = count;
            worstChapter = chapter;
        }
    }

    // Bar Data
    const barData = Object.entries(chapterCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

    // Radar Data
    const typeCounts: Record<string, number> = {
        'Concept': 0, 'Computation': 0, 'Application': 0, 'ProblemSolving': 0
    };
    answers.forEach(a => {
        if (typeCounts[a.questionType] !== undefined) {
            typeCounts[a.questionType]++;
        }
    });
    const radarData = [
        { subject: '개념', A: typeCounts['Concept'], fullMark: Math.max(...Object.values(typeCounts), 10) },
        { subject: '계산', A: typeCounts['Computation'], fullMark: Math.max(...Object.values(typeCounts), 10) },
        { subject: '응용', A: typeCounts['Application'], fullMark: Math.max(...Object.values(typeCounts), 10) },
        { subject: '문제해결', A: typeCounts['ProblemSolving'], fullMark: Math.max(...Object.values(typeCounts), 10) },
    ];

    // Pie Data
    const levelCounts: Record<string, number> = { 'Low': 0, 'Mid': 0, 'High': 0, 'Top': 0 };
    answers.forEach(a => {
        if (levelCounts[a.problemLevel] !== undefined) {
            levelCounts[a.problemLevel]++;
        }
    });
    const pieData = Object.entries(levelCounts).map(([name, value]) => ({ name, value }));

    // Recent Wrongs
    const recentWrongs = [...answers]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 100);

    // ★ 오답 원인별 집계 (ERROR_TYPE_OPTIONS 순서 기준)
    // 코드값(split('|')[0]) 기준으로 카운트
    // null / undefined / '' 인 레코드는 집계에서 제외 (기존 데이터 호환)
    const errorCodeCounts: Record<string, number> = {};
    answers.forEach(a => {
        if (!a.errorType) return; // 기존 데이터 제외
        const code = a.errorType.split('|')[0];
        if (getErrorTypeByCode(code)) {
            errorCodeCounts[code] = (errorCodeCounts[code] || 0) + 1;
        }
    });

    // ERROR_TYPE_OPTIONS 순서를 유지하며 결과 배열 생성
    const errorTypeData: ErrorTypeData[] = ERROR_TYPE_OPTIONS.map(item => ({
        code: item.code,
        label: item.label,
        count: errorCodeCounts[item.code] || 0,
    }));

    return {
        totalWrong,
        resolved,
        resolutionRate,
        worstChapter,
        radarData,
        barData,
        pieData,
        recentWrongs,
        errorTypeData,
    };
}

export async function getStudentsList(): Promise<string[]> {
    if (!GAS_API_URL) return [];

    try {
        const response = await fetch(`${GAS_API_URL}?action=get_students`, {
            method: 'GET',
            cache: 'no-store'
        });

        const result = await response.json();
        if (result.status === 'success') {
            return result.data;
        }
        return [];
    } catch (error) {
        console.error("Failed to fetch students:", error);
        return [];
    }
}

import { ProblemLevel, QuestionType } from '../types';

export const mockStats = {
    totalWrong: 42,
    resolved: 28,
    resolutionRate: 67,
    worstChapter: '분수의 덧셈과 뺄셈',
};

export const radarData = [
    { subject: '개념', A: 120, fullMark: 150 },
    { subject: '계산', A: 98, fullMark: 150 },
    { subject: '응용', A: 86, fullMark: 150 },
    { subject: '문제해결', A: 65, fullMark: 150 },
];

export const barData = [
    { name: '1단원', count: 12 },
    { name: '2단원', count: 19 },
    { name: '3단원', count: 3 },
    { name: '4단원', count: 5 },
    { name: '5단원', count: 2 },
    { name: '6단원', count: 1 },
];

export const pieData = [
    { name: 'Low', value: 10 },
    { name: 'Mid', value: 45 },
    { name: 'High', value: 30 },
    { name: 'Top', value: 15 },
];

export const recentWrongs = [
    { id: '1', date: '2023-05-20', grade: 5, term: 1, chapter: '분수의 덧셈과 뺄셈', level: 'High' as ProblemLevel, type: 'Computation' as QuestionType, resolved: false },
    { id: '2', date: '2023-05-19', grade: 5, term: 1, chapter: '약수와 배수', level: 'Mid' as ProblemLevel, type: 'Concept' as QuestionType, resolved: true },
    { id: '3', date: '2023-05-18', grade: 5, term: 1, chapter: '자연수의 혼합 계산', level: 'Low' as ProblemLevel, type: 'Computation' as QuestionType, resolved: true },
];

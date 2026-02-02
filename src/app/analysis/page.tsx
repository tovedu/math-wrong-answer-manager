"use client";

import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, AlertTriangle, BookOpen, TrendingUp } from 'lucide-react';
import { getAnalysisStats, AnalysisStats, getStudentsList, updateWrongAnswerStatus } from '../actions/wrongAnswer';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
    PieChart, Pie, Cell
} from 'recharts';
import { curriculum } from '../../data/curriculum';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const renderCustomizedLabel = ({ name, percent }: { name?: string | number; percent?: number }) => {
    const p = percent ?? 0;
    if (p <= 0) return '';
    const n = name ?? '';
    const val = (p * 100).toFixed(0);
    return n + ' ' + val + '%';
};

export default function AnalysisPage() {
    const [stats, setStats] = useState<AnalysisStats | null>(null);

    // Filters
    const [studentId, setStudentId] = useState('');
    const [grade, setGrade] = useState<number | ''>('');
    const [term, setTerm] = useState<number | ''>(''); // Helper for chapter selection
    const [chapter, setChapter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Data Lists
    const [studentList, setStudentList] = useState<string[]>([]);

    const chapterList = useMemo(() => {
        let chapters: string[] = [];
        if (grade && term) {
            const curr = curriculum.find(c => c.grade === Number(grade) && c.term === Number(term));
            chapters = curr ? curr.chapters : [];
        } else if (grade) {
            const gradeCurrs = curriculum.filter(c => c.grade === Number(grade));
            chapters = gradeCurrs.flatMap(c => c.chapters);
        }
        return chapters;
    }, [grade, term]);

    const fetchStats = () => {
        getAnalysisStats({
            studentId: studentId || undefined,
            grade: grade ? Number(grade) : undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            chapter: chapter || undefined
        }).then(setStats);
    };

    useEffect(() => {
        fetchStats();
        getStudentsList().then(setStudentList);
    }, []);

    if (!stats) return <div className="p-8 text-center text-gray-500">데이터를 불러오는 중...</div>;

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800">📊 오답 분석 리포트</h1>

                {/* 필터 컨트롤 */}
                <div className="flex flex-wrap gap-2 items-center bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                    <select
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm min-w-[100px]"
                    >
                        <option value="">전체 학생</option>
                        {studentList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <div className="flex items-center gap-1">
                        <select
                            value={grade}
                            onChange={(e) => { setGrade(e.target.value ? Number(e.target.value) : ''); setChapter(''); }}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                            <option value="">학년</option>
                            {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>{g}학년</option>)}
                        </select>
                        <select
                            value={term}
                            onChange={(e) => { setTerm(e.target.value ? Number(e.target.value) : ''); setChapter(''); }}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                            <option value="">학기</option>
                            <option value="1">1학기</option>
                            <option value="2">2학기</option>
                        </select>
                    </div>

                    <select
                        value={chapter}
                        onChange={(e) => setChapter(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm max-w-[150px]"
                    >
                        <option value="">전체 단원</option>
                        {chapterList.map((c, i) => <option key={`${c}-${i}`} value={c}>{c}</option>)}
                    </select>

                    <div className="flex items-center gap-1">
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-[110px]"
                        />
                        <span className="text-gray-400">~</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1 text-sm w-[110px]"
                        />
                    </div>

                    <button
                        onClick={fetchStats}
                        className="bg-slate-800 text-white px-4 py-1 rounded text-sm hover:bg-slate-700"
                    >
                        조회
                    </button>
                </div>
            </div>

            {/* 상단 주요 통계 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center space-x-4 border-l-4 border-red-500">
                    <div className="p-3 bg-red-100 rounded-full text-red-600">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">총 오답 수</p>
                        <p className="text-2xl font-bold">{stats.totalWrong}문제</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center space-x-4 border-l-4 border-green-500">
                    <div className="p-3 bg-green-100 rounded-full text-green-600">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">해결 완료</p>
                        <p className="text-2xl font-bold">{stats.resolved}문제</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center space-x-4 border-l-4 border-blue-500">
                    <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">해결율</p>
                        <p className="text-2xl font-bold">{stats.resolutionRate}%</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-md flex items-center space-x-4 border-l-4 border-yellow-500">
                    <div className="p-3 bg-yellow-100 rounded-full text-yellow-600">
                        <BookOpen size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">취약 단원</p>
                        <p className="text-lg font-bold truncate">{stats.worstChapter}</p>
                    </div>
                </div>
            </div>

            {/* 차트 영역 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* 단원별 오답 빈도 */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">단원별 오답 빈도</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.barData}>
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 유형별 정답률 (Radar) */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">문제 유형별 분석</h2>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={stats.radarData}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" />
                                <PolarRadiusAxis />
                                <Radar name="Count" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 난이도별 분포 (Pie) */}
                <div className="bg-white p-6 rounded-lg shadow-md md:col-span-2 lg:col-span-1">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">난이도별 오답 분포</h2>
                    <div className="h-64 flex justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.pieData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomizedLabel}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {stats.pieData.map((entry, index) => (
                                        <Cell key={'cell-' + index} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 최근 오답 리스트 */}
                <div className="bg-white p-6 rounded-lg shadow-md md:col-span-2 lg:col-span-1">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">최근 오답 목록</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">단원</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">난이도</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {stats.recentWrongs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-4 text-center text-gray-500">데이터가 없습니다.</td>
                                    </tr>
                                ) : (
                                    stats.recentWrongs.map((wrong) => (
                                        <tr key={wrong.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{wrong.date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{wrong.chapter}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <span className={"px-2 inline-flex text-xs leading-5 font-semibold rounded-full " + (
                                                    (wrong.problemLevel === 'High' || wrong.problemLevel === 'Top') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                                )}>
                                                    {wrong.problemLevel}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {wrong.isResolved ? (
                                                    <span className="text-green-600 flex items-center"><CheckCircle size={16} className="mr-1" /> 완료</span>
                                                ) : (
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm('이 문제를 해결 완료 상태로 변경하시겠습니까?')) {
                                                                try {
                                                                    await updateWrongAnswerStatus(wrong.id, true);
                                                                    alert('변경되었습니다.');
                                                                    fetchStats(); // Refresh data
                                                                } catch (e) {
                                                                    alert('오류가 발생했습니다: ' + e);
                                                                }
                                                            }
                                                        }}
                                                        className="text-red-500 flex items-center hover:bg-red-50 px-2 py-1 rounded transition"
                                                    >
                                                        <AlertTriangle size={16} className="mr-1" /> 미해결 (클릭하여 완료)
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

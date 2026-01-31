"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { getWrongAnswers, WrongAnswer, getStudentsList } from '../actions/wrongAnswer';
import { curriculum } from '../../data/curriculum';

export default function PrintPage() {
    const [answers, setAnswers] = useState<WrongAnswer[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [studentId, setStudentId] = useState('');
    const [grade, setGrade] = useState<number | ''>('');
    const [term, setTerm] = useState<number | ''>('');
    const [chapter, setChapter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

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

    const fetchAnswers = () => {
        setLoading(true);
        getWrongAnswers({
            studentId: studentId || undefined,
            grade: grade ? Number(grade) : undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            chapter: chapter || undefined
        }).then((data) => {
            // Unresolved only for print? Or allow all? Usually wrong answer notes are for unresolved or reviewed.
            // Let's show all for now, or maybe only unresolved. 
            // Previous code didn't filter unresolved explicitly in fetch, let's keep it consistent.
            // But usually for "Print", we might want to filter isResolved=false. 
            // For now, just show what's returned.
            const unresolved = data.filter(a => !a.isResolved);
            setAnswers(unresolved);
            setLoading(false);
        });
    };

    useEffect(() => {
        fetchAnswers();
        getStudentsList().then(setStudentList);
    }, []);

    // 4문제씩 페이지 나누기
    const chunkedAnswers = [];
    for (let i = 0; i < answers.length; i += 4) {
        chunkedAnswers.push(answers.slice(i, i + 4));
    }

    return (
        <div className="max-w-screen-lg mx-auto bg-white min-h-screen">
            {/* 인쇄 제어 버튼 (화면상에만 보임) */}
            <div className="print:hidden p-4 bg-gray-100 border-b flex flex-col md:flex-row justify-between items-center sticky top-0 z-10 gap-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.history.back()}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 transition text-sm"
                    >
                        ← 뒤로
                    </button>
                    <h1 className="text-xl font-bold">🖨️ 오답 노트 만들기</h1>
                </div>

                {/* 컨트롤 패널 (인쇄 시 숨김) */}
                <div className="print:hidden bg-slate-100 p-4 mb-6 rounded-lg shadow-sm border border-slate-200 flex flex-wrap gap-2 items-center justify-between">
                    <div className="flex flex-wrap gap-2 items-center">
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
                                className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
                            >
                                <option value="">학년</option>
                                {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>{g}학년</option>)}
                            </select>
                            <select
                                value={term}
                                onChange={(e) => { setTerm(e.target.value ? Number(e.target.value) : ''); setChapter(''); }}
                                className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
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
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm" />
                            <span>~</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={fetchAnswers}
                            className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700"
                        >
                            조건 적용
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="bg-slate-800 text-white px-4 py-1 rounded text-sm hover:bg-slate-700 flex items-center gap-2"
                        >
                            🖨️ 인쇄하기
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center p-10 print:hidden">문제 불러오는 중...</div>
            ) : answers.length === 0 ? (
                <div className="text-center p-10">
                    <h2 className="text-xl font-bold mb-4">조건에 맞는 오답이 없습니다.</h2>
                    <p className="text-gray-600">필터 조건을 변경하거나 새로운 오답을 입력해주세요.</p>
                </div>
            ) : (
                /* 인쇄 영역 */
                <div className="bg-gray-100 p-8 min-h-screen print:bg-white print:p-0">
                    {chunkedAnswers.map((pageAnswers, pageIndex) => (
                        <div
                            key={pageIndex}
                            className="bg-white mx-auto shadow-lg mb-8 p-12 flex flex-col relative print:shadow-none print:mb-0 print:p-0 break-after-page"
                            style={{ width: '210mm', height: '297mm' }}
                        >
                            {/* 페이지 헤더 */}
                            <div className="text-center mb-6 border-b-2 border-gray-800 pb-2 print:mt-4">
                                <h1 className="text-3xl font-bold font-serif">오 답 노 트</h1>
                                <p className="text-gray-500 mt-2 text-sm">
                                    Date: {new Date().toLocaleDateString()} | Name: __________________ | Page: {pageIndex + 1}/{chunkedAnswers.length}
                                </p>
                            </div>

                            {/* 2x2 그리드 (남은 높이 꽉 채우기) */}
                            <div className="grid grid-cols-2 grid-rows-2 gap-8 flex-1 pb-4">
                                {pageAnswers.map((answer, index) => (
                                    <div key={answer.id} className="border-2 border-gray-300 rounded-xl p-4 flex flex-col h-full print:border-gray-400">
                                        {/* 문제 헤더 */}
                                        <div className="flex justify-between items-center mb-3 border-b pb-2">
                                            <span className="font-bold text-lg bg-gray-800 text-white w-8 h-8 flex items-center justify-center rounded-full print:bg-black">
                                                {pageIndex * 4 + index + 1}
                                            </span>
                                            <div className="text-xs text-gray-500 font-medium text-right">
                                                {answer.chapter}<br />
                                                {answer.questionType} | {answer.problemLevel}
                                            </div>
                                        </div>

                                        {/* 컨텐츠 영역: 이미지(상) + 풀이(하) */}
                                        <div className="flex flex-col gap-4 flex-1 min-h-0">
                                            {/* 이미지 영역 (높이 자동 조절, 최대 60%까지) */}
                                            <div className="w-full flex justify-center border border-gray-200 rounded-lg overflow-hidden bg-white print:border-none relative" style={{ minHeight: '100px', maxHeight: '55%' }}>
                                                {answer.imageUrl ? (
                                                    <img
                                                        src={answer.imageUrl}
                                                        alt="오답 문제"
                                                        className="w-full h-full object-contain"
                                                        style={{ maxHeight: '100%' }}
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-center w-full h-24 text-gray-400 text-sm bg-gray-50">이미지 없음</div>
                                                )}
                                            </div>

                                            {/* 풀이 공간 (나머지 영역 채우기) */}
                                            <div className="flex-1 border-2 border-dashed border-gray-300 rounded-lg relative print:border-gray-400">
                                                <span className="absolute top-2 left-2 text-gray-400 text-xs font-bold uppercase tracking-wider bg-white px-1">
                                                    Solution
                                                </span>
                                                {answer.memo && (
                                                    <div className="absolute bottom-2 right-2 text-xs text-gray-500 max-w-[90%] text-right bg-white px-1">
                                                        Memo: {answer.memo}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 0; /* 브라우저 마진 제거하고 padding으로 제어 */
                    }
                    body {
                        background: white;
                        -webkit-print-color-adjust: exact;
                    }
                    /* 화면의 배경색 등 제거 */
                    .print\:bg-white { background-color: white !important; }
                    .print\:shadow-none { box-shadow: none !important; }
                    .print\:p-0 { padding: 0 !important; } /* 내부 page padding은 layout에서 직접 제어하거나 margin설정 */
                
                    /* 실제 인쇄 시 page div에 margin 적용 (margin: 10mm equivalent padding inside) */
                    .break-after-page {
                        padding: 10mm !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        page-break-after: always;
                    }
                }
            `}</style>
        </div>
    );
}

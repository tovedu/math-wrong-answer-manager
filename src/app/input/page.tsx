"use client";

import { useState, useMemo, ChangeEvent, FormEvent, useEffect } from 'react';
import { curriculum } from '../../data/curriculum';
import { ProblemLevel, QuestionType } from '../../types';
import { ERROR_TYPE_OPTIONS } from '../../data/errorTypes';
import { analyzeImage } from '../actions/analyze';
import { saveWrongAnswer } from '../actions/wrongAnswer';

export default function InputPage() {
    const [selectedGrade, setSelectedGrade] = useState<number>(1);
    const [selectedTerm, setSelectedTerm] = useState<number>(1);
    const [selectedChapter, setSelectedChapter] = useState<string>('');
    const [problemLevel, setProblemLevel] = useState<ProblemLevel>('Mid');
    const [questionType, setQuestionType] = useState<QuestionType>('Computation');
    /** 오답 원인 — ERROR_TYPE_OPTIONS[n].value 값 저장 ("코드|풀네임") */
    const [errorType, setErrorType] = useState<string>('');
    const [errorTypeError, setErrorTypeError] = useState<boolean>(false);
    const [memo, setMemo] = useState<string>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // 학생 목록 관리
    const [studentId, setStudentId] = useState<string>('');
    const [studentList, setStudentList] = useState<string[]>([]);

    // ── UX: 최근 선택값 복원 (학생 / 학년 / 학기) ──────────────────────────
    useEffect(() => {
        // 학년/학기 복원
        const savedGrade = localStorage.getItem('lastGrade');
        const savedTerm = localStorage.getItem('lastTerm');
        if (savedGrade) setSelectedGrade(Number(savedGrade));
        if (savedTerm) setSelectedTerm(Number(savedTerm));

        // 학생 목록 로드
        import('../actions/wrongAnswer').then(({ getStudentsList }) => {
            getStudentsList().then(list => {
                if (list.length > 0) {
                    setStudentList(list);
                    const savedId = localStorage.getItem('lastStudentId');
                    if (savedId && list.includes(savedId)) {
                        setStudentId(savedId);
                    } else if (!savedId && list.length > 0) {
                        setStudentId(list[0]);
                    }
                }
            });
        });
    }, []);

    // 최근값 저장
    useEffect(() => { if (studentId) localStorage.setItem('lastStudentId', studentId); }, [studentId]);
    useEffect(() => { localStorage.setItem('lastGrade', String(selectedGrade)); }, [selectedGrade]);
    useEffect(() => { localStorage.setItem('lastTerm', String(selectedTerm)); }, [selectedTerm]);

    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

    const currentCurriculum = useMemo(() => {
        return curriculum.find(c => c.grade === selectedGrade && c.term === selectedTerm);
    }, [selectedGrade, selectedTerm]);

    const chapters = currentCurriculum?.chapters || [];

    // ── 붙여넣기 이벤트 (이미지가 있을 때만 실행) ───────────────────────────
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) handleNewImage(blob);
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, []);

    const handleNewImage = async (file: File) => {
        setFile(file);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        // ★ 이미지가 있을 때만 AI 분석 실행
        setIsAnalyzing(true);
        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    if (result.includes(',')) {
                        resolve(result.split(',')[1]);
                    } else {
                        resolve(result);
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const result = await analyzeImage(base64);
            console.log("Client Received Analysis:", result);

            if (result.success) {
                setProblemLevel(result.data.problemLevel);
                setQuestionType(result.data.questionType);

                // ★ AI 추론 결과는 사용자가 아직 선택하지 않은 경우에만 자동 적용
                // 사용자 수동 선택이 우선 — 덮어쓰기 방지
                if (!errorType && result.data.errorTypeValue) {
                    setErrorType(result.data.errorTypeValue);
                    setErrorTypeError(false);
                }
            } else {
                alert(result.error);
            }
        } catch (error: any) {
            console.error("Analysis failed:", error);
            alert(error.message || "AI 분석 중 오류가 발생했습니다.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) handleNewImage(selectedFile);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        // ★ 필수 입력: 오답 원인이 선택되지 않으면 저장 차단
        if (!errorType) {
            setErrorTypeError(true);
            // 오답 원인 섹션으로 스크롤
            document.getElementById('error-type-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        let imagePayload = {};

        if (file) {
            console.log("Processing file:", file.name, file.size, file.type);
            try {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result as string;
                        if (result.includes(',')) {
                            const base64Data = result.split(',')[1];
                            resolve(base64Data);
                        } else {
                            reject(new Error("Invalid Data URL format"));
                        }
                    };
                    reader.onerror = (e) => reject(reader.error || e);
                    reader.readAsDataURL(file);
                });

                console.log("Base64 conversion successful, length:", base64.length);

                imagePayload = {
                    imageBase64: base64,
                    imageName: file.name,
                    imageType: file.type
                };
            } catch (error) {
                console.error("Image processing failed:", error);
                alert(`이미지 변환 중 오류가 발생했습니다: ${error}`);
                return;
            }
        }

        try {
            await saveWrongAnswer({
                studentId: studentId || 'unknown',
                date,
                grade: selectedGrade,
                term: selectedTerm,
                chapter: selectedChapter,
                problemLevel,
                questionType,
                errorType,   // ★ 오답 원인 추가
                memo,
                ...imagePayload
            });
            alert('오답 노트가 저장되었습니다!');

            // 폼 초기화 (학생/학년/학기는 유지)
            setMemo('');
            setFile(null);
            setPreviewUrl(null);
            setErrorType('');
            setErrorTypeError(false);
            setSelectedChapter('');
        } catch (error) {
            console.error('Save failed:', error);
            alert('저장에 실패했습니다.');
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4 bg-white shadow-md rounded-lg mt-6">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">오답 노트 입력</h1>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* 날짜 및 학생 */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 border p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">학생 이름</label>
                        <select
                            value={studentId}
                            onChange={(e) => setStudentId(e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 border p-2"
                        >
                            <option value="">학생 선택</option>
                            {studentList.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">* 구글 시트 'Students' 탭에서 관리</p>
                    </div>
                </div>

                {/* 교육과정 선택 */}
                <div className="bg-gray-50 p-4 rounded-md space-y-3 border border-gray-200">
                    <h2 className="font-semibold text-gray-700 border-b pb-2">교육과정 선택</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
                            <select
                                value={selectedGrade}
                                onChange={(e) => { setSelectedGrade(Number(e.target.value)); setSelectedChapter(''); }}
                                className="w-full border-gray-300 rounded-md shadow-sm border p-2"
                            >
                                {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>{g}학년</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">학기</label>
                            <select
                                value={selectedTerm}
                                onChange={(e) => { setSelectedTerm(Number(e.target.value)); setSelectedChapter(''); }}
                                className="w-full border-gray-300 rounded-md shadow-sm border p-2"
                            >
                                <option value={1}>1학기</option>
                                <option value={2}>2학기</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">단원</label>
                        <select
                            value={selectedChapter}
                            onChange={(e) => setSelectedChapter(e.target.value)}
                            className="w-full border-gray-300 rounded-md shadow-sm border p-2"
                            required
                        >
                            <option value="">단원 선택</option>
                            {chapters.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* 난이도 & 문제 유형 (AI 분석 결과 반영) */}
                <div className="grid grid-cols-2 gap-4 relative">
                    {isAnalyzing && (
                        <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center rounded-md">
                            <span className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-semibold shadow animate-pulse">
                                AI 분석 중...
                            </span>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            난이도 {isAnalyzing && <span className="text-xs text-indigo-500 animate-pulse">(분석 중)</span>}
                        </label>
                        <select
                            value={problemLevel}
                            onChange={(e) => setProblemLevel(e.target.value as ProblemLevel)}
                            className="w-full border-gray-300 rounded-md shadow-sm border p-2 transition-colors duration-300"
                            style={{ borderColor: isAnalyzing ? '#6366f1' : '#d1d5db' }}
                        >
                            <option value="Low">하</option>
                            <option value="Mid">중</option>
                            <option value="High">상</option>
                            <option value="Top">최상</option>
                        </select>
                    </div>
                    <div>
                        {/* ★ 문제 유형: 절대 삭제 금지 */}
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            문제 유형 {isAnalyzing && <span className="text-xs text-indigo-500 animate-pulse">(분석 중)</span>}
                        </label>
                        <select
                            value={questionType}
                            onChange={(e) => setQuestionType(e.target.value as QuestionType)}
                            className="w-full border-gray-300 rounded-md shadow-sm border p-2 transition-colors duration-300"
                            style={{ borderColor: isAnalyzing ? '#6366f1' : '#d1d5db' }}
                        >
                            <option value="Concept">개념</option>
                            <option value="Computation">계산</option>
                            <option value="Application">응용</option>
                            <option value="ProblemSolving">문제해결</option>
                        </select>
                    </div>
                </div>

                {/* ★ 오답 원인 — 버튼형 필수 입력 */}
                <div id="error-type-section" className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        오답 원인
                        <span className="ml-1 text-red-500 font-bold">★ 필수</span>
                        {isAnalyzing && (
                            <span className="ml-2 text-xs text-indigo-500 animate-pulse">(AI 분석 중...)</span>
                        )}
                    </label>

                    <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg border-2 transition-colors ${
                        errorTypeError
                            ? 'border-red-400 bg-red-50'
                            : errorType
                                ? 'border-indigo-200 bg-indigo-50/30'
                                : 'border-gray-200 bg-gray-50'
                    }`}>
                        {ERROR_TYPE_OPTIONS.map((item) => {
                            const isSelected = errorType === item.value;
                            return (
                                <button
                                    key={item.code}
                                    type="button"
                                    onClick={() => {
                                        setErrorType(item.value);
                                        setErrorTypeError(false);
                                    }}
                                    style={{ minHeight: '48px' }}
                                    className={`
                                        w-full px-3 py-2 rounded-lg text-sm font-medium
                                        transition-all duration-150 ease-in-out
                                        flex items-center justify-center text-center
                                        ${isSelected
                                            ? 'bg-indigo-600 text-white shadow-md scale-[1.02] border-2 border-indigo-700'
                                            : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                                        }
                                    `}
                                >
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* 유효성 검사 에러 메시지 */}
                    {errorTypeError && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                            <span>⚠️</span>
                            오답 원인을 선택해주세요. 이 항목은 필수입니다.
                        </p>
                    )}
                    {errorType && (
                        <p className="text-xs text-indigo-600">
                            선택됨: {ERROR_TYPE_OPTIONS.find(i => i.value === errorType)?.label}
                        </p>
                    )}
                </div>

                {/* 이미지 업로드 (선택) */}
                <div
                    className="border-2 border-dashed border-gray-300 rounded-md p-6 flex flex-col items-center justify-center bg-gray-50 text-gray-500 hover:bg-gray-100 transition cursor-pointer relative"
                    onClick={() => document.getElementById('file-upload')?.click()}
                >
                    <input
                        id="file-upload"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageChange}
                    />

                    {previewUrl ? (
                        <div className="relative w-full h-64">
                            <img
                                src={previewUrl}
                                alt="Preview"
                                className="w-full h-full object-contain rounded-md"
                            />
                            <button
                                type="button"
                                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-70 hover:opacity-100"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setFile(null);
                                    setPreviewUrl(null);
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <>
                            <span className="text-3xl mb-2">📷</span>
                            <span className="text-center">
                                클릭해서 이미지 업로드<br />
                                <span className="text-xs text-gray-400">(선택) 이미지를 복사하여 Ctrl+V도 가능</span>
                            </span>
                        </>
                    )}
                </div>

                {/* 메모 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                    <textarea
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        rows={3}
                        className="w-full border-gray-300 rounded-md shadow-sm border p-2"
                        placeholder="추가 메모를 입력하세요..."
                    />
                </div>

                <button
                    type="submit"
                    className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition font-semibold text-base"
                >
                    저장하기
                </button>
            </form>
        </div>
    );
}

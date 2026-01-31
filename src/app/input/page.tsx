"use client";

import { useState, useMemo, ChangeEvent, FormEvent, useEffect } from 'react';
import { curriculum } from '../../data/curriculum';
import { ProblemLevel, QuestionType } from '../../types';
import { analyzeImage } from '../actions/analyze';
import { saveWrongAnswer } from '../actions/wrongAnswer';

export default function InputPage() {
    const [selectedGrade, setSelectedGrade] = useState<number>(1);
    const [selectedTerm, setSelectedTerm] = useState<number>(1);
    const [selectedChapter, setSelectedChapter] = useState<string>('');
    const [problemLevel, setProblemLevel] = useState<ProblemLevel>('Mid');
    const [questionType, setQuestionType] = useState<QuestionType>('Computation');
    const [memo, setMemo] = useState<string>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Student ID Management
    const [studentId, setStudentId] = useState<string>('');
    const [studentList, setStudentList] = useState<string[]>([]);

    useEffect(() => {
        // Fetch students from server (GAS)
        import('../actions/wrongAnswer').then(({ getStudentsList }) => {
            getStudentsList().then(list => {
                if (list.length > 0) {
                    setStudentList(list);
                    // If previously saved ID exists in the list, use it
                    const savedId = localStorage.getItem('lastStudentId');
                    if (savedId && list.includes(savedId)) {
                        setStudentId(savedId);
                    } else if (!savedId && list.length > 0) {
                        // Default to first student if no saved ID
                        setStudentId(list[0]);
                    }
                }
            });
        });
    }, []);

    useEffect(() => {
        if (studentId) localStorage.setItem('lastStudentId', studentId);
    }, [studentId]);

    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

    const currentCurriculum = useMemo(() => {
        return curriculum.find(c => c.grade === selectedGrade && c.term === selectedTerm);
    }, [selectedGrade, selectedTerm]);

    const chapters = currentCurriculum?.chapters || [];

    // Paste Event Listener
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        handleNewImage(blob);
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, []);

    const handleNewImage = (file: File) => {
        setFile(file);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);

        // Analysis feature is temporarily disabled during migration
        // setIsAnalyzing(true);
        // ...
    };

    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            handleNewImage(selectedFile);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        let imagePayload = {};

        // Convert file to Base64 if exists
        if (file) {
            console.log("Processing file:", file.name, file.size, file.type);
            try {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const result = reader.result as string;
                        // Data URL format: "data:image/png;base64,....."
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
        } else {
            console.log("No file selected.");
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
                memo,
                ...imagePayload
            });
            alert('오답 노트가 저장되었습니다!'); // Now saving to Google Sheet!

            // Reset form
            setMemo('');
            setFile(null);
            setPreviewUrl(null);
        } catch (error) {
            console.error('Save failed:', error);
            alert('저장에 실패했습니다.');
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">오답 노트 입력</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">학생 이름 (선택)</label>
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
                <div className="bg-gray-50 p-4 rounded-md space-y-4 border border-gray-200">
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

                {/* 상세 정보 (AI 분석 결과) */}
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

                {/* 이미지 업로드 */}
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
                                    // Reset analysis if image removed? Optional.
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <>
                            <span className="text-3xl mb-2">📷</span>
                            <span className="text-center">클릭해서 이미지 업로드<br />(또는 이미지를 복사하여 Ctrl+V)</span>
                        </>
                    )}
                </div>

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
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition font-medium"
                >
                    오답 저장하기
                </button>
            </form>
        </div>
    );
}

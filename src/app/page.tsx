import Link from "next/link";

export default function Home() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
            <h1 className="text-4xl font-bold text-indigo-600">수학 오답 관리 시스템</h1>
            <p className="text-xl text-gray-600">학생들의 오답을 기록하고 분석하세요.</p>

            <div className="flex gap-4">
                <Link
                    href="/input"
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition font-semibold"
                >
                    오답 입력하기
                </Link>
                <div className="flex gap-4">
                    <Link
                        href="/analysis"
                        className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
                    >
                        📊 분석 보러가기
                    </Link>
                    <Link
                        href="/print"
                        className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5"
                    >
                        🖨️ 오답 노트 만들기
                    </Link>
                </div>
            </div>
        </div>
    );
}

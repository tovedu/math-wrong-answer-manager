/**
 * 오답 원인(error_type) 상수 중앙 관리 파일
 *
 * ★ Single Source of Truth
 * 이 파일의 값을 UI 렌더링, 저장 페이로드, 분석 집계 모두에서 사용합니다.
 * 동일한 값을 다른 파일에 하드코딩하지 마세요.
 */

/** 오답 원인 코드 타입 (집계 기준값) */
export type ErrorTypeCode = '계' | '개' | '문' | '논' | '식' | '응';

/** 오답 원인 항목 인터페이스 */
export interface ErrorTypeItem {
    /** 집계 기준 코드 (한 글자) */
    code: ErrorTypeCode;
    /** UI 표시 풀네임 */
    label: string;
    /** Google Sheets 저장값: "[코드]|[풀네임]" (구분자 | 변경 불가) */
    value: string;
}

/**
 * 오답 원인 옵션 배열 — 유일한 진실의 원천
 *
 * - UI 버튼 렌더링: ERROR_TYPE_OPTIONS.map(item => ...)
 * - 저장 페이로드: item.value 그대로 전송
 * - 분석 집계: item.code 기준으로 카운트
 */
export const ERROR_TYPE_OPTIONS: ErrorTypeItem[] = [
    { code: '계', label: '계산 실수',       value: '계|계산 실수'       },
    { code: '개', label: '개념 부족',       value: '개|개념 부족'       },
    { code: '문', label: '문해력 부족',     value: '문|문해력 부족'     },
    { code: '논', label: '논리/추론',       value: '논|논리/추론'       },
    { code: '식', label: '식 정리/변형 오류', value: '식|식 정리/변형 오류' },
    { code: '응', label: '개념 응용 실패',  value: '응|개념 응용 실패'  },
];

/**
 * 코드로 항목 찾기 헬퍼
 * @example getErrorTypeByCode('개') → { code: '개', label: '개념 부족', value: '개|개념 부족' }
 */
export const getErrorTypeByCode = (code: string): ErrorTypeItem | undefined =>
    ERROR_TYPE_OPTIONS.find(item => item.code === code);

/**
 * value 문자열로 항목 찾기 헬퍼 (저장값 → 라벨 복원 시 사용)
 * @example getErrorTypeByValue('개|개념 부족') → { code: '개', label: '개념 부족', ... }
 */
export const getErrorTypeByValue = (value: string): ErrorTypeItem | undefined =>
    ERROR_TYPE_OPTIONS.find(item => item.value === value);

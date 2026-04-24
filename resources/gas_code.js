/**
 * TOV 오답 기록 시스템 - Google Apps Script 서버 코드
 *
 * ★ 데이터 저장 컬럼 순서 (헤더 행 기준):
 *   A: id
 *   B: date (날짜)
 *   C: studentId (학생명)
 *   D: grade (학년)
 *   E: term (학기)
 *   F: chapter (단원명)
 *   G: problemLevel (난이도)
 *   H: questionType (문제 유형)
 *   I: errorType (오답 원인 - "[코드]|[풀네임]" 형식)  ← 신규 추가
 *   J: imageUrl (이미지 URL)
 *   K: memo (메모)
 *   L: isResolved (해결 여부)
 *   M: createdAt (입력 시각)
 *
 * ★ error_type 저장 형식: "[코드]|[풀네임]" (구분자 | 변경 불가)
 *    예: "개|개념 부족", "계|계산 실수"
 *
 * ★ 기존 데이터 호환:
 *    errorType 컬럼이 비어 있는 기존 행도 오류 없이 읽을 수 있도록 처리됨.
 */

const SHEET_NAME = 'wrongAnswers';
const STUDENTS_SHEET_NAME = 'students';
const DRIVE_FOLDER_NAME = 'TOV_WrongAnswers_Images';

// ───────────────────────────────────────────────────────────
// HTTP GET 핸들러
// ───────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'get_answers') {
      return handleGetAnswers();
    } else if (action === 'get_students') {
      return handleGetStudents();
    } else {
      return jsonResponse({ status: 'error', message: 'Unknown GET action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ───────────────────────────────────────────────────────────
// HTTP POST 핸들러
// ───────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const payload = body.payload;

    if (action === 'save_answer') {
      return handleSaveAnswer(payload);
    } else if (action === 'update_status') {
      return handleUpdateStatus(payload);
    } else {
      return jsonResponse({ status: 'error', message: 'Unknown POST action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ───────────────────────────────────────────────────────────
// 오답 저장
// ───────────────────────────────────────────────────────────
function handleSaveAnswer(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  // 시트가 없으면 생성 + 헤더 추가
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'id', 'date', 'studentId', 'grade', 'term', 'chapter',
      'problemLevel', 'questionType', 'errorType',
      'imageUrl', 'memo', 'isResolved', 'createdAt'
    ]);
  }

  // 이미지 처리 (선택)
  let imageUrl = '';
  if (payload.imageBase64 && payload.imageName) {
    try {
      imageUrl = saveImageToDrive(payload.imageBase64, payload.imageName, payload.imageType || 'image/jpeg');
    } catch (imgErr) {
      console.error('Image save failed:', imgErr);
      // 이미지 저장 실패해도 데이터는 저장 진행
    }
  }

  // errorType: 없으면 빈 문자열 (기존 데이터 호환)
  const errorType = payload.errorType || '';

  const row = [
    payload.id || Utilities.getUuid(),
    payload.date || new Date().toISOString().split('T')[0],
    payload.studentId || '',
    payload.grade || '',
    payload.term || '',
    payload.chapter || '',
    payload.problemLevel || 'Mid',
    payload.questionType || '',
    errorType,            // ← 오답 원인 ([코드]|[풀네임])
    imageUrl,
    payload.memo || '',
    payload.isResolved ? 'TRUE' : 'FALSE',
    new Date().toISOString()
  ];

  sheet.appendRow(row);

  return jsonResponse({
    status: 'success',
    savedData: {
      id: row[0],
      errorType: errorType
    }
  });
}

// ───────────────────────────────────────────────────────────
// 오답 목록 조회
// ───────────────────────────────────────────────────────────
function handleGetAnswers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return jsonResponse({ status: 'success', data: [] });
  }

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return jsonResponse({ status: 'success', data: [] });
  }

  // 헤더 행 파싱 (컬럼 위치를 이름으로 찾아서 유연하게 처리)
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const idx = (name) => headers.indexOf(name);

  // 컬럼 인덱스
  const COL = {
    id:            idx('id'),
    date:          idx('date'),
    studentId:     idx('studentid'),
    grade:         idx('grade'),
    term:          idx('term'),
    chapter:       idx('chapter'),
    problemLevel:  idx('problemlevel'),
    questionType:  idx('questiontype'),
    errorType:     idx('errortype'),   // ← 새 컬럼
    imageUrl:      idx('imageurl'),
    memo:          idx('memo'),
    isResolved:    idx('isresolved'),
    createdAt:     idx('createdat'),
  };

  const answers = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[COL.id]) continue; // 빈 행 스킵

    answers.push({
      id:           String(row[COL.id] || ''),
      date:         String(row[COL.date] || ''),
      studentId:    String(row[COL.studentId] || ''),
      grade:        Number(row[COL.grade] || 0),
      term:         Number(row[COL.term] || 0),
      chapter:      String(row[COL.chapter] || ''),
      problemLevel: String(row[COL.problemLevel] || 'Mid'),
      questionType: String(row[COL.questionType] || ''),
      // ★ errorType: 없으면 빈 문자열 반환 (null 방지, 기존 데이터 호환)
      errorType:    COL.errorType >= 0 ? String(row[COL.errorType] || '') : '',
      imageUrl:     String(row[COL.imageUrl] || ''),
      memo:         String(row[COL.memo] || ''),
      isResolved:   String(row[COL.isResolved]).toUpperCase() === 'TRUE',
      createdAt:    String(row[COL.createdAt] || ''),
    });
  }

  return jsonResponse({ status: 'success', data: answers });
}

// ───────────────────────────────────────────────────────────
// 해결 상태 업데이트
// ───────────────────────────────────────────────────────────
function handleUpdateStatus(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return jsonResponse({ status: 'error', message: 'Sheet not found' });
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());
  const idCol = headers.indexOf('id');
  const resolvedCol = headers.indexOf('isresolved');

  if (idCol < 0 || resolvedCol < 0) {
    return jsonResponse({ status: 'error', message: 'Required columns not found' });
  }

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(payload.id)) {
      sheet.getRange(i + 1, resolvedCol + 1).setValue(payload.isResolved ? 'TRUE' : 'FALSE');
      return jsonResponse({ status: 'success' });
    }
  }

  return jsonResponse({ status: 'error', message: 'Record not found: ' + payload.id });
}

// ───────────────────────────────────────────────────────────
// 학생 목록 조회 (students 시트)
// ───────────────────────────────────────────────────────────
function handleGetStudents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(STUDENTS_SHEET_NAME);

  if (!sheet) {
    return jsonResponse({ status: 'success', data: [] });
  }

  const data = sheet.getDataRange().getValues();
  // A열 기준, 첫 번째 행은 헤더("학생명")로 스킵
  const students = data
    .slice(1)
    .map(row => String(row[0] || '').trim())
    .filter(name => name.length > 0);

  return jsonResponse({ status: 'success', data: students });
}

// ───────────────────────────────────────────────────────────
// 이미지를 Google Drive에 저장하고 공개 URL 반환
// ───────────────────────────────────────────────────────────
function saveImageToDrive(base64Data, fileName, mimeType) {
  // Base64 디코딩
  const decodedData = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decodedData, mimeType, fileName);

  // 저장할 폴더 찾기 또는 생성
  let folder;
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
  }

  // 파일 저장
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // 직접 접근 URL 반환 (임베드용)
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

// ───────────────────────────────────────────────────────────
// 유틸 — JSON 응답 생성
// ───────────────────────────────────────────────────────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

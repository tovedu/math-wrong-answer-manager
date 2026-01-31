// Google Apps Script Code for Math Wrong Answer Manager

// 1. 초기 설정
const FOLDER_NAME = "오답노트_이미지"; // Google Drive에 생성될 폴더 이름
const SHEET_NAME = "DB"; // 데이터를 저장할 시트 이름

function setup() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. 시트 생성 및 헤더 설정 (DB)
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        // 헤더 추가
        sheet.appendRow([
            "ID", "Date", "Student ID", "Grade", "Term", "Chapter",
            "Level", "Type", "Memo", "Image URL", "Is Resolved", "Created At"
        ]);
        // 헤더 스타일링
        sheet.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#f3f3f3");
        sheet.setFrozenRows(1);
    }

    // 2. 학생 목록 시트 생성 (Students)
    let studentSheet = ss.getSheetByName("Students");
    if (!studentSheet) {
        studentSheet = ss.insertSheet("Students");
        studentSheet.appendRow(["Student Name"]); // 헤더
        studentSheet.appendRow(["홍길동"]); // 예시 데이터
        studentSheet.appendRow(["김철수"]);
        studentSheet.getRange(1, 1).setFontWeight("bold").setBackground("#e6f7ff");
    }

    // 3. 이미지 저장용 드라이브 폴더 확인/생성
    const folders = DriveApp.getFoldersByName(FOLDER_NAME);
    if (!folders.hasNext()) {
        DriveApp.createFolder(FOLDER_NAME);
    }
}

// 2. API 요청 처리 (GET) - 데이터 조회
function doGet(e) {
    const action = e.parameter.action;

    if (action === "get_answers") {
        return getWrongAnswers(e.parameter);
    }

    if (action === "get_students") {
        return getStudents();
    }

    return responseJSON({ status: "error", message: "Invalid action" });
}

// 3. API 요청 처리 (POST) - 데이터 저장
function doPost(e) {
    try {
        const data = JSON.parse(e.postData.contents);
        const action = data.action;

        if (action === "save_answer") {
            return saveWrongAnswer(data.payload);
        }

        return responseJSON({ status: "error", message: "Invalid action" });
    } catch (error) {
        return responseJSON({ status: "error", message: error.toString() });
    }
}

// --- Helper Functions ---

function getStudents() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Students");

    // 시트가 없으면 생성하고 기본값 추가
    if (!sheet) {
        sheet = ss.insertSheet("Students");
        sheet.appendRow(["Student Name"]);
        sheet.appendRow(["홍길동"]);
        sheet.appendRow(["김철수"]);
    }

    const data = sheet.getDataRange().getValues();
    // 첫 번째 줄(헤더) 제외하고 첫 번째 컬럼만 가져옴
    const students = data.slice(1).map(row => row[0]).filter(name => name !== "");

    return responseJSON({ status: "success", data: students });
}

function getWrongAnswers(params) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    // JSON 객체로 변환
    let answers = rows.map(row => {
        return {
            id: row[0],
            date: formatDate(row[1]), // Date 객체일 수 있으므로 포맷
            studentId: row[2],
            grade: row[3],
            term: row[4],
            chapter: row[5],
            problemLevel: row[6],
            questionType: row[7],
            memo: row[8],
            imageUrl: row[9],
            isResolved: row[10] === true || row[10] === "TRUE"
        };
    });

    // 필터링 (선택적)
    if (params.studentId) answers = answers.filter(a => a.studentId === params.studentId);
    if (params.chapter && params.chapter !== '전체') answers = answers.filter(a => a.chapter === params.chapter);
    // 날짜 필터 등 추가 가능하지만, 일단 전체 데이터를 내려주고 프론트에서 필터링하는 게 유연함 (데이터 양이 적을 때)

    return responseJSON({ status: "success", data: answers });
}

function saveWrongAnswer(payload) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    // 이미지 처리 (Base64 -> Drive File)
    let publicImageUrl = "";
    if (payload.imageBase64) {
        const folder = getFolder();
        const blob = Utilities.newBlob(Utilities.base64Decode(payload.imageBase64), payload.imageType, payload.imageName);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        // 썸네일 링크가 아닌 다운로드용 링크나 보기용 링크 사용
        // 보통 webContentLink나 thumbnailLink를 사용하지만, 직접 접근 가능한 ID 기반 링크 사용
        // ID: file.getId() -> https://lh3.googleusercontent.com/d/{ID} 형식은 인증 필요없는 경우가 많음 (CDN)
        // 혹은 https://drive.google.com/uc?id={ID}
        publicImageUrl = `https://drive.google.com/uc?export=view&id=${file.getId()}`;
    }

    const newRow = [
        payload.id,
        payload.date,
        payload.studentId,
        payload.grade,
        payload.term,
        payload.chapter,
        payload.problemLevel,
        payload.questionType,
        payload.memo,
        publicImageUrl,
        false, // isResolved
        new Date() // Created At
    ];

    sheet.appendRow(newRow);

    return responseJSON({ status: "success", message: "Saved successfully", savedData: payload });
}

function getFolder() {
    const folders = DriveApp.getFoldersByName(FOLDER_NAME);
    if (folders.hasNext()) return folders.next();
    return DriveApp.createFolder(FOLDER_NAME);
}

function responseJSON(data) {
    return ContentService.createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
}

function formatDate(date) {
    if (!date) return "";
    if (date instanceof Date) {
        return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    return date;
}

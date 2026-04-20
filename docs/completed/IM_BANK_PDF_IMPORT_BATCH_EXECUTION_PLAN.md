# IM뱅크 PDF 거래내역 업로드 배치 실행 계획

> 보관 상태: `2026-04-20` 기준 IM뱅크 PDF 파일 첨부 업로드 배치 1차 범위를 구현하고 검증한 뒤 `docs/completed/`로 이동했다. 현재 운영 기준은 `docs/API.md`, `docs/CURRENT_CAPABILITIES.md`, `docs/VALIDATION_NOTES.md`, Web `/imports`, API `/import-batches/files`를 우선한다.

## 완료 메모

2026-04-20 기준 이 실행계획의 저장소 내부 구현 범위는 완료 상태다.

- `IM_BANK_PDF` 원본 형식, multipart 파일 업로드 API, IM뱅크 PDF 파서, 등록 계좌/카드 연결, 업로드 배치 그리드 표시를 반영했다.
- 실제 샘플 PDF `거래내역조회_20260419124300843.pdf` 기준 565행이 `COMPLETED`/`PARSED`로 생성되는 것을 확인했다.
- 대량 행 저장은 Prisma `createMany`로 전환해 트랜잭션 timeout을 방지했고, 한글 파일명 UTF-8 복구 보정도 추가했다.
- `npm.cmd run test --workspace @personal-erp/api`, `npm.cmd run check:quick`, 실제 `/import-batches/files` 업로드 검증을 통과했다.

## 목적

IM뱅크(대구은행)에서 내려받은 거래내역 PDF를 업로드 배치 등록 화면에서 파일로 첨부하고, `배치 생성`을 누르면 프로젝트의 `ImportBatch`와 `ImportedRow` 구조에 맞게 변환해 업로드 배치 그리드에 추가한다.

현재 업로드 배치는 `POST /import-batches`에 `sourceKind`, `fileName`, `content`를 JSON으로 보내고, 서버가 UTF-8 CSV/TSV 텍스트를 파싱하는 구조다. 이번 확장은 기존 붙여넣기 흐름은 유지하면서, PDF 바이너리 파일을 서버에서 안전하게 읽어 거래 후보 행으로 변환하는 별도 경로를 추가하는 것이 핵심이다.

## 샘플 PDF 분석 결과

첨부된 IM뱅크 거래내역 PDF는 스캔 이미지가 아니라 텍스트 레이어가 있는 PDF다. PDF 내부에 `ToUnicode` CMap과 한글 폰트가 포함되어 있어 OCR 없이도 텍스트 추출이 가능하지만, 단순 문자열 순서만으로는 빈 컬럼과 월별 안내 문구를 구분하기 어렵다. 따라서 거래 행 파싱은 반드시 텍스트 좌표를 함께 사용해야 한다.

확인한 주요 구조는 다음과 같다.

| 항목           | 분석 결과                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------ |
| 문서 형식      | PDF 1.4, 텍스트 레이어 포함                                                                |
| 페이지 수      | 11페이지                                                                                   |
| 거래 행 수     | 565행                                                                                      |
| 조회 범위      | 2024-04-19 ~ 2026-04-19                                                                    |
| 정렬           | 최신 거래가 먼저 나오는 역순                                                               |
| 출금/입금 구성 | 출금 488행, 입금 77행                                                                      |
| 제목 공백 행   | 비고/메모/거래점이 모두 빈 행 8건 존재                                                     |
| 개인정보       | 고객명, 계좌번호, 현재잔액이 헤더에 포함됨. 원문을 로그/문서/테스트 fixture에 남기면 안 됨 |

표 컬럼은 다음 순서로 반복된다.

| PDF 컬럼     | 프로젝트 변환 후보                                        |
| ------------ | --------------------------------------------------------- |
| `NO`         | `rawPayload.original.statementRowNo`                      |
| `거래일시`   | `parsed.occurredOn`, `parsed.occurredAt`                  |
| `거래종류`   | `rawPayload.original.transactionType`                     |
| `찾으신금액` | `rawPayload.original.withdrawalAmount`, 출금 방향 판정    |
| `맡기신금액` | `rawPayload.original.depositAmount`, 입금 방향 판정       |
| `거래후잔액` | `rawPayload.original.balanceAfter`, `parsed.balanceAfter` |
| `비고`       | `parsed.title`의 1순위                                    |
| `메모`       | `parsed.title` 보조값 또는 원문 메모                      |
| `거래점`     | `parsed.title` 보조값 또는 원문 거래점                    |

월별 `영플러스통장 수수료 면제가능 횟수` 안내는 거래가 아니라 메모 컬럼에 끼어 있는 안내 문구다. 이 문구는 행 제목으로 사용하지 않고 `rawPayload.original.statementNotice` 또는 배치 메타데이터로만 보존하거나, 첫 구현에서는 무시한다.

## 목표 UX

업로드 배치 등록 흐름은 다음처럼 정리한다.

1. `/imports` 또는 `/imports/[batchId]`에서 `업로드 배치 등록`을 누른다.
2. 원본 형식에서 `IM뱅크 PDF` 또는 `계좌 PDF`를 선택한다.
3. 등록된 활성 계좌/카드 자금수단 중 이 PDF 거래가 발생한 대상을 선택한다.
4. `파일 첨부`에 PDF를 선택하면 파일명은 자동 입력되고, 붙여넣기 본문 입력은 비활성화된다.
5. `배치 생성`을 누르면 서버가 선택된 자금수단을 검증한 뒤 PDF를 파싱한다.
6. 성공 시 기존 동작처럼 drawer를 닫고, `GET /import-batches`를 갱신하고, 새 배치를 선택한다.
7. 업로드 배치 그리드는 파일명, 연결 계좌/카드, 원본 종류, 읽기 상태, 행 수를 바로 보여준다.
8. 업로드 행 작업대는 기존 collect-preview/collect 흐름을 그대로 사용하되, PDF에서 나온 `거래일`, `설명`, `금액`, `입출금 방향`, `거래후잔액`을 검토에 활용한다.

추천 설정은 "한 파일은 하나의 원본 배치" 원칙이다. 샘플 PDF처럼 2년치 거래가 들어 있어도 배치는 전체 565행을 보관하고, 작업대에서 현재 운영월/기간 필터로 검토 범위를 좁히는 방식이 추적성과 재업로드 판정에 가장 깔끔하다.

## 데이터 변환 규칙

PDF 한 행은 기존 `ImportedRow.rawPayload`의 `original`/`parsed` 구조를 유지하면서 확장한다.

```ts
type ImBankPdfImportedRowPayload = {
  original: {
    bank: 'IM_BANK_DAEGU';
    statementRowNo: number;
    occurredAtText: string;
    transactionType: string | null;
    withdrawalAmountText: string;
    depositAmountText: string;
    balanceAfterText: string;
    remarks: string | null;
    memo: string | null;
    branch: string | null;
  };
  parsed: {
    occurredOn: string;
    occurredAt: string;
    title: string;
    amount: number;
    direction: 'WITHDRAWAL' | 'DEPOSIT';
    signedAmount: number;
    balanceAfter: number;
    sourceOrigin: string;
  };
};
```

기존 화면과 collect 유스케이스는 `parsed.occurredOn`, `parsed.title`, `parsed.amount`를 읽고 있으므로 이 3개 필드는 반드시 유지한다. PDF 전용 부가 필드는 선택적으로 표시한다.

금액 규칙은 다음처럼 둔다.

| 조건                               | 변환                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `찾으신금액 > 0`, `맡기신금액 = 0` | `direction = WITHDRAWAL`, `amount = 찾으신금액`, `signedAmount = -찾으신금액` |
| `찾으신금액 = 0`, `맡기신금액 > 0` | `direction = DEPOSIT`, `amount = 맡기신금액`, `signedAmount = 맡기신금액`     |
| 둘 다 0 또는 둘 다 양수            | 행 단위 `FAILED` 처리                                                         |
| 제목 후보가 모두 공백              | `IM뱅크 입금` 또는 `IM뱅크 출금` 같은 fallback 제목 생성                      |

중복 판정용 `sourceFingerprint`는 기존 `날짜 + 금액 + 설명`만 쓰면 입금/출금 방향과 잔액 정보가 빠져 충돌 가능성이 있다. PDF 행은 `sourceKind`, 은행 코드, 계좌 식별 해시, 거래일시, 출금액, 입금액, 거래후잔액, 정규화 제목을 함께 사용한 `sf:v2` 기준으로 만든다. 원본 파일 전체 중복은 별도로 raw bytes의 SHA-256 `fileHash`로 판정한다.

## 백엔드 구현 계획

### 1. 계약과 스키마 확장

- `packages/contracts/src/imports.ts`의 `ImportSourceKind`에 `BANK_PDF` 또는 `IM_BANK_PDF`를 추가한다.
- Prisma `ImportSourceKind` enum에도 같은 값을 추가하고 migration을 만든다.
- `ImportBatch`에 `fundingAccountId`를 추가해 프로젝트의 등록 계좌/카드와 배치를 연결한다.
- `ImportBatch`에 배치 수준 메타데이터가 필요하면 `sourceMetadata Json?`를 추가한다.
- 메타데이터에는 은행 코드, PDF 조회기간, 원본 총 행 수, 파서 프로필, 계좌번호 원문이 아닌 계좌 식별 해시만 보관한다.
- 기존 JSON 붙여넣기 API는 깨지지 않게 유지한다.

### 2. 파일 업로드 엔드포인트 추가

권장 엔드포인트는 기존 JSON API와 분리한 `POST /import-batches/files`다. 요청은 `multipart/form-data(sourceKind, fundingAccountId, file)` 형태이며, `fundingAccountId`는 활성 계좌/카드 자금수단이어야 한다.

- 요청 형식은 `multipart/form-data`로 둔다.
- 필드는 `sourceKind`, `parserProfile`, `file`을 받는다.
- `file`은 memory storage로 받고, 첫 구현에서는 원본 PDF를 DB나 로컬 디스크에 저장하지 않는다.
- 파일 해시는 UTF-8 텍스트가 아니라 raw bytes 기준 SHA-256으로 계산한다.
- 성공 응답은 기존과 동일한 `ImportBatchItem`을 반환해 Web 갱신 로직을 재사용한다.

기존 `POST /import-batches`는 `content` 기반 CSV/TSV 업로드를 계속 담당한다. 이렇게 분리하면 DTO validation, Swagger 설명, 테스트가 단순하고, 파일첨부 보안 정책도 명확해진다.

### 3. 파서 구조 분리

현재 `parseImportBatchContent`는 구분자 텍스트 파싱과 행 변환을 한 함수에서 처리한다. PDF까지 들어오면 다음처럼 parser registry로 나누는 것이 유지보수에 좋다.

```ts
interface ImportBatchParser {
  supports(input: ImportBatchParseInput): boolean;
  parse(input: ImportBatchParseInput): Promise<ParsedImportBatchDraft>;
}
```

구현체는 다음처럼 둔다.

- `DelimitedImportBatchParser`: 기존 `BANK_CSV`, `CARD_EXCEL`, `MANUAL_UPLOAD` 담당
- `ImBankPdfStatementParser`: IM뱅크 PDF 담당
- `ImportBatchParserRegistry`: `sourceKind`와 파일 MIME/signature를 보고 적절한 parser 선택

### 4. IM뱅크 PDF 파서

PDF 파서는 `pdfjs-dist`처럼 좌표가 포함된 text item을 받을 수 있는 라이브러리를 사용한다. `pdf-parse`처럼 plain text만 주는 방식은 메모 컬럼 안내문과 빈 컬럼 처리에 취약하므로 우선순위를 낮춘다.

파싱 알고리즘은 다음 순서로 잡는다.

1. PDF magic bytes가 `%PDF-`인지 확인한다.
2. 각 페이지의 text item을 추출한다.
3. 첫 페이지 헤더에서 조회기간, 계좌 식별 문자열, 현재잔액 필드 존재 여부를 확인한다.
4. 표 헤더 `NO`, `거래일시`, `찾으신금액`, `맡기신금액`, `거래후잔액`, `비고`의 x 좌표를 감지한다.
5. y 좌표 tolerance를 두고 같은 행의 item을 그룹화한다.
6. x 좌표 범위로 각 item을 원본 컬럼에 배치한다.
7. `NO + 거래일시` 패턴이 있는 그룹만 거래 행으로 인정한다.
8. `*** YYYY년 MM`, `영플러스통장`, `수수료 면제가능`, `횟수` 안내 문구는 거래 행 제목에서 제외한다.
9. 금액, 일시, 제목, 방향, 잔액을 정규화한다.
10. 변환 실패는 배치 실패가 아니라 행 단위 `FAILED`로 저장한다.

샘플 PDF 기준 컬럼 좌표는 대략 다음 범위다. 실제 구현은 고정값만 쓰지 말고 헤더 위치를 먼저 감지한 뒤 fallback으로 사용한다.

| 컬럼         | x 범위 예시 |
| ------------ | ----------- |
| `NO`         | 30 ~ 51     |
| `거래일시`   | 51 ~ 174    |
| `거래종류`   | 174 ~ 217   |
| `찾으신금액` | 217 ~ 270   |
| `맡기신금액` | 270 ~ 324   |
| `거래후잔액` | 324 ~ 377   |
| `비고`       | 377 ~ 450   |
| `메모`       | 450 ~ 513   |
| `거래점`     | 513 ~ 565   |

## 프론트엔드 구현 계획

### 1. 업로드 drawer 정리

`apps/web/src/features/imports/import-upload-dialog.tsx`를 다음처럼 바꾼다.

- 원본 형식 옵션에 `IM뱅크 PDF`를 추가한다.
- 파일 첨부 영역을 추가하고 `.pdf`, `.csv`, `.tsv`, `.txt`를 허용한다.
- PDF 선택 시 `fileName`을 자동 채우고, `UTF-8 본문` 입력은 숨기거나 비활성화한다.
- 직접 붙여넣기를 선택하면 기존 `content` textarea를 그대로 보여준다.
- 제출 버튼은 `file` 또는 `content` 중 하나가 있어야 활성화한다.

### 2. API 호출 분기

`imports.api.ts`에 파일 업로드 함수를 추가한다.

- `createImportBatch(input, fallback)`: 기존 JSON 업로드 유지
- `createImportBatchFromFile(input, fallback)`: `FormData`로 `/import-batches/files` 호출

`useImportsPage.submitUpload`은 form 상태를 보고 JSON/파일 업로드를 분기한다. 성공 후에는 현재처럼 feedback 표시, drawer 닫기, 새 배치 선택, `importBatchesQueryKey` invalidate를 수행한다.

### 3. 그리드와 작업대 표시 개선

기존 배치 그리드는 그대로 재사용할 수 있다. 다만 PDF 행 검토가 쉬워지도록 다음 표시를 추가한다.

- 원본 종류 라벨: `IM뱅크 PDF`
- 업로드 행 그리드에 입출금 방향 칩 또는 금액 부호 표시
- 선택 배치 요약에 PDF 조회기간, 파싱된 행 수, 실패 행 수 표시
- 상세 작업대에서 기본 필터를 현재 운영월로 두고, `전체 보기`를 제공

## 보안과 개인정보 기준

PDF 거래내역은 계좌번호, 이름, 잔액, 거래상대방을 포함하므로 일반 파일 업로드보다 보수적으로 다룬다.

- 허용 확장자와 MIME만 믿지 않고 magic bytes를 함께 확인한다.
- 파일 크기 제한을 둔다. 초기값은 10MB 이하를 권장한다.
- PDF JavaScript나 attachment는 실행하지 않고 text extraction만 수행한다.
- 원본 PDF는 첫 구현에서 저장하지 않는다.
- 로그와 감사 이벤트에는 파일명, sourceKind, rowCount, parseStatus, fileHash prefix 정도만 남긴다.
- 계좌번호 원문은 저장하지 않고 `sha256(tenantId + ledgerId + accountNumber)` 같은 workspace 범위 해시만 메타데이터에 남긴다.
- 테스트 fixture는 실제 PDF를 복사하지 않고, 익명화된 최소 PDF 또는 parser text item fixture로 만든다.
- 모든 텍스트 파일, fixture, 문서는 UTF-8로 저장한다.

## 테스트 계획

### 파서 단위 테스트

- 샘플과 같은 9개 컬럼을 좌표 기반 text item fixture로 넣으면 565행 구조를 재현할 수 있는지 확인한다.
- 출금 행은 `direction = WITHDRAWAL`, 입금 행은 `direction = DEPOSIT`으로 변환되는지 확인한다.
- 월별 수수료 안내 문구가 거래 제목으로 들어가지 않는지 확인한다.
- 제목 공백 행은 fallback 제목으로 `PARSED` 처리되는지 확인한다.
- 날짜/금액/잔액 오류 행은 개별 `FAILED` 처리되는지 확인한다.

### API 테스트

- `POST /import-batches/files`가 multipart PDF를 받아 `ImportBatchItem`을 반환하는지 확인한다.
- `VIEWER` 역할은 기존 업로드와 동일하게 403인지 확인한다.
- PDF가 아닌 파일, magic bytes 불일치, 크기 초과 파일은 400/413으로 정리한다.
- raw bytes 기준 `fileHash`가 저장되는지 확인한다.
- 파싱 일부 실패 시 배치 상태가 `PARTIAL`인지 확인한다.

### Web 테스트

- 업로드 drawer에서 PDF 파일을 선택하면 파일명이 자동 입력되는지 확인한다.
- `배치 생성` 후 업로드 배치 그리드에 새 배치가 추가되고 선택되는지 확인한다.
- PDF 배치 행이 작업대에서 거래일/설명/금액으로 보이는지 확인한다.
- 현재 운영월 필터와 전체 보기 전환이 동작하는지 확인한다.

## 구현 순서

1. `ImportSourceKind`와 계약 타입 확장
2. `ImportBatchParser` 인터페이스와 기존 delimited parser 분리
3. `pdfjs-dist` 기반 `ImBankPdfStatementParser` 추가
4. multipart 파일 업로드 엔드포인트 추가
5. Web 업로드 drawer에 파일 첨부와 PDF 원본 형식 추가
6. 업로드 성공 후 기존 배치 그리드 갱신 흐름 연결
7. 업로드 행 작업대에 방향/잔액/기간 필터 보강
8. 파서/API/Web 테스트 추가
9. `docs/API.md`, `docs/CURRENT_CAPABILITIES.md`, `docs/ASVS_L2_BASELINE_MATRIX.md` 문서 갱신

## 수용 기준

- IM뱅크 PDF를 첨부하고 `배치 생성`을 누르면 업로드 배치 그리드에 새 배치가 추가된다.
- 샘플 PDF 기준 거래 565행이 누락 없이 `ImportedRow`로 생성된다.
- 입금/출금 방향, 금액, 거래일, 제목, 거래후잔액이 `rawPayload`에 보존된다.
- 기존 CSV/TSV 붙여넣기 업로드는 회귀 없이 동작한다.
- PDF 파싱 실패나 일부 행 실패가 사용자에게 명확히 표시된다.
- 개인정보 원문이 로그, 문서, 테스트 fixture에 남지 않는다.
- 모든 신규 텍스트 파일은 UTF-8 인코딩으로 저장된다.

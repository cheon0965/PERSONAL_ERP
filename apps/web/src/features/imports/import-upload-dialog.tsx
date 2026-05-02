'use client';

import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
  FundingAccountItem,
  ImportSourceKind
} from '@personal-erp/contracts';
import { readFundingAccountTypeLabel } from '@/features/reference-data/reference-data.shared';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { FeedbackAlert } from '@/shared/ui/feedback-alert';
import { appLayout } from '@/shared/ui/layout-metrics';
import {
  fileUploadSourceKinds,
  readImportSourceFundingAccountType,
  readImportSourceFundingAccountTypeLabel,
  selectableSourceKindOptions,
  type FeedbackState
} from './imports.shared';
import type { ImportUploadFormState } from './use-imports-page';

export function ImportUploadDialog({
  open,
  form,
  feedback,
  fundingAccounts,
  submitPending,
  onClose,
  onChange,
  onSubmit
}: {
  open: boolean;
  form: ImportUploadFormState;
  feedback: FeedbackState;
  fundingAccounts: FundingAccountItem[];
  submitPending: boolean;
  onClose: () => void;
  onChange: (patch: Partial<ImportUploadFormState>) => void;
  onSubmit: () => Promise<void>;
}) {
  const isFileUpload = fileUploadSourceKinds.includes(form.sourceKind);
  const isWooriBankHtml = form.sourceKind === 'WOORI_BANK_HTML';
  const isWooriCardHtml = form.sourceKind === 'WOORI_CARD_HTML';
  const isKbKookminBankPdf = form.sourceKind === 'KB_KOOKMIN_BANK_PDF';
  const isHtmlUpload = isWooriBankHtml || isWooriCardHtml;
  const needsVestMailPassword = isWooriBankHtml || isWooriCardHtml;
  const needsPdfPassword = isKbKookminBankPdf;
  const fileKindLabel = isHtmlUpload ? 'HTML' : 'PDF';
  const fundingAccountType = readImportSourceFundingAccountType(
    form.sourceKind
  );
  const fundingAccountTypeLabel = readImportSourceFundingAccountTypeLabel(
    form.sourceKind
  );
  const fundingAccountSelectLabel =
    fundingAccountType === 'CARD' ? '연결 카드' : '연결 은행 계좌';
  const missingFundingAccountMessage =
    fundingAccountType === 'CARD'
      ? '기준 데이터에서 활성 카드를 먼저 등록해 주세요.'
      : '기준 데이터에서 활성 은행 계좌를 먼저 등록해 주세요.';

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="새 업로드 배치"
      description="UTF-8 텍스트를 붙여 넣거나 명세서 파일을 첨부해 최신 진행월 또는 초기 기초 입력용 업로드 행을 생성합니다."
    >
      <Stack spacing={appLayout.fieldGap}>
        <TextField
          select
          label="원본 형식"
          size="small"
          value={form.sourceKind}
          onChange={(event) => {
            const sourceKind = event.target.value as ImportSourceKind;
            onChange({
              sourceKind,
              file: fileUploadSourceKinds.includes(sourceKind)
                ? form.file
                : null,
              password: ''
            });
          }}
        >
          {selectableSourceKindOptions.map((option) => (
            <MenuItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="파일명"
          size="small"
          value={form.fileName}
          onChange={(event) => {
            onChange({ fileName: event.target.value });
          }}
        />
        {isFileUpload ? (
          <Stack spacing={1}>
            <TextField
              select
              required
              label={fundingAccountSelectLabel}
              size="small"
              value={form.fundingAccountId}
              disabled={fundingAccounts.length === 0}
              helperText={
                fundingAccounts.length === 0
                  ? missingFundingAccountMessage
                  : `이 ${fileKindLabel}의 거래가 어느 ${fundingAccountTypeLabel}에서 발생했는지 선택합니다.`
              }
              onChange={(event) => {
                onChange({ fundingAccountId: event.target.value });
              }}
            >
              {fundingAccounts.length === 0 ? (
                <MenuItem value="">
                  선택 가능한 {fundingAccountTypeLabel} 없음
                </MenuItem>
              ) : null}
              {fundingAccounts.map((fundingAccount) => (
                <MenuItem key={fundingAccount.id} value={fundingAccount.id}>
                  {`${readFundingAccountTypeLabel(fundingAccount.type)} · ${fundingAccount.name}`}
                </MenuItem>
              ))}
            </TextField>
            {needsVestMailPassword || needsPdfPassword ? (
              <TextField
                label={needsPdfPassword ? 'PDF 비밀번호' : '보안메일 비밀번호'}
                size="small"
                value={form.password}
                inputProps={
                  needsPdfPassword
                    ? { maxLength: 64 }
                    : { inputMode: 'numeric', maxLength: 6 }
                }
                helperText={
                  needsPdfPassword
                    ? '암호화된 KB국민은행 원본 PDF일 때만 입력합니다. 비밀번호는 저장하지 않습니다.'
                    : `암호화된 ${isWooriBankHtml ? '우리은행' : '우리카드'} VestMail 원본일 때만 숫자 6자리를 입력합니다. 저장 HTML은 비워 두세요.`
                }
                onChange={(event) => {
                  onChange({
                    password: needsPdfPassword
                      ? event.target.value.slice(0, 64)
                      : event.target.value.replace(/\D/g, '').slice(0, 6)
                  });
                }}
              />
            ) : null}
            <Button component="label" variant="outlined">
              {fileKindLabel} 파일 선택
              <input
                hidden
                type="file"
                accept={
                  isHtmlUpload ? 'text/html,.html,.htm' : 'application/pdf,.pdf'
                }
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  onChange({
                    file,
                    fileName: file?.name ?? form.fileName
                  });
                }}
              />
            </Button>
            <Typography variant="body2" color="text.secondary">
              {form.file
                ? `${form.file.name} (${Math.ceil(form.file.size / 1024)}KB)`
                : isWooriBankHtml
                  ? '우리은행 거래내역을 브라우저에서 열어 저장한 HTML을 선택해 주세요.'
                  : isWooriCardHtml
                    ? '우리카드 보안메일을 브라우저에서 열어 저장한 이용대금 명세서 HTML을 선택해 주세요.'
                    : isKbKookminBankPdf
                      ? 'KB국민은행에서 내려받은 거래내역 PDF를 선택해 주세요.'
                      : 'IM뱅크에서 내려받은 거래내역 PDF를 선택해 주세요.'}
            </Typography>
            <Alert severity="info" variant="outlined">
              {isWooriBankHtml
                ? '우리은행 저장 HTML은 바로 거래 행으로 변환하고, 암호화된 VestMail 원본은 비밀번호 숫자 6자리로 서버에서 스크립트 실행 없이 복호화합니다. 비밀번호와 원본 파일은 저장하지 않고 업로드 배치와 행 단위 원본 정보만 보관합니다.'
                : isWooriCardHtml
                  ? '우리카드 저장 HTML은 바로 거래 행으로 변환하고, 암호화된 VestMail 원본은 비밀번호 숫자 6자리로 서버에서 스크립트 실행 없이 복호화합니다. 비밀번호와 원본 파일은 저장하지 않고 업로드 배치와 행 단위 원본 정보만 보관합니다.'
                  : isKbKookminBankPdf
                    ? '텍스트 레이어가 있는 KB국민은행 원본 PDF만 지원합니다. 암호화된 PDF는 입력한 비밀번호로 서버에서 스크립트 실행 없이 복호화하고, 비밀번호와 원본 파일은 저장하지 않습니다. 스캔하거나 이미지로 저장한 PDF는 OCR 미도입 상태라 업로드 전에 차단됩니다.'
                    : '텍스트 레이어가 있는 IM뱅크 원본 PDF만 지원합니다. 스캔하거나 이미지로 저장한 PDF는 OCR 미도입 상태라 업로드 전에 차단됩니다. PDF 원본은 서버에서 거래 행으로 변환한 뒤 저장하지 않고, 업로드 배치와 행 단위 원본 정보만 보관합니다. 운영 중에는 최신 진행월 범위의 거래만 수집 거래로 등록합니다.'}
            </Alert>
          </Stack>
        ) : (
          <TextField
            label="UTF-8 본문"
            multiline
            minRows={8}
            value={form.content}
            onChange={(event) => {
              onChange({ content: event.target.value });
            }}
          />
        )}
        <FeedbackAlert feedback={feedback} />
        <Button
          variant="contained"
          disabled={
            submitPending ||
            form.fileName.trim().length === 0 ||
            (isFileUpload
              ? !form.file || !form.fundingAccountId
              : form.content.trim().length === 0)
          }
          onClick={() => {
            void onSubmit();
          }}
        >
          {submitPending ? '업로드 중...' : '배치 생성'}
        </Button>
      </Stack>
    </FormDrawer>
  );
}

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
import { appLayout } from '@/shared/ui/layout-metrics';
import { sourceKindOptions } from './imports.shared';
import type { ImportUploadFormState } from './use-imports-page';

const FILE_UPLOAD_KINDS: ImportSourceKind[] = ['IM_BANK_PDF', 'WOORI_BANK_HTML'];

export function ImportUploadDialog({
  open,
  form,
  fundingAccounts,
  submitPending,
  onClose,
  onChange,
  onSubmit
}: {
  open: boolean;
  form: ImportUploadFormState;
  fundingAccounts: FundingAccountItem[];
  submitPending: boolean;
  onClose: () => void;
  onChange: (patch: Partial<ImportUploadFormState>) => void;
  onSubmit: () => Promise<void>;
}) {
  const isFileUpload = FILE_UPLOAD_KINDS.includes(form.sourceKind);
  const isWooriHtml = form.sourceKind === 'WOORI_BANK_HTML';

  const fileAccept = isWooriHtml
    ? 'text/html,.html,.htm'
    : 'application/pdf,.pdf';

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="새 업로드 배치"
      description="UTF-8 텍스트를 붙여 넣거나 IM뱅크 PDF 파일 또는 우리은행 보안메일 HTML 파일을 첨부해 최신 진행월 또는 초기 기초 입력용 업로드 행을 생성합니다."
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
              file: FILE_UPLOAD_KINDS.includes(sourceKind) ? form.file : null,
              password: sourceKind === 'WOORI_BANK_HTML' ? form.password : ''
            });
          }}
        >
          {sourceKindOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
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
              label="연결 계좌/카드"
              size="small"
              value={form.fundingAccountId}
              disabled={fundingAccounts.length === 0}
              helperText={
                fundingAccounts.length === 0
                  ? '기준 데이터에서 활성 계좌 또는 카드를 먼저 등록해 주세요.'
                  : isWooriHtml
                    ? '이 HTML의 거래가 어느 자금수단에서 발생했는지 선택합니다.'
                    : '이 PDF의 거래가 어느 자금수단에서 발생했는지 선택합니다.'
              }
              onChange={(event) => {
                onChange({ fundingAccountId: event.target.value });
              }}
            >
              {fundingAccounts.length === 0 ? (
                <MenuItem value="">선택 가능한 계좌/카드 없음</MenuItem>
              ) : null}
              {fundingAccounts.map((fundingAccount) => (
                <MenuItem key={fundingAccount.id} value={fundingAccount.id}>
                  {`${readFundingAccountTypeLabel(fundingAccount.type)} · ${fundingAccount.name}`}
                </MenuItem>
              ))}
            </TextField>
            {isWooriHtml ? (
              <TextField
                required
                label="비밀번호 (주민번호 앞 6자리)"
                size="small"
                type="password"
                inputProps={{ maxLength: 6, pattern: '[0-9]*', inputMode: 'numeric' }}
                value={form.password}
                helperText="우리은행 보안메일 복호화를 위한 주민등록번호 앞자리 6자리를 입력합니다."
                onChange={(event) => {
                  onChange({ password: event.target.value });
                }}
              />
            ) : null}
            <Button component="label" variant="outlined">
              {isWooriHtml ? 'HTML 파일 선택' : 'PDF 파일 선택'}
              <input
                hidden
                type="file"
                accept={fileAccept}
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
                : isWooriHtml
                  ? '우리은행에서 보안메일로 받은 거래내역 HTML 파일을 선택해 주세요.'
                  : 'IM뱅크에서 내려받은 거래내역 PDF를 선택해 주세요.'}
            </Typography>
            <Alert severity="info" variant="outlined">
              {isWooriHtml
                ? '우리은행 보안메일 HTML을 서버에서 복호화한 뒤 거래 행으로 변환합니다. 비밀번호는 서버에 저장되지 않습니다.'
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
        <Button
          variant="contained"
          disabled={
            submitPending ||
            form.fileName.trim().length === 0 ||
            (isFileUpload
              ? !form.file ||
                !form.fundingAccountId ||
                (isWooriHtml && (!form.password || form.password.length !== 6))
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


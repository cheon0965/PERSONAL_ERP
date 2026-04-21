'use client';

import {
  Alert,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type { FundingAccountItem, ImportSourceKind } from '@personal-erp/contracts';
import { readFundingAccountTypeLabel } from '@/features/reference-data/reference-data.shared';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { sourceKindOptions } from './imports.shared';
import type { ImportUploadFormState } from './use-imports-page';

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
  const isFileUpload = form.sourceKind === 'IM_BANK_PDF';

  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="새 업로드 배치"
      description="UTF-8 텍스트를 붙여 넣거나 IM뱅크 PDF 파일을 첨부해 업로드 배치와 업로드 행을 생성합니다."
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
              file: sourceKind === 'IM_BANK_PDF' ? form.file : null
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
            <Button component="label" variant="outlined">
              PDF 파일 선택
              <input
                hidden
                type="file"
                accept="application/pdf,.pdf"
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
                : 'IM뱅크에서 내려받은 거래내역 PDF를 선택해 주세요.'}
            </Typography>
            <Alert severity="info" variant="outlined">
              PDF 원본은 서버에서 거래 행으로 변환한 뒤 저장하지 않고, 업로드
              배치와 행 단위 원본 정보만 보관합니다.
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

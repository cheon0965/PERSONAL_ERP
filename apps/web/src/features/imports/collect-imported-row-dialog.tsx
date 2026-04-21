'use client';

import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
  CategoryItem,
  CollectImportedRowPreview,
  CollectImportedRowRequest,
  FundingAccountItem,
  ReferenceDataReadinessSummary
} from '@personal-erp/contracts';
import { ReferenceDataReadinessAlert } from '@/features/reference-data/reference-data-readiness';
import { formatWon } from '@/shared/lib/format';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { CollectPreviewSummary } from './imports.summary-block';
import type { ImportedRowTableItem } from './imports.shared';

type CollectPreviewState = {
  isLoading: boolean;
  error: unknown;
  data: CollectImportedRowPreview | undefined;
};

export function CollectImportedRowDialog({
  open,
  selectedRow,
  readiness,
  fundingAccounts,
  categories,
  collectForm,
  collectPreview,
  submitPending,
  canSubmit,
  onClose,
  onChange,
  onSubmit
}: {
  open: boolean;
  selectedRow: ImportedRowTableItem | null;
  readiness: ReferenceDataReadinessSummary | null;
  fundingAccounts: FundingAccountItem[];
  categories: CategoryItem[];
  collectForm: CollectImportedRowRequest;
  collectPreview: CollectPreviewState;
  submitPending: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onChange: (patch: Partial<CollectImportedRowRequest>) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="수집 거래 등록"
      description="선택한 업로드 행을 수집 거래로 올리기 전에, 대상 운영월 준비·계획 항목 매칭·카테고리 보완·중복 확인 결과를 먼저 점검합니다."
    >
      {selectedRow ? (
        <Stack spacing={appLayout.fieldGap}>
          <ReferenceDataReadinessAlert
            readiness={readiness}
            context="import-collection"
          />
          <div>
            <Typography variant="caption" color="text.secondary">
              선택 행
            </Typography>
            <Typography variant="body1">
              #{selectedRow.rowNumber} {selectedRow.title}
            </Typography>
          </div>
          <div>
            <Typography variant="caption" color="text.secondary">
              읽은 거래 내용
            </Typography>
            <Typography variant="body2">
              {selectedRow.occurredOn} /{' '}
              {selectedRow.amount == null ? '-' : formatWon(selectedRow.amount)}
            </Typography>
          </div>
          <div>
            <Typography variant="caption" color="text.secondary">
              원본 식별값
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              {selectedRow.sourceFingerprint ?? '-'}
            </Typography>
          </div>
          {selectedRow.parseError ? (
            <Alert severity="warning" variant="outlined">
              {selectedRow.parseError}
            </Alert>
          ) : null}
          <TextField
            select
            label="거래 유형"
            size="small"
            value={collectForm.type}
            onChange={(event) => {
              onChange({
                type: event.target.value as CollectImportedRowRequest['type']
              });
            }}
          >
            <MenuItem value="INCOME">수입</MenuItem>
            <MenuItem value="EXPENSE">지출</MenuItem>
            <MenuItem value="TRANSFER">이체</MenuItem>
            {selectedRow.collectTypeHint === 'REVERSAL' ||
            collectForm.type === 'REVERSAL' ? (
              <MenuItem value="REVERSAL">승인취소</MenuItem>
            ) : null}
          </TextField>
          <TextField
            select
            label="자금수단"
            size="small"
            value={collectForm.fundingAccountId}
            onChange={(event) => {
              onChange({ fundingAccountId: event.target.value });
            }}
          >
            {fundingAccounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {account.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="카테고리"
            size="small"
            value={collectForm.categoryId ?? ''}
            onChange={(event) => {
              onChange({ categoryId: event.target.value });
            }}
            helperText="비워 두면 맞는 계획 항목이 하나뿐인 경우 거래 분류를 자동으로 보완합니다."
          >
            <MenuItem value="">자동 보완 허용</MenuItem>
            {categories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {category.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="메모"
            size="small"
            multiline
            minRows={3}
            value={collectForm.memo ?? ''}
            onChange={(event) => {
              onChange({ memo: event.target.value });
            }}
          />

          <Box
            sx={{
              px: appLayout.cardPadding,
              py: { xs: 1.25, md: 1.5 },
              borderRadius: 2,
              bgcolor: 'background.default',
              border: (theme) => `1px solid ${theme.palette.divider}`
            }}
          >
            <Stack spacing={1.25}>
              <Typography variant="subtitle2">자동 판정 요약</Typography>
              {collectPreview.isLoading ? (
                <Typography variant="body2" color="text.secondary">
                  현재 입력값 기준으로 자동 판정 결과를 계산하고 있습니다.
                </Typography>
              ) : collectPreview.error ? (
                <Alert severity="warning" variant="outlined">
                  {collectPreview.error instanceof Error
                    ? collectPreview.error.message
                    : '자동 판정 결과를 불러오지 못했습니다.'}
                </Alert>
              ) : collectPreview.data ? (
                <CollectPreviewSummary preview={collectPreview.data} />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  거래 유형과 자금수단을 선택하면 자동 판정 결과를
                  표시합니다.
                </Typography>
              )}
            </Stack>
          </Box>

          <Button
            variant="contained"
            disabled={submitPending || !canSubmit}
            onClick={() => {
              void onSubmit();
            }}
          >
            {submitPending ? '등록 중...' : '수집 거래로 등록'}
          </Button>
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          먼저 배치에서 검토할 행을 선택해 주세요.
        </Typography>
      )}
    </FormDrawer>
  );
}

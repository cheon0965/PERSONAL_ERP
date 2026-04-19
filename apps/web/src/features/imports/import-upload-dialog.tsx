'use client';

import { Button, MenuItem, Stack, TextField } from '@mui/material';
import type {
  CreateImportBatchRequest,
  ImportSourceKind
} from '@personal-erp/contracts';
import { FormDrawer } from '@/shared/ui/form-drawer';
import { appLayout } from '@/shared/ui/layout-metrics';
import { sourceKindOptions } from './imports.shared';

export function ImportUploadDialog({
  open,
  form,
  submitPending,
  onClose,
  onChange,
  onSubmit
}: {
  open: boolean;
  form: CreateImportBatchRequest;
  submitPending: boolean;
  onClose: () => void;
  onChange: (patch: Partial<CreateImportBatchRequest>) => void;
  onSubmit: () => Promise<void>;
}) {
  return (
    <FormDrawer
      open={open}
      onClose={onClose}
      title="새 업로드 배치"
      description="UTF-8 텍스트 본문을 그대로 붙여 넣어 업로드 배치와 업로드 행을 생성합니다."
    >
      <Stack spacing={appLayout.fieldGap}>
        <TextField
          select
          label="원본 형식"
          size="small"
          value={form.sourceKind}
          onChange={(event) => {
            onChange({ sourceKind: event.target.value as ImportSourceKind });
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
        <TextField
          label="UTF-8 본문"
          multiline
          minRows={8}
          value={form.content}
          onChange={(event) => {
            onChange({ content: event.target.value });
          }}
        />
        <Button
          variant="contained"
          disabled={
            submitPending ||
            form.fileName.trim().length === 0 ||
            form.content.trim().length === 0
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

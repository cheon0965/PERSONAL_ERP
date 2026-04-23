'use client';

import { Alert } from '@mui/material';
import type { FundingAccountItem } from '@personal-erp/contracts';
import type { FeedbackAlertValue } from '@/shared/ui/feedback-alert';
import { FormDrawer } from '@/shared/ui/form-drawer';
import {
  FundingAccountManagementForm,
  type FundingAccountManagementSubmitInput
} from './funding-account-management-form';
import type { FundingAccountEditorState } from './reference-data.shared';

export function FundingAccountEditorDrawer({
  editorState,
  editingFundingAccount,
  feedback,
  busy,
  onClose,
  onSubmit
}: {
  editorState: FundingAccountEditorState;
  editingFundingAccount: FundingAccountItem | null;
  feedback: FeedbackAlertValue;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: FundingAccountManagementSubmitInput) => Promise<void>;
}) {
  return (
    <FormDrawer
      open={editorState !== null}
      onClose={onClose}
      title={editorState?.mode === 'edit' ? '자금수단 수정' : '자금수단 추가'}
      description={
        editorState?.mode === 'edit'
          ? '현재 범위에서는 자금수단 이름을 수정합니다. 활성/비활성/종료 전환은 목록 버튼에서 처리합니다.'
          : '현재 장부에 새 자금수단을 추가합니다. 생성 후에는 입력 화면의 활성 선택지에 반영됩니다.'
      }
    >
      {editorState?.mode === 'edit' && !editingFundingAccount ? (
        <Alert severity="warning" variant="outlined">
          수정할 자금수단을 찾지 못했습니다.
        </Alert>
      ) : (
        <FundingAccountManagementForm
          feedback={feedback}
          mode={editorState?.mode ?? 'create'}
          initialFundingAccount={editingFundingAccount}
          busy={busy}
          onSubmit={onSubmit}
        />
      )}
    </FormDrawer>
  );
}

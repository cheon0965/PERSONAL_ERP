'use client';

import { Alert } from '@mui/material';
import type { CategoryItem } from '@personal-erp/contracts';
import type { FeedbackAlertValue } from '@/shared/ui/feedback-alert';
import { FormDrawer } from '@/shared/ui/form-drawer';
import {
  CategoryManagementForm,
  type CategoryManagementSubmitInput
} from './category-management-form';
import type { CategoryEditorState } from './reference-data.shared';

export function CategoryEditorDrawer({
  editorState,
  editingCategory,
  feedback,
  busy,
  onClose,
  onSubmit
}: {
  editorState: CategoryEditorState;
  editingCategory: CategoryItem | null;
  feedback: FeedbackAlertValue;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: CategoryManagementSubmitInput) => Promise<void>;
}) {
  return (
    <FormDrawer
      open={editorState !== null}
      onClose={onClose}
      title={editorState?.mode === 'edit' ? '카테고리 수정' : '카테고리 추가'}
      description={
        editorState?.mode === 'edit'
          ? '현재 범위에서는 카테고리 이름과 활성 상태만 관리합니다.'
          : '현재 장부에 새 카테고리를 추가합니다. 생성 후에는 입력 화면의 활성 선택지에 반영됩니다.'
      }
    >
      {editorState?.mode === 'edit' && !editingCategory ? (
        <Alert severity="warning" variant="outlined">
          수정할 카테고리를 찾지 못했습니다.
        </Alert>
      ) : (
        <CategoryManagementForm
          feedback={feedback}
          mode={editorState?.mode ?? 'create'}
          initialCategory={editingCategory}
          busy={busy}
          onSubmit={onSubmit}
        />
      )}
    </FormDrawer>
  );
}

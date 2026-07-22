'use client';

import { Alert } from '@mui/material';
import type { AccountSubjectItem, CategoryItem } from '@personal-erp/contracts';
import type { FeedbackAlertValue } from '@/shared/ui/feedback-alert';
import { FormDrawer } from '@/shared/ui/form-drawer';
import {
  CategoryManagementForm,
  type CategoryManagementSubmitInput
} from './category-management-form';
import type { CategoryEditorState } from '../model/reference-data.shared';

export function CategoryEditorDrawer({
  editorState,
  editingCategory,
  accountSubjects,
  feedback,
  busy,
  onClose,
  onSubmit
}: {
  editorState: CategoryEditorState;
  editingCategory: CategoryItem | null;
  accountSubjects: AccountSubjectItem[];
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
          ? '카테고리 이름과 전표에 사용할 표준 손익 계정과목을 관리합니다.'
          : '현재 장부에 새 카테고리를 추가하고 전표에 사용할 표준 손익 계정과목을 연결합니다.'
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
          accountSubjects={accountSubjects}
          busy={busy}
          onSubmit={onSubmit}
        />
      )}
    </FormDrawer>
  );
}

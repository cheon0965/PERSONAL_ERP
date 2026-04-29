'use client';

import { Chip, type ChipProps } from '@mui/material';

const colorMap: Record<
  string,
  'default' | 'success' | 'warning' | 'error' | 'primary' | 'info'
> = {
  COLLECTED: 'warning',
  REVIEWED: 'info',
  READY_TO_POST: 'primary',
  POSTED: 'success',
  CORRECTED: 'info',
  REVERSED: 'warning',
  SUPERSEDED: 'warning',
  DRAFT: 'default',
  CONFIRMED: 'success',
  EXPIRED: 'default',
  OPEN: 'success',
  IN_REVIEW: 'info',
  CLOSING: 'warning',
  LOCKED: 'default',
  ACTIVE: 'primary',
  INACTIVE: 'default',
  CLOSED: 'default',
  PENDING: 'warning',
  RUNNING: 'info',
  SUCCEEDED: 'success',
  PARSED: 'success',
  PARTIAL: 'warning',
  FAILED: 'error',
  CANCELLED: 'error',
  PAUSED: 'warning',
  PAID_OFF: 'success',
  ARCHIVED: 'default',
  SCHEDULED: 'info',
  PLANNED: 'primary',
  MATCHED: 'primary',
  SKIPPED: 'warning',
  COMPLETED: 'success',
  PROCESSING: 'info',
  NOT_REQUIRED: 'default',
  READY: 'success',
  ACTION_REQUIRED: 'warning',
  OK: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  UNKNOWN: 'default',
  BLOCKED: 'error',
  TRIAL: 'info',
  SUSPENDED: 'warning',
  DISABLED: 'default',
  INVITED: 'info',
  REMOVED: 'default',
  연결됨: 'success',
  미연결: 'default',
  활성: 'success',
  비활성: 'default',
  중지: 'warning',
  '보험 계약 연동': 'info',
  '직접 작성': 'default'
};

const labelMap: Record<string, string> = {
  COLLECTED: '수집됨',
  REVIEWED: '검토됨',
  READY_TO_POST: '전표 준비',
  POSTED: '확정',
  CORRECTED: '정정됨',
  REVERSED: '반전됨',
  SUPERSEDED: '대체됨',
  DRAFT: '초안',
  CONFIRMED: '확정됨',
  EXPIRED: '만료',
  OPEN: '운영 중',
  IN_REVIEW: '검토 중',
  CLOSING: '마감 중',
  LOCKED: '잠금',
  ACTIVE: '활성',
  INACTIVE: '비활성',
  CLOSED: '종료',
  PENDING: '대기',
  RUNNING: '진행 중',
  SUCCEEDED: '성공',
  PARSED: '읽기 완료',
  PARTIAL: '일부 완료',
  FAILED: '실패',
  CANCELLED: '중지',
  PAUSED: '일시중지',
  PAID_OFF: '완납',
  ARCHIVED: '보관',
  SCHEDULED: '예정',
  PLANNED: '계획',
  MATCHED: '거래 연결',
  SKIPPED: '건너뜀',
  COMPLETED: '완료',
  PROCESSING: '처리 중',
  NOT_REQUIRED: '불필요',
  READY: '준비됨',
  ACTION_REQUIRED: '조치 필요',
  OK: '정상',
  WARNING: '주의',
  ERROR: '오류',
  UNKNOWN: '알 수 없음',
  BLOCKED: '차단',
  TRIAL: '체험',
  SUSPENDED: '중지',
  DISABLED: '비활성',
  INVITED: '초대됨',
  REMOVED: '제거됨'
};

export function resolveStatusLabel(label: string): string {
  return labelMap[label] ?? label;
}

export function StatusChip({ label }: { label: string }) {
  const color = colorMap[label] ?? 'default';
  const variant: ChipProps['variant'] = 'outlined';

  return (
    <Chip
      label={resolveStatusLabel(label)}
      color={color}
      variant={variant}
      size="small"
      sx={{
        minWidth: 68,
        justifyContent: 'flex-start',
        '& .MuiChip-label': {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75
        },
        '& .MuiChip-label::before': {
          content: '""',
          width: 6,
          height: 6,
          borderRadius: 999,
          bgcolor: 'currentColor',
          opacity: 0.72,
          flexShrink: 0
        }
      }}
    />
  );
}

'use client';

import Link from 'next/link';
import { Button, Stack } from '@mui/material';

export function OperationsSectionNav() {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <Button component={Link} href="/operations" variant="outlined">
        운영 허브
      </Button>
      <Button component={Link} href="/operations/checklist" variant="outlined">
        체크리스트
      </Button>
      <Button component={Link} href="/operations/exceptions" variant="outlined">
        예외 처리함
      </Button>
      <Button component={Link} href="/operations/month-end" variant="outlined">
        월 마감
      </Button>
      <Button component={Link} href="/operations/imports" variant="outlined">
        업로드 현황
      </Button>
      <Button component={Link} href="/operations/status" variant="outlined">
        시스템 상태
      </Button>
      <Button component={Link} href="/operations/alerts" variant="outlined">
        알림 센터
      </Button>
      <Button component={Link} href="/operations/exports" variant="outlined">
        백업/내보내기
      </Button>
      <Button component={Link} href="/operations/notes" variant="outlined">
        운영 메모
      </Button>
    </Stack>
  );
}

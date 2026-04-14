'use client';

import Link from 'next/link';
import { Button, Stack } from '@mui/material';

export function AdminSectionNav() {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <Button component={Link} href="/admin" variant="outlined">
        관리자 개요
      </Button>
      <Button component={Link} href="/admin/members" variant="outlined">
        회원관리
      </Button>
      <Button component={Link} href="/admin/logs" variant="outlined">
        로그관리
      </Button>
    </Stack>
  );
}

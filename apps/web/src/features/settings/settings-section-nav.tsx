'use client';

import Link from 'next/link';
import { Button, Stack } from '@mui/material';

export function SettingsSectionNav() {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
      <Button component={Link} href="/settings" variant="outlined">
        작업 문맥
      </Button>
      <Button component={Link} href="/settings/workspace" variant="outlined">
        사업장 설정
      </Button>
      <Button component={Link} href="/settings/account" variant="outlined">
        내 계정 / 보안
      </Button>
    </Stack>
  );
}

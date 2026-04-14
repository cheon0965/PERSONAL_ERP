'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography
} from '@mui/material';
import { acceptInvitation } from './auth.api';

type AcceptInvitationState =
  | { status: 'loading' }
  | { status: 'accepted' }
  | { status: 'registration_required' }
  | { status: 'error'; message: string };

export function AcceptInvitationPage() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') ?? '';
  const [state, setState] = useState<AcceptInvitationState>({
    status: 'loading'
  });

  useEffect(() => {
    if (!token) {
      setState({
        status: 'error',
        message: '초대 토큰이 없습니다.'
      });
      return;
    }

    let ignore = false;
    acceptInvitation({ token })
      .then((response) => {
        if (!ignore) {
          setState({ status: response.status });
        }
      })
      .catch((error: unknown) => {
        if (!ignore) {
          setState({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : '초대 수락에 실패했습니다.'
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: 4,
        backgroundColor: 'background.default'
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 520 }}>
        <CardContent>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="overline" color="text.secondary">
                사업장 초대
              </Typography>
              <Typography variant="h4">초대 수락</Typography>
              <Typography variant="body2" color="text.secondary">
                초대 링크를 확인하고 현재 이메일 계정을 사업장 멤버로
                연결합니다.
              </Typography>
            </Stack>

            <InvitationStateMessage state={state} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button component={Link} href="/login" variant="contained">
                로그인
              </Button>
              <Button component={Link} href="/register" variant="outlined">
                회원가입
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function InvitationStateMessage({
  state
}: {
  state: AcceptInvitationState;
}) {
  switch (state.status) {
    case 'loading':
      return <Alert severity="info">초대 링크를 확인하고 있습니다.</Alert>;
    case 'accepted':
      return (
        <Alert severity="success">
          초대를 수락했습니다. 로그인하면 사업장 문맥을 사용할 수 있습니다.
        </Alert>
      );
    case 'registration_required':
      return (
        <Alert severity="info">
          이 이메일로 먼저 회원가입을 완료한 뒤 초대 링크를 다시 열어 주세요.
        </Alert>
      );
    case 'error':
      return <Alert severity="error">{state.message}</Alert>;
  }
}

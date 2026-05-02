'use client';

import * as React from 'react';
import { Alert, Stack, Typography } from '@mui/material';
import {
  ErrorDiagnosticsDisclosure,
  useScrollErrorAlertIntoView
} from './error-alert-behavior';

export type FeedbackAlertValue = {
  severity: 'success' | 'error' | 'info' | 'warning';
  message: string;
  diagnostics?: string | null;
} | null;

export function FeedbackAlert({ feedback }: { feedback: FeedbackAlertValue }) {
  const alertRef = React.useRef<HTMLDivElement | null>(null);

  // 오류가 폼 아래쪽에서 발생해도 사용자가 놓치지 않도록 알림 위치로 초점을 끌어온다.
  useScrollErrorAlertIntoView(
    alertRef,
    feedback?.severity === 'error',
    feedback
  );

  if (!feedback) {
    return null;
  }

  return (
    <Alert
      ref={alertRef}
      severity={feedback.severity}
      variant="outlined"
      tabIndex={-1}
    >
      {feedback.diagnostics ? (
        <Stack spacing={0.75}>
          <Typography variant="body2">{feedback.message}</Typography>
          {/* 개발자용 진단은 기본 접힘 상태로 두어 사용자 메시지를 먼저 읽게 한다. */}
          <ErrorDiagnosticsDisclosure diagnostics={feedback.diagnostics} />
        </Stack>
      ) : (
        feedback.message
      )}
    </Alert>
  );
}

'use client';

import * as React from 'react';
import { Alert, AlertTitle, Stack, Typography } from '@mui/material';
import { readErrorDiagnostics, readErrorUserMessage } from '../api/fetch-json';
import {
  ErrorDiagnosticsDisclosure,
  useScrollErrorAlertIntoView
} from './error-alert-behavior';

type QueryErrorAlertProps = {
  title: string;
  error: unknown;
};

export function QueryErrorAlert({ title, error }: QueryErrorAlertProps) {
  const alertRef = React.useRef<HTMLDivElement | null>(null);
  const fallbackMessage =
    '데이터를 불러오지 못했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.';
  const message = readErrorUserMessage(error, fallbackMessage);
  const diagnostics = readErrorDiagnostics(error);

  useScrollErrorAlertIntoView(alertRef, true, error);

  return (
    <Alert ref={alertRef} severity="error" variant="outlined" tabIndex={-1}>
      <AlertTitle>{title}</AlertTitle>
      <Stack spacing={0.75}>
        <Typography variant="body2">{message}</Typography>
        <ErrorDiagnosticsDisclosure diagnostics={diagnostics} />
      </Stack>
    </Alert>
  );
}

'use client';

import { Alert, AlertTitle, Stack, Typography } from '@mui/material';
import {
  readErrorDiagnostics,
  readErrorUserMessage
} from '../api/fetch-json';

type QueryErrorAlertProps = {
  title: string;
  error: unknown;
};

export function QueryErrorAlert({ title, error }: QueryErrorAlertProps) {
  const fallbackMessage =
    '데이터를 불러오지 못했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.';
  const message = readErrorUserMessage(error, fallbackMessage);
  const diagnostics = readErrorDiagnostics(error);

  return (
    <Alert severity="error" variant="outlined">
      <AlertTitle>{title}</AlertTitle>
      <Stack spacing={0.75}>
        <Typography variant="body2">{message}</Typography>
        {diagnostics ? (
          <Typography variant="caption" color="text.secondary">
            {diagnostics}
          </Typography>
        ) : null}
      </Stack>
    </Alert>
  );
}

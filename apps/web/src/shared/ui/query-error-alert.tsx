'use client';

import { Alert, AlertTitle, Stack, Typography } from '@mui/material';
import { ApiRequestError, formatErrorMessage } from '../api/fetch-json';

type QueryErrorAlertProps = {
  title: string;
  error: unknown;
};

export function QueryErrorAlert({ title, error }: QueryErrorAlertProps) {
  const fallbackMessage =
    '데이터를 불러오지 못했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.';
  const diagnostics =
    error instanceof ApiRequestError
      ? [
          error.errorCode ? `오류 코드 ${error.errorCode}` : null,
          error.requestId ? `요청번호 ${error.requestId}` : null
        ]
          .filter((item): item is string => Boolean(item))
          .join(' · ')
      : '';

  return (
    <Alert severity="error" variant="outlined">
      <AlertTitle>{title}</AlertTitle>
      {error instanceof ApiRequestError ? (
        <Stack spacing={0.75}>
          <Typography variant="body2">{error.userMessage}</Typography>
          {diagnostics ? (
            <Typography variant="caption" color="text.secondary">
              {diagnostics}
            </Typography>
          ) : null}
        </Stack>
      ) : (
        formatErrorMessage(error, fallbackMessage)
      )}
    </Alert>
  );
}

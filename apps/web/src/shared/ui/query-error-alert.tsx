'use client';

import { Alert, AlertTitle } from '@mui/material';

type QueryErrorAlertProps = {
  title: string;
  error: unknown;
};

export function QueryErrorAlert({ title, error }: QueryErrorAlertProps) {
  const message =
    error instanceof Error
      ? error.message
      : '데이터를 불러오는 중 알 수 없는 오류가 발생했습니다.';

  return (
    <Alert severity="error" variant="outlined">
      <AlertTitle>{title}</AlertTitle>
      {message}
    </Alert>
  );
}

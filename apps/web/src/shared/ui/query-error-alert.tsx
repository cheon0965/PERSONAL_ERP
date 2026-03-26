'use client';

import { Alert, AlertTitle } from '@mui/material';

type QueryErrorAlertProps = {
  title: string;
  error: unknown;
};

export function QueryErrorAlert({ title, error }: QueryErrorAlertProps) {
  const message = error instanceof Error ? error.message : 'Unknown data loading error.';

  return (
    <Alert severity="error" variant="outlined">
      <AlertTitle>{title}</AlertTitle>
      {message}
    </Alert>
  );
}

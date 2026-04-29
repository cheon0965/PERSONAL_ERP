'use client';

import { Alert, Stack, Typography } from '@mui/material';

export type FeedbackAlertValue = {
  severity: 'success' | 'error' | 'info' | 'warning';
  message: string;
  diagnostics?: string | null;
} | null;

export function FeedbackAlert({ feedback }: { feedback: FeedbackAlertValue }) {
  if (!feedback) {
    return null;
  }

  return (
    <Alert severity={feedback.severity} variant="outlined">
      {feedback.diagnostics ? (
        <Stack spacing={0.75}>
          <Typography variant="body2">{feedback.message}</Typography>
          <Typography variant="caption" color="text.secondary">
            {feedback.diagnostics}
          </Typography>
        </Stack>
      ) : (
        feedback.message
      )}
    </Alert>
  );
}

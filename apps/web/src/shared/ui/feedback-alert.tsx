'use client';

import { Alert } from '@mui/material';

export type FeedbackAlertValue = {
  severity: 'success' | 'error' | 'info' | 'warning';
  message: string;
} | null;

export function FeedbackAlert({ feedback }: { feedback: FeedbackAlertValue }) {
  if (!feedback) {
    return null;
  }

  return (
    <Alert severity={feedback.severity} variant="outlined">
      {feedback.message}
    </Alert>
  );
}

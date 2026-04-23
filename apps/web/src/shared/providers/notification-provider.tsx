'use client';

import * as React from 'react';
import { Alert, Snackbar } from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';

type AppNotificationInput = {
  severity?: AlertColor;
  message: string;
  autoHideDuration?: number;
};

type AppNotificationContextValue = {
  notify: (input: AppNotificationInput) => void;
  notifyError: (message: string, autoHideDuration?: number) => void;
  notifyInfo: (message: string, autoHideDuration?: number) => void;
  notifySuccess: (message: string, autoHideDuration?: number) => void;
  notifyWarning: (message: string, autoHideDuration?: number) => void;
};

type NotificationState = {
  id: number;
  severity: AlertColor;
  message: string;
  autoHideDuration: number;
} | null;

const DEFAULT_AUTO_HIDE_DURATION = 4000;

const AppNotificationContext =
  React.createContext<AppNotificationContextValue | null>(null);

let nextNotificationId = 1;

export function NotificationProvider({
  children
}: React.PropsWithChildren) {
  const [notification, setNotification] = React.useState<NotificationState>(
    null
  );
  const [open, setOpen] = React.useState(false);

  const notify = React.useCallback((input: AppNotificationInput) => {
    setNotification({
      id: nextNotificationId++,
      severity: input.severity ?? 'info',
      message: input.message,
      autoHideDuration: input.autoHideDuration ?? DEFAULT_AUTO_HIDE_DURATION
    });
    setOpen(true);
  }, []);

  const notifySuccess = React.useCallback(
    (message: string, autoHideDuration?: number) => {
      notify({
        severity: 'success',
        message,
        autoHideDuration
      });
    },
    [notify]
  );

  const notifyError = React.useCallback(
    (message: string, autoHideDuration?: number) => {
      notify({
        severity: 'error',
        message,
        autoHideDuration
      });
    },
    [notify]
  );

  const notifyInfo = React.useCallback(
    (message: string, autoHideDuration?: number) => {
      notify({
        severity: 'info',
        message,
        autoHideDuration
      });
    },
    [notify]
  );

  const notifyWarning = React.useCallback(
    (message: string, autoHideDuration?: number) => {
      notify({
        severity: 'warning',
        message,
        autoHideDuration
      });
    },
    [notify]
  );

  const value = React.useMemo<AppNotificationContextValue>(
    () => ({
      notify,
      notifyError,
      notifyInfo,
      notifySuccess,
      notifyWarning
    }),
    [notify, notifyError, notifyInfo, notifySuccess, notifyWarning]
  );

  return (
    <AppNotificationContext.Provider value={value}>
      {children}
      <Snackbar
        key={notification?.id}
        open={open}
        onClose={(_event, reason) => {
          if (reason === 'clickaway') {
            return;
          }

          setOpen(false);
        }}
        autoHideDuration={notification?.autoHideDuration}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          severity={notification?.severity ?? 'info'}
          variant="filled"
          onClose={() => setOpen(false)}
          sx={{ width: '100%' }}
        >
          {notification?.message}
        </Alert>
      </Snackbar>
    </AppNotificationContext.Provider>
  );
}

export function useAppNotification() {
  const context = React.useContext(AppNotificationContext);

  if (!context) {
    throw new Error(
      'useAppNotification must be used within a NotificationProvider.'
    );
  }

  return context;
}

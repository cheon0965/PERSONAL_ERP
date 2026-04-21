'use client';

import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import { CorrectJournalEntryDialogContent } from './correct-journal-entry-dialog-content';
import { ReverseJournalEntryDialogContent } from './reverse-journal-entry-dialog-content';
import type { JournalEntryAdjustmentDialogProps } from './journal-entry-adjustment-dialog.types';

export type { JournalEntryAdjustmentMode } from './journal-entry-adjustment-dialog.types';

export function JournalEntryAdjustmentDialog({
  open,
  mode,
  entry,
  adjustmentPeriod,
  journalWritablePeriods,
  onClose,
  onCompleted
}: JournalEntryAdjustmentDialogProps) {
  if (!mode || !entry) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={mode === 'correct' ? 'md' : 'sm'}
    >
      <DialogTitle>
        {mode === 'reverse'
          ? `${entry.entryNumber} 반전 전표 생성`
          : `${entry.entryNumber} 정정 전표 생성`}
      </DialogTitle>
      <DialogContent dividers>
        {mode === 'reverse' ? (
          <ReverseJournalEntryDialogContent
            entry={entry}
            adjustmentPeriod={adjustmentPeriod}
            journalWritablePeriods={journalWritablePeriods}
            onClose={onClose}
            onCompleted={onCompleted}
          />
        ) : (
          <CorrectJournalEntryDialogContent
            entry={entry}
            adjustmentPeriod={adjustmentPeriod}
            journalWritablePeriods={journalWritablePeriods}
            onClose={onClose}
            onCompleted={onCompleted}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

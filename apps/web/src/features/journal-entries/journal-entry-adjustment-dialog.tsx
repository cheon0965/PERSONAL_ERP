'use client';

import * as React from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type {
  AccountingPeriodItem,
  AccountSubjectItem,
  CorrectJournalEntryRequest,
  FundingAccountItem,
  JournalEntryItem,
  ReverseJournalEntryRequest
} from '@personal-erp/contracts';
import type { FieldErrors } from 'react-hook-form';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { currentAccountingPeriodQueryKey } from '@/features/accounting-periods/accounting-periods.api';
import {
  accountSubjectsQueryKey,
  fundingAccountsQueryKey,
  getAccountSubjects,
  getFundingAccounts
} from '@/features/reference-data/reference-data.api';
import { collectedTransactionsQueryKey } from '@/features/transactions/transactions.api';
import { getTodayDateInputValue } from '@/shared/lib/date-input';
import { formatWon } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  buildCorrectJournalEntryFallbackItem,
  buildReverseJournalEntryFallbackItem,
  correctJournalEntry,
  journalEntriesQueryKey,
  reverseJournalEntry
} from './journal-entries.api';

export type JournalEntryAdjustmentMode = 'reverse' | 'correct';

type JournalEntryAdjustmentDialogProps = {
  open: boolean;
  mode: JournalEntryAdjustmentMode | null;
  entry: JournalEntryItem | null;
  currentPeriod: AccountingPeriodItem | null;
  onClose: () => void;
  onCompleted: (
    createdEntry: JournalEntryItem,
    mode: JournalEntryAdjustmentMode
  ) => void;
};

type SubmitFeedback =
  | {
      severity: 'success' | 'error';
      message: string;
    }
  | null;

const reverseJournalEntrySchema = z.object({
  entryDate: z.string().min(1, '전표 일자를 입력해 주세요.'),
  reason: z.string().max(300, '사유는 300자 이하여야 합니다.').optional()
});

const correctionLineSchema = z
  .object({
    accountSubjectId: z.string().min(1, '계정과목을 선택해 주세요.'),
    fundingAccountId: z.string().optional(),
    debitAmount: z.coerce
      .number()
      .int('차변 금액은 정수여야 합니다.')
      .min(0, '차변 금액은 0 이상이어야 합니다.'),
    creditAmount: z.coerce
      .number()
      .int('대변 금액은 정수여야 합니다.')
      .min(0, '대변 금액은 0 이상이어야 합니다.'),
    description: z
      .string()
      .max(300, '라인 설명은 300자 이하여야 합니다.')
      .optional()
  })
  .superRefine((value, context) => {
    const hasDebit = value.debitAmount > 0;
    const hasCredit = value.creditAmount > 0;

    if (hasDebit === hasCredit) {
      context.addIssue({
        code: 'custom',
        path: ['debitAmount'],
        message: '각 라인은 차변 또는 대변 중 한쪽만 입력해 주세요.'
      });
    }
  });

const correctJournalEntrySchema = z
  .object({
    entryDate: z.string().min(1, '전표 일자를 입력해 주세요.'),
    reason: z
      .string()
      .trim()
      .min(1, '정정 사유를 입력해 주세요.')
      .max(300, '정정 사유는 300자 이하여야 합니다.'),
    lines: z
      .array(correctionLineSchema)
      .min(2, '정정 전표에는 최소 2개 라인이 필요합니다.')
  })
  .superRefine((value, context) => {
    const totalDebit = value.lines.reduce(
      (sum, line) => sum + line.debitAmount,
      0
    );
    const totalCredit = value.lines.reduce(
      (sum, line) => sum + line.creditAmount,
      0
    );

    if (totalDebit <= 0 || totalCredit <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['lines'],
        message: '정정 전표 금액은 0보다 커야 합니다.'
      });
    }

    if (totalDebit !== totalCredit) {
      context.addIssue({
        code: 'custom',
        path: ['lines'],
        message: '차변 합계와 대변 합계가 일치해야 합니다.'
      });
    }
  });

type ReverseJournalEntryFormInput = z.infer<typeof reverseJournalEntrySchema>;
type CorrectJournalEntryFormInput = z.infer<typeof correctJournalEntrySchema>;

type CorrectionLineInput = CorrectJournalEntryFormInput['lines'][number];

export function JournalEntryAdjustmentDialog({
  open,
  mode,
  entry,
  currentPeriod,
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
            currentPeriod={currentPeriod}
            onClose={onClose}
            onCompleted={onCompleted}
          />
        ) : (
          <CorrectJournalEntryDialogContent
            entry={entry}
            currentPeriod={currentPeriod}
            onClose={onClose}
            onCompleted={onCompleted}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReverseJournalEntryDialogContent({
  entry,
  currentPeriod,
  onClose,
  onCompleted
}: Pick<
  JournalEntryAdjustmentDialogProps,
  'currentPeriod' | 'onClose' | 'onCompleted'
> & {
  entry: JournalEntryItem;
}) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const form = useForm<ReverseJournalEntryFormInput>({
    resolver: zodResolver(reverseJournalEntrySchema),
    defaultValues: buildReverseDefaultValues(currentPeriod)
  });

  React.useEffect(() => {
    form.reset(buildReverseDefaultValues(currentPeriod));
    setFeedback(null);
  }, [currentPeriod, entry.id, form]);

  const mutation = useMutation({
    mutationFn: (payload: ReverseJournalEntryRequest) =>
      reverseJournalEntry(
        entry.id,
        payload,
        buildReverseJournalEntryFallbackItem(entry, payload)
      ),
    onSuccess: async (createdEntry) => {
      await invalidateAdjustmentQueries(queryClient);
      onCompleted(createdEntry, 'reverse');
      onClose();
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '반전 전표를 생성하지 못했습니다.'
      });
    }
  });

  const canSubmit = Boolean(currentPeriod);

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        if (!currentPeriod) {
          setFeedback({
            severity: 'error',
            message:
              '현재 열린 운영 기간이 없어 반전 전표를 생성할 수 없습니다.'
          });
          return;
        }

        if (!isWithinPeriod(values.entryDate, currentPeriod)) {
          setFeedback({
            severity: 'error',
            message:
              '반전 전표 일자는 현재 열린 운영 기간 안에 있어야 합니다.'
          });
          return;
        }

        await mutation.mutateAsync({
          entryDate: values.entryDate,
          reason: trimOptionalText(values.reason)
        });
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        {!currentPeriod ? (
          <Alert severity="warning" variant="outlined">
            현재 열린 운영 기간이 없어 반전 전표를 시작할 수 없습니다.
          </Alert>
        ) : (
          <Alert severity="info" variant="outlined">
            {entry.entryNumber} 전표를 {currentPeriod.monthLabel} 운영 기간의 조정
            전표로 반전합니다.
          </Alert>
        )}
        {feedback ? (
          <Alert severity={feedback.severity} variant="outlined">
            {feedback.message}
          </Alert>
        ) : null}

        <Stack spacing={1}>
          <Typography variant="subtitle2">원전표 요약</Typography>
          <Typography variant="body2" color="text.secondary">
            상태: {entry.status} | 전표 일자: {entry.entryDate.slice(0, 10)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {entry.memo ?? '메모 없음'}
          </Typography>
        </Stack>

        <TextField
          label="반전 전표 일자"
          type="date"
          disabled={!canSubmit || mutation.isPending}
          error={Boolean(form.formState.errors.entryDate)}
          helperText={
            form.formState.errors.entryDate?.message ??
            (currentPeriod
              ? `${currentPeriod.monthLabel} 운영 기간 안에서만 반전할 수 있습니다.`
              : '현재 열린 운영 기간이 필요합니다.')
          }
          {...form.register('entryDate')}
        />
        <TextField
          label="반전 사유"
          multiline
          minRows={3}
          disabled={mutation.isPending}
          error={Boolean(form.formState.errors.reason)}
          helperText={
            form.formState.errors.reason?.message ??
            '선택 사항입니다. 비우면 기본 메모를 사용합니다.'
          }
          {...form.register('reason')}
        />
      </Stack>
      <DialogActions sx={{ px: 0, pt: appLayout.cardGap }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          취소
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!canSubmit || mutation.isPending}
        >
          {mutation.isPending ? '반전 생성 중...' : '반전 전표 생성'}
        </Button>
      </DialogActions>
    </form>
  );
}

function CorrectJournalEntryDialogContent({
  entry,
  currentPeriod,
  onClose,
  onCompleted
}: Pick<
  JournalEntryAdjustmentDialogProps,
  'currentPeriod' | 'onClose' | 'onCompleted'
> & {
  entry: JournalEntryItem;
}) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const accountSubjectsQuery = useQuery({
    queryKey: accountSubjectsQueryKey,
    queryFn: getAccountSubjects
  });
  const fundingAccountsQuery = useQuery({
    queryKey: fundingAccountsQueryKey,
    queryFn: getFundingAccounts
  });
  const accountSubjects = React.useMemo(
    () => accountSubjectsQuery.data ?? [],
    [accountSubjectsQuery.data]
  );
  const fundingAccounts = React.useMemo(
    () => fundingAccountsQuery.data ?? [],
    [fundingAccountsQuery.data]
  );
  const defaultValues = React.useMemo(
    () =>
      buildCorrectionDefaultValues(
        entry,
        currentPeriod,
        accountSubjects,
        fundingAccounts
      ),
    [accountSubjects, currentPeriod, entry, fundingAccounts]
  );
  const form = useForm<CorrectJournalEntryFormInput>({
    resolver: zodResolver(correctJournalEntrySchema),
    defaultValues
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lines'
  });

  React.useEffect(() => {
    form.reset(defaultValues);
    setFeedback(null);
  }, [defaultValues, form]);

  const watchedLines = form.watch('lines');
  const totals = React.useMemo(() => {
    return (watchedLines ?? []).reduce(
      (accumulator, line) => ({
        debit: accumulator.debit + Number(line?.debitAmount ?? 0),
        credit: accumulator.credit + Number(line?.creditAmount ?? 0)
      }),
      { debit: 0, credit: 0 }
    );
  }, [watchedLines]);

  const mutation = useMutation({
    mutationFn: (payload: CorrectJournalEntryRequest) =>
      correctJournalEntry(
        entry.id,
        payload,
        buildCorrectJournalEntryFallbackItem(entry, payload, {
          accountSubjects,
          fundingAccounts
        })
      ),
    onSuccess: async (createdEntry) => {
      await invalidateAdjustmentQueries(queryClient);
      onCompleted(createdEntry, 'correct');
      onClose();
    },
    onError: (error) => {
      setFeedback({
        severity: 'error',
        message:
          error instanceof Error
            ? error.message
            : '정정 전표를 생성하지 못했습니다.'
      });
    }
  });

  const referenceError =
    accountSubjectsQuery.error ?? fundingAccountsQuery.error ?? null;
  const linesMessage = readLinesErrorMessage(form.formState.errors.lines);
  const canSubmit =
    Boolean(currentPeriod) &&
    !referenceError &&
    accountSubjects.length > 0 &&
    fundingAccounts.length > 0;

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        if (!currentPeriod) {
          setFeedback({
            severity: 'error',
            message:
              '현재 열린 운영 기간이 없어 정정 전표를 생성할 수 없습니다.'
          });
          return;
        }

        if (!isWithinPeriod(values.entryDate, currentPeriod)) {
          setFeedback({
            severity: 'error',
            message:
              '정정 전표 일자는 현재 열린 운영 기간 안에 있어야 합니다.'
          });
          return;
        }

        await mutation.mutateAsync({
          entryDate: values.entryDate,
          reason: values.reason.trim(),
          lines: values.lines.map((line) => ({
            accountSubjectId: line.accountSubjectId,
            fundingAccountId: trimOptionalText(line.fundingAccountId),
            debitAmount: Number(line.debitAmount),
            creditAmount: Number(line.creditAmount),
            description: trimOptionalText(line.description)
          }))
        });
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        {!currentPeriod ? (
          <Alert severity="warning" variant="outlined">
            현재 열린 운영 기간이 없어 정정 전표를 시작할 수 없습니다.
          </Alert>
        ) : (
          <Alert severity="info" variant="outlined">
            {entry.entryNumber} 전표를 기준으로 {currentPeriod.monthLabel} 운영
            기간에 정정 전표를 만듭니다.
          </Alert>
        )}
        {referenceError ? (
          <QueryErrorAlert
            title="정정 전표 참조데이터를 불러오지 못했습니다."
            error={referenceError}
          />
        ) : null}
        {feedback ? (
          <Alert severity={feedback.severity} variant="outlined">
            {feedback.message}
          </Alert>
        ) : null}
        {linesMessage ? (
          <Alert severity="error" variant="outlined">
            {linesMessage}
          </Alert>
        ) : null}

        <Grid container spacing={appLayout.fieldGap}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="정정 전표 일자"
              type="date"
              disabled={!canSubmit || mutation.isPending}
              error={Boolean(form.formState.errors.entryDate)}
              helperText={
                form.formState.errors.entryDate?.message ??
                (currentPeriod
                  ? `${currentPeriod.monthLabel} 운영 기간 안에서만 정정할 수 있습니다.`
                  : '현재 열린 운영 기간이 필요합니다.')
              }
              {...form.register('entryDate')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              label="정정 사유"
              disabled={mutation.isPending}
              error={Boolean(form.formState.errors.reason)}
              helperText={
                form.formState.errors.reason?.message ??
                '왜 다시 전표를 세우는지 간단히 남겨 주세요.'
              }
              {...form.register('reason')}
            />
          </Grid>
        </Grid>

        <Stack spacing={1}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
          >
            <div>
              <Typography variant="subtitle2">정정 라인</Typography>
              <Typography variant="body2" color="text.secondary">
                원전표 라인을 기준으로 시작하고 필요한 만큼 금액이나 계정을 조정할
                수 있습니다.
              </Typography>
            </div>
            <Button
              variant="outlined"
              startIcon={<AddRoundedIcon />}
              onClick={() => append(createEmptyCorrectionLine())}
              disabled={mutation.isPending}
            >
              라인 추가
            </Button>
          </Stack>

          {fields.map((field, index) => (
            <Box
              key={field.id}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 3,
                p: appLayout.cardPadding
              }}
            >
              <Stack spacing={appLayout.fieldGap}>
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Typography variant="subtitle2">라인 {index + 1}</Typography>
                  <IconButton
                    aria-label={`라인 ${index + 1} 삭제`}
                    size="small"
                    disabled={fields.length <= 2 || mutation.isPending}
                    onClick={() => remove(index)}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Grid container spacing={appLayout.fieldGap}>
                  <Grid size={{ xs: 12, md: 5 }}>
                    <TextField
                      select
                      label="계정과목"
                      disabled={mutation.isPending}
                      error={Boolean(
                        form.formState.errors.lines?.[index]?.accountSubjectId
                      )}
                      helperText={
                        form.formState.errors.lines?.[index]?.accountSubjectId
                          ?.message ?? ' '
                      }
                      {...form.register(`lines.${index}.accountSubjectId`)}
                    >
                      {accountSubjects.map((accountSubject) => (
                        <MenuItem key={accountSubject.id} value={accountSubject.id}>
                          {accountSubject.code} {accountSubject.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                      select
                      label="자금수단"
                      disabled={mutation.isPending}
                      helperText="선택 사항"
                      {...form.register(`lines.${index}.fundingAccountId`)}
                    >
                      <MenuItem value="">자금수단 없음</MenuItem>
                      {fundingAccounts.map((fundingAccount) => (
                        <MenuItem key={fundingAccount.id} value={fundingAccount.id}>
                          {fundingAccount.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <TextField
                      label="차변"
                      type="number"
                      disabled={mutation.isPending}
                      error={Boolean(
                        form.formState.errors.lines?.[index]?.debitAmount
                      )}
                      helperText={
                        form.formState.errors.lines?.[index]?.debitAmount?.message ??
                        ' '
                      }
                      {...form.register(`lines.${index}.debitAmount`)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 2 }}>
                    <TextField
                      label="대변"
                      type="number"
                      disabled={mutation.isPending}
                      error={Boolean(
                        form.formState.errors.lines?.[index]?.creditAmount
                      )}
                      helperText={
                        form.formState.errors.lines?.[index]?.creditAmount?.message ??
                        ' '
                      }
                      {...form.register(`lines.${index}.creditAmount`)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="라인 설명"
                      disabled={mutation.isPending}
                      helperText="선택 사항"
                      {...form.register(`lines.${index}.description`)}
                    />
                  </Grid>
                </Grid>
              </Stack>
            </Box>
          ))}
        </Stack>

        <Divider />
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          justifyContent="space-between"
        >
          <Typography variant="body2" color="text.secondary">
            차변 합계 {formatWon(totals.debit)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            대변 합계 {formatWon(totals.credit)}
          </Typography>
        </Stack>
      </Stack>
      <DialogActions sx={{ px: 0, pt: appLayout.cardGap }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          취소
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={!canSubmit || mutation.isPending}
        >
          {mutation.isPending ? '정정 생성 중...' : '정정 전표 생성'}
        </Button>
      </DialogActions>
    </form>
  );
}

async function invalidateAdjustmentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: journalEntriesQueryKey }),
    queryClient.invalidateQueries({ queryKey: collectedTransactionsQueryKey }),
    queryClient.invalidateQueries({ queryKey: currentAccountingPeriodQueryKey }),
    queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
    queryClient.invalidateQueries({ queryKey: ['forecast'] })
  ]);
}

function buildReverseDefaultValues(
  currentPeriod: AccountingPeriodItem | null
): ReverseJournalEntryFormInput {
  return {
    entryDate: resolveAdjustmentEntryDate(currentPeriod),
    reason: ''
  };
}

function buildCorrectionDefaultValues(
  entry: JournalEntryItem,
  currentPeriod: AccountingPeriodItem | null,
  accountSubjects: AccountSubjectItem[],
  fundingAccounts: FundingAccountItem[]
): CorrectJournalEntryFormInput {
  return {
    entryDate: resolveAdjustmentEntryDate(currentPeriod),
    reason: '',
    lines:
      entry.lines.length > 0
        ? entry.lines.map((line) => {
            const accountSubject =
              accountSubjects.find(
                (candidate) => candidate.code === line.accountSubjectCode
              ) ?? null;
            const fundingAccount =
              line.fundingAccountName == null
                ? null
                : (fundingAccounts.find(
                    (candidate) => candidate.name === line.fundingAccountName
                  ) ?? null);

            return {
              accountSubjectId: accountSubject?.id ?? '',
              fundingAccountId: fundingAccount?.id ?? '',
              debitAmount: line.debitAmount,
              creditAmount: line.creditAmount,
              description: line.description ?? ''
            };
          })
        : [createEmptyCorrectionLine(), createEmptyCorrectionLine()]
  };
}

function resolveAdjustmentEntryDate(
  currentPeriod: AccountingPeriodItem | null
): string {
  const today = getTodayDateInputValue();

  if (!currentPeriod) {
    return today;
  }

  if (isWithinPeriod(today, currentPeriod)) {
    return today;
  }

  return currentPeriod.startDate.slice(0, 10);
}

function isWithinPeriod(
  entryDate: string,
  currentPeriod: AccountingPeriodItem | null
): boolean {
  if (!currentPeriod) {
    return false;
  }

  const targetTime = Date.parse(`${entryDate}T00:00:00.000Z`);
  const startTime = Date.parse(currentPeriod.startDate);
  const endTime = Date.parse(currentPeriod.endDate);

  return targetTime >= startTime && targetTime < endTime;
}

function createEmptyCorrectionLine(): CorrectionLineInput {
  return {
    accountSubjectId: '',
    fundingAccountId: '',
    debitAmount: 0,
    creditAmount: 0,
    description: ''
  };
}

function trimOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function readLinesErrorMessage(
  linesError: FieldErrors<CorrectJournalEntryFormInput>['lines']
) {
  if (!linesError) {
    return null;
  }

  return 'message' in linesError && typeof linesError.message === 'string'
    ? linesError.message
    : null;
}

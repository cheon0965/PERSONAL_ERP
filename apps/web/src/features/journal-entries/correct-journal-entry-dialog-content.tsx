import * as React from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  DialogActions,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import type { CorrectJournalEntryRequest } from '@personal-erp/contracts';
import { sumMoneyWon, parseMoneyWon } from '@personal-erp/money';
import { useFieldArray, useForm } from 'react-hook-form';
import { findAccountingPeriodForDate } from '@/features/accounting-periods/accounting-period-selection';
import {
  accountSubjectsQueryKey,
  fundingAccountsManagementQueryKey,
  fundingAccountsQueryKey,
  getAccountSubjects,
  getFundingAccounts
} from '@/features/reference-data/reference-data.api';
import { formatWon } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import {
  buildCorrectJournalEntryFallbackItem,
  correctJournalEntry
} from './journal-entries.api';
import {
  buildCorrectionDefaultValues,
  createEmptyCorrectionLine,
  invalidateAdjustmentQueries,
  readLinesErrorMessage,
  trimOptionalText
} from './journal-entry-adjustment-dialog.shared';
import {
  correctJournalEntrySchema,
  type CorrectJournalEntryFormInput,
  type JournalEntryAdjustmentContentProps,
  type SubmitFeedback
} from './journal-entry-adjustment-dialog.types';

export function CorrectJournalEntryDialogContent({
  entry,
  adjustmentPeriod,
  journalWritablePeriods,
  onClose,
  onCompleted
}: JournalEntryAdjustmentContentProps) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = React.useState<SubmitFeedback>(null);
  const referencedFundingAccountNames = React.useMemo(
    () =>
      new Set(
        entry.lines
          .map((line) => line.fundingAccountName)
          .filter((value): value is string => Boolean(value))
      ),
    [entry.lines]
  );
  const includeInactiveFundingAccounts = referencedFundingAccountNames.size > 0;
  const accountSubjectsQuery = useQuery({
    queryKey: accountSubjectsQueryKey,
    queryFn: getAccountSubjects
  });
  const fundingAccountsQuery = useQuery({
    queryKey: includeInactiveFundingAccounts
      ? fundingAccountsManagementQueryKey
      : fundingAccountsQueryKey,
    queryFn: () =>
      getFundingAccounts({ includeInactive: includeInactiveFundingAccounts })
  });
  const accountSubjects = React.useMemo(
    () => accountSubjectsQuery.data ?? [],
    [accountSubjectsQuery.data]
  );
  const fundingAccounts = React.useMemo(
    () =>
      (fundingAccountsQuery.data ?? []).filter(
        (fundingAccount) =>
          fundingAccount.status === 'ACTIVE' ||
          referencedFundingAccountNames.has(fundingAccount.name)
      ),
    [fundingAccountsQuery.data, referencedFundingAccountNames]
  );
  const defaultValues = React.useMemo(
    () =>
      buildCorrectionDefaultValues(
        entry,
        adjustmentPeriod,
        accountSubjects,
        fundingAccounts
      ),
    [accountSubjects, adjustmentPeriod, entry, fundingAccounts]
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
    const debit = sumMoneyWon(
      (watchedLines ?? []).map((line) => parseMoneyWon(line?.debitAmount) ?? 0)
    );
    const credit = sumMoneyWon(
      (watchedLines ?? []).map((line) => parseMoneyWon(line?.creditAmount) ?? 0)
    );

    return {
      debit,
      credit
    };
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
    journalWritablePeriods.length > 0 &&
    !referenceError &&
    accountSubjects.length > 0 &&
    fundingAccounts.length > 0;

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => {
        setFeedback(null);

        if (journalWritablePeriods.length === 0) {
          setFeedback({
            severity: 'error',
            message:
              '전표 입력 가능한 운영 기간이 없어 정정 전표를 생성할 수 없습니다.'
          });
          return;
        }

        if (
          !findAccountingPeriodForDate(journalWritablePeriods, values.entryDate)
        ) {
          setFeedback({
            severity: 'error',
            message:
              '정정 전표 일자는 전표 입력 가능한 열린 운영 기간 안에 있어야 합니다.'
          });
          return;
        }

        await mutation.mutateAsync({
          entryDate: values.entryDate,
          reason: values.reason.trim(),
          lines: values.lines.map((line) => ({
            accountSubjectId: line.accountSubjectId,
            fundingAccountId: trimOptionalText(line.fundingAccountId),
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            description: trimOptionalText(line.description)
          }))
        });
      })}
    >
      <Stack spacing={appLayout.cardGap}>
        {!journalWritablePeriods.length ? (
          <Alert severity="warning" variant="outlined">
            전표 입력 가능한 운영 기간이 없어 정정 전표를 시작할 수 없습니다.
          </Alert>
        ) : (
          <Alert severity="info" variant="outlined">
            {entry.entryNumber} 전표를 기준으로 {adjustmentPeriod?.monthLabel}{' '}
            운영 기간을 기본 기준으로 정정 전표를 만듭니다.
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
                (journalWritablePeriods.length > 1
                  ? '전표 입력 가능한 열린 운영 기간 안에서만 정정할 수 있습니다.'
                  : adjustmentPeriod
                    ? `${adjustmentPeriod.monthLabel} 운영 기간 안에서만 정정할 수 있습니다.`
                    : '전표 입력 가능한 운영 기간이 필요합니다.')
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
                원전표 라인을 기준으로 시작하고 필요한 만큼 금액이나 계정을
                조정할 수 있습니다.
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
                        <MenuItem
                          key={accountSubject.id}
                          value={accountSubject.id}
                        >
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
                        <MenuItem
                          key={fundingAccount.id}
                          value={fundingAccount.id}
                        >
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
                        form.formState.errors.lines?.[index]?.debitAmount
                          ?.message ?? ' '
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
                        form.formState.errors.lines?.[index]?.creditAmount
                          ?.message ?? ' '
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

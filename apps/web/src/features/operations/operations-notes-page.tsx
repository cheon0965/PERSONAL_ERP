'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import type { OperationsNoteKind } from '@personal-erp/contracts';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateTime, formatNumber } from '@/shared/lib/format';
import { appLayout } from '@/shared/ui/layout-metrics';
import { PageHeader } from '@/shared/ui/page-header';
import { QueryErrorAlert } from '@/shared/ui/query-error-alert';
import { SectionCard } from '@/shared/ui/section-card';
import { SummaryCard } from '@/shared/ui/summary-card';
import {
  createOperationsNote,
  getOperationsNotes,
  operationsNotesQueryKey
} from './operations.api';
import { readOperationsNoteKindLabel } from './operations-labels';
import { OperationsSectionNav } from './operations-section-nav';

const noteKinds: OperationsNoteKind[] = [
  'GENERAL',
  'MONTH_END',
  'EXCEPTION',
  'ALERT',
  'FOLLOW_UP'
];

export function OperationsNotesPage() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<OperationsNoteKind>('GENERAL');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [relatedHref, setRelatedHref] = useState('');
  const [periodId, setPeriodId] = useState('');
  const notesQuery = useQuery({
    queryKey: operationsNotesQueryKey,
    queryFn: getOperationsNotes
  });
  const createMutation = useMutation({
    mutationFn: createOperationsNote,
    onSuccess: async () => {
      setKind('GENERAL');
      setTitle('');
      setBody('');
      setRelatedHref('');
      setPeriodId('');
      await queryClient.invalidateQueries({
        queryKey: operationsNotesQueryKey
      });
    }
  });
  const notes = notesQuery.data;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createMutation.mutateAsync({
      kind,
      title,
      body,
      relatedHref: relatedHref.trim() || null,
      periodId: periodId.trim() || null
    });
  };

  return (
    <Stack spacing={appLayout.pageGap}>
      <PageHeader
        eyebrow="운영 지원"
        title="운영 메모 / 인수인계"
        description="월 마감, 예외 처리, 알림 후속 조치처럼 다음 운영자가 알아야 할 내용을 날짜와 작성자 기준으로 남깁니다."
      />

      <OperationsSectionNav />

      {notesQuery.error ? (
        <QueryErrorAlert
          title="운영 메모를 불러오지 못했습니다."
          error={notesQuery.error}
        />
      ) : null}

      {createMutation.error ? (
        <Alert severity="error">
          {createMutation.error instanceof Error
            ? createMutation.error.message
            : '운영 메모를 저장하지 못했습니다.'}
        </Alert>
      ) : null}

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="최근 메모"
            value={formatNumber(notes?.totalCount ?? 0, 0)}
            subtitle="최근 50건 기준"
            tone="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="월 마감 메모"
            value={formatNumber(
              notes?.items.filter((item) => item.kind === 'MONTH_END').length ??
                0,
              0
            )}
            tone="warning"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <SummaryCard
            title="최근 작성"
            value={formatDateTime(notes?.items[0]?.createdAt ?? null)}
            tone="neutral"
          />
        </Grid>
      </Grid>

      <Grid container spacing={appLayout.sectionGap}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard
            title="새 인수인계 메모"
            description="첨부, 멘션, 승인 워크플로는 다음 단계로 미루고 텍스트 기록부터 안전하게 남깁니다."
          >
            <Stack component="form" spacing={2} onSubmit={handleSubmit}>
              <TextField
                select
                label="구분"
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as OperationsNoteKind)
                }
                fullWidth
              >
                {noteKinds.map((option) => (
                  <MenuItem key={option} value={option}>
                    {readOperationsNoteKindLabel(option)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="제목"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                inputProps={{ maxLength: 191 }}
                required
                fullWidth
              />
              <TextField
                label="관련 링크"
                value={relatedHref}
                onChange={(event) => setRelatedHref(event.target.value)}
                placeholder="/operations/alerts"
                inputProps={{ maxLength: 300 }}
                fullWidth
              />
              <TextField
                label="운영 기간 ID"
                value={periodId}
                onChange={(event) => setPeriodId(event.target.value)}
                placeholder="선택 입력"
                fullWidth
              />
              <TextField
                label="내용"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                inputProps={{ maxLength: 5000 }}
                minRows={6}
                multiline
                required
                fullWidth
              />
              <Button
                type="submit"
                variant="contained"
                disabled={
                  createMutation.isPending || !title.trim() || !body.trim()
                }
              >
                {createMutation.isPending ? '저장 중...' : '메모 저장'}
              </Button>
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard
            title="최근 인수인계 기록"
            description="작성자 멤버십 ID와 관련 링크를 함께 남겨 후속 추적이 가능하도록 합니다."
          >
            <Stack spacing={1.5}>
              {(notes?.items ?? []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  아직 운영 메모가 없습니다.
                </Typography>
              ) : null}
              {(notes?.items ?? []).map((note) => (
                <Box
                  key={note.id}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider'
                  }}
                >
                  <Stack spacing={1.25}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1}
                      justifyContent="space-between"
                      alignItems={{ md: 'center' }}
                    >
                      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        <Chip
                          label={readOperationsNoteKindLabel(note.kind)}
                          color={note.kind === 'MONTH_END' ? 'warning' : 'primary'}
                          size="small"
                        />
                        {note.periodLabel ? (
                          <Chip
                            label={note.periodLabel}
                            variant="outlined"
                            size="small"
                          />
                        ) : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateTime(note.createdAt)}
                      </Typography>
                    </Stack>
                    <Typography variant="subtitle2">{note.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {note.body}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      작성자 멤버십: {note.authorMembershipId}
                    </Typography>
                    {note.relatedHref ? (
                      <Button
                        component={Link}
                        href={note.relatedHref}
                        variant="outlined"
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        관련 화면 열기
                      </Button>
                    ) : null}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </Stack>
  );
}

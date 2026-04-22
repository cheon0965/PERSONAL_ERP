import * as React from 'react';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { AccountingPeriodItem } from '@personal-erp/contracts';
import { appLayout } from '@/shared/ui/layout-metrics';
import { SectionCard } from '@/shared/ui/section-card';
import { SegmentedTabs } from '@/shared/ui/section-tabs';
import type { AccountingPeriodReopenEligibility } from './accounting-period-reopen-eligibility';
import { readMembershipRoleLabel } from './accounting-periods-page.helpers';
import { OpenAccountingPeriodSection } from './accounting-periods-page.sections';

type PeriodLifecycleActionProps = {
  openPeriod: AccountingPeriodItem | null;
  reopenPeriod: AccountingPeriodItem | null;
  lockedPeriods: AccountingPeriodItem[];
  reopenEligibilityByPeriodId: Record<
    string,
    AccountingPeriodReopenEligibility
  >;
  selectedReopenEligibility: AccountingPeriodReopenEligibility | null;
  selectedReopenPeriodId: string | null;
  membershipRole: string | null;
  canClosePeriod: boolean;
  canReopenPeriod: boolean;
  hasWorkspace: boolean;
  closeNote: string;
  reopenReason: string;
  closePending: boolean;
  reopenPending: boolean;
  onCloseNoteChange: (value: string) => void;
  onReopenReasonChange: (value: string) => void;
  onSelectReopenPeriod: (periodId: string | null) => void;
  onClosePeriod: () => Promise<void> | void;
  onReopenPeriod: () => Promise<void> | void;
};

export function PeriodOperationsSection(
  props: Parameters<typeof OpenAccountingPeriodSection>[0] &
    PeriodLifecycleActionProps & {
      availableTabs?: readonly PeriodOperationTab[];
      defaultTab?: PeriodOperationTab;
      forcedTab?: PeriodOperationTab;
      hideTabs?: boolean;
      headingTitle?: string;
      headingDescription?: string;
    }
) {
  const {
    openPeriod,
    reopenPeriod,
    availableTabs,
    defaultTab,
    forcedTab,
    hideTabs = false,
    headingTitle = '운영 작업',
    headingDescription
  } = props;
  const tabItems = React.useMemo(
    () =>
      periodOperationTabItems.filter(
        (item) => availableTabs?.includes(item.value) ?? true
      ),
    [availableTabs]
  );
  const [activeTab, setActiveTab] = React.useState<PeriodOperationTab>(
    () =>
      forcedTab ??
      pickDefaultPeriodOperationTab({
        openPeriod,
        reopenPeriod,
        availableTabs,
        defaultTab
      })
  );

  React.useEffect(() => {
    if (forcedTab) {
      setActiveTab(forcedTab);
      return;
    }

    setActiveTab((currentTab) => {
      if (availableTabs && !availableTabs.includes(currentTab)) {
        return pickDefaultPeriodOperationTab({
          openPeriod,
          reopenPeriod,
          availableTabs,
          defaultTab
        });
      }

      if (currentTab === 'close' && !openPeriod) {
        return pickDefaultPeriodOperationTab({
          openPeriod,
          reopenPeriod,
          availableTabs,
          defaultTab
        });
      }

      if (currentTab === 'reopen' && !reopenPeriod) {
        return pickDefaultPeriodOperationTab({
          openPeriod,
          reopenPeriod,
          availableTabs,
          defaultTab
        });
      }

      return currentTab;
    });
  }, [availableTabs, defaultTab, forcedTab, openPeriod, reopenPeriod]);

  return (
    <Stack spacing={appLayout.cardGap} id="accounting-period-workbench">
      <Stack spacing={0.5}>
        <Typography variant="h6">{headingTitle}</Typography>
        <Typography variant="body2" color="text.secondary">
          {headingDescription ??
            (openPeriod
              ? `${openPeriod.monthLabel} 월 기준으로 마감 준비 또는 운영 메모를 처리합니다.`
              : reopenPeriod
                ? `${reopenPeriod.monthLabel} 잠금 월 재오픈 여부를 검토합니다.`
                : '새 운영 월을 열 준비를 진행합니다.')}
        </Typography>
      </Stack>
      {!hideTabs ? (
        <SegmentedTabs
          ariaLabel="월 운영 작업 선택"
          items={tabItems}
          value={activeTab}
          onChange={setActiveTab}
        />
      ) : null}

      {activeTab === 'open' ? <OpenAccountingPeriodSection {...props} /> : null}

      {activeTab === 'close' ? (
        <CloseAccountingPeriodSection
          openPeriod={props.openPeriod}
          membershipRole={props.membershipRole}
          canClosePeriod={props.canClosePeriod}
          hasWorkspace={props.hasWorkspace}
          closeNote={props.closeNote}
          closePending={props.closePending}
          onCloseNoteChange={props.onCloseNoteChange}
          onClosePeriod={props.onClosePeriod}
        />
      ) : null}

      {activeTab === 'reopen' ? (
        <ReopenAccountingPeriodSection
          lockedPeriods={props.lockedPeriods}
          reopenEligibilityByPeriodId={props.reopenEligibilityByPeriodId}
          reopenPeriod={props.reopenPeriod}
          selectedReopenEligibility={props.selectedReopenEligibility}
          selectedReopenPeriodId={props.selectedReopenPeriodId}
          membershipRole={props.membershipRole}
          canReopenPeriod={props.canReopenPeriod}
          hasWorkspace={props.hasWorkspace}
          reopenReason={props.reopenReason}
          reopenPending={props.reopenPending}
          onSelectReopenPeriod={props.onSelectReopenPeriod}
          onReopenReasonChange={props.onReopenReasonChange}
          onReopenPeriod={props.onReopenPeriod}
        />
      ) : null}
    </Stack>
  );
}

function CloseAccountingPeriodSection({
  openPeriod,
  membershipRole,
  canClosePeriod,
  hasWorkspace,
  closeNote,
  closePending,
  onCloseNoteChange,
  onClosePeriod
}: {
  openPeriod: AccountingPeriodItem | null;
  membershipRole: string | null;
  canClosePeriod: boolean;
  hasWorkspace: boolean;
  closeNote: string;
  closePending: boolean;
  onCloseNoteChange: (value: string) => void;
  onClosePeriod: () => Promise<void> | void;
}) {
  return (
    <SectionCard
      title="월 마감"
      description="현재 열린 운영 기간을 잠그고 월 마감 스냅샷을 생성합니다. 미확정 수집 거래가 남아 있으면 마감할 수 없습니다."
    >
      <Stack spacing={appLayout.cardGap}>
        <InfoRow
          label="마감 대상"
          value={
            openPeriod ? openPeriod.monthLabel : '현재 열린 운영 기간 없음'
          }
        />
        <InfoRow
          label="권한"
          value={
            canClosePeriod ? '소유자' : readMembershipRoleLabel(membershipRole)
          }
        />
        <TextField
          label="마감 메모"
          multiline
          minRows={3}
          value={closeNote}
          onChange={(event) => {
            onCloseNoteChange(event.target.value);
          }}
          helperText="월 마감 사유 또는 운영 메모를 남길 수 있습니다."
          disabled={!openPeriod || !canClosePeriod || !hasWorkspace}
        />
        <Button
          variant="contained"
          color="inherit"
          disabled={
            !openPeriod || !canClosePeriod || !hasWorkspace || closePending
          }
          onClick={() => {
            void onClosePeriod();
          }}
          sx={{ alignSelf: 'flex-start' }}
        >
          {closePending ? '월 마감 진행 중...' : '월 마감'}
        </Button>
      </Stack>
    </SectionCard>
  );
}

function ReopenAccountingPeriodSection({
  lockedPeriods,
  reopenEligibilityByPeriodId,
  reopenPeriod,
  selectedReopenEligibility,
  selectedReopenPeriodId,
  membershipRole,
  canReopenPeriod,
  hasWorkspace,
  reopenReason,
  reopenPending,
  onSelectReopenPeriod,
  onReopenReasonChange,
  onReopenPeriod
}: {
  lockedPeriods: AccountingPeriodItem[];
  reopenEligibilityByPeriodId: Record<
    string,
    AccountingPeriodReopenEligibility
  >;
  reopenPeriod: AccountingPeriodItem | null;
  selectedReopenEligibility: AccountingPeriodReopenEligibility | null;
  selectedReopenPeriodId: string | null;
  membershipRole: string | null;
  canReopenPeriod: boolean;
  hasWorkspace: boolean;
  reopenReason: string;
  reopenPending: boolean;
  onSelectReopenPeriod: (periodId: string | null) => void;
  onReopenReasonChange: (value: string) => void;
  onReopenPeriod: () => Promise<void> | void;
}) {
  return (
    <SectionCard
      title="월 재오픈"
      description="가장 최근 운영 월이 잠금 상태이고 차기 이월이나 다음 월 오프닝 스냅샷 같은 종속 결과가 아직 없을 때만 다시 열 수 있습니다."
    >
      <Stack spacing={appLayout.cardGap}>
        <InfoRow
          label="권한"
          value={
            canReopenPeriod ? '소유자' : readMembershipRoleLabel(membershipRole)
          }
        />
        <TextField
          select
          label="재오픈 대상 월"
          value={selectedReopenPeriodId ?? reopenPeriod?.id ?? ''}
          onChange={(event) => {
            onSelectReopenPeriod(event.target.value || null);
          }}
          helperText={
            lockedPeriods.length > 0
              ? '잠금 월별 재오픈 가능 여부는 최신 월 여부, 차기 이월, 다음 월 오프닝 스냅샷 존재 여부로 다시 검증됩니다.'
              : '현재 선택 가능한 잠금 월이 없습니다.'
          }
          disabled={!hasWorkspace || lockedPeriods.length === 0 || reopenPending}
        >
          {lockedPeriods.length === 0 ? (
            <MenuItem value="" disabled>
              재오픈 가능한 잠금 월 없음
            </MenuItem>
          ) : null}
          {lockedPeriods.map((period) => {
            const periodEligibility = reopenEligibilityByPeriodId[period.id];

            return (
              <MenuItem key={period.id} value={period.id}>
                {period.monthLabel}
                {periodEligibility ? ` · ${periodEligibility.statusLabel}` : ''}
              </MenuItem>
            );
          })}
        </TextField>
        <InfoRow
          label="선택 상태"
          value={
            selectedReopenEligibility
              ? `${reopenPeriod?.monthLabel ?? '-'} · ${selectedReopenEligibility.statusLabel}`
              : '재오픈 대상으로 선택된 잠금 월 없음'
          }
        />
        {selectedReopenEligibility ? (
          <Alert
            severity={selectedReopenEligibility.statusSeverity}
            variant="outlined"
          >
            <Stack spacing={0.5}>
              {selectedReopenEligibility.detailLines.map((line, index) => (
                <Typography key={`${selectedReopenEligibility.periodId}-${index}`} variant="body2">
                  {line}
                </Typography>
              ))}
            </Stack>
          </Alert>
        ) : null}
        <TextField
          label="재오픈 사유"
          multiline
          minRows={3}
          value={reopenReason}
          onChange={(event) => {
            onReopenReasonChange(event.target.value);
          }}
          helperText="재무제표 재산출, 전표 정정 등 재오픈 사유를 남겨 주세요."
          disabled={!reopenPeriod || !canReopenPeriod || !hasWorkspace}
        />
        <Button
          variant="outlined"
          disabled={
            !reopenPeriod ||
            !selectedReopenEligibility?.isReady ||
            !selectedReopenEligibility.canReopen ||
            !canReopenPeriod ||
            !hasWorkspace ||
            reopenPending ||
            reopenReason.trim().length === 0
          }
          onClick={() => {
            void onReopenPeriod();
          }}
          sx={{ alignSelf: 'flex-start' }}
        >
          {reopenPending ? '월 재오픈 진행 중...' : '월 재오픈'}
        </Button>
      </Stack>
    </SectionCard>
  );
}

export type PeriodOperationTab = 'open' | 'close' | 'reopen';

const periodOperationTabItems = [
  { value: 'open', label: '운영 시작', shortLabel: '시작' },
  { value: 'close', label: '월 마감', shortLabel: '마감' },
  { value: 'reopen', label: '재오픈' }
] as const satisfies ReadonlyArray<{
  value: PeriodOperationTab;
  label: string;
  shortLabel?: string;
}>;

function pickDefaultPeriodOperationTab(input: {
  openPeriod: AccountingPeriodItem | null;
  reopenPeriod: AccountingPeriodItem | null;
  availableTabs?: readonly PeriodOperationTab[];
  defaultTab?: PeriodOperationTab;
}): PeriodOperationTab {
  const availableTabs = input.availableTabs ?? [
    'open',
    'close',
    'reopen'
  ];
  const canUseDefaultTab =
    input.defaultTab &&
    availableTabs.includes(input.defaultTab) &&
    (input.defaultTab === 'open' ||
      (input.defaultTab === 'close' && input.openPeriod) ||
      (input.defaultTab === 'reopen' && input.reopenPeriod));

  if (canUseDefaultTab) {
    return input.defaultTab!;
  }

  if (input.openPeriod && availableTabs.includes('close')) {
    return 'close';
  }

  if (input.reopenPeriod && availableTabs.includes('reopen')) {
    return 'reopen';
  }

  return availableTabs[0] ?? 'open';
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {typeof value === 'string' ? (
        <Typography variant="body1">{value}</Typography>
      ) : (
        value
      )}
    </Stack>
  );
}

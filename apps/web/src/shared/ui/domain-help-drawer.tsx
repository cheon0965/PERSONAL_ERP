'use client';

import * as React from 'react';
import Link from 'next/link';
import { alpha } from '@mui/material/styles';
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import {
  type DomainHelpContextType,
  useDomainHelpStore
} from '../providers/domain-help-provider';
import { brandTokens } from '../theme/tokens';
import { SegmentedTabs } from './section-tabs';

type HelpTabValue = 'overview' | 'checkpoints' | 'followup';
type HelpSection = NonNullable<
  DomainHelpContextType['supplementarySections']
>[number];

const STANDARD_HELP_TABS = [
  { value: 'overview' as const, label: '화면 안내' },
  { value: 'checkpoints' as const, label: '작업 기준' },
  { value: 'followup' as const, label: '다음 작업' }
] as const;

const COMMON_HELP_CHECKPOINTS = [
  {
    title: '공통 화면 조작',
    items: [
      '화면 이름 옆 상태 배지로 현재 범위, 처리 건수, 연동 상태를 먼저 확인합니다.',
      '조회조건과 상태 칩을 바꾸면 목록, 카드, 요약 수치가 같은 기준으로 갱신됩니다.',
      '모바일에서는 표가 카드 목록으로 바뀌며, 같은 페이지 이동과 필터 기준으로 계속 작업합니다.'
    ]
  },
  {
    title: '오류 메시지 확인',
    items: [
      '오류가 발생하면 화면 상단의 사용자용 메시지를 먼저 확인하고 안내된 조치부터 진행합니다.',
      '개발자용 오류 코드, 요청번호, 세부 항목은 기본 접힘 상태의 상세 영역을 열어 확인합니다.',
      '문제가 반복되면 화면 이름, 작업 시각, 오류 코드, 요청번호를 함께 남겨 원인 추적에 사용합니다.'
    ]
  }
] as const satisfies readonly HelpSection[];

export function DomainHelpDrawer() {
  const { activeContext, isDrawerOpen, setDrawerOpen } = useDomainHelpStore();

  const handleClose = () => setDrawerOpen(false);
  const [activeTab, setActiveTab] = React.useState<HelpTabValue>('overview');
  const standardSections = React.useMemo(
    () => buildStandardHelpSections(activeContext),
    [activeContext]
  );

  React.useEffect(() => {
    setActiveTab('overview');
  }, [activeContext]);

  if (!activeContext) return null;

  return (
    <Drawer
      anchor="right"
      open={isDrawerOpen}
      onClose={handleClose}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: 'rgba(0, 0, 0, 0.1)' }
        }
      }}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 520, lg: 560 },
          p: 0,
          backgroundColor: brandTokens.palette.background
        }
      }}
    >
      <Box
        sx={{
          p: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: alpha(brandTokens.palette.primaryBright, 0.12),
          background: `linear-gradient(135deg, ${alpha(
            brandTokens.palette.surface,
            0.96
          )}, ${alpha(brandTokens.palette.primaryTint, 0.92)})`
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 999,
              background: brandTokens.gradient.brand,
              color: '#ffffff',
              boxShadow: '0 10px 22px rgba(11, 92, 255, 0.18)'
            }}
          >
            <HelpOutlineRoundedIcon fontSize="small" />
          </Box>
          <Typography variant="h6" fontWeight={700}>
            화면 도움말
          </Typography>
        </Stack>
        <IconButton
          onClick={handleClose}
          size="small"
          sx={{
            border: '1px solid',
            borderColor: alpha(brandTokens.palette.primaryBright, 0.16),
            backgroundColor: alpha(brandTokens.palette.surface, 0.72)
          }}
        >
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: alpha(brandTokens.palette.primary, 0.06) }} />

      <Box sx={{ p: 3, overflowY: 'auto' }}>
        <Stack spacing={2.25}>
          <Box
            sx={(theme) => ({
              p: 2.5,
              borderRadius: 3,
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.18),
              background: `radial-gradient(circle at 100% 0%, ${alpha(
                brandTokens.palette.secondary,
                0.2
              )}, transparent 38%), linear-gradient(180deg, ${alpha(
                theme.palette.primary.main,
                0.08
              )} 0%, ${alpha(theme.palette.primary.main, 0.02)} 100%)`
            })}
          >
            <Stack spacing={1.25}>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                >
                  이 화면에서 확인할 일
                </Typography>
                <Typography
                  variant="subtitle2"
                  color="primary"
                  fontWeight={700}
                  sx={{ mt: 0.35, mb: 0.5 }}
                >
                  {activeContext.title || '화면 개요'}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ whiteSpace: 'pre-wrap' }}
                >
                  {activeContext.description}
                </Typography>
              </Box>
              <div>
                <Chip
                  label={`먼저 볼 정보 · ${activeContext.primaryEntity}`}
                  color="primary"
                  variant="outlined"
                  sx={{ borderRadius: 1.5 }}
                />
              </div>
            </Stack>
          </Box>

          <Box
            sx={{
              '& > [role="tablist"]': {
                p: 0.45,
                borderRadius: 2
              },
              '& [role="tab"]': {
                borderRadius: 1.5,
                minHeight: 38
              }
            }}
          >
            <SegmentedTabs
              items={STANDARD_HELP_TABS}
              value={activeTab}
              ariaLabel="화면 도움말 탭"
              onChange={(value) => setActiveTab(value)}
            />
          </Box>

          {activeTab === 'overview' ? (
            <Stack spacing={1.5}>
              <HelpPanelCard title="가장 먼저 볼 정보">
                <Typography variant="body1" fontWeight={700}>
                  {activeContext.primaryEntity}
                </Typography>
              </HelpPanelCard>

              <HelpPanelCard title="함께 보여주는 정보">
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  {activeContext.relatedEntities.map((entity) => (
                    <Chip
                      key={entity}
                      label={entity}
                      variant="outlined"
                      size="small"
                      sx={{ borderRadius: 1 }}
                    />
                  ))}
                </Stack>
              </HelpPanelCard>

              <HelpPanelCard title="데이터 기준" tone="subtle">
                <Typography variant="body2" color="text.secondary">
                  {activeContext.truthSource}
                </Typography>
              </HelpPanelCard>

              {activeContext.readModelNote ? (
                <HelpPanelCard title="작업 전 참고" tone="primary">
                  <Typography variant="body2" color="inherit">
                    {activeContext.readModelNote}
                  </Typography>
                </HelpPanelCard>
              ) : null}
            </Stack>
          ) : activeTab === 'checkpoints' ? (
            standardSections.checkpoints.length > 0 ? (
              <Stack spacing={1.5}>
                {standardSections.checkpoints.map((section) => (
                  <HelpSupplementarySection
                    key={`checkpoint-${section.title}`}
                    section={section}
                  />
                ))}
              </Stack>
            ) : (
              <HelpEmptyState
                title="작업 기준"
                description="이 화면에서 먼저 볼 정보와 작업 순서는 화면 안내 탭과 본문 카드에서 함께 확인할 수 있습니다."
              />
            )
          ) : null}

          {activeTab === 'followup' ? (
            <Stack spacing={1.5}>
              {standardSections.followup.length > 0 ? (
                standardSections.followup.map((section) => (
                  <HelpSupplementarySection
                    key={`followup-${section.title}`}
                    section={section}
                  />
                ))
              ) : (
                <HelpEmptyState
                  title="다음 작업"
                  description="현재 화면에서 바로 이어지는 작업은 별도 등록되지 않았습니다. 본문 액션 버튼이나 좌측 메뉴를 사용해 다음 화면으로 이동할 수 있습니다."
                />
              )}

              {activeContext.readModelNote ? (
                <HelpPanelCard title="작업 전 참고" tone="primary">
                  <Typography variant="body2" color="inherit">
                    {activeContext.readModelNote}
                  </Typography>
                </HelpPanelCard>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </Box>

      <Box
        sx={{
          mt: 'auto',
          p: 3,
          bgcolor: alpha(brandTokens.palette.primaryTint, 0.82),
          borderTop: '1px solid',
          borderColor: alpha(brandTokens.palette.primaryBright, 0.12)
        }}
      >
        <Typography variant="caption" color="text.secondary">
          현재 화면이 무엇을 보여주는지, 어떤 순서로 작업할지, 어디로 이어갈지
          빠르게 확인할 수 있습니다.
        </Typography>
      </Box>
    </Drawer>
  );
}

function HelpSupplementarySection({ section }: { section: HelpSection }) {
  return (
    <HelpPanelCard title={section.title}>
      <Stack spacing={1.5}>
        {section.description ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: 'pre-wrap' }}
          >
            {section.description}
          </Typography>
        ) : null}

        {section.facts?.length ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(1, minmax(0, 1fr))',
                sm: 'repeat(2, minmax(0, 1fr))'
              },
              gap: 1.1
            }}
          >
            {section.facts.map((fact) => (
              <Box
                key={`${section.title}-${fact.label}`}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: alpha(brandTokens.palette.primaryBright, 0.12),
                  bgcolor: alpha(brandTokens.palette.surface, 0.8)
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {fact.label}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.4, fontWeight: 700 }}>
                  {fact.value}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : null}

        {section.items?.length ? (
          <Stack spacing={1.1}>
            {section.items.map((item) => (
              <Stack
                key={`${section.title}-${item}`}
                direction="row"
                spacing={1}
                alignItems="flex-start"
              >
                <Typography
                  variant="body2"
                  color="primary"
                  sx={{ lineHeight: 1.6, fontWeight: 700 }}
                >
                  •
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item}
                </Typography>
              </Stack>
            ))}
          </Stack>
        ) : null}

        {section.links?.length ? (
          <Stack spacing={1.1}>
            {section.links.map((link) => (
              <Box
                key={`${section.title}-${link.href}-${link.title}`}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: alpha(brandTokens.palette.primaryBright, 0.12),
                  bgcolor: alpha(brandTokens.palette.surface, 0.8)
                }}
              >
                <Stack spacing={1}>
                  <Typography variant="body2" fontWeight={700}>
                    {link.title}
                  </Typography>
                  {link.description ? (
                    <Typography variant="body2" color="text.secondary">
                      {link.description}
                    </Typography>
                  ) : null}
                  <div>
                    <Button
                      component={Link}
                      href={link.href}
                      variant="outlined"
                      size="small"
                    >
                      {link.actionLabel ?? `${link.title} 열기`}
                    </Button>
                  </div>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </HelpPanelCard>
  );
}

function HelpPanelCard({
  children,
  title,
  tone = 'default'
}: {
  children: React.ReactNode;
  title: string;
  tone?: 'default' | 'subtle' | 'primary';
}) {
  return (
    <Box
      sx={{
        p: 2.25,
        borderRadius: 2.5,
        border: '1px solid',
        borderColor:
          tone === 'primary'
            ? alpha(brandTokens.palette.primaryBright, 0.18)
            : alpha(brandTokens.palette.primaryBright, 0.1),
        background:
          tone === 'primary'
            ? brandTokens.gradient.brand
            : tone === 'subtle'
              ? `linear-gradient(180deg, ${alpha(
                  brandTokens.palette.primaryTint,
                  0.86
                )}, ${alpha(brandTokens.palette.secondaryTint, 0.64)})`
              : brandTokens.gradient.card,
        color: tone === 'primary' ? 'primary.contrastText' : 'text.primary'
      }}
    >
      <Stack spacing={1.25}>
        <Typography
          variant="subtitle2"
          fontWeight={700}
          color={tone === 'primary' ? 'inherit' : 'text.primary'}
        >
          {title}
        </Typography>
        {children}
      </Stack>
    </Box>
  );
}

function HelpEmptyState({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <HelpPanelCard title={title} tone="subtle">
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </HelpPanelCard>
  );
}

function buildStandardHelpSections(context: DomainHelpContextType | null) {
  const sections = [
    ...COMMON_HELP_CHECKPOINTS,
    ...(context?.supplementarySections ?? [])
  ];

  return sections.reduce(
    (groups, section) => {
      const bucket = readHelpSectionBucket(section);
      groups[bucket].push(section);
      return groups;
    },
    {
      checkpoints: [] as HelpSection[],
      followup: [] as HelpSection[]
    }
  );
}

function readHelpSectionBucket(section: HelpSection) {
  if (section.links?.length) {
    return 'followup' as const;
  }

  const normalizedTitle = section.title.replace(/\s+/g, '');

  if (
    normalizedTitle.includes('이어지는화면') ||
    normalizedTitle.includes('다음단계') ||
    normalizedTitle.includes('후속') ||
    normalizedTitle.includes('참고') ||
    normalizedTitle.includes('주의') ||
    normalizedTitle.includes('메모')
  ) {
    return 'followup' as const;
  }

  return 'checkpoints' as const;
}

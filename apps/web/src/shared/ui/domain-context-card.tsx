'use client';

import { Box, Chip, Stack, Typography } from '@mui/material';
import { SectionCard } from './section-card';
import { appLayout } from './layout-metrics';

type DomainContextCardProps = {
  title?: string;
  description: string;
  primaryEntity: string;
  relatedEntities: string[];
  truthSource: string;
  readModelNote?: string;
};

export function DomainContextCard({
  title = '도메인 기준',
  description,
  primaryEntity,
  relatedEntities,
  truthSource,
  readModelNote
}: DomainContextCardProps) {
  return (
    <SectionCard title={title} description={description}>
      <Stack spacing={appLayout.cardGap}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            대표 엔티티
          </Typography>
          <Typography variant="body1" fontWeight={700} sx={{ mt: 0.5 }}>
            {primaryEntity}
          </Typography>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary">
            함께 보는 엔티티
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
            {relatedEntities.map((entity) => (
              <Chip key={entity} label={entity} variant="outlined" size="small" />
            ))}
          </Stack>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary">
            회계 확정 기준
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            {truthSource}
          </Typography>
        </Box>

        {readModelNote ? (
          <Typography variant="body2" color="text.secondary">
            {readModelNote}
          </Typography>
        ) : null}
      </Stack>
    </SectionCard>
  );
}

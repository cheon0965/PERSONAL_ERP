'use client';

import * as React from 'react';
import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { useDomainHelpStore } from '../providers/domain-help-provider';

export function DomainHelpDrawer() {
  const { activeContext, isDrawerOpen, setDrawerOpen } = useDomainHelpStore();

  const handleClose = () => setDrawerOpen(false);

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
          width: { xs: '100%', sm: 400 },
          p: 0,
          backgroundImage: 'none'
        }
      }}
    >
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HelpOutlineRoundedIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>
            도메인 가이드
          </Typography>
        </Stack>
        <IconButton onClick={handleClose} size="small">
          <CloseRoundedIcon />
        </IconButton>
      </Box>

      <Divider />

      <Box sx={{ p: 3, overflowY: 'auto' }}>
        <Stack spacing={4}>
          <Box>
            <Typography variant="subtitle2" color="primary" fontWeight={700} gutterBottom>
              {activeContext.title || '화면 개요'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {activeContext.description}
            </Typography>
          </Box>

          <Divider />

          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 1 }}>
              대표 엔티티
            </Typography>
            <Typography variant="body1" fontWeight={700}>
              {activeContext.primaryEntity}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 1 }}>
              함께 보는 엔티티
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {activeContext.relatedEntities.map((entity) => (
                <Chip key={entity} label={entity} variant="outlined" size="small" sx={{ borderRadius: 1 }} />
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1, textTransform: 'uppercase', letterSpacing: 1 }}>
              회계 확정 기준
            </Typography>
            <Typography variant="body2" sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              {activeContext.truthSource}
            </Typography>
          </Box>

          {activeContext.readModelNote && (
            <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mb: 0.5, fontWeight: 700 }}>
                주의 사항 / 참고
              </Typography>
              <Typography variant="body2">
                {activeContext.readModelNote}
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>

      <Box sx={{ mt: 'auto', p: 3, bgcolor: 'action.hover', borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          본 가이드는 Personal ERP의 도메인 설계 원칙을 준수합니다. 비즈니스 로직과 화면의 정합성이 궁금하실 때 언제든 열어보세요.
        </Typography>
      </Box>
    </Drawer>
  );
}

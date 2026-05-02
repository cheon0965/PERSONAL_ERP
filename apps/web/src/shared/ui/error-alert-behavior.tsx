'use client';

import * as React from 'react';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { Box, Button, Collapse, Typography } from '@mui/material';

export function useScrollErrorAlertIntoView(
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  trigger: unknown
) {
  React.useEffect(() => {
    if (!enabled || !ref.current) {
      return;
    }

    const target = ref.current;
    const frame = window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      target.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center'
      });
      target.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [enabled, ref, trigger]);
}

type ErrorDiagnosticsDisclosureProps = {
  diagnostics?: string | null;
};

export function ErrorDiagnosticsDisclosure({
  diagnostics
}: ErrorDiagnosticsDisclosureProps) {
  const [expanded, setExpanded] = React.useState(false);
  const detailsId = React.useId();

  React.useEffect(() => {
    setExpanded(false);
  }, [diagnostics]);

  if (!diagnostics) {
    return null;
  }

  return (
    <Box sx={{ mt: 0.25 }}>
      <Button
        type="button"
        size="small"
        color="inherit"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={detailsId}
        endIcon={
          <ExpandMoreRoundedIcon
            fontSize="small"
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: (theme) =>
                theme.transitions.create('transform', {
                  duration: theme.transitions.duration.shortest
                })
            }}
          />
        }
        sx={{
          alignSelf: 'flex-start',
          minWidth: 0,
          px: 0,
          py: 0.25,
          textTransform: 'none',
          fontWeight: 700
        }}
      >
        개발자 진단 정보 {expanded ? '접기' : '보기'}
      </Button>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Typography
          id={detailsId}
          component="pre"
          variant="caption"
          color="text.secondary"
          sx={{
            m: 0,
            mt: 0.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
          }}
        >
          {diagnostics}
        </Typography>
      </Collapse>
    </Box>
  );
}

'use client';

import type {} from '@mui/x-data-grid/themeAugmentation';
import { koKR as dataGridKoKR } from '@mui/x-data-grid/locales';
import { koKR as materialKoKR } from '@mui/material/locale';
import { createTheme } from '@mui/material/styles';
import { brandTokens } from './tokens';

export const appTheme = createTheme(
  {
    cssVariables: true,
    shape: {
      borderRadius: brandTokens.radius.md
    },
    palette: {
      mode: 'light',
      primary: {
        main: brandTokens.palette.primary,
        dark: brandTokens.palette.primaryDark
      },
      secondary: {
        main: brandTokens.palette.secondary
      },
      success: {
        main: brandTokens.palette.success
      },
      warning: {
        main: brandTokens.palette.warning
      },
      error: {
        main: brandTokens.palette.error
      },
      background: {
        default: brandTokens.palette.background,
        paper: brandTokens.palette.surface
      },
      text: {
        primary: brandTokens.palette.text,
        secondary: brandTokens.palette.textMuted
      },
      divider: brandTokens.palette.border
    },
    typography: {
      fontFamily: 'Pretendard, Inter, system-ui, sans-serif',
      h3: {
        fontWeight: 700
      },
      h4: {
        fontWeight: 700
      },
      h5: {
        fontWeight: 700
      },
      h6: {
        fontWeight: 700
      },
      button: {
        fontWeight: 700,
        textTransform: 'none'
      }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: brandTokens.palette.background
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: brandTokens.radius.lg,
            boxShadow: brandTokens.shadow.card,
            border: `1px solid ${brandTokens.palette.border}`
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: brandTokens.radius.lg
          }
        }
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true
        },
        styleOverrides: {
          root: {
            borderRadius: 14,
            minHeight: 42
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 10
          }
        }
      },
      MuiMenu: {
        defaultProps: {
          disableScrollLock: true
        }
      },
      MuiTextField: {
        defaultProps: {
          fullWidth: true
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            backgroundColor: '#fff'
          }
        }
      },
      MuiDataGrid: {
        styleOverrides: {
          root: {
            border: 'none'
          },
          columnHeaders: {
            backgroundColor: brandTokens.palette.surfaceSoft,
            fontWeight: 700
          }
        }
      }
    }
  },
  materialKoKR,
  dataGridKoKR
);

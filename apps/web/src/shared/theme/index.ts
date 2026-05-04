'use client';

import type {} from '@mui/x-data-grid/themeAugmentation';
import { koKR as dataGridKoKR } from '@mui/x-data-grid/locales';
import { koKR as materialKoKR } from '@mui/material/locale';
import { alpha, createTheme } from '@mui/material/styles';
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
        dark: brandTokens.palette.primaryDark,
        light: brandTokens.palette.primaryBright,
        contrastText: '#ffffff'
      },
      secondary: {
        main: brandTokens.palette.secondary,
        dark: brandTokens.palette.secondaryDark,
        light: brandTokens.palette.secondarySoft,
        contrastText: brandTokens.palette.primaryDark
      },
      info: {
        main: brandTokens.palette.info,
        light: brandTokens.palette.infoSoft,
        contrastText: '#ffffff'
      },
      success: {
        main: brandTokens.palette.success,
        light: brandTokens.palette.successSoft,
        contrastText: '#ffffff'
      },
      warning: {
        main: brandTokens.palette.warning,
        light: brandTokens.palette.warningSoft,
        contrastText: brandTokens.palette.primaryDark
      },
      error: {
        main: brandTokens.palette.error,
        light: brandTokens.palette.errorSoft,
        contrastText: '#ffffff'
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
            backgroundColor: brandTokens.palette.background,
            color: brandTokens.palette.text
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: brandTokens.radius.lg,
            minWidth: 0,
            boxShadow: brandTokens.shadow.card,
            border: `1px solid ${alpha(brandTokens.palette.primary, 0.1)}`,
            background: brandTokens.gradient.card,
            backgroundImage: brandTokens.gradient.card
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            minWidth: 0,
            borderRadius: brandTokens.radius.lg,
            backgroundImage: 'none'
          }
        }
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true
        },
        styleOverrides: {
          root: {
            borderRadius: 999,
            maxWidth: '100%',
            minHeight: 42,
            fontWeight: 800,
            letterSpacing: 0,
            transition:
              'background 180ms ease, background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, color 180ms ease, transform 180ms ease',
            '&:hover': {
              transform: 'translateY(-1px)'
            },
            '&.MuiButton-sizeSmall': {
              minHeight: 34,
              paddingInline: 14
            },
            '&.Mui-disabled': {
              opacity: 0.56
            },
            '&.Mui-focusVisible': {
              boxShadow: brandTokens.shadow.focus
            }
          },
          containedPrimary: {
            background: brandTokens.gradient.brand,
            boxShadow: brandTokens.shadow.button,
            '&:hover': {
              background: brandTokens.gradient.brandHover,
              boxShadow: '0 14px 30px rgba(11, 92, 255, 0.26)'
            }
          },
          containedSecondary: {
            background: `linear-gradient(135deg, ${brandTokens.palette.secondary} 0%, ${brandTokens.palette.secondaryDark} 100%)`,
            color: brandTokens.palette.primaryDark,
            boxShadow: '0 12px 24px rgba(52, 199, 184, 0.24)',
            '&:hover': {
              background: `linear-gradient(135deg, ${brandTokens.palette.secondary} 0%, ${brandTokens.palette.primaryBright} 100%)`,
              boxShadow: '0 14px 30px rgba(52, 199, 184, 0.28)'
            }
          },
          containedSuccess: {
            background: `linear-gradient(135deg, ${brandTokens.palette.success} 0%, ${brandTokens.palette.secondaryDark} 100%)`,
            boxShadow: '0 12px 24px rgba(15, 159, 117, 0.2)'
          },
          containedWarning: {
            background: `linear-gradient(135deg, #f4b23e 0%, ${brandTokens.palette.warning} 100%)`,
            color: brandTokens.palette.primaryDark,
            boxShadow: '0 12px 24px rgba(226, 138, 11, 0.18)'
          },
          containedError: {
            background: `linear-gradient(135deg, #f05b78 0%, ${brandTokens.palette.error} 100%)`,
            boxShadow: '0 12px 24px rgba(223, 63, 95, 0.2)'
          },
          outlinedPrimary: {
            borderColor: alpha(brandTokens.palette.primaryBright, 0.34),
            color: brandTokens.palette.primary,
            backgroundColor: alpha(brandTokens.palette.primaryBright, 0.04),
            '&:hover': {
              borderColor: brandTokens.palette.primaryBright,
              backgroundColor: alpha(brandTokens.palette.primaryBright, 0.1)
            }
          },
          outlinedSecondary: {
            borderColor: alpha(brandTokens.palette.secondary, 0.5),
            color: brandTokens.palette.secondaryDark,
            backgroundColor: alpha(brandTokens.palette.secondary, 0.06),
            '&:hover': {
              borderColor: brandTokens.palette.secondaryDark,
              backgroundColor: alpha(brandTokens.palette.secondary, 0.14)
            }
          },
          outlinedSuccess: {
            borderColor: alpha(brandTokens.palette.success, 0.42),
            color: brandTokens.palette.success,
            backgroundColor: alpha(brandTokens.palette.success, 0.06),
            '&:hover': {
              borderColor: brandTokens.palette.success,
              backgroundColor: alpha(brandTokens.palette.success, 0.12)
            }
          },
          outlinedWarning: {
            borderColor: alpha(brandTokens.palette.warning, 0.44),
            color: brandTokens.palette.warning,
            backgroundColor: alpha(brandTokens.palette.warning, 0.08),
            '&:hover': {
              borderColor: brandTokens.palette.warning,
              backgroundColor: alpha(brandTokens.palette.warning, 0.14)
            }
          },
          outlinedError: {
            borderColor: alpha(brandTokens.palette.error, 0.42),
            color: brandTokens.palette.error,
            backgroundColor: alpha(brandTokens.palette.error, 0.06),
            '&:hover': {
              borderColor: brandTokens.palette.error,
              backgroundColor: alpha(brandTokens.palette.error, 0.12)
            }
          },
          textPrimary: {
            color: brandTokens.palette.primary,
            backgroundColor: alpha(brandTokens.palette.primaryBright, 0.05),
            '&:hover': {
              backgroundColor: alpha(brandTokens.palette.primaryBright, 0.08)
            }
          },
          textWarning: {
            color: brandTokens.palette.warning,
            backgroundColor: alpha(brandTokens.palette.warning, 0.07),
            '&:hover': {
              backgroundColor: alpha(brandTokens.palette.warning, 0.1)
            }
          },
          textError: {
            color: brandTokens.palette.error,
            backgroundColor: alpha(brandTokens.palette.error, 0.07),
            '&:hover': {
              backgroundColor: alpha(brandTokens.palette.error, 0.1)
            }
          },
          textSuccess: {
            color: brandTokens.palette.success,
            backgroundColor: alpha(brandTokens.palette.success, 0.07),
            '&:hover': {
              backgroundColor: alpha(brandTokens.palette.success, 0.1)
            }
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            maxWidth: '100%',
            minHeight: 26,
            fontWeight: 800,
            letterSpacing: 0,
            borderStyle: 'solid',
            borderWidth: 1,
            '&.MuiChip-filled': {
              boxShadow: 'none'
            },
            '&.MuiChip-colorDefault': {
              backgroundColor: brandTokens.palette.surfaceMuted,
              borderColor: brandTokens.palette.border,
              color: brandTokens.palette.textMuted
            },
            '&.MuiChip-filled.MuiChip-colorDefault': {
              backgroundColor: brandTokens.palette.surfaceMuted,
              borderColor: brandTokens.palette.borderStrong,
              color: brandTokens.palette.textMuted
            },
            '&.MuiChip-colorPrimary': {
              backgroundColor: alpha(brandTokens.palette.primaryBright, 0.12),
              borderColor: alpha(brandTokens.palette.primaryBright, 0.28),
              color: brandTokens.palette.primary
            },
            '&.MuiChip-filled.MuiChip-colorPrimary': {
              background: alpha(brandTokens.palette.primaryBright, 0.16),
              borderColor: alpha(brandTokens.palette.primaryBright, 0.32),
              color: brandTokens.palette.primary
            },
            '&.MuiChip-colorSecondary': {
              backgroundColor: alpha(brandTokens.palette.secondary, 0.14),
              borderColor: alpha(brandTokens.palette.secondary, 0.34),
              color: brandTokens.palette.secondaryDark
            },
            '&.MuiChip-filled.MuiChip-colorSecondary': {
              backgroundColor: alpha(brandTokens.palette.secondary, 0.18),
              borderColor: alpha(brandTokens.palette.secondary, 0.38),
              color: brandTokens.palette.primaryDark
            },
            '&.MuiChip-colorSuccess': {
              backgroundColor: alpha(brandTokens.palette.success, 0.12),
              borderColor: alpha(brandTokens.palette.success, 0.34),
              color: brandTokens.palette.success
            },
            '&.MuiChip-filled.MuiChip-colorSuccess': {
              backgroundColor: alpha(brandTokens.palette.success, 0.16),
              borderColor: alpha(brandTokens.palette.success, 0.36),
              color: brandTokens.palette.success
            },
            '&.MuiChip-colorWarning': {
              backgroundColor: alpha(brandTokens.palette.warning, 0.14),
              borderColor: alpha(brandTokens.palette.warning, 0.34),
              color: '#9a5b00'
            },
            '&.MuiChip-filled.MuiChip-colorWarning': {
              backgroundColor: alpha(brandTokens.palette.warning, 0.18),
              borderColor: alpha(brandTokens.palette.warning, 0.38),
              color: '#9a5b00'
            },
            '&.MuiChip-colorError': {
              backgroundColor: alpha(brandTokens.palette.error, 0.12),
              borderColor: alpha(brandTokens.palette.error, 0.34),
              color: brandTokens.palette.error
            },
            '&.MuiChip-filled.MuiChip-colorError': {
              backgroundColor: alpha(brandTokens.palette.error, 0.16),
              borderColor: alpha(brandTokens.palette.error, 0.36),
              color: brandTokens.palette.error
            },
            '&.MuiChip-colorInfo': {
              backgroundColor: alpha(brandTokens.palette.info, 0.12),
              borderColor: alpha(brandTokens.palette.info, 0.32),
              color: brandTokens.palette.info
            },
            '&.MuiChip-filled.MuiChip-colorInfo': {
              backgroundColor: alpha(brandTokens.palette.info, 0.16),
              borderColor: alpha(brandTokens.palette.info, 0.34),
              color: brandTokens.palette.info
            }
          },
          label: {
            minWidth: 0,
            paddingInline: 10,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }
        }
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            fontWeight: 600
          },
          outlinedInfo: {
            borderColor: alpha(brandTokens.palette.info, 0.28),
            backgroundColor: alpha(brandTokens.palette.info, 0.06)
          },
          outlinedSuccess: {
            borderColor: alpha(brandTokens.palette.success, 0.3),
            backgroundColor: alpha(brandTokens.palette.success, 0.07)
          },
          outlinedWarning: {
            borderColor: alpha(brandTokens.palette.warning, 0.32),
            backgroundColor: alpha(brandTokens.palette.warning, 0.08)
          },
          outlinedError: {
            borderColor: alpha(brandTokens.palette.error, 0.3),
            backgroundColor: alpha(brandTokens.palette.error, 0.07)
          }
        }
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition:
              'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
            '&:hover': {
              transform: 'translateY(-1px)'
            },
            '&.Mui-focusVisible': {
              boxShadow: brandTokens.shadow.focus
            }
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
            backgroundColor: brandTokens.palette.surface,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(brandTokens.palette.primaryBright, 0.48)
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: brandTokens.palette.primaryBright,
              boxShadow: brandTokens.shadow.focus
            }
          },
          input: {
            '&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus':
              {
                WebkitBoxShadow: `0 0 0 1000px ${brandTokens.palette.surface} inset`,
                WebkitTextFillColor: brandTokens.palette.text,
                caretColor: brandTokens.palette.text,
                transition: 'background-color 9999s ease-out'
              }
          }
        }
      },
      MuiDataGrid: {
        styleOverrides: {
          root: {
            border: 'none',
            borderRadius: '4px 4px 0 0',
            color: brandTokens.palette.text,
            '--DataGrid-rowBorderColor': alpha(
              brandTokens.palette.primary,
              0.08
            ),
            '& .MuiDataGrid-columnHeaders': {
              background:
                'linear-gradient(180deg, rgba(240,246,255,0.98), rgba(233,247,250,0.98))',
              borderRadius: '4px 4px 0 0',
              border: `1px solid ${alpha(brandTokens.palette.primaryBright, 0.12)}`
            },
            '& .MuiDataGrid-columnHeader': {
              borderRadius: 0
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 800,
              color: brandTokens.palette.primaryDark
            },
            '& .MuiDataGrid-row': {
              borderRadius: 12,
              transition: 'background-color 140ms ease'
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: alpha(brandTokens.palette.primaryBright, 0.05)
            },
            '& .MuiDataGrid-cell': {
              borderColor: alpha(brandTokens.palette.primary, 0.08)
            },
            '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': {
              outline: 'none'
            },
            '& .MuiDataGrid-cell:focus-within, & .MuiDataGrid-columnHeader:focus-within':
              {
                outline: `2px solid ${alpha(brandTokens.palette.secondary, 0.38)}`,
                outlineOffset: -2
              },
            '& .MuiDataGrid-footerContainer': {
              borderColor: alpha(brandTokens.palette.primary, 0.08)
            }
          }
        }
      }
    }
  },
  materialKoKR,
  dataGridKoKR
);

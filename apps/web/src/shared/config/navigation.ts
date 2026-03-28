import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded';
import DesignServicesRoundedIcon from '@mui/icons-material/DesignServicesRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';

export const navigationItems = [
  { label: '대시보드', href: '/dashboard', icon: DashboardRoundedIcon },
  { label: '수집 거래', href: '/transactions', icon: ReceiptLongRoundedIcon },
  { label: '반복 규칙', href: '/recurring', icon: AutorenewRoundedIcon },
  { label: '보험 계약', href: '/insurances', icon: HealthAndSafetyRoundedIcon },
  { label: '차량 운영', href: '/vehicles', icon: DirectionsCarRoundedIcon },
  { label: '기간 전망', href: '/forecast', icon: AutoGraphRoundedIcon },
  { label: '디자인 시스템', href: '/design-system', icon: DesignServicesRoundedIcon },
  { label: '설정', href: '/settings', icon: SettingsRoundedIcon }
] as const;

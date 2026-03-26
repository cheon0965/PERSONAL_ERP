import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded';
import DesignServicesRoundedIcon from '@mui/icons-material/DesignServicesRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';

export const navigationItems = [
  { label: 'Dashboard', href: '/dashboard', icon: DashboardRoundedIcon },
  { label: 'Transactions', href: '/transactions', icon: ReceiptLongRoundedIcon },
  { label: 'Recurring', href: '/recurring', icon: AutorenewRoundedIcon },
  { label: 'Insurances', href: '/insurances', icon: HealthAndSafetyRoundedIcon },
  { label: 'Vehicles', href: '/vehicles', icon: DirectionsCarRoundedIcon },
  { label: 'Forecast', href: '/forecast', icon: AutoGraphRoundedIcon },
  { label: 'Design System', href: '/design-system', icon: DesignServicesRoundedIcon },
  { label: 'Settings', href: '/settings', icon: SettingsRoundedIcon }
] as const;

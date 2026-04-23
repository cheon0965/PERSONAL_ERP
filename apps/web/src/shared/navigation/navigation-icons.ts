import type { ElementType } from 'react';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import LocalGasStationRoundedIcon from '@mui/icons-material/LocalGasStationRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import MiscellaneousServicesRoundedIcon from '@mui/icons-material/MiscellaneousServicesRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import RuleFolderRoundedIcon from '@mui/icons-material/RuleFolderRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import SummarizeRoundedIcon from '@mui/icons-material/SummarizeRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';

const navigationIconMap: Record<string, ElementType> = {
  admin: AdminPanelSettingsRoundedIcon,
  assets: WorkspacePremiumRoundedIcon,
  calendar: CalendarMonthRoundedIcon,
  carryForward: SwapHorizRoundedIcon,
  dashboard: DashboardRoundedIcon,
  financialStatements: SummarizeRoundedIcon,
  forecast: AutoGraphRoundedIcon,
  fuel: LocalGasStationRoundedIcon,
  insurance: HealthAndSafetyRoundedIcon,
  journal: ArticleRoundedIcon,
  liabilities: AccountBalanceRoundedIcon,
  maintenance: MiscellaneousServicesRoundedIcon,
  operations: RuleFolderRoundedIcon,
  planItems: ViewListRoundedIcon,
  recurring: AutorenewRoundedIcon,
  referenceData: Inventory2RoundedIcon,
  reports: SummarizeRoundedIcon,
  settings: SettingsRoundedIcon,
  transactions: ReceiptLongRoundedIcon,
  upload: UploadFileRoundedIcon,
  vehicles: DirectionsCarRoundedIcon,
  workspace: ManageAccountsRoundedIcon
};

export function resolveNavigationIcon(iconKey: string | null | undefined) {
  if (!iconKey) {
    return null;
  }

  return navigationIconMap[iconKey] ?? null;
}

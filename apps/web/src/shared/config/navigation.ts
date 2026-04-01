import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import SummarizeRoundedIcon from '@mui/icons-material/SummarizeRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';

export const navigationItems = [
  { label: '대시보드', href: '/dashboard', icon: DashboardRoundedIcon },
  { label: '작업 문맥', href: '/settings', icon: SettingsRoundedIcon },
  {
    label: '기준 데이터',
    href: '/reference-data',
    icon: Inventory2RoundedIcon
  },
  { label: '월 운영', href: '/periods', icon: CalendarMonthRoundedIcon },
  { label: '반복 규칙', href: '/recurring', icon: AutorenewRoundedIcon },
  { label: '계획 항목', href: '/plan-items', icon: ViewListRoundedIcon },
  { label: '수집 거래', href: '/transactions', icon: ReceiptLongRoundedIcon },
  { label: '업로드 배치', href: '/imports', icon: UploadFileRoundedIcon },
  { label: '전표 조회', href: '/journal-entries', icon: ArticleRoundedIcon },
  {
    label: '재무제표',
    href: '/financial-statements',
    icon: SummarizeRoundedIcon
  },
  { label: '차기 이월', href: '/carry-forwards', icon: SwapHorizRoundedIcon },
  { label: '기간 전망', href: '/forecast', icon: AutoGraphRoundedIcon },
  { label: '보험 계약', href: '/insurances', icon: HealthAndSafetyRoundedIcon },
  { label: '차량 운영', href: '/vehicles', icon: DirectionsCarRoundedIcon }
] as const;

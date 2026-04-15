import type { ElementType } from 'react';
import type { Route } from 'next';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import RuleFolderRoundedIcon from '@mui/icons-material/RuleFolderRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import SummarizeRoundedIcon from '@mui/icons-material/SummarizeRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';

type NavigationItem = {
  label: string;
  href: Route;
  icon: ElementType;
};

type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

export const navigationSections: NavigationSection[] = [
  {
    label: '운영 준비',
    items: [
      { label: '작업 문맥', href: '/settings', icon: SettingsRoundedIcon },
      { label: '관리자', href: '/admin', icon: AdminPanelSettingsRoundedIcon },
      { label: '운영 지원', href: '/operations', icon: RuleFolderRoundedIcon },
      {
        label: '기준 데이터',
        href: '/reference-data',
        icon: Inventory2RoundedIcon
      }
    ]
  },
  {
    label: '월 실행',
    items: [
      { label: '월 운영', href: '/periods', icon: CalendarMonthRoundedIcon },
      { label: '반복 규칙', href: '/recurring', icon: AutorenewRoundedIcon },
      { label: '계획 항목', href: '/plan-items', icon: ViewListRoundedIcon },
      { label: '업로드 배치', href: '/imports', icon: UploadFileRoundedIcon },
      { label: '수집 거래', href: '/transactions', icon: ReceiptLongRoundedIcon },
      { label: '전표 조회', href: '/journal-entries', icon: ArticleRoundedIcon }
    ]
  },
  {
    label: '운영 기준',
    items: [
      { label: '보험 계약', href: '/insurances', icon: HealthAndSafetyRoundedIcon },
      { label: '차량 운영', href: '/vehicles', icon: DirectionsCarRoundedIcon }
    ]
  },
  {
    label: '보고 / 판단',
    items: [
      {
        label: '재무제표',
        href: '/financial-statements',
        icon: SummarizeRoundedIcon
      },
      { label: '차기 이월', href: '/carry-forwards', icon: SwapHorizRoundedIcon },
      { label: '기간 전망', href: '/forecast', icon: AutoGraphRoundedIcon },
      { label: '대시보드', href: '/dashboard', icon: DashboardRoundedIcon }
    ]
  }
];

export const navigationItems: NavigationItem[] = navigationSections.flatMap(
  (section) => section.items
);

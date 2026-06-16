'use client';

import { SectionTabs } from '@/shared/ui/section-tabs';

export type VehicleWorkspaceSection =
  | 'overview'
  | 'fleet'
  | 'fuel'
  | 'maintenance';

const vehicleSectionItems = [
  { href: '/vehicles', label: '차량 운영' },
  { href: '/vehicles/fleet', label: '차량 목록' },
  { href: '/vehicles/fuel', label: '연료 기록' },
  { href: '/vehicles/maintenance', label: '정비 이력' }
] as const;

export function VehiclesSectionNav() {
  return (
    <SectionTabs
      items={vehicleSectionItems}
      ariaLabel="차량 운영 하위 화면 이동"
    />
  );
}

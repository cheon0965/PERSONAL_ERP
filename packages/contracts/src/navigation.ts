import type { TenantMembershipRole } from './auth';

export type NavigationMenuItemType = 'GROUP' | 'PAGE';

export type NavigationMenuMatchMode = 'EXACT' | 'PREFIX';

export type NavigationMenuItem = {
  id: string;
  key: string;
  parentId: string | null;
  itemType: NavigationMenuItemType;
  label: string;
  description: string | null;
  href: string | null;
  iconKey: string | null;
  matchMode: NavigationMenuMatchMode;
  sortOrder: number;
  depth: number;
  isVisible: boolean;
  allowedRoles: TenantMembershipRole[];
  children: NavigationMenuItem[];
};

export type NavigationMenuTreeResponse = {
  items: NavigationMenuItem[];
};

export type UpdateNavigationMenuItemRequest = {
  isVisible?: boolean;
  allowedRoles?: TenantMembershipRole[];
};

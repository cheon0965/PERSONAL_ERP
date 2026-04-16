import type { NavigationMenuTreeResponse } from '@personal-erp/contracts';
import { fetchJson } from '@/shared/api/fetch-json';

export const workspaceNavigationQueryKey = [
  'workspace-navigation',
  'tree'
] as const;

export function getWorkspaceNavigationTree() {
  return fetchJson<NavigationMenuTreeResponse>('/navigation/tree', {
    items: []
  });
}

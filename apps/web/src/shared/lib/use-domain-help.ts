'use client';

import * as React from 'react';
import {
  type DomainHelpContextType,
  useDomainHelpStore
} from '../providers/domain-help-provider';

/**
 * 페이지별 도움말 내용을 전역 화면 도움말에 등록합니다.
 */
export function useDomainHelp(context: DomainHelpContextType) {
  const { setContext, clearContext } = useDomainHelpStore();
  const serializedContext = React.useMemo(
    () => JSON.stringify(context),
    [context]
  );
  const stableContext = React.useMemo(() => context, [serializedContext]);

  React.useEffect(() => {
    setContext(stableContext);

    return () => {
      clearContext(stableContext);
    };
  }, [stableContext, setContext, clearContext]);
}

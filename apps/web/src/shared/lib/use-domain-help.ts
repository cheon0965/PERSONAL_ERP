'use client';

import * as React from 'react';
import {
  type DomainHelpContextType,
  useDomainHelpStore
} from '../providers/domain-help-provider';

/**
 * 페이지별 도메인 지식을 전역 도움말 시스템(TopBar 아이콘)에 등록하는 훅입니다.
 */
export function useDomainHelp(context: DomainHelpContextType) {
  const { setContext, activeContext } = useDomainHelpStore();

  React.useEffect(() => {
    const isSame = JSON.stringify(context) === JSON.stringify(activeContext);

    if (!isSame) {
      setContext(context);
    }

    return () => {
      // 페이지 전환 시, 현재 등록했던 그 도움말이 여전히 활성 상태라면 클린업
      // 단, 즉각적인 null 처리는 다음 페이지의 등록과 경합할 수 있으므로
      // 실제로는 전역 상태이므로 페이지 컴포넌트 수준의 언마운트와 전역 스토어의 데이터 생명 주기를 분리해서 생각할 필요가 있음
    };
  }, [context, setContext, activeContext]);
}

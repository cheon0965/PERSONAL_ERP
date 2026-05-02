import type { ImportSourceKind } from '@prisma/client';
import { buildSourceFingerprint } from './import-batch.policy';

export function resolveCollectedSourceFingerprint(input: {
  existingSourceFingerprint: string | null;
  sourceKind: ImportSourceKind;
  occurredOn: string;
  amount: number;
  title: string;
}): string {
  // 파서가 은행/카드 원본 고유값을 제공한 경우 그대로 보존한다.
  // 과거/수동 원본처럼 값이 없을 때만 정규화된 설명 기반 fingerprint를 만든다.
  return (
    input.existingSourceFingerprint ??
    buildSourceFingerprint({
      sourceKind: input.sourceKind,
      occurredOn: input.occurredOn,
      amount: input.amount,
      description: input.title,
      sourceOrigin: null
    })
  );
}

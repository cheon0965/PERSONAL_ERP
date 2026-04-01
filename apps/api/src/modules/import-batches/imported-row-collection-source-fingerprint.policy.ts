import type { ImportSourceKind } from '@prisma/client';
import { buildSourceFingerprint } from './import-batch.policy';

export function resolveCollectedSourceFingerprint(input: {
  existingSourceFingerprint: string | null;
  sourceKind: ImportSourceKind;
  occurredOn: string;
  amount: number;
  title: string;
}): string {
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

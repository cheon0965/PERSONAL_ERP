import { Catch, ConflictException, type ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaConflictExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    if (exception.code !== 'P2002') {
      return super.catch(exception, host);
    }

    const target = readConflictTarget(exception);
    return super.catch(
      new ConflictException(resolveConflictMessage(target)),
      host
    );
  }
}

function readConflictTarget(
  exception: Prisma.PrismaClientKnownRequestError
): string[] {
  const target = exception.meta?.target;
  return Array.isArray(target)
    ? target.filter((item): item is string => typeof item === 'string')
    : [];
}

function resolveConflictMessage(target: string[]) {
  if (hasExactTarget(target, ['ledgerId', 'entryNumber'])) {
    return '동시에 다른 전표가 먼저 기록되었습니다. 다시 시도해 주세요.';
  }

  if (hasExactTarget(target, ['periodId', 'recurringRuleId', 'plannedDate'])) {
    return '해당 반복 규칙과 예정일의 계획 항목이 이미 생성되었습니다.';
  }

  if (hasExactTarget(target, ['ledgerId', 'normalizedName'])) {
    return '같은 이름의 데이터가 이미 있습니다.';
  }

  if (
    hasExactTarget(target, ['ledgerId', 'kind', 'normalizedName']) ||
    hasExactTarget(target, [
      'ledgerId',
      'normalizedProvider',
      'normalizedProductName'
    ])
  ) {
    return '같은 기준의 데이터가 이미 있습니다.';
  }

  if (hasExactTarget(target, ['ledgerId', 'year', 'month'])) {
    return '해당 월 운영 기간이 이미 존재합니다.';
  }

  if (
    hasExactTarget(target, ['fromPeriodId']) ||
    hasExactTarget(target, ['toPeriodId']) ||
    hasExactTarget(target, ['sourceClosingSnapshotId'])
  ) {
    return '해당 운영 기간의 차기 이월이 이미 생성되었습니다.';
  }

  if (hasExactTarget(target, ['importedRowId'])) {
    return '이미 수집 거래로 승격된 업로드 행입니다.';
  }

  if (hasExactTarget(target, ['matchedPlanItemId'])) {
    return '이미 다른 수집 거래와 연결된 계획 항목입니다.';
  }

  if (hasExactTarget(target, ['sourceCollectedTransactionId'])) {
    return '이미 전표로 확정된 수집 거래입니다.';
  }

  if (hasExactTarget(target, ['reversesJournalEntryId'])) {
    return '이미 역분개가 생성된 전표입니다.';
  }

  return '이미 존재하는 데이터와 충돌했습니다. 다시 확인해 주세요.';
}

function hasExactTarget(target: string[], expected: string[]) {
  if (target.length !== expected.length) {
    return false;
  }

  return expected.every((field) => target.includes(field));
}

import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from '@nestjs/common';
import { ImportedRowParseStatus } from '@prisma/client';
import {
  readParsedImportedRowPayload,
  type ParsedImportedRowPayload
} from './import-batch.policy';
import type {
  CollectableImportedRow,
  CollectingPeriodRecord
} from './imported-row-collection.types';

export function assertImportedRowCanBeCollected(
  row: CollectableImportedRow | null
): asserts row is CollectableImportedRow {
  if (!row) {
    throw new NotFoundException('업로드 행을 찾을 수 없습니다.');
  }

  if (row.parseStatus !== ImportedRowParseStatus.PARSED) {
    throw new BadRequestException(
      '파싱 완료 행만 수집 거래로 승격할 수 있습니다.'
    );
  }

  if (row.createdCollectedTransaction) {
    throw new ConflictException('이미 수집 거래로 승격된 업로드 행입니다.');
  }
}

export function readNormalizedImportedRow(
  row: CollectableImportedRow
): ParsedImportedRowPayload {
  const parsedRow = readParsedImportedRowPayload(row.rawPayload);
  if (!parsedRow) {
    throw new BadRequestException(
      '파싱 완료 행의 정규화 결과를 읽을 수 없습니다.'
    );
  }

  return parsedRow;
}

export function assertOccurredOnWithinPeriod(
  occurredOnIso: string,
  currentCollectingPeriod: Pick<CollectingPeriodRecord, 'startDate' | 'endDate'>
): Date {
  const occurredOn = new Date(`${occurredOnIso}T00:00:00.000Z`);

  if (
    occurredOn.getTime() < currentCollectingPeriod.startDate.getTime() ||
    occurredOn.getTime() >= currentCollectingPeriod.endDate.getTime()
  ) {
    throw new BadRequestException(
      '수집 거래 일자는 대상 운영 기간 안에 있어야 합니다.'
    );
  }

  return occurredOn;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import type { CompleteFundingAccountBootstrapRequest } from '@personal-erp/contracts';
import { IsInt, IsOptional, Min } from 'class-validator';

export class CompleteFundingAccountBootstrapDto implements CompleteFundingAccountBootstrapRequest {
  @ApiPropertyOptional({
    description:
      '기초 업로드 대기 자금수단의 기초금액 (원). 0원이거나 비어 있으면 기초전표 없이 상태만 완료합니다.'
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  initialBalanceWon?: number | null;
}

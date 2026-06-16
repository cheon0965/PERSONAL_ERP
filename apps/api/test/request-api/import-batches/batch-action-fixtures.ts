import assert from 'node:assert/strict';
import type { ImportBatchCollectionJobItem } from '@personal-erp/contracts';
import { createRequestTestContext } from '../../support/request-api/index';

export async function readCollectionJobUntilDone(
  context: Awaited<ReturnType<typeof createRequestTestContext>>,
  importBatchId: string,
  jobId: string
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await context.request(
      `/import-batches/${importBatchId}/collection-jobs/${jobId}`,
      {
        method: 'GET',
        headers: context.authHeaders()
      }
    );
    assert.equal(response.status, 200);

    const job = response.body as ImportBatchCollectionJobItem;
    if (
      job.status === 'SUCCEEDED' ||
      job.status === 'PARTIAL' ||
      job.status === 'FAILED' ||
      job.status === 'CANCELLED'
    ) {
      return job;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error('일괄 등록 작업이 제한 시간 안에 완료되지 않았습니다.');
}

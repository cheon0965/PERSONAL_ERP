import { JournalEntriesPage } from '@/features/journal-entries/journal-entries-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '전표 조회',
  description: '수집 거래에서 확정된 전표와 수정·취소 이력을 조회하고 회계 처리 상태를 확인합니다.'
});

export default async function Page({
  searchParams
}: {
  searchParams?: Promise<{ entryId?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const highlightedEntryId = resolvedSearchParams.entryId ?? null;

  return (
    <JournalEntriesPage
      highlightedEntryId={highlightedEntryId}
      layout={highlightedEntryId ? 'split' : 'list'}
    />
  );
}

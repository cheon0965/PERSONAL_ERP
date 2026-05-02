import { JournalEntriesPage } from '@/features/journal-entries/journal-entries-page';
import { createPageMetadata } from '@/shared/seo/page-metadata';

export const metadata = createPageMetadata({
  title: '전표 상세',
  description: '선택한 전표의 상세 내용, 연결 거래, 수정·취소 흐름을 확인합니다.'
});

export default async function JournalEntryDetailRoute({
  params
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;

  return <JournalEntriesPage highlightedEntryId={entryId} layout="detail" />;
}

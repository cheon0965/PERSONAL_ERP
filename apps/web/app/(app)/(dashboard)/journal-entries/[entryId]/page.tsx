import { JournalEntriesPage } from '@/features/journal-entries/journal-entries-page';

export default async function JournalEntryDetailRoute({
  params
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;

  return <JournalEntriesPage highlightedEntryId={entryId} layout="detail" />;
}

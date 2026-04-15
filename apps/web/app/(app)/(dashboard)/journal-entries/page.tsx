import { JournalEntriesPage } from '@/features/journal-entries/journal-entries-page';

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

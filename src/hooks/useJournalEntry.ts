
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Annotation {
  id: string;
  content: string;
  selected_text?: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  date_created: string;
  annotations?: Annotation[];
  journal_entry_tags?: { tag_id: string }[];
}

export interface SystemTag {
  id: string;
  name: string;
  category: string;
}

export interface Narrative {
  id: string;
  title: string;
}

export const fetchJournalEntry = async (journalId: string) => {
  const { data: entry, error } = await supabase
    .from('journal_entries')
    .select(`
      *,
      annotations:journal_entry_annotations (
        id,
        content,
        selected_text,
        created_at
      ),
      journal_entry_tags (
        tag_id
      )
    `)
    .eq('id', journalId)
    .single();

  if (error) {
    console.error('Error fetching journal entry:', error);
    throw new Error('Failed to load journal entry');
  }

  // Process the content to include created_at in the marks
  if (entry.content) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(entry.content, 'text/html');

    doc.querySelectorAll('mark[data-type="annotation"]').forEach(mark => {
      const id = mark.getAttribute('data-id');
      const annotation = entry.annotations?.find(a => a.id === id);
      if (annotation) {
        mark.setAttribute('data-created-at', annotation.created_at);
      }
    });

    entry.content = doc.body.innerHTML;
  }

  return entry;
};

export const useJournalEntry = (journalId: string | undefined) => {
  return useQuery({
    queryKey: ['journal-entry', journalId],
    queryFn: () => fetchJournalEntry(journalId!),
    enabled: !!journalId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const fetchJournalTags = async (tagIds: string[]) => {
  if (!tagIds.length) return [];
  
  const { data: tagsData, error: tagsError } = await supabase
    .from('system_tags')
    .select('*')
    .in('id', tagIds);

  if (tagsError) {
    console.error('Error fetching journal tags:', tagsError);
    throw new Error('Failed to load tags');
  }

  return tagsData || [];
};

export const useJournalTags = (tagIds: string[] = []) => {
  return useQuery({
    queryKey: ['journal-tags', tagIds],
    queryFn: () => fetchJournalTags(tagIds),
    enabled: tagIds.length > 0,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const fetchJournalNarratives = async (journalId: string) => {
  const { data: narrativeEntries, error: narrativesError } = await supabase
    .from('narrative_journal_entries')
    .select(`
      narrative:narratives (
        id,
        title
      )
    `)
    .eq('journal_entry_id', journalId);

  if (narrativesError) {
    console.error('Error fetching narratives:', narrativesError);
    throw new Error('Failed to load narratives');
  }

  return narrativeEntries
    ?.map(entry => entry.narrative)
    .filter((narrative): narrative is Narrative => narrative !== null) || [];
};

export const useJournalNarratives = (journalId: string | undefined) => {
  return useQuery({
    queryKey: ['journal-narratives', journalId],
    queryFn: () => fetchJournalNarratives(journalId!),
    enabled: !!journalId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

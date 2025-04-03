
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import JournalEntryList from '@/components/JournalEntryList';
import { useAuth } from '@/contexts/AuthContext';

const JournalEntries: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [eventTags, setEventTags] = useState<{ [key: string]: string[] }>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        setIsLoading(true);

        if (!user) {
          toast({
            title: "Authentication Error",
            description: "You must be logged in to view journal entries",
            variant: "destructive"
          });
          return;
        }

        // Fetch journal entries with their tags
        const { data: entriesData, error: entriesError } = await supabase
          .from('journal_entries')
          .select(`
            *,
            journal_entry_tags (
              tag_id
            ),
            annotations:journal_entry_annotations (
              id,
              content,
              selected_text,
              created_at
            )
          `)
          .eq('user_id', user.id)
          .order('date', { ascending: false });

        if (entriesError) throw entriesError;

        // Fetch all available tags
        const { data: tagsData, error: tagsError } = await supabase
          .from('system_tags')
          .select('*')
          .order('name');

        if (tagsError) throw tagsError;

        // Process entries to include tags array and annotations
        const entriesWithTags = entriesData.map(entry => {
          // Process the content to include created_at in the marks
          if (entry.content && entry.annotations) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(entry.content, 'text/html');

            doc.querySelectorAll('mark[data-type="annotation"]').forEach(mark => {
              const id = mark.getAttribute('data-id');
              const annotation = entry.annotations.find(a => a.id === id);
              if (annotation) {
                mark.setAttribute('data-created-at', annotation.created_at);
              }
            });

            entry.content = doc.body.innerHTML;
          }

          return {
            ...entry,
            tags: entry.journal_entry_tags.map((t: any) => t.tag_id)
          };
        });

        // Fetch event tags for entries that are linked to events
        const entriesWithEvents = entriesWithTags.filter(entry => entry.event_id);
        if (entriesWithEvents.length > 0) {
          const { data: eventsData, error: eventsError } = await supabase
            .from('events')
            .select('id, tags')
            .in('id', entriesWithEvents.map(entry => entry.event_id));

          if (eventsError) {
            console.error('Error fetching event tags:', eventsError);
          } else {
            // Create a map of entry IDs to their event tags
            const eventTagsMap: { [key: string]: string[] } = {};
            entriesWithEvents.forEach(entry => {
              const event = eventsData.find(e => e.id === entry.event_id);
              if (event?.tags) {
                eventTagsMap[entry.id] = event.tags;
              }
            });
            setEventTags(eventTagsMap);
          }
        }

        setEntries(entriesWithTags);
        setTags(tagsData);
      } catch (error) {
        console.error('Error fetching journal entries:', error);
        toast({
          title: "Error",
          description: "Failed to load journal entries",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchEntries();
  }, [toast, user]);

  const handleDeleteEntry = async (id: string) => {
    try {
      // First delete any narrative_journal_entries references
      const { error: narrativeEntriesError } = await supabase
        .from('narrative_journal_entries')
        .delete()
        .eq('journal_entry_id', id);

      if (narrativeEntriesError) throw narrativeEntriesError;

      // Then delete any journal_entry_tags references
      const { error: entryTagsError } = await supabase
        .from('journal_entry_tags')
        .delete()
        .eq('journal_entry_id', id);

      if (entryTagsError) throw entryTagsError;

      // Finally delete the journal entry itself
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setEntries(entries.filter(entry => entry.id !== id));
      // Also remove from eventTags
      setEventTags(prev => {
        const newEventTags = { ...prev };
        delete newEventTags[id];
        return newEventTags;
      });

      toast({
        title: "Success",
        description: "Journal entry deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      toast({
        title: "Error",
        description: "Failed to delete journal entry",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Journal Entries</h2>
        <Button 
          onClick={() => navigate('/dashboard/journal/create')}
          className="flex items-center gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          New Entry
        </Button>
      </div>

      <JournalEntryList
        entries={entries}
        isLoading={isLoading}
        onDelete={handleDeleteEntry}
        tags={tags}
        eventTags={eventTags}
      />
    </div>
  );
};

export default JournalEntries;

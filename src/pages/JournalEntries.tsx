
import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import JournalEntryForm from '@/components/JournalEntryForm';
import JournalEntryList from '@/components/JournalEntryList';

const JournalEntries: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tags, setTags] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        setIsLoading(true);
        const { data: entriesData, error: entriesError } = await supabase
          .from('journal_entries')
          .select('*')
          .order('date_created', { ascending: false });

        if (entriesError) throw entriesError;
        
        const { data: tagsData, error: tagsError } = await supabase
          .from('system_tags')
          .select('*');
          
        if (tagsError) throw tagsError;

        // Fetch tags for each entry
        const entriesWithTags = await Promise.all(
          entriesData.map(async (entry) => {
            const { data: entryTags, error: entryTagsError } = await supabase
              .from('journal_entry_tags')
              .select('tag_id')
              .eq('journal_entry_id', entry.id);
              
            if (entryTagsError) throw entryTagsError;
            
            return {
              ...entry,
              tags: entryTags.map(et => et.tag_id)
            };
          })
        );

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
  }, [toast]);

  const handleCreateEntry = async (newEntry: any) => {
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to create entries",
          variant: "destructive"
        });
        return;
      }
      
      // Insert the entry
      const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          ...newEntry,
          user_id: user.id
        })
        .select()
        .single();
        
      if (entryError) throw entryError;
      
      // Add tags if any were selected
      if (newEntry.tags && newEntry.tags.length > 0) {
        const tagInserts = newEntry.tags.map((tagId: string) => ({
          journal_entry_id: entry.id,
          tag_id: tagId
        }));
        
        const { error: tagError } = await supabase
          .from('journal_entry_tags')
          .insert(tagInserts);
          
        if (tagError) throw tagError;
      }
      
      // Add the new entry to the state
      setEntries([{ ...entry, tags: newEntry.tags || [] }, ...entries]);
      setIsCreating(false);
      
      toast({
        title: "Success",
        description: "Journal entry created successfully"
      });
    } catch (error) {
      console.error('Error creating journal entry:', error);
      toast({
        title: "Error",
        description: "Failed to create journal entry",
        variant: "destructive"
      });
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setEntries(entries.filter(entry => entry.id !== id));
      
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
        <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
          <PlusCircle className="h-4 w-4" />
          New Entry
        </Button>
      </div>

      {isCreating ? (
        <div className="mb-6 bg-card p-4 rounded-lg border">
          <h3 className="text-lg font-medium mb-4">Create New Entry</h3>
          <JournalEntryForm 
            onSubmit={handleCreateEntry} 
            onCancel={() => setIsCreating(false)}
            tags={tags}
          />
        </div>
      ) : null}

      <JournalEntryList 
        entries={entries} 
        isLoading={isLoading} 
        onDelete={handleDeleteEntry}
        tags={tags}
      />
    </div>
  );
};

export default JournalEntries;

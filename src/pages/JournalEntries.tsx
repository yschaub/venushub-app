
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import JournalEntryList from '@/components/JournalEntryList';

const JournalEntries: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tags, setTags] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

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
          .select('*')
          .order('name');
          
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
      />
    </div>
  );
};

export default JournalEntries;

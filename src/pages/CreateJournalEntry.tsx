
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import JournalEntryForm from '@/components/JournalEntryForm';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CreateJournalEntry: React.FC = () => {
  const [tags, setTags] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTags = async () => {
      try {
        setIsLoading(true);
        const { data: tagsData, error: tagsError } = await supabase
          .from('system_tags')
          .select('*');
          
        if (tagsError) throw tagsError;
        setTags(tagsData);
      } catch (error) {
        console.error('Error fetching tags:', error);
        toast({
          title: "Error",
          description: "Failed to load tags",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
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
      
      // Extract tags before inserting entry
      const { tags: selectedTags, ...entryData } = newEntry;
      
      // Insert the entry without tags field
      const { data: entry, error: entryError } = await supabase
        .from('journal_entries')
        .insert({
          ...entryData,
          user_id: user.id
        })
        .select()
        .single();
        
      if (entryError) throw entryError;
      
      // Add tags if any were selected
      if (selectedTags && selectedTags.length > 0) {
        const tagInserts = selectedTags.map((tagId: string) => ({
          journal_entry_id: entry.id,
          tag_id: tagId
        }));
        
        const { error: tagError } = await supabase
          .from('journal_entry_tags')
          .insert(tagInserts);
          
        if (tagError) throw tagError;
      }
      
      toast({
        title: "Success",
        description: "Journal entry created successfully"
      });

      // Navigate back to the journal entries list
      navigate('/dashboard/journal');
    } catch (error) {
      console.error('Error creating journal entry:', error);
      toast({
        title: "Error",
        description: "Failed to create journal entry",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return <div className="p-6 flex justify-center">Loading tags...</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/dashboard/journal')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Journal
        </Button>
      </div>
      
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Create New Journal Entry</h2>
        <p className="text-muted-foreground mt-1">Record your thoughts, feelings, and experiences</p>
      </div>
      
      <div className="bg-card p-6 rounded-lg border">
        <JournalEntryForm 
          onSubmit={handleCreateEntry} 
          onCancel={() => navigate('/dashboard/journal')}
          tags={tags}
        />
      </div>
    </div>
  );
};

export default CreateJournalEntry;

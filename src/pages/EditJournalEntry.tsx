
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import JournalEntryEditor from '@/components/JournalEntryEditor';

const EditJournalEntry: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<any>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tags, setTags] = useState<any[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    
    const fetchEntryData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch journal entry
        const { data: entryData, error: entryError } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('id', id)
          .single();
          
        if (entryError) throw entryError;
        
        // Fetch tags for this entry
        const { data: entryTags, error: entryTagsError } = await supabase
          .from('journal_entry_tags')
          .select('tag_id')
          .eq('journal_entry_id', id);
          
        if (entryTagsError) throw entryTagsError;
        
        // Fetch all available tags
        const { data: tagsData, error: tagsError } = await supabase
          .from('system_tags')
          .select('*')
          .order('name');
          
        if (tagsError) throw tagsError;
        
        setEntry(entryData);
        setSelectedTags(entryTags.map((tag: any) => tag.tag_id));
        setTags(tagsData);
      } catch (error) {
        console.error('Error fetching entry:', error);
        toast({
          title: "Error",
          description: "Failed to load journal entry",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchEntryData();
  }, [id, toast]);

  if (isLoading) {
    return <div className="p-6 flex justify-center">Loading entry...</div>;
  }

  if (!entry) {
    return <div className="p-6">Entry not found</div>;
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
        <h2 className="text-2xl font-semibold">Edit Journal Entry</h2>
        <p className="text-muted-foreground mt-1">
          Update your entry and add annotations
        </p>
      </div>
      
      <JournalEntryEditor
        mode="edit"
        entryId={id}
        initialValues={{
          title: entry.title,
          content: entry.content || '',
          tags: selectedTags
        }}
        tags={tags}
        onSuccess={() => navigate('/dashboard/journal')}
        onCancel={() => navigate('/dashboard/journal')}
      />
    </div>
  );
};

export default EditJournalEntry;

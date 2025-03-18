
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import JournalEntryEditor from '@/components/JournalEntryEditor';

interface EventData {
  id: string;
  title: string;
  tags: string[];
  date: string;
}

const CreateJournalEntry: React.FC = () => {
  const [tags, setTags] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Extract event data from location state if it exists
  const eventData = location.state?.eventData as EventData | undefined;

  // Log the event data for debugging
  console.log("Event data received:", eventData);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        setIsLoading(true);
        const { data: tagsData, error: tagsError } = await supabase
          .from('system_tags')
          .select('*')
          .order('name');

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
        <h2 className="text-2xl font-semibold">
          {eventData ? `Journal About: ${eventData.title}` : 'Create New Journal Entry'}
        </h2>
        <p className="text-muted-foreground mt-1">
          {eventData
            ? 'Record your thoughts about this specific event'
            : 'Record your thoughts, feelings, and experiences'}
        </p>
      </div>

      <JournalEntryEditor
        mode="create"
        tags={tags}
        initialValues={{
          title: eventData?.title || '',
          content: '',
          tags: eventData?.tags || []
        }}
        eventId={eventData?.id}
        eventDate={eventData?.date}
        onSuccess={() => navigate('/dashboard/journal')}
        onCancel={() => navigate('/dashboard/journal')}
      />
    </div>
  );
};

export default CreateJournalEntry;

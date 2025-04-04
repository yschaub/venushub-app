import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, BookOpen, ChevronRight, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Tag {
  id: string;
  name: string;
}

interface JournalEntry {
  id: string;
  title: string;
  content: string | null;
  date_created: string;
}

interface Narrative {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
  required_tags?: string[];
  entry_count?: number;
  journal_entries?: JournalEntry[];
  tags?: Tag[];
}

interface NarrativesListProps {
  categoryId: string;
  categoryName: string;
}

const NarrativesList = ({ categoryId, categoryName }: NarrativesListProps) => {
  const navigate = useNavigate();
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchNarratives = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setError("No authenticated user found");
        return;
      }

      // Fetch narratives for this category
      const { data: narrativesData, error: narrativesError } = await supabase
        .from('narratives')
        .select('*')
        .eq('category_id', categoryId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (narrativesError) throw narrativesError;

      // Get journal entries and tags for each narrative
      const narrativesWithEntries = await Promise.all(
        narrativesData.map(async (narrative) => {
          // First get the narrative_journal_entries associations
          const { data: associationsData, error: associationsError } = await supabase
            .from('narrative_journal_entries')
            .select('journal_entry_id')
            .eq('narrative_id', narrative.id)
            .order('added_at', { ascending: false });

          if (associationsError) {
            console.error('Error fetching associations:', associationsError);
            return { ...narrative, journal_entries: [] };
          }

          if (!associationsData || associationsData.length === 0) {
            return { ...narrative, journal_entries: [], entry_count: 0 };
          }

          // Then get the actual journal entries
          const { data: entriesData, error: entriesError } = await supabase
            .from('journal_entries')
            .select('id, title, content, date_created')
            .in('id', associationsData.map(a => a.journal_entry_id))
            .eq('user_id', user.id)
            .order('date_created', { ascending: false });

          if (entriesError) {
            console.error('Error fetching entries:', entriesError);
            return { ...narrative, journal_entries: [] };
          }

          // Fetch tags if the narrative has required tags
          let tags: Tag[] = [];
          if (narrative.required_tags && narrative.required_tags.length > 0) {
            const { data: tagData, error: tagError } = await supabase
              .from('system_tags')
              .select('id, name')
              .in('id', narrative.required_tags);

            if (!tagError && tagData) {
              tags = tagData;
            }
          }

          return {
            ...narrative,
            journal_entries: entriesData || [],
            entry_count: entriesData?.length || 0,
            tags
          };
        })
      );

      setNarratives(narrativesWithEntries);
    } catch (error: any) {
      console.error('Error fetching narratives:', error);
      setError(error.message || "Failed to load narratives");
      toast({
        title: "Error",
        description: "Failed to load narratives",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNarratives();
  }, [categoryId]);

  if (isLoading) {
    return <div className="py-4 text-center">Loading narratives...</div>;
  }

  if (error) {
    return (
      <div className="py-4">
        <p className="text-destructive mb-2">Error: {error}</p>
        <Button
          variant="outline"
          onClick={fetchNarratives}
          size="sm"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-medium">Narratives</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/dashboard/narratives/create/${categoryId}`)}
          className="flex items-center gap-1"
        >
          <PlusCircle className="h-4 w-4" />
          New Narrative
        </Button>
      </div>

      {narratives.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-4">
          No narratives in this category yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-6">
          {narratives.map((narrative) => (
            <Card key={narrative.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <CardTitle className="text-base cursor-pointer hover:text-primary" onClick={() => navigate(`/dashboard/narratives/${narrative.id}`)}>
                      {narrative.title}
                    </CardTitle>
                    {narrative.content && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {narrative.content}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center text-muted-foreground text-sm">
                    <BookOpen className="h-4 w-4 mr-1" />
                    <span>{narrative.entry_count} journal entries</span>
                  </div>

                  {narrative.tags && narrative.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {narrative.tags.map(tag => (
                        <Badge key={tag.id} variant="secondary">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default NarrativesList;


import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, BookOpen, Edit } from 'lucide-react';
import CreateNarrativeDialog from './CreateNarrativeDialog';

interface Narrative {
  id: string;
  title: string;
  content: string | null;
  created_at: string;
  updated_at: string;
  required_tags?: string[];
  entry_count?: number;
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedNarrative, setSelectedNarrative] = useState<Narrative | null>(null);
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
      
      // Get the count of journal entries for each narrative
      const narrativesWithEntryCounts = await Promise.all(
        narrativesData.map(async (narrative) => {
          const { count, error: countError } = await supabase
            .from('narrative_journal_entries')
            .select('*', { count: 'exact', head: true })
            .eq('narrative_id', narrative.id);
          
          if (countError) {
            console.error('Error fetching entry count:', countError);
            return { ...narrative, entry_count: 0 };
          }
          
          return { ...narrative, entry_count: count || 0 };
        })
      );
      
      setNarratives(narrativesWithEntryCounts);
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

  const handleEditNarrative = (narrative: Narrative) => {
    setSelectedNarrative(narrative);
    setEditDialogOpen(true);
  };

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
          onClick={() => setCreateDialogOpen(true)}
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
        <div className="space-y-3">
          {narratives.map((narrative) => (
            <Card key={narrative.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">{narrative.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditNarrative(narrative)}
                    title="Edit narrative"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-muted-foreground text-sm">
                    <BookOpen className="h-4 w-4 mr-1" />
                    <span>{narrative.entry_count} journal entries</span>
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto"
                    onClick={() => navigate(`/dashboard/narratives/${narrative.id}`)}
                  >
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      <CreateNarrativeDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        categoryId={categoryId}
        categoryName={categoryName}
        onNarrativeCreated={fetchNarratives}
      />
      
      <CreateNarrativeDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        categoryId={categoryId}
        categoryName={categoryName}
        narrativeToEdit={selectedNarrative}
        onNarrativeCreated={fetchNarratives}
      />
    </div>
  );
};

export default NarrativesList;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusCircle, BookText, BookOpen, Tag, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import NarrativesList from '@/components/NarrativesList';

const Narratives: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasAnyNarratives, setHasAnyNarratives] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // First get the current user ID
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) throw userError;

        if (!user) {
          setError("No authenticated user found");
          return;
        }

        // Then fetch categories for this user only
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('narrative_categories')
          .select('*')
          .eq('is_active', true)
          .eq('user_id', user.id)
          .order('name');

        if (categoriesError) throw categoriesError;

        // Check if user has any narratives at all
        const { count, error: narrativeError } = await supabase
          .from('narratives')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (narrativeError) throw narrativeError;

        setHasAnyNarratives(count ? count > 0 : false);
        setCategories(categoriesData);
      } catch (error: any) {
        console.error('Error fetching narrative categories:', error);
        setError(error.message || "Failed to load categories");
        toast({
          title: "Error",
          description: "Failed to load narrative categories",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, [toast]);

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'eclipse':
        return '🌓';
      case 'return':
        return '🔄';
      case 'transit':
        return '⚡';
      case 'custom':
        return '📝';
      default:
        return '📋';
    }
  };

  if (isLoading) {
    return <div className="p-6 flex justify-center">Loading categories...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold">Narratives</h2>
          <p className="text-muted-foreground mt-1">
            Organize your astrological stories and insights
          </p>
        </div>
        <Card className="bg-muted/50">
          <CardContent className="py-10 text-center">
            <p className="text-destructive mb-2">Error: {error}</p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show empty state if:
  // 1. No categories exist at all, or
  // 2. Categories exist but no narratives exist in any of them
  const showEmptyState = categories.length === 0 || !hasAnyNarratives;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Narratives</h2>
          <p className="text-muted-foreground mt-1">
            Organize your astrological stories and insights
          </p>
        </div>
      </div>

      {showEmptyState ? (
        <Card className="bg-muted/50">
          <CardContent className="py-16 px-4 flex flex-col items-center text-center">
            <div className="bg-primary/10 p-5 rounded-full mb-6">
              <BookText className="h-16 w-16 text-primary/80" />
            </div>
            <CardTitle className="text-2xl mb-4">Discover Narratives</CardTitle>
            <div className="max-w-2xl space-y-4">
              <p className="text-muted-foreground">
                Narratives are powerful tools to track patterns and insights across your journal entries.
                They help you organize your astrological experiences into meaningful stories and themes.
              </p>
              <div className="py-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="bg-background p-6 rounded-lg border border-border/60 hover:border-primary/20 hover:bg-accent/20 transition-colors flex flex-col">
                  <div className="bg-primary/5 p-3 rounded-full w-fit mb-4">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-medium text-lg mb-2.5">
                    Connect Journal Entries
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Group related journal entries together to see patterns over time and across different events.
                  </p>
                </div>
                <div className="bg-background p-6 rounded-lg border border-border/60 hover:border-primary/20 hover:bg-accent/20 transition-colors flex flex-col">
                  <div className="bg-primary/5 p-3 rounded-full w-fit mb-4">
                    <Tag className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-medium text-lg mb-2.5">
                    Use Tags
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Set required tags for a narrative to automatically find journal entries that match your criteria.
                  </p>
                </div>
                <div className="bg-background p-6 rounded-lg border border-border/60 hover:border-primary/20 hover:bg-accent/20 transition-colors flex flex-col">
                  <div className="bg-primary/5 p-3 rounded-full w-fit mb-4">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-medium text-lg mb-2.5">
                    Track Over Time
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Follow how astrological events affect you over time by collecting related experiences in one place.
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-muted-foreground font-medium">
                  To get started, select one of the narrative themes from the sidebar
                  and create your first narrative.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {categories.map((category) => (
            <Card
              key={category.id}
              className="overflow-hidden"
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="text-2xl">{getCategoryIcon(category.type)}</div>
                  <div>
                    <CardTitle>{category.name}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <NarrativesList
                  categoryId={category.id}
                  categoryName={category.name}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Narratives;

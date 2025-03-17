import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import NarrativesList from '@/components/NarrativesList';

const Narratives: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
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
        
        console.log("Fetched user categories:", categoriesData);
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

  const toggleCategoryExpand = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
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

      {categories.length === 0 ? (
        <Card className="bg-muted/50">
          <CardContent className="py-10 text-center">
            <p>No narrative categories available. They will appear here after your first login.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {categories.map((category) => (
            <Card 
              key={category.id} 
              className="overflow-hidden"
            >
              <CardHeader className="pb-3 cursor-pointer" onClick={() => toggleCategoryExpand(category.id)}>
                <div className="flex items-center gap-2">
                  <div className="text-2xl">{getCategoryIcon(category.type)}</div>
                  <CardTitle>{category.name}</CardTitle>
                  {expandedCategories[category.id] ? 
                    <ChevronDown className="h-4 w-4 ml-auto" /> : 
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  }
                </div>
                <CardDescription>
                  {category.type === 'eclipse' && 'Track and interpret eclipse events'}
                  {category.type === 'return' && 'Document planet returns in your chart'}
                  {category.type === 'transit' && 'Record significant planetary transits'}
                  {category.type === 'custom' && 'Your custom narrative category'}
                </CardDescription>
              </CardHeader>
              {expandedCategories[category.id] && (
                <CardContent>
                  <NarrativesList 
                    categoryId={category.id} 
                    categoryName={category.name} 
                  />
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Narratives;

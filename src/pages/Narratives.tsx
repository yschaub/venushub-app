
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { PlusCircle, Folder } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const Narratives: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('narrative_categories')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (categoriesError) throw categoriesError;
        
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error fetching narrative categories:', error);
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Narratives</h2>
          <p className="text-muted-foreground mt-1">
            Organize your astrological stories and insights
          </p>
        </div>
        <Button 
          onClick={() => toast({
            title: "Coming Soon",
            description: "Creating new narratives will be available soon!"
          })} 
          className="flex items-center gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          New Narrative
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card className="bg-muted/50">
          <CardContent className="py-10 text-center">
            <p>No narrative categories available. They will appear here after your first login.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <Card 
              key={category.id} 
              className="cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => toast({
                title: "Coming Soon",
                description: `The ${category.name} category will be available soon!`
              })}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="text-2xl">{getCategoryIcon(category.type)}</div>
                  <CardTitle>{category.name}</CardTitle>
                </div>
                <CardDescription>
                  {category.type === 'eclipse' && 'Track and interpret eclipse events'}
                  {category.type === 'return' && 'Document planet returns in your chart'}
                  {category.type === 'transit' && 'Record significant planetary transits'}
                  {category.type === 'custom' && 'Your custom narrative category'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-muted-foreground text-sm">
                  <Folder className="h-4 w-4 mr-1" />
                  <span>0 narratives</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Narratives;

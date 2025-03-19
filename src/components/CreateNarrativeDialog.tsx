
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface CreateNarrativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
  onNarrativeCreated: () => void;
  narrativeToEdit?: {
    id: string;
    title: string;
    required_tags?: string[];
  } | null;
}

const CreateNarrativeDialog = ({
  open,
  onOpenChange,
  categoryId,
  categoryName,
  onNarrativeCreated,
  narrativeToEdit = null
}: CreateNarrativeDialogProps) => {
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [matchingEntriesCount, setMatchingEntriesCount] = useState<number | null>(null);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      // Reset form when dialog opens
      if (narrativeToEdit) {
        setTitle(narrativeToEdit.title);
        setSelectedTags(narrativeToEdit.required_tags || []);
      } else {
        setTitle('');
        setSelectedTags([]);
      }
      
      fetchTags();
    }
  }, [open, narrativeToEdit]);

  useEffect(() => {
    if (selectedTags.length > 0) {
      updateMatchingEntriesCount();
    } else {
      setMatchingEntriesCount(null);
    }
  }, [selectedTags]);

  const fetchTags = async () => {
    try {
      const { data: tagsData, error } = await supabase
        .from('system_tags')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      setAvailableTags(tagsData || []);
    } catch (error: any) {
      console.error('Error fetching tags:', error);
      toast({
        title: "Error",
        description: "Failed to load tags",
        variant: "destructive"
      });
    }
  };

  const updateMatchingEntriesCount = async () => {
    if (selectedTags.length === 0) {
      setMatchingEntriesCount(null);
      return;
    }

    try {
      setIsLoadingCount(true);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) return;
      
      // Count journal entries with ALL of the selected tags
      const { count, error } = await supabase
        .from('journal_entry_tags')
        .select('journal_entry_id', { count: 'exact', head: true })
        .in('tag_id', selectedTags)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setMatchingEntriesCount(count || 0);
    } catch (error: any) {
      console.error('Error counting matching entries:', error);
      setMatchingEntriesCount(null);
    } finally {
      setIsLoadingCount(false);
    }
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for your narrative",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) throw userError;
      
      if (!user) {
        throw new Error("You must be logged in to create a narrative");
      }
      
      if (narrativeToEdit) {
        // Update existing narrative
        const { error } = await supabase
          .from('narratives')
          .update({
            title,
            required_tags: selectedTags,
            updated_at: new Date().toISOString()
          })
          .eq('id', narrativeToEdit.id);
        
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Narrative updated successfully"
        });
      } else {
        // Create new narrative
        const { data, error } = await supabase
          .from('narratives')
          .insert({
            title,
            category_id: categoryId,
            user_id: user.id,
            required_tags: selectedTags
          })
          .select()
          .single();
        
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Narrative created successfully"
        });
      }
      
      // Reset form and close dialog
      setTitle('');
      setSelectedTags([]);
      onOpenChange(false);
      
      // Notify parent component
      onNarrativeCreated();
      
    } catch (error: any) {
      console.error('Error saving narrative:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save narrative",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{narrativeToEdit ? 'Edit Narrative' : 'Create New Narrative'}</DialogTitle>
          <DialogDescription>
            {narrativeToEdit 
              ? 'Update your narrative details' 
              : `Add a new narrative to the ${categoryName} category`}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter narrative title"
                autoFocus
              />
            </div>
            
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                Required Tags (optional)
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Journal entries with these tags will be automatically added to this narrative.
              </p>
              
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedTags.length > 0 ? (
                  availableTags
                    .filter(tag => selectedTags.includes(tag.id))
                    .map(tag => (
                      <Badge key={tag.id} variant="secondary" className="cursor-pointer" onClick={() => handleTagToggle(tag.id)}>
                        {tag.name} ✕
                      </Badge>
                    ))
                ) : (
                  <span className="text-xs text-muted-foreground">No tags selected</span>
                )}
              </div>
              
              <div className="bg-muted/50 rounded-md p-2 max-h-40 overflow-y-auto">
                {availableTags.map(tag => (
                  <div key={tag.id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={selectedTags.includes(tag.id)}
                      onCheckedChange={() => handleTagToggle(tag.id)}
                    />
                    <label
                      htmlFor={`tag-${tag.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {tag.name}
                    </label>
                  </div>
                ))}
              </div>
              
              {(selectedTags.length > 0 || isLoadingCount) && (
                <div className="mt-2 text-sm">
                  {isLoadingCount ? (
                    <div className="flex items-center">
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Calculating matching entries...
                    </div>
                  ) : (
                    <span>
                      {matchingEntriesCount !== null 
                        ? `${matchingEntriesCount} journal entries match these tags`
                        : 'No matching journal entries found'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : narrativeToEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateNarrativeDialog;

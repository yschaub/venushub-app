
import { useState } from 'react';
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

interface CreateNarrativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
  onNarrativeCreated: () => void;
}

const CreateNarrativeDialog = ({
  open,
  onOpenChange,
  categoryId,
  categoryName,
  onNarrativeCreated
}: CreateNarrativeDialogProps) => {
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

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
      
      // Create new narrative
      const { data, error } = await supabase
        .from('narratives')
        .insert({
          title,
          category_id: categoryId,
          user_id: user.id
        })
        .select()
        .single();
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Narrative created successfully"
      });
      
      // Reset form and close dialog
      setTitle('');
      onOpenChange(false);
      
      // Notify parent component
      onNarrativeCreated();
      
    } catch (error: any) {
      console.error('Error creating narrative:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create narrative",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Narrative</DialogTitle>
          <DialogDescription>
            Add a new narrative to the {categoryName} category
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
              {isSubmitting ? 'Creating...' : 'Create Narrative'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateNarrativeDialog;

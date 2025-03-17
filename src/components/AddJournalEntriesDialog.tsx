
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
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';

interface JournalEntry {
  id: string;
  title: string;
  content: string | null;
  date_created: string;
  isSelected?: boolean;
  isAlreadyAdded?: boolean;
}

interface AddJournalEntriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  narrativeId: string;
  narrative: string;
  onEntriesAdded: () => void;
}

const AddJournalEntriesDialog = ({
  open,
  onOpenChange,
  narrativeId,
  narrative,
  onEntriesAdded
}: AddJournalEntriesDialogProps) => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchEntriesAndExistingLinks();
    }
  }, [open, narrativeId]);

  const fetchEntriesAndExistingLinks = async () => {
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
      
      // Fetch all journal entries for this user
      const { data: entriesData, error: entriesError } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date_created', { ascending: false });
      
      if (entriesError) throw entriesError;
      
      // Fetch existing links between journal entries and this narrative
      const { data: existingLinks, error: linksError } = await supabase
        .from('narrative_journal_entries')
        .select('journal_entry_id')
        .eq('narrative_id', narrativeId);
      
      if (linksError) throw linksError;
      
      // Mark which entries are already added to this narrative
      const alreadyAddedEntryIds = new Set(existingLinks.map(link => link.journal_entry_id));
      
      const entriesWithSelection = entriesData.map(entry => ({
        ...entry,
        isSelected: alreadyAddedEntryIds.has(entry.id),
        isAlreadyAdded: alreadyAddedEntryIds.has(entry.id)
      }));
      
      setEntries(entriesWithSelection);
    } catch (error: any) {
      console.error('Error fetching journal entries:', error);
      setError(error.message || "Failed to load journal entries");
      toast({
        title: "Error",
        description: "Failed to load journal entries",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleEntry = (entryId: string) => {
    setEntries(prevEntries => 
      prevEntries.map(entry => 
        entry.id === entryId 
          ? { ...entry, isSelected: !entry.isSelected } 
          : entry
      )
    );
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Find entries that are selected but not already added
      const entriesToAdd = entries.filter(entry => entry.isSelected && !entry.isAlreadyAdded);
      
      // Find entries that are not selected but were previously added
      const entriesToRemove = entries.filter(entry => !entry.isSelected && entry.isAlreadyAdded);
      
      // Add new entries
      if (entriesToAdd.length > 0) {
        const entriesToInsert = entriesToAdd.map(entry => ({
          narrative_id: narrativeId,
          journal_entry_id: entry.id
        }));
        
        const { error: insertError } = await supabase
          .from('narrative_journal_entries')
          .insert(entriesToInsert);
        
        if (insertError) throw insertError;
      }
      
      // Remove unselected entries
      if (entriesToRemove.length > 0) {
        for (const entry of entriesToRemove) {
          const { error: deleteError } = await supabase
            .from('narrative_journal_entries')
            .delete()
            .eq('narrative_id', narrativeId)
            .eq('journal_entry_id', entry.id);
          
          if (deleteError) throw deleteError;
        }
      }
      
      toast({
        title: "Success",
        description: "Journal entries updated successfully"
      });
      
      onOpenChange(false);
      onEntriesAdded();
      
    } catch (error: any) {
      console.error('Error updating journal entries:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update journal entries",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const truncateContent = (content: string | null, maxLength: number = 100) => {
    if (!content) return '';
    return content.length > maxLength
      ? `${content.substring(0, maxLength)}...`
      : content;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Journal Entries</DialogTitle>
          <DialogDescription>
            Select journal entries to add to "{narrative}"
          </DialogDescription>
        </DialogHeader>
        
        <div className="overflow-y-auto flex-grow py-4">
          {isLoading ? (
            <div className="text-center py-8">Loading journal entries...</div>
          ) : error ? (
            <div className="text-destructive py-4">{error}</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No journal entries found. Create some journal entries first.
            </div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <div 
                  key={entry.id} 
                  className="flex items-start gap-3 p-3 border rounded-md hover:bg-muted/30"
                >
                  <Checkbox 
                    id={`entry-${entry.id}`}
                    checked={entry.isSelected}
                    onCheckedChange={() => handleToggleEntry(entry.id)}
                    className="mt-1"
                  />
                  <div className="flex-grow overflow-hidden">
                    <label 
                      htmlFor={`entry-${entry.id}`}
                      className="font-medium cursor-pointer"
                    >
                      {entry.title}
                    </label>
                    <div className="text-sm text-muted-foreground mb-1">
                      {format(new Date(entry.date_created), 'MMMM d, yyyy')}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                      {truncateContent(entry.content)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleSave}
            disabled={isLoading || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddJournalEntriesDialog;

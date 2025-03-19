import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface AddJournalEntriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  narrativeId: string;
  narrative: string;
  onEntriesAdded: () => void;
}

interface JournalEntry {
  id: string;
  title: string;
  date_created: string;
  isSelected: boolean;
}

const AddJournalEntriesDialog: React.FC<AddJournalEntriesDialogProps> = ({
  open,
  onOpenChange,
  narrativeId,
  narrative,
  onEntriesAdded
}) => {
  const { toast } = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchJournalEntries();
    }
  }, [open]);

  const fetchJournalEntries = async () => {
    try {
      setIsLoading(true);
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) return;

      // Fetch all journal entries for the user
      const { data: entriesData, error: entriesError } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date_created', { ascending: false });

      if (entriesError) throw entriesError;

      // Fetch existing narrative entries to check which ones are already added
      const { data: narrativeEntries, error: narrativeError } = await supabase
        .from('narrative_journal_entries')
        .select('journal_entry_id')
        .eq('narrative_id', narrativeId);

      if (narrativeError) throw narrativeError;

      // Create a Set of already added entry IDs
      const addedEntryIds = new Set(narrativeEntries?.map(entry => entry.journal_entry_id) || []);

      // Transform entries and mark which ones are already added
      const transformedEntries = entriesData.map(entry => ({
        id: entry.id,
        title: entry.title,
        date_created: entry.date_created,
        isSelected: addedEntryIds.has(entry.id)
      }));

      setEntries(transformedEntries);
    } catch (error: any) {
      console.error('Error fetching journal entries:', error);
      toast({
        title: "Error",
        description: "Failed to load journal entries",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEntryToggle = (entryId: string) => {
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

      // Get selected entries
      const selectedEntries = entries.filter(entry => entry.isSelected);

      // Insert new narrative entries
      const { error: insertError } = await supabase
        .from('narrative_journal_entries')
        .insert(
          selectedEntries.map(entry => ({
            narrative_id: narrativeId,
            journal_entry_id: entry.id
          }))
        );

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "Journal entries added to narrative",
      });

      onEntriesAdded();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error adding entries to narrative:', error);
      toast({
        title: "Error",
        description: "Failed to add entries to narrative",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Journal Entries to {narrative}</DialogTitle>
          <DialogDescription>
            Select the journal entries you want to add to this narrative.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted"
                  >
                    <Checkbox
                      id={entry.id}
                      checked={entry.isSelected}
                      onCheckedChange={() => handleEntryToggle(entry.id)}
                    />
                    <label
                      htmlFor={entry.id}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium">{entry.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(entry.date_created), 'PPP')}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !entries.some(entry => entry.isSelected)}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Selected Entries'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddJournalEntriesDialog;

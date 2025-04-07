import React, { useState, useRef, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, BookOpen, Calendar, BookmarkPlus, Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { computePosition, flip, shift, offset } from '@floating-ui/dom';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Tag {
  id: string;
  name: string;
  category: string;
}

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  date: string;
  tags: string[]; // This now contains tag UUIDs instead of tag names
  event_id?: string; // Add this to track if the entry is linked to an event
  isInNarrative?: boolean; // Add this field
}

interface JournalEntryListProps {
  entries: JournalEntry[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  tags: Tag[];
  eventTags?: { [key: string]: string[] }; // Add this to map entry IDs to their event tags
}

const parseContent = (content: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const annotations: any[] = [];

  // Find all marks with annotation data attributes
  doc.querySelectorAll('mark[data-type="annotation"]').forEach(mark => {
    const id = mark.getAttribute('data-id') || '';
    const annotationContent = mark.getAttribute('data-content') || '';
    const selectedText = mark.textContent || '';
    const createdAt = mark.getAttribute('data-created-at') || '';

    // Create a new mark element with tooltip trigger
    const highlightMark = doc.createElement('mark');
    highlightMark.className = 'bg-yellow-100 dark:bg-yellow-900/30 px-0.5 rounded cursor-help hover:bg-yellow-200 dark:hover:bg-yellow-800/50 transition-colors';
    highlightMark.setAttribute('data-annotation-ref', id);
    highlightMark.setAttribute('data-content', annotationContent);
    highlightMark.setAttribute('data-created-at', createdAt);
    highlightMark.textContent = selectedText;

    // Replace the original mark with our highlighted version
    mark.replaceWith(highlightMark);

    annotations.push({
      id,
      content: annotationContent,
      selectedText,
      created_at: createdAt
    });
  });

  // Get the content with our highlight marks
  const cleanContent = doc.body.innerHTML;

  return {
    content: cleanContent,
    annotations
  };
};

const JournalEntryList: React.FC<JournalEntryListProps> = ({
  entries: initialEntries,
  isLoading,
  onDelete,
  tags,
  eventTags = {}
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [narrativeStatus, setNarrativeStatus] = useState<Record<string, boolean>>({});
  const [hoveredAnnotation, setHoveredAnnotation] = useState<{
    element: HTMLElement;
    content: string;
    created_at: string;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [narrativesDialogOpen, setNarrativesDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [narratives, setNarratives] = useState<any[]>([]);
  const [isLoadingNarratives, setIsLoadingNarratives] = useState(false);

  useEffect(() => {
    if (!hoveredAnnotation || !tooltipRef.current) return;

    const updatePosition = () => {
      computePosition(hoveredAnnotation.element, tooltipRef.current!, {
        placement: 'top',
        middleware: [
          offset(8),
          flip(),
          shift({ padding: 5 })
        ],
        strategy: 'absolute'
      }).then(({ x, y }) => {
        if (tooltipRef.current) {
          Object.assign(tooltipRef.current.style, {
            left: `${x}px`,
            top: `${y}px`,
          });
        }
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [hoveredAnnotation]);

  // Add new useEffect to handle fetching narratives when selectedEntry changes
  useEffect(() => {
    if (narrativesDialogOpen && selectedEntry) {
      fetchNarratives();
    }
  }, [narrativesDialogOpen, selectedEntry]);

  // Update the useEffect to store only narrative status
  useEffect(() => {
    const checkNarrativeAssociations = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get all narrative associations
        const { data: associations, error: associationsError } = await supabase
          .from('narrative_journal_entries')
          .select('journal_entry_id')
          .in('journal_entry_id', initialEntries.map(e => e.id));

        if (associationsError) throw associationsError;

        // Get all narratives to check smart associations
        const { data: narratives, error: narrativesError } = await supabase
          .from('narratives')
          .select('*')
          .eq('user_id', user.id);

        if (narrativesError) throw narrativesError;

        // Get all entry tags
        const { data: entryTags, error: tagsError } = await supabase
          .from('journal_entry_tags')
          .select('journal_entry_id, tag_id')
          .in('journal_entry_id', initialEntries.map(e => e.id));

        if (tagsError) throw tagsError;

        // Group tags by entry
        const entryTagsMap = entryTags?.reduce((acc, { journal_entry_id, tag_id }) => {
          if (!acc[journal_entry_id]) {
            acc[journal_entry_id] = [];
          }
          acc[journal_entry_id].push(tag_id);
          return acc;
        }, {} as Record<string, string[]>);

        // Set of entries that are in narratives (either manually or through tags)
        const entriesInNarratives = new Set<string>();

        // Add manually associated entries
        associations?.forEach(({ journal_entry_id }) => {
          entriesInNarratives.add(journal_entry_id);
        });

        // Check smart associations
        narratives?.forEach(narrative => {
          if (narrative.required_tags && narrative.required_tags.length > 0) {
            initialEntries.forEach(entry => {
              const entryTags = entryTagsMap[entry.id] || [];
              const hasAllRequiredTags = narrative.required_tags.every(tagId =>
                entryTags.includes(tagId)
              );
              if (hasAllRequiredTags) {
                entriesInNarratives.add(entry.id);
              }
            });
          }
        });

        // Update narrative status
        const newStatus: Record<string, boolean> = {};
        initialEntries.forEach(entry => {
          newStatus[entry.id] = entriesInNarratives.has(entry.id);
        });
        setNarrativeStatus(newStatus);
      } catch (error) {
        console.error('Error checking narrative associations:', error);
      }
    };

    if (initialEntries.length > 0) {
      checkNarrativeAssociations();
    }
  }, [initialEntries]);

  if (isLoading) {
    return <div className="py-20 text-center">Loading journal entries...</div>;
  }

  if (initialEntries.length === 0) {
    return (
      <Card className="bg-muted/50 flex flex-col items-center justify-center py-16 px-4">
        <CardContent className="flex flex-col items-center text-center space-y-4 max-w-md">
          <div className="bg-primary/10 p-4 rounded-full">
            <BookOpen className="h-12 w-12 text-primary/80" />
          </div>
          <CardTitle className="text-xl">No journal entries yet</CardTitle>
          <p className="text-muted-foreground">
            Journal entries are created through calendar events. Head over to the calendar,
            find an event, and create a journal entry to document your thoughts and reflections.
          </p>
          <Button
            onClick={() => navigate('/dashboard/calendar')}
            className="mt-2 flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Go to Calendar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getTagName = (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    return tag ? tag.name : 'Unknown';
  };

  const isEventTag = (entryId: string, tagId: string) => {
    return eventTags[entryId]?.includes(tagId) || false;
  };

  const handleDeleteClick = (id: string) => {
    setEntryToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (entryToDelete) {
      onDelete(entryToDelete);
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
    }
  };

  const handleManageNarratives = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setNarrativesDialogOpen(true);
  };

  const fetchNarratives = async () => {
    try {
      setIsLoadingNarratives(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to manage narratives",
          variant: "destructive"
        });
        return;
      }

      if (!selectedEntry) {
        toast({
          title: "Error",
          description: "No journal entry selected",
          variant: "destructive"
        });
        return;
      }

      // Fetch all narratives for the user
      const { data: narrativesData, error: narrativesError } = await supabase
        .from('narratives')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (narrativesError) throw narrativesError;

      // Fetch existing manual narrative associations for this entry
      const { data: existingAssociations, error: associationsError } = await supabase
        .from('narrative_journal_entries')
        .select('narrative_id')
        .eq('journal_entry_id', selectedEntry.id);

      if (associationsError) throw associationsError;

      // Create a Set of manually associated narrative IDs
      const manualNarrativeIds = new Set(existingAssociations?.map(a => a.narrative_id) || []);

      // Check for smart tag-based associations
      const smartNarrativeIds = new Set<string>();

      // Get all tags for this entry
      const { data: entryTags, error: tagsError } = await supabase
        .from('journal_entry_tags')
        .select('tag_id')
        .eq('journal_entry_id', selectedEntry.id);

      if (tagsError) throw tagsError;

      const entryTagIds = entryTags?.map(t => t.tag_id) || [];

      // For each narrative, check if its required tags match the entry's tags
      for (const narrative of narrativesData) {
        if (narrative.required_tags && narrative.required_tags.length > 0) {
          // Check if the entry has ALL the required tags for this narrative
          const hasAllRequiredTags = narrative.required_tags.every(tagId =>
            entryTagIds.includes(tagId)
          );

          if (hasAllRequiredTags) {
            smartNarrativeIds.add(narrative.id);
          }
        }
      }

      // Transform narratives to include selection state
      // An entry is considered "selected" if it's either manually associated OR smart-associated
      const transformedNarratives = narrativesData.map(narrative => ({
        ...narrative,
        isSelected: manualNarrativeIds.has(narrative.id) || smartNarrativeIds.has(narrative.id),
        isSmartAssociated: smartNarrativeIds.has(narrative.id)
      }));

      setNarratives(transformedNarratives);
    } catch (error) {
      console.error('Error fetching narratives:', error);
      toast({
        title: "Error",
        description: "Failed to load narratives",
        variant: "destructive"
      });
    } finally {
      setIsLoadingNarratives(false);
    }
  };

  const handleNarrativeToggle = (narrativeId: string) => {
    setNarratives(prevNarratives =>
      prevNarratives.map(narrative =>
        narrative.id === narrativeId
          ? { ...narrative, isSelected: !narrative.isSelected }
          : narrative
      )
    );
  };

  const handleSaveNarratives = async () => {
    try {
      if (!selectedEntry) return;

      // Get selected narratives
      const selectedNarratives = narratives.filter(n => n.isSelected && !n.isSmartAssociated);
      const selectedNarrativeIds = selectedNarratives.map(n => n.id);

      // First, remove all existing associations for this entry
      const { error: deleteError } = await supabase
        .from('narrative_journal_entries')
        .delete()
        .eq('journal_entry_id', selectedEntry.id);

      if (deleteError) throw deleteError;

      // Then, add new associations for selected narratives
      if (selectedNarrativeIds.length > 0) {
        const { error: insertError } = await supabase
          .from('narrative_journal_entries')
          .insert(
            selectedNarrativeIds.map(narrativeId => ({
              narrative_id: narrativeId,
              journal_entry_id: selectedEntry.id
            }))
          );

        if (insertError) throw insertError;
      }

      // Update the narrative status for this entry
      const hasManualAssociation = selectedNarrativeIds.length > 0;
      const hasSmartAssociation = narratives.some(n =>
        n.isSmartAssociated && n.isSelected && !selectedNarrativeIds.includes(n.id)
      );

      setNarrativeStatus(prev => ({
        ...prev,
        [selectedEntry.id]: hasManualAssociation || hasSmartAssociation
      }));

      toast({
        title: "Success",
        description: "Narrative associations updated successfully"
      });

      setNarrativesDialogOpen(false);
    } catch (error) {
      console.error('Error updating narrative associations:', error);
      toast({
        title: "Error",
        description: "Failed to update narrative associations",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      {initialEntries.map(entry => {
        const { content } = parseContent(entry.content);
        return (
          <Card key={entry.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{entry.title}</CardTitle>
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleManageNarratives(entry)}
                    className="text-muted-foreground hover:text-primary"
                    title={narrativeStatus[entry.id] ? "Manage narratives (entry is in narratives)" : "Manage narratives"}
                  >
                    <Bookmark
                      className="h-5 w-5"
                      fill={narrativeStatus[entry.id] ? "currentColor" : "none"}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/dashboard/journal/${entry.id}/edit`)}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <Edit className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteClick(entry.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {format(new Date(entry.date), 'MMMM d, yyyy')}
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="whitespace-pre-wrap prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: content }}
                onMouseOver={(e) => {
                  const target = e.target as HTMLElement;
                  const mark = target.closest('mark[data-annotation-ref]') as HTMLElement;
                  if (mark) {
                    const content = mark.getAttribute('data-content');
                    const createdAt = mark.getAttribute('data-created-at');
                    if (content && createdAt) {
                      setHoveredAnnotation({
                        element: mark,
                        content,
                        created_at: createdAt
                      });
                    }
                  }
                }}
                onMouseOut={() => {
                  setHoveredAnnotation(null);
                }}
              />
            </CardContent>
            {entry.tags && entry.tags.length > 0 && (
              <CardFooter className="pt-0 flex flex-wrap gap-2">
                {entry.tags.map(tagId => (
                  <Badge
                    key={tagId}
                    variant="outline"
                    className={cn(
                      "border-0",
                      isEventTag(entry.id, tagId)
                        ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                    )}
                  >
                    {getTagName(tagId)}
                  </Badge>
                ))}
              </CardFooter>
            )}
          </Card>
        );
      })}
      {hoveredAnnotation && (
        <div
          ref={tooltipRef}
          className="absolute z-50 px-2 py-1 text-sm rounded shadow-lg border bg-white dark:bg-gray-800 text-foreground max-w-[300px]"
        >
          <div className="mb-1">{hoveredAnnotation.content}</div>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(hoveredAnnotation.created_at), { addSuffix: true })}
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Delete */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Journal Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this journal entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2 justify-end">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Narratives Dialog */}
      <Dialog open={narrativesDialogOpen} onOpenChange={setNarrativesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Narratives for "{selectedEntry?.title}"</DialogTitle>
            <DialogDescription>
              Select the narratives you want to associate with this journal entry.
              Narratives with a checkmark are automatically associated based on tags.
            </DialogDescription>
          </DialogHeader>
          {isLoadingNarratives ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {narratives.map((narrative) => (
                    <div
                      key={narrative.id}
                      className={cn(
                        "flex items-center space-x-2 p-2 rounded-md",
                        narrative.isSmartAssociated ? "bg-muted/50" : "hover:bg-muted"
                      )}
                    >
                      <Checkbox
                        id={narrative.id}
                        checked={narrative.isSelected}
                        onCheckedChange={() => handleNarrativeToggle(narrative.id)}
                        disabled={narrative.isSmartAssociated}
                      />
                      <label
                        htmlFor={narrative.id}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="font-medium">{narrative.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(narrative.created_at), 'PPP')}
                          {narrative.isSmartAssociated && (
                            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                              Smart Associated
                            </span>
                          )}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex justify-end space-x-2 mt-4">
                <Button variant="outline" onClick={() => setNarrativesDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveNarratives}>
                  Save Changes
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JournalEntryList;

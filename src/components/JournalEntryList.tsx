import React, { useState, useRef, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, BookOpen, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { computePosition, flip, shift, offset } from '@floating-ui/dom';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  entries,
  isLoading,
  onDelete,
  tags,
  eventTags = {}
}) => {
  const navigate = useNavigate();
  const [hoveredAnnotation, setHoveredAnnotation] = useState<{
    element: HTMLElement;
    content: string;
    created_at: string;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

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

  if (isLoading) {
    return <div className="py-20 text-center">Loading journal entries...</div>;
  }

  if (entries.length === 0) {
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

  return (
    <div className="space-y-4">
      {entries.map(entry => {
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
    </div>
  );
};

export default JournalEntryList;

import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

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

const JournalEntryList: React.FC<JournalEntryListProps> = ({
  entries,
  isLoading,
  onDelete,
  tags,
  eventTags = {}
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return <div className="py-20 text-center">Loading journal entries...</div>;
  }

  if (entries.length === 0) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="py-10 text-center">
          <p>No journal entries yet. Create your first one!</p>
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

  return (
    <div className="space-y-4">
      {entries.map(entry => (
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
                  onClick={() => onDelete(entry.id)}
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
              dangerouslySetInnerHTML={{ __html: entry.content }}
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
      ))}
    </div>
  );
};

export default JournalEntryList;

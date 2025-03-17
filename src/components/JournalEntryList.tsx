
import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2 } from 'lucide-react';

interface Tag {
  id: string;
  name: string;
}

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  date_created: string;
  tags: string[];
}

interface JournalEntryListProps {
  entries: JournalEntry[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  tags: Tag[];
}

const JournalEntryList: React.FC<JournalEntryListProps> = ({
  entries,
  isLoading,
  onDelete,
  tags
}) => {
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

  return (
    <div className="space-y-4">
      {entries.map(entry => (
        <Card key={entry.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-xl">{entry.title}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(entry.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {format(new Date(entry.date_created), 'MMMM d, yyyy')}
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{entry.content}</p>
          </CardContent>
          {entry.tags && entry.tags.length > 0 && (
            <CardFooter className="pt-0 flex flex-wrap gap-2">
              {entry.tags.map(tagId => (
                <Badge key={tagId} variant="secondary">
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

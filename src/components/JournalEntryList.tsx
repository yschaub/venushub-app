import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Tag {
  id: string;
  name: string;
  category: string;
}

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  date_created: string;
  tags: string[]; // This now contains tag UUIDs instead of tag names
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

  const getTagCategory = (tagId: string) => {
    const tag = tags.find(t => t.id === tagId);
    return tag ? tag.category : 'Unknown';
  };

  const getCategoryColor = (category: string) => {
    const categoryColors: { [key: string]: string } = {
      'Planets': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'Event': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      'Sign': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'Aspect': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      'Direction': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
      'Cycle': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      'Houses': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
    };
    
    return categoryColors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
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
              {format(new Date(entry.date_created), 'MMMM d, yyyy')}
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{entry.content}</p>
          </CardContent>
          {entry.tags && entry.tags.length > 0 && (
            <CardFooter className="pt-0 flex flex-wrap gap-2">
              {entry.tags.map(tagId => (
                <Badge 
                  key={tagId} 
                  variant="outline"
                  className={`${getCategoryColor(getTagCategory(tagId))} border-0`}
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

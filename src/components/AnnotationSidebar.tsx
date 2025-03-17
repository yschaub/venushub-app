
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Annotation {
  id: string;
  content: string;
  selected_text: string;
  created_at: string;
}

interface AnnotationSidebarProps {
  annotations: Annotation[];
  onDeleteAnnotation: (id: string) => void;
  onAnnotationClick?: (id: string) => void;
  content: string;
}

const AnnotationSidebar: React.FC<AnnotationSidebarProps> = ({
  annotations,
  onDeleteAnnotation,
  onAnnotationClick,
  content
}) => {
  if (annotations.length === 0) {
    return (
      <div className="w-full md:w-[300px]">
        <Card>
          <CardHeader>
            <CardTitle>Annotations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No annotations yet. Highlight text in your entry to add annotations.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full md:w-[300px]">
      <Card>
        <CardHeader>
          <CardTitle>Annotations ({annotations.length})</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[600px] overflow-y-auto">
          <div className="space-y-4">
            {annotations.map((annotation) => (
              <div
                key={annotation.id}
                className="border rounded-md p-3 hover:bg-muted/30 transition-colors"
              >
                <div 
                  className="text-sm mb-2 cursor-pointer"
                  onClick={() => onAnnotationClick && onAnnotationClick(annotation.id)}
                >
                  <span className="bg-yellow-100 dark:bg-yellow-900/30 px-1 py-0.5 rounded">
                    {annotation.selected_text}
                  </span>
                </div>
                
                <p className="text-sm font-medium mb-2">{annotation.content}</p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(annotation.created_at), { addSuffix: true })}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteAnnotation(annotation.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnnotationSidebar;

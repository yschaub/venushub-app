
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Annotation {
  id: string;
  content: string;
  selection_start: number;
  selection_end: number;
  selected_text: string;
  created_at: string;
}

interface AnnotationSidebarProps {
  annotations: Annotation[];
  onDeleteAnnotation: (id: string) => void;
  content: string;
}

const AnnotationSidebar: React.FC<AnnotationSidebarProps> = ({
  annotations,
  onDeleteAnnotation,
  content
}) => {
  const getContextAround = (start: number, end: number, radius: number = 20) => {
    if (!content) return '';
    
    const contextStart = Math.max(0, start - radius);
    const contextEnd = Math.min(content.length, end + radius);
    
    let prefix = '';
    let suffix = '';
    
    // Add ellipsis if we're not at the beginning/end
    if (contextStart > 0) prefix = '...';
    if (contextEnd < content.length) suffix = '...';
    
    // Extract the context text
    const beforeText = content.substring(contextStart, start);
    const selectedText = content.substring(start, end);
    const afterText = content.substring(end, contextEnd);
    
    return {
      beforeText: prefix + beforeText,
      selectedText,
      afterText: afterText + suffix
    };
  };

  const scrollToAnnotation = (annotation: Annotation) => {
    // This could be enhanced to actually scroll to the position in a more
    // sophisticated implementation with a proper rich text editor
    console.log('Scroll to position', annotation.selection_start);
  };

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
            {annotations.map((annotation) => {
              const context = getContextAround(
                annotation.selection_start,
                annotation.selection_end
              );
              
              // Handle case where context might be an empty string
              const contextDisplay = typeof context === 'string' ? (
                <span className="text-muted-foreground">{annotation.selected_text}</span>
              ) : (
                <>
                  <span className="text-muted-foreground">{context.beforeText}</span>
                  <span className="bg-yellow-100 dark:bg-yellow-900/30">{context.selectedText}</span>
                  <span className="text-muted-foreground">{context.afterText}</span>
                </>
              );
              
              return (
                <div
                  key={annotation.id}
                  className="border rounded-md p-3 hover:bg-muted/30 transition-colors"
                >
                  <div 
                    className="text-sm mb-2 cursor-pointer"
                    onClick={() => scrollToAnnotation(annotation)}
                  >
                    {contextDisplay}
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
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnnotationSidebar;

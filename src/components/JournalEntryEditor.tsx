
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/integrations/supabase/client';
import AnnotationSidebar from '@/components/AnnotationSidebar';

interface Tag {
  id: string;
  name: string;
}

interface Annotation {
  id: string;
  content: string;
  selection_start: number;
  selection_end: number;
  selected_text: string;
  created_at: string;
  journal_entry_id?: string;
}

interface JournalEntryEditorProps {
  mode: 'create' | 'edit';
  entryId?: string;
  initialValues?: {
    title: string;
    content: string;
    tags: string[];
  };
  tags: Tag[];
  onSuccess: () => void;
  onCancel: () => void;
}

const JournalEntryEditor: React.FC<JournalEntryEditorProps> = ({
  mode,
  entryId,
  initialValues = { title: '', content: '', tags: [] },
  tags,
  onSuccess,
  onCancel
}) => {
  const [title, setTitle] = useState(initialValues.title);
  const [content, setContent] = useState(initialValues.content);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialValues.tags);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const [annotationContent, setAnnotationContent] = useState('');
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Fetch existing annotations when in edit mode
  useEffect(() => {
    if (mode === 'edit' && entryId) {
      const fetchAnnotations = async () => {
        try {
          const { data, error } = await supabase
            .from('journal_entry_annotations')
            .select('*')
            .eq('journal_entry_id', entryId)
            .order('created_at', { ascending: true });
            
          if (error) throw error;
          setAnnotations(data || []);
        } catch (error) {
          console.error('Error fetching annotations:', error);
          toast({
            title: "Error",
            description: "Failed to load annotations",
            variant: "destructive"
          });
        }
      };

      fetchAnnotations();
    }
  }, [mode, entryId, toast]);

  const handleTextSelection = () => {
    if (!contentRef.current) return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.toString().trim() === '') {
      setSelectedText(null);
      return;
    }
    
    // Get the selected text and its position within the textarea
    const textarea = contentRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start !== end) {
      const selectedContent = content.substring(start, end);
      setSelectedText({
        text: selectedContent,
        start,
        end
      });
      setShowAnnotationForm(true);
    } else {
      setSelectedText(null);
      setShowAnnotationForm(false);
    }
  };

  const handleAddAnnotation = async () => {
    if (!selectedText || !annotationContent.trim()) return;
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');
      
      const newAnnotation: Annotation = {
        id: mode === 'create' ? `temp_${uuidv4()}` : uuidv4(),
        content: annotationContent,
        selection_start: selectedText.start,
        selection_end: selectedText.end,
        selected_text: selectedText.text,
        created_at: new Date().toISOString(),
      };
      
      if (mode === 'edit' && entryId) {
        // In edit mode, we can save the annotation directly
        const { error } = await supabase
          .from('journal_entry_annotations')
          .insert({
            ...newAnnotation,
            journal_entry_id: entryId,
            user_id: userData.user.id
          });
          
        if (error) throw error;
      }
      
      // Add to local state for both modes
      setAnnotations([...annotations, newAnnotation]);
      setAnnotationContent('');
      setSelectedText(null);
      setShowAnnotationForm(false);
      
      toast({
        title: "Success",
        description: "Annotation added successfully"
      });
    } catch (error) {
      console.error('Error adding annotation:', error);
      toast({
        title: "Error",
        description: "Failed to add annotation",
        variant: "destructive"
      });
    }
  };

  const handleDeleteAnnotation = async (annotationId: string) => {
    try {
      // If it's a temporary annotation (in create mode), just remove from state
      if (annotationId.startsWith('temp_')) {
        setAnnotations(annotations.filter(a => a.id !== annotationId));
        toast({
          title: "Success",
          description: "Annotation deleted successfully"
        });
        return;
      }
      
      // For permanent annotations (in edit mode)
      const { error } = await supabase
        .from('journal_entry_annotations')
        .delete()
        .eq('id', annotationId);
        
      if (error) throw error;
      
      setAnnotations(annotations.filter(a => a.id !== annotationId));
      
      toast({
        title: "Success",
        description: "Annotation deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting annotation:', error);
      toast({
        title: "Error",
        description: "Failed to delete annotation",
        variant: "destructive"
      });
    }
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to create entries",
          variant: "destructive"
        });
        return;
      }
      
      if (mode === 'create') {
        // Create a new journal entry
        const { data: entry, error: entryError } = await supabase
          .from('journal_entries')
          .insert({
            title,
            content,
            user_id: user.id
          })
          .select()
          .single();
          
        if (entryError) throw entryError;
        
        // Add tags if any were selected
        if (selectedTags.length > 0) {
          const tagInserts = selectedTags.map((tagId: string) => ({
            journal_entry_id: entry.id,
            tag_id: tagId
          }));
          
          const { error: tagError } = await supabase
            .from('journal_entry_tags')
            .insert(tagInserts);
            
          if (tagError) throw tagError;
        }
        
        // Save any temporary annotations
        if (annotations.length > 0) {
          const annotationInserts = annotations.map((annotation) => ({
            content: annotation.content,
            selection_start: annotation.selection_start,
            selection_end: annotation.selection_end,
            selected_text: annotation.selected_text,
            journal_entry_id: entry.id,
            user_id: user.id
          }));
          
          const { error: annotationError } = await supabase
            .from('journal_entry_annotations')
            .insert(annotationInserts);
            
          if (annotationError) throw annotationError;
        }
        
        toast({
          title: "Success",
          description: "Journal entry created successfully"
        });
      } else if (mode === 'edit' && entryId) {
        // Update the existing journal entry
        const { error: entryError } = await supabase
          .from('journal_entries')
          .update({
            title,
            content,
            updated_at: new Date().toISOString()
          })
          .eq('id', entryId);
          
        if (entryError) throw entryError;
        
        // Delete existing tag associations
        const { error: deleteTagsError } = await supabase
          .from('journal_entry_tags')
          .delete()
          .eq('journal_entry_id', entryId);
          
        if (deleteTagsError) throw deleteTagsError;
        
        // Add new tag associations
        if (selectedTags.length > 0) {
          const tagInserts = selectedTags.map(tagId => ({
            journal_entry_id: entryId,
            tag_id: tagId
          }));
          
          const { error: insertTagsError } = await supabase
            .from('journal_entry_tags')
            .insert(tagInserts);
            
          if (insertTagsError) throw insertTagsError;
        }
        
        toast({
          title: "Success",
          description: "Journal entry updated successfully"
        });
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error saving journal entry:', error);
      toast({
        title: "Error",
        description: "Failed to save journal entry",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex-1">
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Entry title"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                ref={contentRef}
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onMouseUp={handleTextSelection}
                onKeyUp={handleTextSelection}
                placeholder="Write your thoughts..."
                rows={10}
                className="min-h-[200px]"
              />
            </div>
            
            {showAnnotationForm && selectedText && (
              <div className="border p-4 rounded-md bg-muted/30">
                <h3 className="text-sm font-medium mb-2">Add annotation for:</h3>
                <p className="text-sm italic mb-2 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded">
                  "{selectedText.text}"
                </p>
                <Textarea
                  value={annotationContent}
                  onChange={(e) => setAnnotationContent(e.target.value)}
                  placeholder="Write your annotation..."
                  className="mb-2"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setShowAnnotationForm(false);
                      setSelectedText(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button" 
                    size="sm"
                    onClick={handleAddAnnotation}
                  >
                    Add Annotation
                  </Button>
                </div>
              </div>
            )}
            
            {tags.length > 0 && (
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="grid grid-cols-2 gap-2">
                  {tags.map(tag => (
                    <div key={tag.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tag-${tag.id}`}
                        checked={selectedTags.includes(tag.id)}
                        onCheckedChange={() => handleTagToggle(tag.id)}
                      />
                      <Label htmlFor={`tag-${tag.id}`} className="cursor-pointer">
                        {tag.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : mode === 'create' ? 'Create Entry' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
      
      <AnnotationSidebar 
        annotations={annotations}
        onDeleteAnnotation={handleDeleteAnnotation}
        content={content}
      />
    </div>
  );
};

export default JournalEntryEditor;

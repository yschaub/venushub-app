
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft } from 'lucide-react';
import AnnotationSidebar from '@/components/AnnotationSidebar';
import { Card } from '@/components/ui/card';

interface Annotation {
  id: string;
  content: string;
  selection_start: number;
  selection_end: number;
  selected_text: string;
  created_at: string;
}

const EditJournalEntry: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<any>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [tags, setTags] = useState<any[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedText, setSelectedText] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const [annotationContent, setAnnotationContent] = useState('');
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    
    const fetchEntryAndAnnotations = async () => {
      try {
        setIsLoading(true);
        
        // Fetch journal entry
        const { data: entryData, error: entryError } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('id', id)
          .single();
          
        if (entryError) throw entryError;
        
        // Fetch tags for this entry
        const { data: entryTags, error: entryTagsError } = await supabase
          .from('journal_entry_tags')
          .select('tag_id')
          .eq('journal_entry_id', id);
          
        if (entryTagsError) throw entryTagsError;
        
        // Fetch all available tags
        const { data: tagsData, error: tagsError } = await supabase
          .from('system_tags')
          .select('*');
          
        if (tagsError) throw tagsError;
        
        // Fetch annotations for this entry
        const { data: annotationsData, error: annotationsError } = await supabase
          .from('journal_entry_annotations')
          .select('*')
          .eq('journal_entry_id', id)
          .order('created_at', { ascending: true });
          
        if (annotationsError) throw annotationsError;
        
        setEntry(entryData);
        setTitle(entryData.title);
        setContent(entryData.content || '');
        setSelectedTags(entryTags.map((tag: any) => tag.tag_id));
        setTags(tagsData);
        setAnnotations(annotationsData);
      } catch (error) {
        console.error('Error fetching entry:', error);
        toast({
          title: "Error",
          description: "Failed to load journal entry",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchEntryAndAnnotations();
  }, [id, toast]);

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
    if (!selectedText || !annotationContent.trim() || !id) return;
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('User not authenticated');
      
      const newAnnotation = {
        journal_entry_id: id,
        user_id: userData.user.id,
        content: annotationContent,
        selection_start: selectedText.start,
        selection_end: selectedText.end,
        selected_text: selectedText.text
      };
      
      const { data, error } = await supabase
        .from('journal_entry_annotations')
        .insert(newAnnotation)
        .select()
        .single();
        
      if (error) throw error;
      
      setAnnotations([...annotations, data]);
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

  const handleUpdateEntry = async () => {
    try {
      // Update the journal entry
      const { error: entryError } = await supabase
        .from('journal_entries')
        .update({
          title,
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (entryError) throw entryError;
      
      // Delete existing tag associations
      const { error: deleteTagsError } = await supabase
        .from('journal_entry_tags')
        .delete()
        .eq('journal_entry_id', id);
        
      if (deleteTagsError) throw deleteTagsError;
      
      // Add new tag associations
      if (selectedTags.length > 0) {
        const tagInserts = selectedTags.map(tagId => ({
          journal_entry_id: id,
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
      
      navigate('/dashboard/journal');
    } catch (error) {
      console.error('Error updating journal entry:', error);
      toast({
        title: "Error",
        description: "Failed to update journal entry",
        variant: "destructive"
      });
    }
  };

  const highlightedContent = () => {
    if (!content || annotations.length === 0) return content;
    
    // Sort annotations by start position to process them in order
    const sortedAnnotations = [...annotations].sort((a, b) => a.selection_start - b.selection_start);
    
    return content;
  };

  if (isLoading) {
    return <div className="p-6 flex justify-center">Loading entry...</div>;
  }

  if (!entry) {
    return <div className="p-6">Entry not found</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/dashboard/journal')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Journal
        </Button>
      </div>
      
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Edit Journal Entry</h2>
        <p className="text-muted-foreground mt-1">
          Update your entry and add annotations
        </p>
      </div>
      
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <Card className="p-6">
            <div className="space-y-4">
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
              
              <div className="flex justify-end mt-6">
                <Button 
                  onClick={handleUpdateEntry}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        </div>
        
        <AnnotationSidebar 
          annotations={annotations}
          onDeleteAnnotation={handleDeleteAnnotation}
          content={content}
        />
      </div>
    </div>
  );
};

export default EditJournalEntry;

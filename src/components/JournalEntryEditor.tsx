
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import RichTextEditor, { RichTextEditorRef, AnnotationMark } from './editor/RichTextEditor';

interface Tag {
  id: string;
  name: string;
  category: string;
}

interface Annotation {
  id: string;
  content: string;
  selected_text: string;
  created_at: string;
  journal_entry_id?: string;
  selection_start?: number;
  selection_end?: number;
}

interface JournalEntryEditorProps {
  mode: 'create' | 'edit';
  entryId?: string;
  initialValues?: {
    title: string;
    content: string;
    tags: string[];
  };
  eventId?: string;
  eventDate?: string;
  tags: Tag[];
  onSuccess: () => void;
  onCancel: () => void;
}

const JournalEntryEditor: React.FC<JournalEntryEditorProps> = ({
  mode,
  entryId,
  initialValues = { title: '', content: '', tags: [] },
  eventId,
  eventDate,
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
    from: number;
    to: number;
  } | null>(null);
  const [annotationContent, setAnnotationContent] = useState('');
  const [showAnnotationForm, setShowAnnotationForm] = useState(false);
  const [entryDate, setEntryDate] = useState<Date | undefined>(
    eventDate ? new Date(eventDate) : new Date()
  );
  const editorRef = useRef<RichTextEditorRef>(null);
  const { toast } = useToast();

  console.log("Initial tags from event:", initialValues.tags);
  console.log("Selected tags state:", selectedTags);

  useEffect(() => {
    if (mode === 'edit' && entryId) {
      const fetchEntryDetails = async () => {
        try {
          const { data, error } = await supabase
            .from('journal_entries')
            .select('date')
            .eq('id', entryId)
            .single();

          if (error) throw error;
          if (data?.date) {
            setEntryDate(new Date(data.date));
          }
        } catch (error) {
          console.error('Error fetching entry date:', error);
        }
      };

      fetchEntryDetails();
    }
  }, [mode, entryId]);

  useEffect(() => {
    if (mode === 'edit' && entryId) {
      const fetchJournalEntryTags = async () => {
        try {
          const { data, error } = await supabase
            .from('journal_entry_tags')
            .select('tag_id')
            .eq('journal_entry_id', entryId);

          if (error) throw error;

          if (data) {
            const tagIds = data.map(tag => tag.tag_id);
            setSelectedTags(tagIds);
          }
        } catch (error) {
          console.error('Error fetching journal entry tags:', error);
        }
      };

      fetchJournalEntryTags();
    }
  }, [mode, entryId]);

  const tagsByCategory = React.useMemo(() => {
    const grouped: { [key: string]: Tag[] } = {};

    tags.forEach(tag => {
      if (!grouped[tag.category]) {
        grouped[tag.category] = [];
      }
      grouped[tag.category].push(tag);
    });

    return grouped;
  }, [tags]);

  const convertAnnotations = (editorAnnotations: AnnotationMark[]): Annotation[] => {
    return editorAnnotations.map(annotation => ({
      id: annotation.id,
      content: annotation.content,
      selected_text: annotation.text,
      created_at: new Date().toISOString(),
      journal_entry_id: entryId
    }));
  };

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

          const transformedData = data?.map(item => ({
            id: item.id,
            content: item.content,
            selected_text: item.selected_text,
            created_at: item.created_at,
            journal_entry_id: item.journal_entry_id,
            selection_start: item.selection_start,
            selection_end: item.selection_end
          })) || [];

          setAnnotations(transformedData);
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

  const handleSelectionChange = (selection: { from: number; to: number; text: string } | null) => {
    setSelectedText(selection);
    setShowAnnotationForm(!!selection);
  };

  const handleAddAnnotation = () => {
    if (!selectedText || !annotationContent.trim() || !editorRef.current) return;

    try {
      editorRef.current.addAnnotation(annotationContent);

      const editorAnnotations = editorRef.current.getAnnotations();
      const newAnnotations = convertAnnotations(editorAnnotations);

      setAnnotations(newAnnotations);
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
      if (mode === 'edit' && entryId) {
        const { error } = await supabase
          .from('journal_entry_annotations')
          .delete()
          .eq('id', annotationId);

        if (error) throw error;
      }

      setAnnotations(annotations.filter(a => a.id !== annotationId));

      if (editorRef.current) {
        editorRef.current.removeAnnotation(annotationId);
      }

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to create entries",
          variant: "destructive"
        });
        return;
      }

      const editorHtml = editorRef.current?.getHTML() || content;
      const editorAnnotations = editorRef.current?.getAnnotations() || [];
      const formattedDate = entryDate ? format(entryDate, 'yyyy-MM-dd') : new Date().toISOString().split('T')[0];

      if (mode === 'create') {
        const { data: entry, error: entryError } = await supabase
          .from('journal_entries')
          .insert({
            title,
            content: editorHtml,
            user_id: user.id,
            event_id: eventId || null,
            date: formattedDate
          })
          .select()
          .single();

        if (entryError) throw entryError;

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

        if (editorAnnotations.length > 0) {
          const annotationInserts = editorAnnotations.map((annotation) => ({
            id: annotation.id,
            content: annotation.content,
            selected_text: annotation.text,
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
          description: eventId
            ? "Journal entry for event created successfully"
            : "Journal entry created successfully"
        });
      } else if (mode === 'edit' && entryId) {
        const { error: entryError } = await supabase
          .from('journal_entries')
          .update({
            title,
            content: editorHtml,
            date: formattedDate,
            updated_at: new Date().toISOString()
          })
          .eq('id', entryId);

        if (entryError) throw entryError;

        const { error: deleteTagsError } = await supabase
          .from('journal_entry_tags')
          .delete()
          .eq('journal_entry_id', entryId);

        if (deleteTagsError) throw deleteTagsError;

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

        const { data: existingAnnotations, error: fetchAnnotationsError } = await supabase
          .from('journal_entry_annotations')
          .select('id')
          .eq('journal_entry_id', entryId);

        if (fetchAnnotationsError) throw fetchAnnotationsError;

        const existingIds = new Set(existingAnnotations?.map(a => a.id) || []);
        const currentIds = new Set(editorAnnotations.map(a => a.id));

        const annotationsToCreate = editorAnnotations.filter(a => !existingIds.has(a.id));

        if (annotationsToCreate.length > 0) {
          const createPayload = annotationsToCreate.map(a => ({
            id: a.id,
            content: a.content,
            selected_text: a.text,
            journal_entry_id: entryId,
            user_id: user.id
          }));

          const { error: createAnnotationsError } = await supabase
            .from('journal_entry_annotations')
            .insert(createPayload);

          if (createAnnotationsError) throw createAnnotationsError;
        }

        const annotationsToDelete = Array.from(existingIds).filter(id => !currentIds.has(id));

        if (annotationsToDelete.length > 0) {
          const { error: deleteAnnotationsError } = await supabase
            .from('journal_entry_annotations')
            .delete()
            .in('id', annotationsToDelete);

          if (deleteAnnotationsError) throw deleteAnnotationsError;
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

  const handleAnnotationClick = (annotationId: string) => {
    if (editorRef.current) {
      editorRef.current.scrollToAnnotation(annotationId);
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
              <Label htmlFor="date">Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    id="date"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {entryDate ? format(entryDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={entryDate}
                    onSelect={(date) => setEntryDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="content">Content</Label>
              <div className="min-h-[200px] border rounded-md">
                <RichTextEditor
                  ref={editorRef}
                  content={content}
                  onChange={setContent}
                  onSelectionChange={handleSelectionChange}
                  placeholder="Write your thoughts..."
                  className="p-3 min-h-[200px]"
                />
              </div>
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

            {Object.keys(tagsByCategory).length > 0 && (
              <div className="space-y-2">
                <Label>Tags</Label>
                <Accordion type="multiple" className="w-full space-y-2">
                  {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
                    <AccordionItem key={category} value={category} className="border rounded-md">
                      <AccordionTrigger className="px-4 py-2 hover:no-underline">
                        {category}
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-3">
                        <div className="grid grid-cols-2 gap-2">
                          {categoryTags.map(tag => (
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
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}

            {eventId && (
              <div className="bg-muted/30 p-4 rounded-md">
                <p className="text-sm text-muted-foreground">
                  This journal entry will be linked to the selected event.
                </p>
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
        onAnnotationClick={handleAnnotationClick}
        content={content}
      />
    </div>
  );
};

export default JournalEntryEditor;

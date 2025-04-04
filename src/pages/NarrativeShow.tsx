import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ChevronLeft, BookOpen, Edit, Tag, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDeleteNarrative } from '@/hooks/use-narratives';
import JournalEntryCard from '@/components/JournalEntryCard';

interface Narrative {
    id: string;
    title: string;
    category_id: string;
    category_name: string;
    category_type: string;
    required_tags?: string[];
}

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
    annotations?: any[];
}

const NarrativeShow: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [narrative, setNarrative] = useState<Narrative | null>(null);
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [narrativeTags, setNarrativeTags] = useState<Tag[]>([]);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [eventTags, setEventTags] = useState<{ [key: string]: string[] }>({});

    // Use the delete narrative mutation
    const deleteNarrativeMutation = useDeleteNarrative();

    useEffect(() => {
        const fetchNarrativeAndEntries = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Get current user
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError) throw userError;
                if (!user) {
                    setError("No authenticated user found");
                    return;
                }

                // Fetch narrative with category info
                const { data: narrativeData, error: narrativeError } = await supabase
                    .from('narratives')
                    .select(`
                        *,
                        narrative_categories (
                            name,
                            type
                        )
                    `)
                    .eq('id', id)
                    .eq('user_id', user.id)
                    .single();

                if (narrativeError) throw narrativeError;
                if (!narrativeData) {
                    setError("Narrative not found");
                    return;
                }

                const narrative = {
                    ...narrativeData,
                    category_name: narrativeData.narrative_categories.name,
                    category_type: narrativeData.narrative_categories.type
                };
                setNarrative(narrative);

                // Fetch all tags for reference
                const { data: tagsData, error: allTagsError } = await supabase
                    .from('system_tags')
                    .select('*')
                    .order('name');

                if (allTagsError) throw allTagsError;
                setAllTags(tagsData || []);

                // If narrative has required tags, fetch tag names
                if (narrative.required_tags && narrative.required_tags.length > 0) {
                    // Fetch tag names
                    const { data: tagData, error: tagError } = await supabase
                        .from('system_tags')
                        .select('id, name')
                        .in('id', narrative.required_tags);

                    if (tagError) throw tagError;
                    setNarrativeTags(tagData || []);
                }

                // Fetch journal entries that are directly associated with this narrative
                const { data: narrativeJournalEntries, error: narrativeJournalError } = await supabase
                    .from('narrative_journal_entries')
                    .select('journal_entry_id')
                    .eq('narrative_id', id);

                if (narrativeJournalError) throw narrativeJournalError;

                if (!narrativeJournalEntries || narrativeJournalEntries.length === 0) {
                    setEntries([]);
                    setIsLoading(false);
                    return;
                }

                const entryIds = narrativeJournalEntries.map(e => e.journal_entry_id);

                // Fetch full journal entries with annotations
                const { data: entriesData, error: entriesError } = await supabase
                    .from('journal_entries')
                    .select(`
                        *,
                        journal_entry_tags (
                            tag_id
                        ),
                        annotations:journal_entry_annotations (
                            id,
                            content,
                            selected_text,
                            created_at
                        )
                    `)
                    .in('id', entryIds)
                    .order('date_created', { ascending: false });

                if (entriesError) throw entriesError;

                // Process entries to include annotations properly
                const processedEntries = entriesData.map(entry => {
                    // Process the content to include created_at in the marks
                    if (entry.content && entry.annotations) {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(entry.content, 'text/html');

                        doc.querySelectorAll('mark[data-type="annotation"]').forEach(mark => {
                            const id = mark.getAttribute('data-id');
                            const annotation = entry.annotations.find((a: any) => a.id === id);
                            if (annotation) {
                                mark.setAttribute('data-created-at', annotation.created_at);
                            }
                        });

                        entry.content = doc.body.innerHTML;
                    }

                    return {
                        ...entry,
                        tags: entry.journal_entry_tags.map((t: any) => t.tag_id)
                    };
                });

                setEntries(processedEntries);

                // Fetch event tags for entries that are linked to events
                const entriesWithEvents = processedEntries.filter(entry => entry.event_id);
                if (entriesWithEvents.length > 0) {
                    const { data: eventsData, error: eventsError } = await supabase
                        .from('events')
                        .select('id, tags')
                        .in('id', entriesWithEvents.map(entry => entry.event_id));

                    if (eventsError) {
                        console.error('Error fetching event tags:', eventsError);
                    } else {
                        // Create a map of entry IDs to their event tags
                        const eventTagsMap: { [key: string]: string[] } = {};
                        entriesWithEvents.forEach(entry => {
                            const event = eventsData.find(e => e.id === entry.event_id);
                            if (event?.tags) {
                                eventTagsMap[entry.id] = event.tags;
                            }
                        });
                        setEventTags(eventTagsMap);
                    }
                }
            } catch (error: any) {
                console.error('Error fetching narrative and entries:', error);
                setError(error.message || "Failed to load narrative");
                toast({
                    title: "Error",
                    description: "Failed to load narrative",
                    variant: "destructive"
                });
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            fetchNarrativeAndEntries();
        }
    }, [id, toast]);

    const getCategoryIcon = (type: string) => {
        switch (type) {
            case 'eclipse':
                return '🌓';
            case 'return':
                return '🔄';
            case 'transit':
                return '⚡';
            case 'custom':
                return '📝';
            default:
                return '📋';
        }
    };

    const handleDeleteNarrative = async () => {
        if (!id) return;

        try {
            await deleteNarrativeMutation.mutateAsync(id);

            toast({
                title: "Success",
                description: "Narrative deleted successfully",
            });

            // Navigate back to narratives page
            navigate('/dashboard/narratives');
        } catch (error: any) {
            console.error('Error deleting narrative:', error);
            toast({
                title: "Error",
                description: "Failed to delete narrative",
                variant: "destructive"
            });
        } finally {
            setDeleteDialogOpen(false);
        }
    };

    // Add a helper function to determine if a tag is an event tag
    const isEventTag = (entryId: string, tagId: string) => {
        return eventTags[entryId]?.includes(tagId) || false;
    };

    if (isLoading) {
        return <div className="p-6 flex justify-center">Loading narrative...</div>;
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/dashboard/narratives')}
                        className="mb-4"
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Back to Narratives
                    </Button>
                    <h2 className="text-2xl font-semibold">Error</h2>
                    <p className="text-muted-foreground mt-1">
                        {error}
                    </p>
                </div>
            </div>
        );
    }

    if (!narrative) {
        return null;
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/dashboard/narratives')}
                    className="mb-4"
                >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back to Narratives
                </Button>
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{getCategoryIcon(narrative.category_type)}</span>
                        <h2 className="text-2xl font-semibold">{narrative.title}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteDialogOpen(true)}
                            className="flex items-center gap-1 text-muted-foreground hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/dashboard/narratives/create/${narrative.category_id}?edit=${narrative.id}`)}
                            className="flex items-center gap-1"
                        >
                            <Edit className="h-4 w-4" />
                            Edit
                        </Button>
                    </div>
                </div>
                <p className="text-muted-foreground">
                    Category: {narrative.category_name}
                </p>

                {narrativeTags.length > 0 && (
                    <div className="mt-3">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                            <Tag className="h-3 w-3" />
                            <span>Tags:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {narrativeTags.map(tag => (
                                <Badge key={tag.id} variant="secondary">
                                    {tag.name}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <h3 className="text-lg font-medium mb-4">Journal Entries</h3>

            {entries.length === 0 ? (
                <Card className="bg-muted/50">
                    <CardContent className="py-10 text-center">
                        <p>No journal entries in this narrative yet.</p>
                        {narrative.required_tags && narrative.required_tags.length > 0 && (
                            <p className="text-sm text-muted-foreground mt-2">
                                Journal entries with ALL matching tags will appear here automatically.
                            </p>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {entries.map((entry) => (
                        <JournalEntryCard
                            key={entry.id}
                            entry={entry}
                            allTags={allTags}
                            isEventTag={(entryId, tagId) => isEventTag(entryId, tagId)}
                            narrativeId={id}
                        />
                    ))}
                </div>
            )}

            {/* Confirmation Dialog for Delete */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Narrative</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this narrative? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex space-x-2 justify-end">
                        <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteNarrative}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default NarrativeShow;

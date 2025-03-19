import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ChevronLeft, BookOpen, Edit, Tag, Trash2 } from 'lucide-react';
import CreateNarrativeDialog from '@/components/CreateNarrativeDialog';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NarrativesContext } from '@/pages/Dashboard';

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
    content: string | null;
    date_created: string;
}

const NarrativeShow: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { triggerNarrativesRefresh } = useContext(NarrativesContext);
    const [narrative, setNarrative] = useState<Narrative | null>(null);
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [narrativeTags, setNarrativeTags] = useState<Tag[]>([]);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

                // If narrative has required tags, fetch tag names and entries that match ALL those tags
                if (narrative.required_tags && narrative.required_tags.length > 0) {
                    // Fetch tag names
                    const { data: tagData, error: tagError } = await supabase
                        .from('system_tags')
                        .select('id, name')
                        .in('id', narrative.required_tags);
                    
                    if (tagError) throw tagError;
                    setNarrativeTags(tagData || []);
                    
                    // First, get all journal entries for this user
                    const { data: userEntriesData, error: userEntriesError } = await supabase
                        .from('journal_entries')
                        .select('id, title, content, date_created')
                        .eq('user_id', user.id);
                    
                    if (userEntriesError) throw userEntriesError;
                    
                    if (!userEntriesData || userEntriesData.length === 0) {
                        setEntries([]);
                        setIsLoading(false);
                        return;
                    }
                    
                    // Get tags for all of the user's entries
                    const { data: entryTagsData, error: entryTagsError } = await supabase
                        .from('journal_entry_tags')
                        .select('journal_entry_id, tag_id')
                        .in('journal_entry_id', userEntriesData.map(entry => entry.id));
                    
                    if (entryTagsError) throw entryTagsError;
                    
                    // Group tags by entry id
                    const entryTagsMap = new Map<string, Set<string>>();
                    
                    if (entryTagsData) {
                        entryTagsData.forEach(item => {
                            if (!entryTagsMap.has(item.journal_entry_id)) {
                                entryTagsMap.set(item.journal_entry_id, new Set());
                            }
                            entryTagsMap.get(item.journal_entry_id)?.add(item.tag_id);
                        });
                    }
                    
                    // Filter entries that have ALL the required tags (AND logic)
                    const matchingEntries = userEntriesData.filter(entry => {
                        const entryTags = entryTagsMap.get(entry.id);
                        if (!entryTags) return false;
                        
                        // Check if entry has ALL required tags
                        return narrative.required_tags!.every(tagId => entryTags.has(tagId));
                    });
                    
                    // Sort entries by date_created
                    const sortedEntries = matchingEntries
                        .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
                    
                    setEntries(sortedEntries);
                } else {
                    setEntries([]);
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
    }, [id, toast, editDialogOpen]);

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
            // Delete the narrative
            const { error } = await supabase
                .from('narratives')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            toast({
                title: "Success",
                description: "Narrative deleted successfully",
            });
            
            // Trigger a refresh of the sidebar
            triggerNarrativesRefresh();
            
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
                            onClick={() => setEditDialogOpen(true)}
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
                        <Card key={entry.id} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <CardTitle className="text-base">{entry.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center text-muted-foreground text-sm">
                                        <BookOpen className="h-4 w-4 mr-1" />
                                        <span>Created on {format(new Date(entry.date_created), 'PPP')}</span>
                                    </div>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="p-0 h-auto"
                                        onClick={() => navigate(`/dashboard/journal/${entry.id}`)}
                                    >
                                        View entry
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <CreateNarrativeDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                categoryId={narrative.category_id}
                categoryName={narrative.category_name}
                narrativeToEdit={{
                    id: narrative.id,
                    title: narrative.title,
                    required_tags: narrative.required_tags
                }}
                onNarrativeCreated={() => {}}
            />
            
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

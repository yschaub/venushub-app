
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ChevronLeft, BookOpen, Edit } from 'lucide-react';
import CreateNarrativeDialog from '@/components/CreateNarrativeDialog';

interface Narrative {
    id: string;
    title: string;
    category_id: string;
    category_name: string;
    category_type: string;
    required_tags?: string[];
}

interface JournalEntry {
    id: string;
    title: string;
    content: string | null;
    date_created: string;
    added_at: string;
}

const NarrativeShow: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [narrative, setNarrative] = useState<Narrative | null>(null);
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);

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

                // Fetch all entries that are already explicitly connected to this narrative
                const { data: explicitEntries, error: explicitEntriesError } = await supabase
                    .from('narrative_journal_entries')
                    .select(`
                        journal_entries (
                            id,
                            title,
                            content,
                            date_created
                        ),
                        added_at
                    `)
                    .eq('narrative_id', id)
                    .order('added_at', { ascending: false });

                if (explicitEntriesError) throw explicitEntriesError;
                
                // Transform the entries data for explicitly connected entries
                const explicitTransformedEntries = explicitEntries.map(entry => ({
                    id: entry.journal_entries.id,
                    title: entry.journal_entries.title,
                    content: entry.journal_entries.content,
                    date_created: entry.journal_entries.date_created,
                    added_at: entry.added_at
                }));

                // If narrative has required tags, fetch entries that match those tags
                let tagBasedEntries: JournalEntry[] = [];
                if (narrative.required_tags && narrative.required_tags.length > 0) {
                    // Get all entries that have at least one of the required tags
                    const { data: taggedEntriesData, error: taggedEntriesError } = await supabase
                        .from('journal_entry_tags')
                        .select(`
                            journal_entry_id,
                            journal_entries (
                                id,
                                title,
                                content,
                                date_created,
                                user_id
                            )
                        `)
                        .in('tag_id', narrative.required_tags)
                        .eq('journal_entries.user_id', user.id);
                    
                    if (taggedEntriesError) throw taggedEntriesError;
                    
                    // Transform and filter for unique entries that aren't already in explicitEntries
                    const explicitEntryIds = new Set(explicitTransformedEntries.map(e => e.id));
                    
                    // Create a map to prevent duplicates from tag-based entries
                    const uniqueTagEntries = new Map();
                    
                    taggedEntriesData.forEach(item => {
                        const entry = item.journal_entries;
                        // Only add if not already included in explicit entries
                        if (entry && !explicitEntryIds.has(entry.id) && !uniqueTagEntries.has(entry.id)) {
                            uniqueTagEntries.set(entry.id, {
                                id: entry.id,
                                title: entry.title,
                                content: entry.content,
                                date_created: entry.date_created,
                                added_at: new Date().toISOString() // Use current date as these weren't explicitly added
                            });
                        }
                    });
                    
                    tagBasedEntries = Array.from(uniqueTagEntries.values());
                }
                
                // Combine both types of entries and sort by added_at
                const allEntries = [...explicitTransformedEntries, ...tagBasedEntries]
                    .sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
                
                setEntries(allEntries);
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
                <p className="text-muted-foreground">
                    Category: {narrative.category_name}
                </p>
                {narrative.required_tags && narrative.required_tags.length > 0 && (
                    <p className="text-muted-foreground text-sm mt-1">
                        This narrative automatically includes entries with required tags
                    </p>
                )}
            </div>

            <h3 className="text-lg font-medium mb-4">Journal Entries</h3>

            {entries.length === 0 ? (
                <Card className="bg-muted/50">
                    <CardContent className="py-10 text-center">
                        <p>No journal entries in this narrative yet.</p>
                        {narrative.required_tags && narrative.required_tags.length > 0 && (
                            <p className="text-sm text-muted-foreground mt-2">
                                Journal entries with the required tags will be shown here.
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
        </div>
    );
};

export default NarrativeShow;

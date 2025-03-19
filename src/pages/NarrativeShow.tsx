import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ChevronLeft, BookOpen, Pencil } from 'lucide-react';
import AddJournalEntriesDialog from '@/components/AddJournalEntriesDialog';

interface Narrative {
    id: string;
    title: string;
    category_id: string;
    category_name: string;
    category_type: string;
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
    const [addEntriesDialogOpen, setAddEntriesDialogOpen] = useState(false);

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

                setNarrative({
                    ...narrativeData,
                    category_name: narrativeData.narrative_categories.name,
                    category_type: narrativeData.narrative_categories.type
                });

                // Fetch journal entries for this narrative
                const { data: entriesData, error: entriesError } = await supabase
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

                if (entriesError) throw entriesError;

                // Transform the entries data
                const transformedEntries = entriesData.map(entry => ({
                    id: entry.journal_entries.id,
                    title: entry.journal_entries.title,
                    content: entry.journal_entries.content,
                    date_created: entry.journal_entries.date_created,
                    added_at: entry.added_at
                }));

                setEntries(transformedEntries);
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
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getCategoryIcon(narrative.category_type)}</span>
                    <h2 className="text-2xl font-semibold">{narrative.title}</h2>
                </div>
                <p className="text-muted-foreground">
                    Category: {narrative.category_name}
                </p>
            </div>

            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Journal Entries</h3>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddEntriesDialogOpen(true)}
                    className="flex items-center gap-1"
                >
                    <Pencil className="h-4 w-4" />
                    Add Entries
                </Button>
            </div>

            {entries.length === 0 ? (
                <Card className="bg-muted/50">
                    <CardContent className="py-10 text-center">
                        <p>No journal entries in this narrative yet.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {entries.map((entry) => (
                        <Card key={entry.id}>
                            <CardHeader>
                                <CardTitle className="text-base">{entry.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center text-muted-foreground text-sm">
                                    <BookOpen className="h-4 w-4 mr-1" />
                                    <span>Added on {format(new Date(entry.added_at), 'PPP')}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <AddJournalEntriesDialog
                open={addEntriesDialogOpen}
                onOpenChange={setAddEntriesDialogOpen}
                narrativeId={narrative.id}
                narrative={narrative.title}
                onEntriesAdded={() => {
                    // Refresh the entries list
                    const fetchEntries = async () => {
                        try {
                            const { data: entriesData, error: entriesError } = await supabase
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
                                .eq('narrative_id', narrative.id)
                                .order('added_at', { ascending: false });

                            if (entriesError) throw entriesError;

                            const transformedEntries = entriesData.map(entry => ({
                                id: entry.journal_entries.id,
                                title: entry.journal_entries.title,
                                content: entry.journal_entries.content,
                                date_created: entry.journal_entries.date_created,
                                added_at: entry.added_at
                            }));

                            setEntries(transformedEntries);
                        } catch (error) {
                            console.error('Error refreshing entries:', error);
                        }
                    };

                    fetchEntries();
                }}
            />
        </div>
    );
};

export default NarrativeShow; 
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { useCreateNarrative, useUpdateNarrative } from '@/hooks/use-narratives';

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

const CreateNarrative = () => {
    const { categoryId } = useParams<{ categoryId: string }>();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('edit');
    const navigate = useNavigate();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [matchingEntriesCount, setMatchingEntriesCount] = useState<number | null>(null);
    const [isLoadingCount, setIsLoadingCount] = useState(false);
    const [categoryName, setCategoryName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [matchingEntries, setMatchingEntries] = useState<JournalEntry[]>([]);

    // Use the mutation hooks
    const createNarrativeMutation = useCreateNarrative();
    const updateNarrativeMutation = useUpdateNarrative();

    useEffect(() => {
        if (categoryId) {
            fetchCategory();
            fetchTags();
            if (editId) {
                fetchNarrative();
            }
        }
    }, [categoryId, editId]);

    useEffect(() => {
        if (selectedTags.length > 0) {
            updateMatchingEntriesCount();
        } else {
            setMatchingEntriesCount(null);
        }
    }, [selectedTags]);

    const fetchCategory = async () => {
        try {
            const { data: categoryData, error } = await supabase
                .from('narrative_categories')
                .select('name')
                .eq('id', categoryId)
                .single();

            if (error) throw error;

            setCategoryName(categoryData.name);
        } catch (error: any) {
            console.error('Error fetching category:', error);
            toast({
                title: "Error",
                description: "Failed to load category information",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchNarrative = async () => {
        try {
            const { data: narrativeData, error } = await supabase
                .from('narratives')
                .select('*')
                .eq('id', editId)
                .single();

            if (error) throw error;

            setTitle(narrativeData.title);
            setSelectedTags(narrativeData.required_tags || []);
        } catch (error: any) {
            console.error('Error fetching narrative:', error);
            toast({
                title: "Error",
                description: "Failed to load narrative information",
                variant: "destructive"
            });
        }
    };

    const fetchTags = async () => {
        try {
            const { data: tagsData, error } = await supabase
                .from('system_tags')
                .select('*')
                .order('name');

            if (error) throw error;

            setAvailableTags(tagsData || []);
        } catch (error: any) {
            console.error('Error fetching tags:', error);
            toast({
                title: "Error",
                description: "Failed to load tags",
                variant: "destructive"
            });
        }
    };

    const updateMatchingEntriesCount = async () => {
        try {
            setIsLoadingCount(true);

            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError) throw userError;

            if (!user) {
                throw new Error("You must be logged in to count matching entries");
            }

            // First, get all journal entries for this user
            const { data: userEntriesData, error: userEntriesError } = await supabase
                .from('journal_entries')
                .select('id, title, content, date_created')
                .eq('user_id', user.id);

            if (userEntriesError) throw userEntriesError;

            if (!userEntriesData || userEntriesData.length === 0) {
                setMatchingEntriesCount(0);
                setMatchingEntries([]);
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

            // Filter entries that have ALL the selected tags (AND logic)
            const matchingEntries = userEntriesData.filter(entry => {
                const entryTags = entryTagsMap.get(entry.id);
                if (!entryTags) return false;

                // Check if entry has ALL selected tags
                return selectedTags.every(tagId => entryTags.has(tagId));
            });

            // Sort entries by date_created
            const sortedEntries = matchingEntries
                .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());

            setMatchingEntriesCount(matchingEntries.length);
            setMatchingEntries(sortedEntries);
        } catch (error: any) {
            console.error('Error updating matching entries count:', error);
            setMatchingEntriesCount(0);
            setMatchingEntries([]);
        } finally {
            setIsLoadingCount(false);
        }
    };

    const handleTagToggle = (tagId: string) => {
        setSelectedTags(prev => {
            if (prev.includes(tagId)) {
                return prev.filter(id => id !== tagId);
            } else {
                return [...prev, tagId];
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast({
                title: "Error",
                description: "Please enter a title for your narrative",
                variant: "destructive"
            });
            return;
        }

        try {
            setIsSubmitting(true);

            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError) throw userError;

            if (!user) {
                throw new Error("You must be logged in to create a narrative");
            }

            if (editId) {
                await updateNarrativeMutation.mutateAsync({
                    id: editId,
                    title,
                    required_tags: selectedTags,
                    category_id: categoryId!, // Using non-null assertion since we know it exists
                    user_id: user.id
                });

                toast({
                    title: "Success",
                    description: "Narrative updated successfully"
                });

                // Navigate to the narrative's page
                navigate(`/dashboard/narratives/${editId}`);
            } else {
                const newNarrative = await createNarrativeMutation.mutateAsync({
                    title,
                    category_id: categoryId!,
                    user_id: user.id,
                    required_tags: selectedTags
                });

                toast({
                    title: "Success",
                    description: "Narrative created successfully"
                });

                // Navigate to the narrative's page
                navigate(`/dashboard/narratives/${newNarrative.id}`);
            }
        } catch (error: any) {
            console.error('Error saving narrative:', error);
            toast({
                title: "Error",
                description: error.message || "Failed to save narrative",
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return <div className="p-6">Loading...</div>;
    }

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="mb-6">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/dashboard/narratives')}
                    className="mb-4"
                >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Back to Narratives
                </Button>
                <h1 className="text-2xl font-semibold mb-2">{editId ? 'Edit Narrative' : 'Create New Narrative'}</h1>
                <p className="text-muted-foreground">
                    {editId ? 'Update your narrative details' : `Add a new narrative to the ${categoryName} category`}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label htmlFor="title" className="text-sm font-medium">
                        Title
                    </label>
                    <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter narrative title"
                        autoFocus
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">
                        Required Tags (optional)
                    </label>
                    <p className="text-xs text-muted-foreground">
                        Journal entries with ALL these tags will be automatically added to this narrative.
                    </p>

                    <div className="flex flex-wrap gap-2 mb-2">
                        {selectedTags.length > 0 ? (
                            availableTags
                                .filter(tag => selectedTags.includes(tag.id))
                                .map(tag => (
                                    <Badge key={tag.id} variant="secondary" className="cursor-pointer" onClick={() => handleTagToggle(tag.id)}>
                                        {tag.name} ✕
                                    </Badge>
                                ))
                        ) : (
                            <span className="text-xs text-muted-foreground">No tags selected</span>
                        )}
                    </div>

                    <div className="bg-muted/50 rounded-md p-4 max-h-60 overflow-y-auto">
                        {availableTags.map(tag => (
                            <div key={tag.id} className="flex items-center space-x-2 py-1">
                                <Checkbox
                                    id={`tag-${tag.id}`}
                                    checked={selectedTags.includes(tag.id)}
                                    onCheckedChange={() => handleTagToggle(tag.id)}
                                />
                                <label
                                    htmlFor={`tag-${tag.id}`}
                                    className="text-sm cursor-pointer"
                                >
                                    {tag.name}
                                </label>
                            </div>
                        ))}
                    </div>

                    {(selectedTags.length > 0 || isLoadingCount) && (
                        <div className="mt-2 text-sm">
                            {isLoadingCount ? (
                                <div className="flex items-center">
                                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                    Calculating matching entries...
                                </div>
                            ) : (
                                <span>
                                    {matchingEntriesCount !== null
                                        ? `${matchingEntriesCount} journal ${matchingEntriesCount === 1 ? 'entry matches' : 'entries match'} ALL these tags`
                                        : 'No matching journal entries found'}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {matchingEntries.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium">Matching Journal Entries</h3>
                        <div className="space-y-3">
                            {matchingEntries.map((entry) => (
                                <Card key={entry.id} className="bg-muted/50">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">{entry.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex items-center text-muted-foreground text-sm">
                                            <BookOpen className="h-4 w-4 mr-1" />
                                            <span>Created on {format(new Date(entry.date_created), 'PPP')}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate('/dashboard/narratives')}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : editId ? 'Update' : 'Create'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default CreateNarrative; 
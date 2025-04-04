import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types
export interface Narrative {
    id: string;
    title: string;
    category_id: string;
    user_id: string;
    required_tags?: string[];
    created_at?: string;
    updated_at?: string;
}

export interface NarrativeCategory {
    id: string;
    name: string;
    type: 'eclipse' | 'return' | 'transit' | 'custom';
}

// Query keys
export const narrativesKeys = {
    all: ['narratives'] as const,
    lists: () => [...narrativesKeys.all, 'list'] as const,
    list: (filters: any) => [...narrativesKeys.lists(), filters] as const,
    details: () => [...narrativesKeys.all, 'detail'] as const,
    detail: (id: string) => [...narrativesKeys.details(), id] as const,
};

// Fetch narratives for sidebar
export const useNarrativesForSidebar = () => {
    return useQuery({
        queryKey: narrativesKeys.lists(),
        queryFn: async () => {
            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!user) return [];

            // Fetch narratives
            const { data: narrativesData, error: narrativesError } = await supabase
                .from('narratives')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (narrativesError) throw narrativesError;
            return narrativesData || [];
        }
    });
};

// Fetch categories for sidebar
export const useCategoriesForSidebar = () => {
    return useQuery({
        queryKey: ['narrativeCategories'],
        queryFn: async () => {
            // Get current user
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!user) return [];

            // Fetch categories
            const { data: categoriesData, error: categoriesError } = await supabase
                .from('narrative_categories')
                .select('*')
                .eq('is_active', true)
                .eq('user_id', user.id)
                .order('name');

            if (categoriesError) throw categoriesError;
            return categoriesData || [];
        }
    });
};

// Create narrative mutation
export const useCreateNarrative = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (narrativeData: Omit<Narrative, 'id'>) => {
            const { data, error } = await supabase
                .from('narratives')
                .insert(narrativeData)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            // Invalidate queries to refetch narratives data
            queryClient.invalidateQueries({ queryKey: narrativesKeys.lists() });
        }
    });
};

// Update narrative mutation
export const useUpdateNarrative = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...data }: Narrative) => {
            const { data: updatedData, error } = await supabase
                .from('narratives')
                .update(data)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return updatedData;
        },
        onSuccess: (data) => {
            // Invalidate both list and detail queries
            queryClient.invalidateQueries({ queryKey: narrativesKeys.lists() });
            queryClient.invalidateQueries({ queryKey: narrativesKeys.detail(data.id) });
        }
    });
};

// Delete narrative mutation
export const useDeleteNarrative = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            // First, delete any associations in narrative_journal_entries
            const { error: associationsError } = await supabase
                .from('narrative_journal_entries')
                .delete()
                .eq('narrative_id', id);

            if (associationsError) throw associationsError;

            // Then delete the narrative itself
            const { error } = await supabase
                .from('narratives')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return id;
        },
        onSuccess: () => {
            // Invalidate list queries
            queryClient.invalidateQueries({ queryKey: narrativesKeys.lists() });
        }
    });
}; 
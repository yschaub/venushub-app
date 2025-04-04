import React, { useEffect, useState } from 'react';
import { useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import DashboardSidebar from '@/components/DashboardSidebar';
import JournalEntries from '@/pages/JournalEntries';
import CreateJournalEntry from '@/pages/CreateJournalEntry';
import EditJournalEntry from '@/pages/EditJournalEntry';
import Narratives from '@/pages/Narratives';
import CalendarView from '@/pages/CalendarView';
import NarrativeShow from '@/pages/NarrativeShow';
import CreateNarrative from '@/pages/CreateNarrative';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  // Function to automatically associate journal entries with narratives based on tags
  const associateEntriesWithNarratives = async (userId: string) => {
    try {
      // Fetch all narratives with required tags
      const { data: narratives, error: narrativesError } = await supabase
        .from('narratives')
        .select('id, required_tags')
        .eq('user_id', userId)
        .not('required_tags', 'eq', '{}');

      if (narrativesError) throw narrativesError;
      if (!narratives || narratives.length === 0) return;

      for (const narrative of narratives) {
        if (!narrative.required_tags || narrative.required_tags.length === 0) continue;

        // Find journal entries that have ALL the required tags for this narrative
        // Convert required_tags to a simple string[] to avoid TypeScript recursion
        const requiredTags = narrative.required_tags as unknown as string[];

        if (!requiredTags.length) continue;

        const { data: journalEntryTagsData, error: tagsError } = await supabase
          .from('journal_entry_tags')
          .select('journal_entry_id, tag_id, journal_entries(user_id)')
          .in('tag_id', requiredTags);

        if (tagsError) {
          console.error('Error fetching journal entry tags:', tagsError);
          continue;
        }

        // Group entries by journal_entry_id and count how many tags they have
        const entryCounts: Record<string, string[]> = {};
        journalEntryTagsData.forEach(item => {
          // Only include entries belonging to the current user
          if (item.journal_entries?.user_id === userId) {
            if (!entryCounts[item.journal_entry_id]) {
              entryCounts[item.journal_entry_id] = [];
            }
            entryCounts[item.journal_entry_id].push(item.tag_id);
          }
        });

        // Find entries that have ALL required tags
        const matchingEntryIds = Object.entries(entryCounts)
          .filter(([_, tags]) => {
            // Check if this entry has ALL the required tags
            return requiredTags.every(tagId => tags.includes(tagId));
          })
          .map(([entryId]) => entryId);

        if (matchingEntryIds.length === 0) continue;

        // Find which entries are already associated with this narrative
        const { data: existingAssociations, error: existingError } = await supabase
          .from('narrative_journal_entries')
          .select('journal_entry_id')
          .eq('narrative_id', narrative.id)
          .in('journal_entry_id', matchingEntryIds);

        if (existingError) {
          console.error('Error fetching existing associations:', existingError);
          continue;
        }

        const existingEntryIds = existingAssociations.map(item => item.journal_entry_id);

        // Find entries that need to be added
        const entriesToAdd = matchingEntryIds.filter(id => !existingEntryIds.includes(id));

        if (entriesToAdd.length === 0) continue;

        // Add new associations
        const associationsToInsert = entriesToAdd.map(entryId => ({
          narrative_id: narrative.id,
          journal_entry_id: entryId
        }));

        const { error: insertError } = await supabase
          .from('narrative_journal_entries')
          .insert(associationsToInsert);

        if (insertError) {
          console.error('Error associating entries with narrative:', insertError);
        }
      }
    } catch (error) {
      console.error('Error in associateEntriesWithNarratives:', error);
    }
  };

  useEffect(() => {
    const setupDashboard = async () => {
      if (!isLoading && !user) {
        navigate('/');
        return;
      }

      if (user) {
        // Associate journal entries with narratives based on tags
        await associateEntriesWithNarratives(user.id);
        setLoading(false);
      }
    };

    setupDashboard();
  }, [user, isLoading, navigate]);

  if (isLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center">
      <p>Loading...</p>
    </div>;
  }

  if (!user) {
    return <Navigate to="/" />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <DashboardSidebar userEmail={user.email} />
        <SidebarInset>
          <div className="flex h-full flex-col">
            <div className="flex-grow overflow-auto">
              <Routes>
                <Route path="/" element={<CalendarView />} />
                <Route path="/calendar" element={<CalendarView />} />
                <Route path="/narratives" element={<Narratives />} />
                <Route path="/narratives/create/:categoryId" element={<CreateNarrative />} />
                <Route path="/narratives/:id" element={<NarrativeShow />} />
                <Route path="/journal" element={<JournalEntries />} />
                <Route path="/journal/create" element={<CreateJournalEntry />} />
                <Route path="/journal/:id/edit" element={<EditJournalEntry />} />
              </Routes>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Dashboard;

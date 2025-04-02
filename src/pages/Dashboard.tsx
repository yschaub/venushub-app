import React, { useEffect, useState } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import DashboardSidebar from '@/components/DashboardSidebar';
import JournalEntries from '@/pages/JournalEntries';
import CreateJournalEntry from '@/pages/CreateJournalEntry';
import EditJournalEntry from '@/pages/EditJournalEntry';
import Narratives from '@/pages/Narratives';
import CalendarView from '@/pages/CalendarView';
import NarrativeShow from '@/pages/NarrativeShow';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  const associateEntriesWithNarratives = async (userId: string) => {
    try {
      const { data: narratives, error: narrativesError } = await supabase
        .from('narratives')
        .select('id, required_tags')
        .eq('user_id', userId)
        .not('required_tags', 'eq', '{}');

      if (narrativesError) throw narrativesError;
      if (!narratives || narratives.length === 0) return;

      for (const narrative of narratives) {
        if (!narrative.required_tags || narrative.required_tags.length === 0) continue;

        const requiredTags = narrative.required_tags as unknown as string[];

        if (!requiredTags.length) continue;

        const { data: journalEntryTagsData, error: tagsError } = await supabase
          .from('journal_entry_tags')
          .select('journal_entry_id, tag_id')
          .in('tag_id', requiredTags);

        if (tagsError) {
          console.error('Error fetching journal entry tags:', tagsError);
          continue;
        }

        const entryCounts: Record<string, string[]> = {};
        journalEntryTagsData.forEach(item => {
          if (!entryCounts[item.journal_entry_id]) {
            entryCounts[item.journal_entry_id] = [];
          }
          entryCounts[item.journal_entry_id].push(item.tag_id);
        });

        const matchingEntryIds = Object.entries(entryCounts)
          .filter(([_, tags]) => {
            return requiredTags.every(tagId => tags.includes(tagId));
          })
          .map(([entryId]) => entryId);

        if (matchingEntryIds.length === 0) continue;

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

        const entriesToAdd = matchingEntryIds.filter(id => !existingEntryIds.includes(id));

        if (entriesToAdd.length === 0) continue;

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
    const getUser = async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUserEmail(user.email);

      await associateEntriesWithNarratives(user.id);

      setLoading(false);
    };
    getUser();

    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">
      <p>Loading...</p>
    </div>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <DashboardSidebar userEmail={userEmail} />
        <SidebarInset>
          <div className="flex h-full flex-col">
            <div className="flex-grow overflow-auto">
              <Routes>
                <Route path="/" element={<CalendarView />} />
                <Route path="/calendar" element={<CalendarView />} />
                <Route path="/narratives" element={<Narratives />} />
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

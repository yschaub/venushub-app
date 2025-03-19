import React, { useEffect, useState } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import DashboardSidebar from '@/components/DashboardSidebar';
import Home from '@/pages/Home';
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
                <Route path="/" element={<Home />} />
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

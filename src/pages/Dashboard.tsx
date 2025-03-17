import React, { useEffect, useState } from 'react';
import { useNavigate, Routes, Route } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import DashboardSidebar from '@/components/DashboardSidebar';
import Home from '@/pages/Home';
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
  return <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <DashboardSidebar userEmail={userEmail} />
        <SidebarInset>
          <div className="flex h-full flex-col">
            
            <div className="flex-grow overflow-auto">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/calendar" element={<div className="p-6">Calendar view coming soon</div>} />
                <Route path="/narratives" element={<div className="p-6">Narratives view coming soon</div>} />
              </Routes>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>;
};
export default Dashboard;
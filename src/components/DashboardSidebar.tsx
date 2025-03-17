
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Calendar, BookText, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarFooter, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarSeparator
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardSidebarProps {
  userEmail: string | null;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ userEmail }) => {
  const navigate = useNavigate();
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <Sidebar>
      <SidebarHeader className="flex justify-center py-4">
        <h1 className="text-xl font-bold">VenusHub</h1>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              isActive={true}
              onClick={() => handleNavigation('/dashboard')}
              tooltip="Home"
            >
              <Home />
              <span>Home</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => handleNavigation('/dashboard/calendar')}
              tooltip="Calendar"
            >
              <Calendar />
              <span>Calendar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => handleNavigation('/dashboard/narratives')}
              tooltip="Narratives"
            >
              <BookText />
              <span>Narratives</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      
      <SidebarFooter className="p-2">
        <SidebarSeparator />
        <div className="flex flex-col gap-2 p-2">
          <div className="text-sm font-medium truncate">{userEmail}</div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex justify-start text-muted-foreground hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default DashboardSidebar;

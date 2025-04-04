import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, BookText, LogOut, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useNarrativesForSidebar, useCategoriesForSidebar } from '@/hooks/use-narratives';

interface DashboardSidebarProps {
  userEmail: string | null;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ userEmail }) => {
  const navigate = useNavigate();
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // Use React Query hooks
  const { data: categories = [], isLoading: isCategoriesLoading } = useCategoriesForSidebar();
  const { data: narratives = [], isLoading: isNarrativesLoading } = useNarrativesForSidebar();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      // If this is the first time toggling, set it to false (since default is expanded)
      const currentValue = prev[categoryId] !== undefined ? prev[categoryId] : true;
      return {
        ...prev,
        [categoryId]: !currentValue
      };
    });
  };

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

  const handleCreateNarrative = (categoryId: string) => {
    navigate(`/dashboard/narratives/create/${categoryId}`);
  };

  // Check if a category is expanded
  const isCategoryExpanded = (categoryId: string) => {
    return expandedCategories[categoryId] !== undefined ?
      expandedCategories[categoryId] : true; // Default to expanded
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
              isActive={window.location.pathname === '/dashboard/calendar'}
              onClick={() => handleNavigation('/dashboard/calendar')}
              tooltip="Calendar"
            >
              <Calendar />
              <span>Calendar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={window.location.pathname.includes('/dashboard/journal')}
              onClick={() => handleNavigation('/dashboard/journal')}
              tooltip="Journal"
            >
              <BookOpen />
              <span>Journal Entries</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={window.location.pathname.includes('/dashboard/narratives')}
              onClick={() => handleNavigation('/dashboard/narratives')}
              tooltip="Narratives"
            >
              <BookText />
              <span>Narratives</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {!isCategoriesLoading && categories.length > 0 && (
            <SidebarMenuSub>
              {categories.map((category) => (
                <SidebarMenuSubItem key={category.id}>
                  <SidebarMenuSubButton
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span>{getCategoryIcon(category.type)}</span>
                      <span>{category.name}</span>
                    </div>
                    {isCategoryExpanded(category.id) ?
                      <ChevronDown className="h-4 w-4" /> :
                      <ChevronRight className="h-4 w-4" />
                    }
                  </SidebarMenuSubButton>
                  {isCategoryExpanded(category.id) && (
                    <SidebarMenuSub>
                      {!isNarrativesLoading && narratives
                        .filter(n => n.category_id === category.id)
                        .map(narrative => (
                          <SidebarMenuSubItem key={narrative.id}>
                            <SidebarMenuSubButton
                              onClick={() => handleNavigation(`/dashboard/narratives/${narrative.id}`)}
                              size="sm"
                              className="cursor-pointer"
                            >
                              {narrative.title}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          onClick={() => handleCreateNarrative(category.id)}
                          size="sm"
                          className="text-muted-foreground hover:text-primary cursor-pointer"
                        >
                          + Create new narrative
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  )}
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          )}
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

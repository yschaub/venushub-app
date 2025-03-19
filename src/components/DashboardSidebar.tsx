import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Calendar, BookText, LogOut, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
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
import CreateNarrativeDialog from './CreateNarrativeDialog';

interface DashboardSidebarProps {
  userEmail: string | null;
  refreshTrigger?: number;
}

interface NarrativeCategory {
  id: string;
  name: string;
  type: 'eclipse' | 'return' | 'transit' | 'custom';
}

interface Narrative {
  id: string;
  title: string;
  category_id: string;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ userEmail, refreshTrigger = 0 }) => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<NarrativeCategory[]>([]);
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  const fetchNarratives = async () => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) return;

      // Fetch narratives
      const { data: narrativesData, error: narrativesError } = await supabase
        .from('narratives')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (narrativesError) throw narrativesError;
      setNarratives(narrativesData || []);
    } catch (error) {
      console.error('Error fetching narratives:', error);
    }
  };

  useEffect(() => {
    const fetchCategoriesAndNarratives = async () => {
      try {
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) return;

        // Fetch categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('narrative_categories')
          .select('*')
          .eq('is_active', true)
          .eq('user_id', user.id)
          .order('name');

        if (categoriesError) throw categoriesError;
        setCategories(categoriesData || []);

        // Set all categories as expanded by default
        const expandedState = (categoriesData || []).reduce((acc, category) => ({
          ...acc,
          [category.id]: true
        }), {});
        setExpandedCategories(expandedState);

        // Fetch narratives
        await fetchNarratives();
      } catch (error) {
        console.error('Error fetching categories and narratives:', error);
      }
    };

    fetchCategoriesAndNarratives();
  }, []);

  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchNarratives();
    }
  }, [refreshTrigger]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
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

  const handleCreateNarrative = (categoryId: string, categoryName: string) => {
    setSelectedCategory({ id: categoryId, name: categoryName });
    setCreateDialogOpen(true);
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
              isActive={window.location.pathname === '/dashboard'}
              onClick={() => handleNavigation('/dashboard')}
              tooltip="Home"
            >
              <Home />
              <span>Home</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={window.location.pathname.includes('/dashboard/journal')}
              onClick={() => handleNavigation('/dashboard/journal')}
              tooltip="Journal"
            >
              <BookOpen />
              <span>Journal</span>
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

          {categories.length > 0 && (
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
                    {expandedCategories[category.id] ?
                      <ChevronDown className="h-4 w-4" /> :
                      <ChevronRight className="h-4 w-4" />
                    }
                  </SidebarMenuSubButton>
                  {expandedCategories[category.id] && (
                    <SidebarMenuSub>
                      {narratives
                        .filter(n => n.category_id === category.id)
                        .map(narrative => (
                          <SidebarMenuSubItem key={narrative.id}>
                            <SidebarMenuSubButton
                              onClick={() => handleNavigation(`/dashboard/narratives/${narrative.id}`)}
                              size="sm"
                            >
                              {narrative.title}
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          onClick={() => handleCreateNarrative(category.id, category.name)}
                          size="sm"
                          className="text-muted-foreground hover:text-primary"
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

      {selectedCategory && (
        <CreateNarrativeDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          categoryId={selectedCategory.id}
          categoryName={selectedCategory.name}
          onNarrativeCreated={fetchNarratives}
        />
      )}
    </Sidebar>
  );
};

export default DashboardSidebar;

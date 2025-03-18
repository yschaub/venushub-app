
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { CalendarIcon, AlertCircle, BookOpen } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Event {
  id: string;
  title: string;
  date: string;
  start_date: string;
  end_date: string;
  primary_event: boolean;
  tags: string[] | null;
}

interface TagMapping {
  [key: string]: string;
}

interface EventWithJournalStatus extends Event {
  hasJournal?: boolean;
  journalId?: string;
}

const Home: React.FC = () => {
  const [todayEvents, setTodayEvents] = useState<EventWithJournalStatus[]>([]);
  const [currentEvents, setCurrentEvents] = useState<EventWithJournalStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tagMapping, setTagMapping] = useState<TagMapping>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setIsLoading(true);
        
        const today = new Date();
        const formattedToday = format(today, 'yyyy-MM-dd');
        
        // Fetch all available tags for mapping
        const { data: tagsData, error: tagsError } = await supabase
          .from('system_tags')
          .select('*')
          .order('name');
          
        if (tagsError) throw tagsError;
        
        // Create mapping of tag names to IDs
        const mapping: TagMapping = {};
        tagsData?.forEach(tag => {
          mapping[tag.name] = tag.id;
        });
        
        setTagMapping(mapping);
        
        // Fetch events happening today (exact date match)
        const { data: todayData, error: todayError } = await supabase
          .from('events')
          .select('*')
          .eq('date', formattedToday);
          
        if (todayError) throw todayError;
        
        // Fetch events that are currently unfolding (today falls within start_date and end_date)
        const { data: currentData, error: currentError } = await supabase
          .from('events')
          .select('*')
          .lte('start_date', formattedToday)
          .gte('end_date', formattedToday)
          .not('date', 'eq', formattedToday); // Exclude today's events to avoid duplication
          
        if (currentError) throw currentError;
        
        // Check if each event has a journal entry
        const checkJournalEntries = async (events: Event[]): Promise<EventWithJournalStatus[]> => {
          const enhancedEvents = await Promise.all(events.map(async (event) => {
            // Check if this event has a journal entry
            const { data, error } = await supabase
              .from('journal_entries')
              .select('id')
              .eq('event_id', event.id)
              .maybeSingle();
            
            if (error) {
              console.error('Error checking journal entry:', error);
              return { ...event, hasJournal: false };
            }
            
            return { 
              ...event, 
              hasJournal: !!data, 
              journalId: data?.id 
            };
          }));
          
          return enhancedEvents;
        };
        
        // Enhance events with journal status information
        const enhancedTodayEvents = await checkJournalEntries(todayData || []);
        const enhancedCurrentEvents = await checkJournalEntries(currentData || []);
        
        setTodayEvents(enhancedTodayEvents);
        setCurrentEvents(enhancedCurrentEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
        toast({
          title: "Error",
          description: "Failed to load events",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEvents();
  }, [toast]);
  
  const handleEventClick = (event: EventWithJournalStatus) => {
    // Navigate to calendar view with this date selected
    const date = new Date(event.date);
    navigate(`/dashboard/calendar?date=${format(date, 'yyyy-MM-dd')}`);
  };
  
  const handleJournalAction = (event: EventWithJournalStatus, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event card click from triggering
    
    if (event.hasJournal && event.journalId) {
      // If a journal entry exists, navigate to view/edit it
      navigate(`/dashboard/journal/edit/${event.journalId}`);
    } else {
      // Convert tag names to tag IDs
      const tagIds = event.tags?.map(tagName => {
        const id = tagMapping[tagName];
        if (!id) {
          console.warn(`No ID found for tag: ${tagName}`);
        }
        return id;
      }).filter(Boolean) || [];
      
      console.log("Journaling about event:", event);
      console.log("Event tags mapped to IDs:", tagIds);
      
      // Navigate to create with event data
      navigate('/dashboard/journal/create', { 
        state: { 
          eventData: {
            id: event.id,
            title: event.title,
            tags: tagIds,
            date: event.date
          } 
        }
      });
    }
  };
  
  const renderEventCard = (event: EventWithJournalStatus) => (
    <div 
      key={event.id} 
      className="p-4 border rounded-lg cursor-pointer hover:bg-accent transition-colors"
      onClick={() => handleEventClick(event)}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg">{event.title}</h3>
          <div className="flex items-center text-sm text-muted-foreground mt-1">
            <CalendarIcon className="mr-1 h-4 w-4" />
            <span>
              {event === todayEvents[0] ? 'Today' : 
                `${format(new Date(event.start_date), 'MMM d')} - ${format(new Date(event.end_date), 'MMM d, yyyy')}`}
            </span>
          </div>
        </div>
        {event.primary_event && (
          <Badge variant="default" className="bg-primary">Primary</Badge>
        )}
      </div>
      {event.tags && event.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {event.tags.map((tag, idx) => (
            <Badge key={idx} variant="outline">{tag}</Badge>
          ))}
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <Button 
          size="sm" 
          variant="outline" 
          className="flex items-center gap-1"
          onClick={(e) => handleJournalAction(event, e)}
        >
          <BookOpen className="h-3.5 w-3.5" />
          {event.hasJournal ? "View Journal" : "Journal About This"}
        </Button>
      </div>
    </div>
  );
  
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-semibold mb-4">Welcome to VenusHub</h2>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      ) : (
        <>
          {/* Today's Events */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Events Today
              </CardTitle>
              <CardDescription>
                Events happening on {format(new Date(), 'MMMM d, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todayEvents.length > 0 ? (
                <div className="space-y-4">
                  {todayEvents.map(event => renderEventCard(event))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No events scheduled for today</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Currently Unfolding Events */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Currently Unfolding
              </CardTitle>
              <CardDescription>
                Events that are currently in progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentEvents.length > 0 ? (
                <div className="space-y-4">
                  {currentEvents.map(event => renderEventCard(event))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No events currently unfolding</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default Home;


import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Link, BookOpen } from 'lucide-react';
import {
  Calendar,
  CalendarCurrentDate,
  CalendarMonthView,
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarTodayTrigger,
  CalendarEvent,
} from '@/components/ui/full-calendar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Event {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  primary_event: boolean;
  tags: string[];
  hasJournal?: boolean;
  journalId?: string;
}

interface RelatedEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
}

const CalendarView = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [relatedEvents, setRelatedEvents] = useState<RelatedEvent[]>([]);
  const [loadingRelatedEvents, setLoadingRelatedEvents] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user?.id || null);
    };
    
    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        console.log('Fetching events...');
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('No authenticated user found');
          return;
        }

        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .order('start_date', { ascending: true });

        if (eventsError) {
          console.error('Error fetching events:', eventsError);
          return;
        }

        // Fetch journal entries to check which events have them
        const { data: journalEntries, error: journalError } = await supabase
          .from('journal_entries')
          .select('id, event_id')
          .eq('user_id', user.id)
          .not('event_id', 'is', null);

        if (journalError) {
          console.error('Error fetching journal entries:', journalError);
          return;
        }

        // Create a Map of event IDs that have journal entries
        const eventJournalMap = new Map();
        journalEntries?.forEach(entry => {
          eventJournalMap.set(entry.event_id, entry.id);
        });

        // Transform events to match the calendar format
        const transformedEvents = (eventsData || []).map(event => {
          const hasJournal = eventJournalMap.has(event.id);
          const journalId = eventJournalMap.get(event.id);
          
          const transformed = {
            id: event.id,
            title: event.title,
            start: new Date(event.start_date),
            end: new Date(event.end_date),
            hasJournal: hasJournal,
            journalId: journalId,
            tags: event.tags,
            // Use a different style for events with journal entries
            className: hasJournal
              ? "bg-green-100 border-green-300 cursor-pointer"
              : "bg-background border-border cursor-pointer"
          };
          console.log('Transformed event:', transformed);
          return transformed;
        });

        console.log('Final transformed events:', transformedEvents);
        setEvents(transformedEvents);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const handleEventClick = async (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsSheetOpen(true);
    
    // Fetch related events when an event is selected
    await fetchRelatedEvents(event.id);
  };

  const fetchRelatedEvents = async (eventId: string) => {
    setLoadingRelatedEvents(true);
    try {
      // First, get all relationships for this event
      const { data: relationships, error: relationshipsError } = await supabase
        .from('event_relationships')
        .select('related_event_id')
        .eq('event_id', eventId);

      if (relationshipsError) {
        console.error('Error fetching event relationships:', relationshipsError);
        return;
      }

      // Also get relationships where this event is the related one
      const { data: inverseRelationships, error: inverseError } = await supabase
        .from('event_relationships')
        .select('event_id')
        .eq('related_event_id', eventId);

      if (inverseError) {
        console.error('Error fetching inverse event relationships:', inverseError);
        return;
      }

      // Combine all related event IDs
      const relatedEventIds = [
        ...(relationships?.map(rel => rel.related_event_id) || []),
        ...(inverseRelationships?.map(rel => rel.event_id) || [])
      ];

      if (relatedEventIds.length === 0) {
        setRelatedEvents([]);
        return;
      }

      // Fetch details for all related events
      const { data: relatedEventsData, error: relatedEventsError } = await supabase
        .from('events')
        .select('id, title, start_date, end_date')
        .in('id', relatedEventIds);

      if (relatedEventsError) {
        console.error('Error fetching related events:', relatedEventsError);
        return;
      }

      setRelatedEvents(relatedEventsData || []);
    } catch (error) {
      console.error('Error in fetchRelatedEvents:', error);
    } finally {
      setLoadingRelatedEvents(false);
    }
  };

  const handleJournalAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!currentUser) {
      navigate('/auth');
      return;
    }
    
    if (selectedEvent?.hasJournal && selectedEvent?.journalId) {
      navigate(`/dashboard/journal/${selectedEvent.journalId}/edit`);
    } else if (selectedEvent) {
      navigate('/dashboard/journal/create', { 
        state: { 
          eventData: {
            id: selectedEvent.id,
            title: selectedEvent.title,
            tags: selectedEvent.tags || [],
            date: format(selectedEvent.start, 'yyyy-MM-dd')
          } 
        }
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading calendar...</p>
      </div>
    );
  }

  return (
    <>
      <Calendar
        events={events}
        view="month"
        onEventClick={handleEventClick}
      >
        <div className="h-dvh py-6 flex flex-col">
          <div className="flex px-6 items-center gap-2 mb-6">
            <span className="flex-1" />

            <CalendarCurrentDate />

            <CalendarPrevTrigger>
              <ChevronLeft size={20} />
              <span className="sr-only">Previous</span>
            </CalendarPrevTrigger>

            <CalendarTodayTrigger>Today</CalendarTodayTrigger>

            <CalendarNextTrigger>
              <ChevronRight size={20} />
              <span className="sr-only">Next</span>
            </CalendarNextTrigger>
          </div>

          <div className="flex-1 overflow-auto px-6 relative">
            <CalendarMonthView />
          </div>
        </div>
      </Calendar>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedEvent?.title}</SheetTitle>
            <SheetDescription className="space-y-3">
              {selectedEvent && (
                <>
                  <p>
                    <strong>Start:</strong> {format(selectedEvent.start, 'PPP')}
                  </p>
                  <p>
                    <strong>End:</strong> {format(selectedEvent.end, 'PPP')}
                  </p>
                  <p>
                    <strong>Status:</strong> {selectedEvent.hasJournal ? 'Journal entry added' : 'No journal entry'}
                  </p>
                </>
              )}
            </SheetDescription>
          </SheetHeader>
          
          {/* Journal Entry Button */}
          {selectedEvent && (
            <div className="mt-4">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex items-center gap-1 w-full"
                onClick={handleJournalAction}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {selectedEvent.hasJournal ? "View Journal" : "Journal About This"}
              </Button>
            </div>
          )}

          {/* Related Events Section */}
          <div className="mt-6">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Link size={18} />
              Connected Events
            </h3>
            <Separator className="my-2" />
            
            {loadingRelatedEvents ? (
              <p className="text-sm text-muted-foreground">Loading connected events...</p>
            ) : relatedEvents.length > 0 ? (
              <div className="space-y-3 mt-3">
                {relatedEvents.map(event => (
                  <div key={event.id} className="rounded-md border p-3">
                    <h4 className="font-medium">{event.title}</h4>
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <CalendarIcon size={14} />
                      <span>{format(new Date(event.start_date), 'MMM d')} - {format(new Date(event.end_date), 'MMM d, yyyy')}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-2 text-xs"
                      onClick={() => {
                        // Find the corresponding calendar event
                        const calendarEvent = events.find(e => e.id === event.id);
                        if (calendarEvent) {
                          setSelectedEvent(calendarEvent);
                          fetchRelatedEvents(event.id);
                        }
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No connected events found</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default CalendarView;

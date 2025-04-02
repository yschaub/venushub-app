import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Link, BookOpen, Tag } from 'lucide-react';
import {
  Calendar,
  CalendarCurrentDate,
  CalendarMonthView,
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarTodayTrigger,
  CalendarEvent as BaseCalendarEvent,
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
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, addMonths, isSameMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from "sonner";

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

interface SystemTag {
  id: string;
  name: string;
  category: string;
}

interface EventCache {
  [monthKey: string]: CalendarEvent[];
}

interface CalendarEvent extends BaseCalendarEvent {
  start_date?: string;
  end_date?: string;
}

const CalendarView = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [relatedEvents, setRelatedEvents] = useState<RelatedEvent[]>([]);
  const [loadingRelatedEvents, setLoadingRelatedEvents] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [eventTags, setEventTags] = useState<SystemTag[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventCache, setEventCache] = useState<EventCache>({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const navigate = useNavigate();

  const getMonthKey = useCallback((date: Date) => {
    return format(date, 'yyyy-MM');
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user?.id || null);
    };

    fetchUserData();
  }, []);

  const fetchEventsForMonth = useCallback(async (date: Date) => {
    const monthKey = getMonthKey(date);

    if (eventCache[monthKey]) {
      setEvents(eventCache[monthKey]);
      setLoading(false);
      return;
    }

    setLoadingMonth(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        return;
      }

      const firstDay = startOfMonth(date);
      const lastDay = endOfMonth(date);

      console.log(`Fetching events from ${format(firstDay, 'yyyy-MM-dd')} to ${format(lastDay, 'yyyy-MM-dd')}`);

      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .or(`date.gte.${format(firstDay, 'yyyy-MM-dd')},date.lte.${format(lastDay, 'yyyy-MM-dd')}`)
        .order('date', { ascending: true });

      if (eventsError) {
        console.error('Error fetching events:', eventsError);
        toast.error("Failed to load events");
        return;
      }

      const eventIds = eventsData.map(event => event.id);

      const { data: journalEntries, error: journalError } = await supabase
        .from('journal_entries')
        .select('id, event_id')
        .eq('user_id', user.id)
        .in('event_id', eventIds)
        .not('event_id', 'is', null);

      if (journalError) {
        console.error('Error fetching journal entries:', journalError);
      }

      const eventJournalMap = new Map();
      journalEntries?.forEach(entry => {
        eventJournalMap.set(entry.event_id, entry.id);
      });

      const transformedEvents = (eventsData || []).map(event => {
        const hasJournal = eventJournalMap.has(event.id);
        const journalId = eventJournalMap.get(event.id);

        return {
          id: event.id,
          title: event.title,
          start: new Date(event.date),
          end: new Date(event.date),
          hasJournal: hasJournal,
          journalId: journalId,
          tags: event.tags,
          primary_event: event.primary_event,
          start_date: event.start_date,
          end_date: event.end_date,
          className: event.primary_event
            ? (hasJournal
              ? "bg-green-100 border-green-300 cursor-pointer"
              : "bg-background border-border cursor-pointer")
            : "bg-background border-border cursor-pointer text-muted-foreground text-xs"
        };
      });

      const sortedEvents = transformedEvents.sort((a, b) => {
        if (a.primary_event !== b.primary_event) {
          return a.primary_event ? 1 : -1;
        }
        return a.start.getTime() - b.start.getTime();
      });

      setEventCache(prev => ({
        ...prev,
        [monthKey]: sortedEvents
      }));

      setEvents(sortedEvents);
      console.log(`Loaded ${sortedEvents.length} events for ${monthKey}`);
    } catch (error) {
      console.error('Error:', error);
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
      setLoadingMonth(false);
    }
  }, [eventCache, getMonthKey]);

  useEffect(() => {
    fetchEventsForMonth(currentDate);
  }, [currentDate, fetchEventsForMonth]);

  useEffect(() => {
    const prefetchAdjacentMonths = async () => {
      const nextMonth = addMonths(currentDate, 1);
      const prevMonth = addMonths(currentDate, -1);

      if (!eventCache[getMonthKey(nextMonth)]) {
        fetchEventsForMonth(nextMonth);
      }

      if (!eventCache[getMonthKey(prevMonth)]) {
        fetchEventsForMonth(prevMonth);
      }
    };

    if (!loading && Object.keys(eventCache).length > 0) {
      prefetchAdjacentMonths();
    }
  }, [currentDate, eventCache, fetchEventsForMonth, getMonthKey, loading]);

  const handleEventClick = async (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsSheetOpen(true);

    await fetchRelatedEvents(event.id);

    if (event.tags && event.tags.length > 0) {
      const { data: tagsData, error: tagsError } = await supabase
        .from('system_tags')
        .select('*')
        .in('id', event.tags);

      if (tagsError) {
        console.error('Error fetching event tags:', tagsError);
        return;
      }

      setEventTags(tagsData || []);
    } else {
      setEventTags([]);
    }
  };

  const fetchRelatedEvents = async (eventId: string) => {
    setLoadingRelatedEvents(true);
    try {
      const { data: relationships, error: relationshipsError } = await supabase
        .from('event_relationships')
        .select('related_event_id')
        .eq('event_id', eventId);

      if (relationshipsError) {
        console.error('Error fetching event relationships:', relationshipsError);
        return;
      }

      const { data: inverseRelationships, error: inverseError } = await supabase
        .from('event_relationships')
        .select('event_id')
        .eq('related_event_id', eventId);

      if (inverseError) {
        console.error('Error fetching inverse event relationships:', inverseError);
        return;
      }

      const relatedEventIds = [
        ...(relationships?.map(rel => rel.related_event_id) || []),
        ...(inverseRelationships?.map(rel => rel.event_id) || [])
      ];

      if (relatedEventIds.length === 0) {
        setRelatedEvents([]);
        return;
      }

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

  const handleMonthChange = (date: Date) => {
    setCurrentDate(date);

    const monthKey = getMonthKey(date);
    if (!eventCache[monthKey]) {
      fetchEventsForMonth(date);
    } else {
      setEvents(eventCache[monthKey]);
    }

    const nextMonth = addMonths(date, 1);
    const nextMonthKey = getMonthKey(nextMonth);
    if (!eventCache[nextMonthKey]) {
      fetchEventsForMonth(nextMonth);
    }
  };

  if (loading && !eventCache[getMonthKey(currentDate)]) {
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
        defaultDate={currentDate}
        onChangeDate={handleMonthChange}
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
            {loadingMonth && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                <div className="text-sm text-muted-foreground">Loading events...</div>
              </div>
            )}
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
                    <strong>Date:</strong> {format(selectedEvent.start, 'PPP')}
                  </p>
                  {selectedEvent.start_date && selectedEvent.end_date && (
                    <>
                      <p>
                        <strong>Start:</strong> {format(new Date(selectedEvent.start_date), 'PPP')}
                      </p>
                      <p>
                        <strong>End:</strong> {format(new Date(selectedEvent.end_date), 'PPP')}
                      </p>
                    </>
                  )}
                  <p>
                    <strong>Status:</strong> {selectedEvent.hasJournal ? 'Journal entry added' : 'No journal entry'}
                  </p>

                  {eventTags.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                        <Tag className="h-3 w-3" />
                        <span>Tags:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {eventTags.map(tag => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className={`${tag.category === 'Planets' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                              tag.category === 'Event' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                tag.category === 'Sign' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                                  tag.category === 'Aspect' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                    tag.category === 'Direction' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' :
                                      tag.category === 'Cycle' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' :
                                        tag.category === 'Houses' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' :
                                          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                              }`}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </SheetDescription>
          </SheetHeader>

          {selectedEvent?.primary_event && (
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

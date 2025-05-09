import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Link, BookOpen, Tag, X } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, startOfMonth, endOfMonth, addMonths, isSameMonth, formatDistanceToNow } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computePosition, flip, shift, offset } from '@floating-ui/dom';

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
  date: string;
}

interface SystemTag {
  id: string;
  name: string;
  category: string;
}

interface EventCache {
  events: {
    [key: string]: CalendarEvent[];
  };
  lastUpdated?: string;
}

interface CalendarEvent extends BaseCalendarEvent {
  start_date?: string;
  end_date?: string;
}

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  date_created: string;
}

interface Annotation {
  id: string;
  content: string;
  selectedText?: string;
  created_at: string;
}

interface Narrative {
  id: string;
  title: string;
}

const parseContent = (content: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const annotations: Annotation[] = [];

  // Find all marks with annotation data attributes
  doc.querySelectorAll('mark[data-type="annotation"]').forEach(mark => {
    const id = mark.getAttribute('data-id') || '';
    const annotationContent = mark.getAttribute('data-content') || '';
    const selectedText = mark.textContent || '';
    const createdAt = mark.getAttribute('data-created-at') || '';

    // Create a new mark element with tooltip trigger
    const highlightMark = doc.createElement('mark');
    highlightMark.className = 'bg-yellow-100 dark:bg-yellow-900/30 px-0.5 rounded cursor-help hover:bg-yellow-200 dark:hover:bg-yellow-800/50 transition-colors';
    highlightMark.setAttribute('data-annotation-ref', id);
    highlightMark.setAttribute('data-content', annotationContent);
    highlightMark.setAttribute('data-created-at', createdAt);
    highlightMark.textContent = selectedText;

    // Replace the original mark with our highlighted version
    mark.replaceWith(highlightMark);

    annotations.push({
      id,
      content: annotationContent,
      selectedText,
      created_at: createdAt
    });
  });

  // Get the content with our highlight marks
  const cleanContent = doc.body.innerHTML;

  return {
    content: cleanContent,
    annotations
  };
};

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
  const [eventCache, setEventCache] = useState<EventCache>({ events: {} });
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
  const [loadingJournal, setLoadingJournal] = useState(false);
  const [journalNarratives, setJournalNarratives] = useState<Narrative[]>([]);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<{
    element: HTMLElement;
    content: string;
    created_at: string;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

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

    // Check if we have cached data that's less than 5 minutes old
    if (eventCache.events[monthKey] && eventCache.lastUpdated) {
      const lastUpdated = new Date(eventCache.lastUpdated);
      const now = new Date();
      const minutesDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);

      if (minutesDiff < 5) {
        setEvents(eventCache.events[monthKey]);
        setLoading(false);
        return;
      }
    }

    setLoadingMonth(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        toast.error("Authentication error. Please try logging in again.");
        return;
      }
      if (!user) {
        toast.error("Please log in to view events");
        return;
      }

      const firstDay = startOfMonth(date);
      const lastDay = endOfMonth(date);

      // Fetch events and journal entries in parallel without abort signal
      const [eventsResponse, journalResponse] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .or(`date.gte.${format(firstDay, 'yyyy-MM-dd')},date.lte.${format(lastDay, 'yyyy-MM-dd')}`)
          .order('date', { ascending: true }),
        supabase
          .from('journal_entries')
          .select('id, event_id')
          .eq('user_id', user.id)
          .not('event_id', 'is', null)
      ]);

      if (eventsResponse.error) {
        if (eventsResponse.error.code === 'PGRST116') {
          toast.error("No events found for this period");
        } else {
          toast.error(`Failed to load events: ${eventsResponse.error.message}`);
        }
        return;
      }

      if (journalResponse.error) {
        // Continue with events even if journal fetch fails
      }

      const eventJournalMap = new Map();
      journalResponse.data?.forEach(entry => {
        eventJournalMap.set(entry.event_id, entry.id);
      });

      const transformedEvents = (eventsResponse.data || []).map(event => {
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
          className: event.primary_event
            ? (hasJournal
              ? "bg-green-100 border-green-300 cursor-pointer"
              : "bg-background border-border cursor-pointer")
            : "bg-background border-border text-muted-foreground text-xs"
        };
      });

      const sortedEvents = transformedEvents.sort((a, b) => {
        if (a.primary_event !== b.primary_event) {
          return a.primary_event ? 1 : -1;
        }
        return a.start.getTime() - b.start.getTime();
      });

      // Update cache with timestamp
      setEventCache(prev => ({
        ...prev,
        events: {
          ...prev.events,
          [monthKey]: sortedEvents
        },
        lastUpdated: new Date().toISOString()
      }));

      setEvents(sortedEvents);
    } catch (error) {
      toast.error("Failed to load events. Please try refreshing the page.");
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

      if (!eventCache.events[getMonthKey(nextMonth)]) {
        fetchEventsForMonth(nextMonth);
      }

      if (!eventCache.events[getMonthKey(prevMonth)]) {
        fetchEventsForMonth(prevMonth);
      }
    };

    if (!loading && Object.keys(eventCache.events).length > 0) {
      prefetchAdjacentMonths();
    }
  }, [currentDate, eventCache, fetchEventsForMonth, getMonthKey, loading]);

  const fetchJournalEntry = async (journalId: string) => {
    setLoadingJournal(true);
    setJournalNarratives([]);
    try {
      const { data: entry, error } = await supabase
        .from('journal_entries')
        .select(`
          *,
          annotations:journal_entry_annotations (
            id,
            content,
            selected_text,
            created_at
          ),
          journal_entry_tags (
            tag_id
          )
        `)
        .eq('id', journalId)
        .single();

      if (error) {
        return;
      }

      // Process the content to include created_at in the marks
      if (entry.content) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(entry.content, 'text/html');

        doc.querySelectorAll('mark[data-type="annotation"]').forEach(mark => {
          const id = mark.getAttribute('data-id');
          const annotation = entry.annotations?.find(a => a.id === id);
          if (annotation) {
            mark.setAttribute('data-created-at', annotation.created_at);
          }
        });

        entry.content = doc.body.innerHTML;
      }

      // Fetch tags data for the journal entry
      if (entry.journal_entry_tags && entry.journal_entry_tags.length > 0) {
        const tagIds = entry.journal_entry_tags.map(t => t.tag_id);
        const { data: tagsData, error: tagsError } = await supabase
          .from('system_tags')
          .select('*')
          .in('id', tagIds);

        if (!tagsError) {
          setEventTags(tagsData || []);
        }
      } else {
        setEventTags([]);
      }

      setJournalEntry(entry);

      // Fetch narratives that this journal entry belongs to
      const { data: narrativeEntries, error: narrativesError } = await supabase
        .from('narrative_journal_entries')
        .select(`
          narrative:narratives (
            id,
            title
          )
        `)
        .eq('journal_entry_id', journalId);

      if (!narrativesError) {
        const narratives = narrativeEntries
          ?.map(entry => entry.narrative)
          .filter((narrative): narrative is Narrative => narrative !== null);

        setJournalNarratives(narratives || []);
      }
    } catch (error) {
      // Silently handle errors for journal entries
    } finally {
      setLoadingJournal(false);
    }
  };

  const fetchRelatedEvents = async (eventId: string) => {
    setLoadingRelatedEvents(true);
    try {
      const [relationshipsResponse, inverseRelationshipsResponse] = await Promise.all([
        supabase
          .from('event_relationships')
          .select('related_event_id')
          .eq('event_id', eventId),
        supabase
          .from('event_relationships')
          .select('event_id')
          .eq('related_event_id', eventId)
      ]);

      if (relationshipsResponse.error || inverseRelationshipsResponse.error) {
        setRelatedEvents([]);
        return;
      }

      const relatedEventIds = [
        ...(relationshipsResponse.data?.map(rel => rel.related_event_id) || []),
        ...(inverseRelationshipsResponse.data?.map(rel => rel.event_id) || [])
      ];

      if (relatedEventIds.length === 0) {
        setRelatedEvents([]);
        return;
      }

      const { data: relatedEventsData, error: relatedEventsError } = await supabase
        .from('events')
        .select('id, title, date')
        .in('id', relatedEventIds)
        .order('date', { ascending: true });

      if (!relatedEventsError) {
        setRelatedEvents(relatedEventsData || []);
      }
    } catch (error) {
      setRelatedEvents([]);
    } finally {
      setLoadingRelatedEvents(false);
    }
  };

  const handleEventClick = async (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsSheetOpen(true);
    setJournalEntry(null);
    setEventTags([]); // Reset tags

    await fetchRelatedEvents(event.id);

    // If there's a journal entry, its tags will be fetched in fetchJournalEntry
    if (event.hasJournal && event.journalId) {
      await fetchJournalEntry(event.journalId);
    } else if (event.tags && event.tags.length > 0) {
      // Only fetch event tags if there's no journal entry
      const { data: tagsData, error: tagsError } = await supabase
        .from('system_tags')
        .select('*')
        .in('id', event.tags);

      if (tagsError) {
        console.error('Error fetching event tags:', tagsError);
        return;
      }

      setEventTags(tagsData || []);
    }
  };

  const handleJournalAction = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!currentUser) {
      navigate('/auth');
      return;
    }

    if (selectedEvent?.hasJournal && selectedEvent?.journalId) {
      navigate(`/dashboard/journal/${selectedEvent.journalId}/edit`, {
        state: {
          returnTo: {
            path: '/dashboard/calendar',
            eventId: selectedEvent.id
          }
        }
      });
    } else if (selectedEvent) {
      navigate('/dashboard/journal/create', {
        state: {
          eventData: {
            id: selectedEvent.id,
            title: selectedEvent.title,
            tags: selectedEvent.tags || [],
            date: format(selectedEvent.start, 'yyyy-MM-dd')
          },
          returnTo: {
            path: '/dashboard/calendar',
            eventId: selectedEvent.id
          }
        }
      });
    }
  };

  const handleMonthChange = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  useEffect(() => {
    if (!hoveredAnnotation || !tooltipRef.current) return;

    const updatePosition = () => {
      computePosition(hoveredAnnotation.element, tooltipRef.current!, {
        placement: 'top',
        middleware: [
          offset(8),
          flip(),
          shift({ padding: 5 })
        ],
      }).then(({ x, y }) => {
        if (tooltipRef.current) {
          Object.assign(tooltipRef.current.style, {
            left: `${x}px`,
            top: `${y}px`,
          });
        }
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [hoveredAnnotation]);

  // Add effect to handle return navigation
  useEffect(() => {
    const openEventId = location.state?.openEventId;
    if (!openEventId || loading) return;

    // First, find the event in the current month
    const eventToOpen = events.find(event => event.id === openEventId);

    if (eventToOpen) {
      handleEventClick(eventToOpen);
      // Clear the state after opening the event
      navigate(location.pathname, {
        replace: true,
        state: {}
      });
    } else {
      // If event not found in current month, fetch it to get its date
      const fetchEventDate = async () => {
        try {
          const { data: event, error } = await supabase
            .from('events')
            .select('date')
            .eq('id', openEventId)
            .single();

          if (error || !event) {
            console.error('Error fetching event:', error);
            return;
          }

          // Set the calendar to the event's month
          const eventDate = new Date(event.date);
          if (!isSameMonth(eventDate, currentDate)) {
            setCurrentDate(eventDate);
          }
        } catch (error) {
          console.error('Error fetching event date:', error);
        }
      };

      fetchEventDate();
    }
  }, [location.state?.openEventId, events, loading, currentDate, navigate, handleEventClick]);

  if (loading && !eventCache.events[getMonthKey(currentDate)]) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading calendar...</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
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

        <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col border-0 shadow-xl p-6 bg-white dark:bg-[#191919] overflow-hidden">
            <button
              onClick={() => setIsSheetOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header with title */}
            <DialogTitle className="text-3xl font-bold mb-6">
              {selectedEvent?.title}
            </DialogTitle>

            {/* Scrollable content */}
            <div className="flex-1 -mx-6 px-6 overflow-y-auto">
              {/* Properties section */}
              <div className="space-y-4">
                {/* Date */}
                <div className="flex items-start">
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-28">Date</span>
                  <span className="text-sm">
                    {selectedEvent && format(selectedEvent.start, 'MMMM d, yyyy')}
                  </span>
                </div>

                {/* Tags */}
                {eventTags.length > 0 && (
                  <div className="flex items-start">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-28">Tags</span>
                    <div className="flex flex-wrap gap-1.5">
                      {eventTags.map((tag) => (
                        <Badge key={tag.id} variant="outline" className="text-xs">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connected Events */}
                {!loadingRelatedEvents && relatedEvents.length > 0 && (
                  <div className="flex items-start">
                    <span className="text-sm text-gray-500 dark:text-gray-400 w-28">Connected to</span>
                    <div className="flex-1">
                      {relatedEvents.map((event, index) => {
                        const calendarEvent = events.find(e => e.id === event.id);
                        const isPrimary = calendarEvent?.primary_event;

                        return (
                          <React.Fragment key={event.id}>
                            <span
                              className={cn(
                                "text-sm",
                                isPrimary ? (
                                  "text-primary decoration-gray-500 underline underline-offset-2 hover:no-underline cursor-pointer"
                                ) : (
                                  "text-muted-foreground"
                                )
                              )}
                              onClick={isPrimary ? () => {
                                if (calendarEvent) {
                                  setSelectedEvent(calendarEvent);
                                  fetchRelatedEvents(event.id);
                                }
                              } : undefined}
                            >
                              {event.title}
                            </span>
                            {index < relatedEvents.length - 1 && (
                              <span className="text-muted-foreground mx-1">,</span>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Journal Entry Section */}
              {selectedEvent?.primary_event && (
                <div className="mt-6">
                  {selectedEvent.hasJournal ? (
                    <div className="space-y-4">
                      {loadingJournal ? (
                        <div className="flex items-center justify-center py-4">
                          <p className="text-sm text-muted-foreground">Loading journal entry...</p>
                        </div>
                      ) : journalEntry ? (
                        <>
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium flex items-center gap-2">
                              <BookOpen className="h-4 w-4" />
                              Journal Entry
                            </h3>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/dashboard/journal/${journalEntry.id}/edit`, {
                                state: {
                                  returnTo: {
                                    path: '/dashboard/calendar',
                                    eventId: selectedEvent?.id
                                  }
                                }
                              })}
                            >
                              Edit
                            </Button>
                          </div>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            {journalEntry.content.split(/(<p>.*?<\/p>)/).filter(Boolean).map((paragraph, index) => {
                              if (paragraph.startsWith('<p>')) {
                                return (
                                  <div
                                    key={index}
                                    dangerouslySetInnerHTML={{ __html: paragraph }}
                                    className="relative group"
                                  />
                                );
                              }
                              return null;
                            })}
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex items-center gap-1 w-full"
                      onClick={handleJournalAction}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Journal About This
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    </TooltipProvider>
  );
};

export default CalendarView;

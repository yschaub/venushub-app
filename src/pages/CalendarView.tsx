import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [eventCache, setEventCache] = useState<EventCache>({});
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
        console.error('Error fetching journal entry:', error);
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

        if (tagsError) {
          console.error('Error fetching journal entry tags:', tagsError);
        } else {
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

      if (narrativesError) {
        console.error('Error fetching narratives:', narrativesError);
        return;
      }

      const narratives = narrativeEntries
        ?.map(entry => entry.narrative)
        .filter((narrative): narrative is Narrative => narrative !== null);

      setJournalNarratives(narratives || []);
    } catch (error) {
      console.error('Error in fetchJournalEntry:', error);
    } finally {
      setLoadingJournal(false);
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

  if (loading && !eventCache[getMonthKey(currentDate)]) {
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
          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {selectedEvent?.title}
              </DialogTitle>
              <DialogDescription>
                {selectedEvent && (
                  <>
                    <div className="text-sm text-muted-foreground">
                      {format(selectedEvent.start, 'MMMM d, yyyy')}
                    </div>
                    {eventTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {eventTags.map((tag) => (
                          <Badge key={tag.id} variant="outline" className="text-xs">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {!selectedEvent.hasJournal && selectedEvent.tags && selectedEvent.tags.length > 0 && eventTags.length === 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedEvent.tags.map((tagId) => {
                          const tag = eventTags.find(t => t.id === tagId);
                          return tag ? (
                            <Badge key={tagId} variant="outline" className="text-xs">
                              {tag.name}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}

                    {!loadingRelatedEvents && relatedEvents.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                          <Link className="h-3 w-3" />
                          <span>Connected to:</span>
                        </div>
                        <div className="flex flex-wrap gap-x-2 text-sm">
                          {relatedEvents.map((event, index) => (
                            <React.Fragment key={event.id}>
                              <button
                                className="text-primary hover:underline"
                                onClick={() => {
                                  const calendarEvent = events.find(e => e.id === event.id);
                                  if (calendarEvent) {
                                    setSelectedEvent(calendarEvent);
                                    fetchRelatedEvents(event.id);
                                  }
                                }}
                              >
                                {event.title}
                              </button>
                              {index < relatedEvents.length - 1 && <span className="text-muted-foreground">•</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}

                    {journalNarratives.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                          <BookOpen className="h-3 w-3" />
                          <span>Part of narratives:</span>
                        </div>
                        <div className="flex flex-wrap gap-x-2 text-sm">
                          {journalNarratives.map((narrative, index) => (
                            <React.Fragment key={narrative.id}>
                              <button
                                className="text-primary hover:underline"
                                onClick={() => navigate(`/dashboard/narratives/${narrative.id}`)}
                              >
                                {narrative.title}
                              </button>
                              {index < journalNarratives.length - 1 && <span className="text-muted-foreground">•</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-6 -mr-6">
              {selectedEvent?.primary_event && (
                <div className="mt-4">
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
                          <div className="rounded-lg border bg-card">
                            <div className="p-4 prose prose-sm max-w-none [&>div:first-child>p]:mt-0 [&>div:last-child>p]:mb-0">
                              {journalEntry.content.split(/(<p>.*?<\/p>)/).filter(Boolean).map((paragraph, index) => {
                                if (paragraph.startsWith('<p>')) {
                                  const { content } = parseContent(paragraph);
                                  return (
                                    <div key={index}>
                                      <p
                                        dangerouslySetInnerHTML={{ __html: content }}
                                        onMouseOver={(e) => {
                                          const target = e.target as HTMLElement;
                                          const mark = target.closest('mark[data-annotation-ref]') as HTMLElement;
                                          if (mark) {
                                            const content = mark.getAttribute('data-content');
                                            const createdAt = mark.getAttribute('data-created-at');
                                            if (content && createdAt) {
                                              setHoveredAnnotation({
                                                element: mark,
                                                content,
                                                created_at: createdAt
                                              });
                                            }
                                          }
                                        }}
                                        onMouseOut={() => {
                                          setHoveredAnnotation(null);
                                        }}
                                      />
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          </div>
                          {hoveredAnnotation && (
                            <div
                              ref={tooltipRef}
                              className="fixed z-50 px-2 py-1 text-sm rounded shadow-lg border bg-white dark:bg-gray-800 text-foreground max-w-[300px]"
                            >
                              <div className="mb-1">{hoveredAnnotation.content}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(hoveredAnnotation.created_at), { addSuffix: true })}
                              </div>
                            </div>
                          )}
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

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, addMonths, isSameMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
}

interface Narrative {
  id: string;
  title: string;
}

const parseContent = (content: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const annotations: Annotation[] = [];

  // Find all spans with data-annotation attributes
  doc.querySelectorAll('span[data-annotation-id]').forEach(span => {
    const id = span.getAttribute('data-annotation-id') || '';
    const annotationContent = span.getAttribute('data-annotation-content') || '';

    // Create a new span with yellow background for the annotated text
    const highlightSpan = doc.createElement('span');
    highlightSpan.className = 'bg-yellow-100 dark:bg-yellow-900/30 rounded px-0.5';
    highlightSpan.setAttribute('data-annotation-ref', id);
    highlightSpan.textContent = span.textContent || '';

    // Replace the original span with our highlighted version
    span.replaceWith(highlightSpan);

    annotations.push({
      id,
      content: annotationContent
    });
  });

  // Get the cleaned content with our highlight spans
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

  const fetchJournalEntry = async (journalId: string) => {
    setLoadingJournal(true);
    setJournalNarratives([]);
    try {
      const { data: entry, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('id', journalId)
        .single();

      if (error) {
        console.error('Error fetching journal entry:', error);
        return;
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

    // Fetch journal entry if it exists
    if (event.hasJournal && event.journalId) {
      await fetchJournalEntry(event.journalId);
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

      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="max-w-[1000px] max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-none">
            <DialogTitle>{selectedEvent?.title}</DialogTitle>
            <DialogDescription className="space-y-3">
              {selectedEvent && (
                <>
                  <p>
                    <strong>Date:</strong> {format(selectedEvent.start, 'PPP')}
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
                            onClick={() => navigate(`/dashboard/journal/${journalEntry.id}/edit`)}
                          >
                            Edit
                          </Button>
                        </div>
                        <div className="grid grid-cols-[1fr,350px] gap-6">
                          <div className="rounded-lg border bg-card">
                            <div className="p-4 prose prose-sm max-w-none [&>div:first-child>p]:mt-0 [&>div:last-child>p]:mb-0">
                              {journalEntry.content.split(/(<p>.*?<\/p>)/).filter(Boolean).map((paragraph, index) => {
                                if (paragraph.startsWith('<p>')) {
                                  const { content, annotations } = parseContent(paragraph);
                                  return (
                                    <div key={index}>
                                      <p
                                        dangerouslySetInnerHTML={{ __html: content }}
                                      />
                                    </div>
                                  );
                                }
                                return null;
                              })}
                            </div>
                          </div>
                          <div className="rounded-lg border bg-card">
                            <div className="border-b px-3 py-2 bg-muted/50">
                              <div className="text-sm font-medium">
                                Annotations ({journalEntry.content.split(/(<p>.*?<\/p>)/).filter(Boolean)
                                  .reduce((count, paragraph) => {
                                    if (paragraph.startsWith('<p>')) {
                                      const { annotations } = parseContent(paragraph);
                                      return count + annotations.length;
                                    }
                                    return count;
                                  }, 0)})
                              </div>
                            </div>
                            <div className="p-3 space-y-3">
                              {journalEntry.content.split(/(<p>.*?<\/p>)/).filter(Boolean).map((paragraph, index) => {
                                if (paragraph.startsWith('<p>')) {
                                  const { annotations } = parseContent(paragraph);
                                  return annotations.map((annotation) => (
                                    <div
                                      key={annotation.id}
                                      className="rounded-lg border bg-card text-sm"
                                    >
                                      <div className="border-b bg-yellow-100 dark:bg-yellow-900/30 px-3 py-2">
                                        {document.querySelector(`[data-annotation-ref="${annotation.id}"]`)?.textContent}
                                      </div>
                                      <div className="px-3 py-2 space-y-2">
                                        <div>{annotation.content}</div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                          <div>9 minutes ago</div>
                                          <button className="opacity-0">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ));
                                }
                                return null;
                              })}
                            </div>
                          </div>
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
  );
};

export default CalendarView;


import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft, ChevronRight, BookOpen, Link, Tag } from 'lucide-react';
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
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, isSameMonth, formatDistanceToNow } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computePosition, flip, shift, offset } from '@floating-ui/dom';
import { Skeleton } from "@/components/ui/skeleton";
import { 
  useCalendarEvents, 
  CalendarEvent, 
  getMonthKey 
} from '@/hooks/useCalendarEvents';
import { 
  useJournalEntry, 
  useJournalTags, 
  useJournalNarratives 
} from '@/hooks/useJournalEntry';
import { useRelatedEvents } from '@/hooks/useRelatedEvents';
import { supabase } from '@/integrations/supabase/client';

interface Annotation {
  id: string;
  content: string;
  selectedText?: string;
  created_at: string;
}

const parseContent = (content: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const annotations: Annotation[] = [];

  doc.querySelectorAll('mark[data-type="annotation"]').forEach(mark => {
    const id = mark.getAttribute('data-id') || '';
    const annotationContent = mark.getAttribute('data-content') || '';
    const selectedText = mark.textContent || '';
    const createdAt = mark.getAttribute('data-created-at') || '';

    const highlightMark = doc.createElement('mark');
    highlightMark.className = 'bg-yellow-100 dark:bg-yellow-900/30 px-0.5 rounded cursor-help hover:bg-yellow-200 dark:hover:bg-yellow-800/50 transition-colors';
    highlightMark.setAttribute('data-annotation-ref', id);
    highlightMark.setAttribute('data-content', annotationContent);
    highlightMark.setAttribute('data-created-at', createdAt);
    highlightMark.textContent = selectedText;

    mark.replaceWith(highlightMark);

    annotations.push({
      id,
      content: annotationContent,
      selectedText,
      created_at: createdAt
    });
  });

  const cleanContent = doc.body.innerHTML;

  return {
    content: cleanContent,
    annotations
  };
};

const CalendarView = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [hoveredAnnotation, setHoveredAnnotation] = useState<{
    element: HTMLElement;
    content: string;
    created_at: string;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { 
    events, 
    isLoading: loadingEvents, 
    prefetchAdjacentMonths 
  } = useCalendarEvents(currentDate, user?.id || null);

  const { 
    data: journalEntry, 
    isLoading: loadingJournal 
  } = useJournalEntry(selectedEvent?.journalId);

  const { 
    data: relatedEvents = [], 
    isLoading: loadingRelatedEvents 
  } = useRelatedEvents(selectedEvent?.id);

  const { 
    data: journalNarratives = [], 
    isLoading: loadingNarratives 
  } = useJournalNarratives(selectedEvent?.journalId);

  const tagIds = selectedEvent
    ? selectedEvent.hasJournal && journalEntry?.journal_entry_tags
      ? journalEntry.journal_entry_tags.map(t => t.tag_id)
      : selectedEvent.tags
    : [];

  const { data: eventTags = [] } = useJournalTags(tagIds);

  // Force an initial fetch and prefetch on component mount
  useEffect(() => {
    if (user?.id) {
      prefetchAdjacentMonths();
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Continue prefetching when month changes or events load
  useEffect(() => {
    if (!loadingEvents) {
      prefetchAdjacentMonths();
    }
  }, [currentDate, loadingEvents, prefetchAdjacentMonths]);

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsSheetOpen(true);
  };

  const handleJournalAction = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
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

  useEffect(() => {
    const openEventId = location.state?.openEventId;
    if (!openEventId || loadingEvents) return;

    const eventToOpen = events.find(event => event.id === openEventId);

    if (eventToOpen) {
      handleEventClick(eventToOpen);
      navigate(location.pathname, {
        replace: true,
        state: {}
      });
    } else {
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
  }, [location.state?.openEventId, events, loadingEvents, currentDate, navigate]);

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
              {loadingEvents && (
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
                        {eventTags.map((tag) => {
                          const isEventTag = selectedEvent?.hasJournal && selectedEvent.tags?.includes(tag.id);
                          return (
                            <Badge
                              key={tag.id}
                              variant="outline"
                              className={cn(
                                "border-0 text-xs",
                                isEventTag
                                  ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                              )}
                            >
                              {tag.name}
                            </Badge>
                          );
                        })}
                      </div>
                    )}

                    {loadingRelatedEvents ? (
                      <div className="mt-3">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    ) : relatedEvents.length > 0 && (
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

                    {loadingNarratives ? (
                      <div className="mt-3">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    ) : journalNarratives.length > 0 && (
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
                        <div className="space-y-3">
                          <Skeleton className="h-6 w-32" />
                          <Skeleton className="h-24 w-full rounded-lg" />
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

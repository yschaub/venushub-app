
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { toast } from "sonner";

export type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  start_date?: string;
  end_date?: string;
  primary_event: boolean;
  tags: string[];
  hasJournal?: boolean;
  journalId?: string;
  className?: string;
};

// Helper function to generate a month key
export const getMonthKey = (date: Date) => format(date, 'yyyy-MM');

// Function to fetch events for a given month
export const fetchEventsForMonth = async (date: Date, userId: string | null) => {
  if (!userId) {
    console.log('No authenticated user found');
    return [];
  }

  const firstDay = startOfMonth(date);
  const lastDay = endOfMonth(date);
  
  console.log(`Fetching events from ${format(firstDay, 'yyyy-MM-dd')} to ${format(lastDay, 'yyyy-MM-dd')}`);

  try {
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .or(`date.gte.${format(firstDay, 'yyyy-MM-dd')},date.lte.${format(lastDay, 'yyyy-MM-dd')}`)
      .order('date', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      throw new Error('Failed to load events');
    }

    // If no events data, return early
    if (!eventsData || eventsData.length === 0) {
      console.log(`No events found for ${getMonthKey(date)}`);
      return [];
    }

    const eventIds = eventsData.map(event => event.id);

    const { data: journalEntries, error: journalError } = await supabase
      .from('journal_entries')
      .select('id, event_id')
      .eq('user_id', userId)
      .in('event_id', eventIds)
      .not('event_id', 'is', null);

    if (journalError) {
      console.error('Error fetching journal entries:', journalError);
      // Continue anyway, we'll just show events without journal status
    }

    const eventJournalMap = new Map();
    if (journalEntries && journalEntries.length > 0) {
      journalEntries.forEach(entry => {
        eventJournalMap.set(entry.event_id, entry.id);
      });
    }

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
        tags: event.tags || [],
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

    console.log(`Loaded ${sortedEvents.length} events for ${getMonthKey(date)}`);
    return sortedEvents;
  } catch (error) {
    console.error('Error in fetchEventsForMonth:', error);
    throw error;
  }
};

// Custom hook that uses React Query for calendar events
export const useCalendarEvents = (date: Date, userId: string | null) => {
  const monthKey = getMonthKey(date);
  const queryClient = useQueryClient();

  // The main query for the current month
  const query = useQuery({
    queryKey: ['calendar-events', monthKey, userId],
    queryFn: () => fetchEventsForMonth(date, userId),
    staleTime: 0, // Always treat data as stale to ensure fresh data
    gcTime: 0, // Don't keep old data in cache
    retry: 1, // Only retry once to avoid infinite loading
    enabled: !!userId,
    meta: {
      onSettled: (data, error) => {
        if (error) {
          console.error('Error fetching events:', error);
          toast.error("Failed to load events");
        }
      }
    }
  });

  // Function to prefetch adjacent months
  const prefetchAdjacentMonths = () => {
    if (!userId) return;

    const nextMonth = addMonths(date, 1);
    const prevMonth = addMonths(date, -1);
    const nextMonthKey = getMonthKey(nextMonth);
    const prevMonthKey = getMonthKey(prevMonth);

    // Prefetch next month
    queryClient.prefetchQuery({
      queryKey: ['calendar-events', nextMonthKey, userId],
      queryFn: () => fetchEventsForMonth(nextMonth, userId),
      staleTime: 0,
    });

    // Prefetch previous month
    queryClient.prefetchQuery({
      queryKey: ['calendar-events', prevMonthKey, userId],
      queryFn: () => fetchEventsForMonth(prevMonth, userId),
      staleTime: 0,
    });
  };

  // Function to manually invalidate calendar data
  const refreshEvents = () => {
    // Force invalidate the current month
    queryClient.invalidateQueries({ queryKey: ['calendar-events', monthKey, userId] });
    
    // Invalidate all calendar events to ensure fresh data
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
  };

  return {
    events: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    prefetchAdjacentMonths,
    refreshEvents,
  };
};

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Calendar,
  CalendarCurrentDate,
  CalendarMonthView,
  CalendarNextTrigger,
  CalendarPrevTrigger,
  CalendarTodayTrigger,
  CalendarEvent,
} from '@/components/ui/full-calendar';

interface Event {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  primary_event: boolean;
  tags: string[];
  hasJournal?: boolean;
}

const CalendarView = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

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
          .select('event_id')
          .eq('user_id', user.id)
          .not('event_id', 'is', null);

        if (journalError) {
          console.error('Error fetching journal entries:', journalError);
          return;
        }

        // Create a Set of event IDs that have journal entries
        const eventIdsWithJournal = new Set(journalEntries?.map(entry => entry.event_id) || []);

        // Transform events to match the calendar format
        const transformedEvents = (eventsData || []).map(event => {
          const transformed = {
            id: event.id,
            title: event.title,
            start: new Date(event.start_date),
            end: new Date(event.end_date),
            // Use a different style for events with journal entries
            className: eventIdsWithJournal.has(event.id)
              ? "bg-green-100 border-green-300"
              : "bg-background border-border"
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading calendar...</p>
      </div>
    );
  }

  console.log('Rendering calendar with events:', events);

  return (
    <Calendar events={events} view="month">
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
  );
};

export default CalendarView;

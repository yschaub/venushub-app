
import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { CalendarIcon } from 'lucide-react';

interface Event {
  id: string;
  title: string;
  date: string;
  start_date: string;
  end_date: string;
  primary_event: boolean;
  tags: string[];
}

const CalendarView = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDayEvents, setSelectedDayEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch events from Supabase
  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*');
      
      if (error) {
        console.error('Error fetching events:', error);
      } else {
        setEvents(data || []);
      }
      setLoading(false);
    };

    fetchEvents();
  }, []);

  // Update selected day events when date changes
  useEffect(() => {
    if (date && events.length > 0) {
      const formattedDate = format(date, 'yyyy-MM-dd');
      const filteredEvents = events.filter(event => {
        // Check if the selected date falls within the event's date range
        return event.date === formattedDate || 
               (event.start_date <= formattedDate && event.end_date >= formattedDate);
      });
      setSelectedDayEvents(filteredEvents);
    } else {
      setSelectedDayEvents([]);
    }
  }, [date, events]);

  // Function to determine if a day has events
  const getDayHasEvents = (day: Date) => {
    const formattedDay = format(day, 'yyyy-MM-dd');
    return events.some(event => {
      return event.date === formattedDay || 
             (event.start_date <= formattedDay && event.end_date >= formattedDay);
    });
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Astrological Calendar</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Calendar</CardTitle>
            <CardDescription>Select a date to view events</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
              modifiers={{
                hasEvent: (date) => getDayHasEvents(date),
              }}
              modifiersClassNames={{
                hasEvent: 'has-event',
              }}
            />
          </CardContent>
        </Card>
        
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>
              {date ? format(date, 'MMMM d, yyyy') : 'No date selected'}
            </CardTitle>
            <CardDescription>
              {selectedDayEvents.length > 0 
                ? `${selectedDayEvents.length} event${selectedDayEvents.length > 1 ? 's' : ''} on this day`
                : 'No events on this day'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <p className="text-muted-foreground">Loading events...</p>
              </div>
            ) : selectedDayEvents.length > 0 ? (
              <div className="space-y-4">
                {selectedDayEvents.map((event) => (
                  <div key={event.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">{event.title}</h3>
                        <div className="flex items-center text-sm text-muted-foreground mt-1">
                          <CalendarIcon className="mr-1 h-4 w-4" />
                          <span>
                            {event.start_date === event.end_date 
                              ? format(new Date(event.date), 'MMM d, yyyy')
                              : `${format(new Date(event.start_date), 'MMM d')} - ${format(new Date(event.end_date), 'MMM d, yyyy')}`}
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <p className="text-muted-foreground">No events found for this day.</p>
                <p className="text-sm text-muted-foreground mt-1">Select another date or check back later.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CalendarView;

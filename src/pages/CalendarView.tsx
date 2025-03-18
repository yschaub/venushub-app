
import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedDayEvents, setSelectedDayEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch events for the current month
  useEffect(() => {
    const fetchEventsForMonth = async () => {
      setLoading(true);
      
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      
      if (error) {
        console.error('Error fetching events:', error);
      } else {
        setEvents(data || []);
      }
      setLoading(false);
    };

    fetchEventsForMonth();
  }, [currentMonth]);

  // Update selected day events when date changes
  useEffect(() => {
    if (selectedDate && events.length > 0) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      
      // Filter by exact date match, ignoring start_date and end_date
      const filteredEvents = events.filter(event => 
        event.date === formattedDate
      );
      
      setSelectedDayEvents(filteredEvents);
    } else {
      setSelectedDayEvents([]);
    }
  }, [selectedDate, events]);

  // Function to determine if a day has events (based on date field only)
  const getDayHasEvents = (day: Date) => {
    const formattedDay = format(day, 'yyyy-MM-dd');
    return events.some(event => event.date === formattedDay);
  };

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentMonth(prevMonth => subMonths(prevMonth, 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentMonth(prevMonth => addMonths(prevMonth, 1));
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Astrological Calendar</h1>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>
                {format(currentMonth, 'MMMM yyyy')}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={goToPreviousMonth}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={goToNextMonth}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <CardDescription className="mt-2">
              {selectedDayEvents.length > 0 
                ? `${selectedDayEvents.length} event${selectedDayEvents.length > 1 ? 's' : ''} on ${selectedDate ? format(selectedDate, 'MMMM d, yyyy') : ''}`
                : `Select a date to view events`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
              <div className="md:col-span-7">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  className="rounded-md border w-full"
                  modifiers={{
                    hasEvent: (date) => getDayHasEvents(date),
                  }}
                />
              </div>
            </div>
            
            {/* Display events for selected date */}
            {selectedDate && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-3">
                  Events on {format(selectedDate, 'MMMM d, yyyy')}
                </h3>
                {loading ? (
                  <div className="flex items-center justify-center h-20">
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
                                  : `Influence: ${format(new Date(event.start_date), 'MMM d')} - ${format(new Date(event.end_date), 'MMM d, yyyy')}`}
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
                  <div className="flex flex-col items-center justify-center h-20 text-center">
                    <p className="text-muted-foreground">No events found for this day.</p>
                    <p className="text-sm text-muted-foreground mt-1">Select another date or check back later.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CalendarView;

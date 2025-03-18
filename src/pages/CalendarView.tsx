import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CalendarIcon, BookText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Event {
  id: string;
  title: string;
  date: string;
  start_date: string;
  end_date: string;
  primary_event: boolean;
  tags: string[];
  type: 'event';
}

interface JournalEntry {
  id: string;
  title: string;
  date: string;
  content: string | null;
  user_id: string;
  type: 'journal';
}

type CalendarItem = Event | JournalEntry;

const CalendarView = () => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [selectedDayItems, setSelectedDayItems] = useState<CalendarItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Fetch events and journal entries for the current month
  useEffect(() => {
    const fetchDataForMonth = async () => {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        setLoading(false);
        return;
      }
      
      const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
      
      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      
      if (eventsError) {
        console.error('Error fetching events:', eventsError);
      } else {
        setEvents((eventsData || []).map(event => ({
          ...event,
          type: 'event'
        })));
      }

      // Fetch journal entries for the current user only
      const { data: journalData, error: journalError } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      
      if (journalError) {
        console.error('Error fetching journal entries:', journalError);
      } else {
        setJournalEntries((journalData || []).map(entry => ({
          ...entry,
          type: 'journal'
        })));
      }
      
      setLoading(false);
    };

    fetchDataForMonth();
  }, [currentMonth]);

  // Update selected day items when date changes
  useEffect(() => {
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      
      const filteredEvents = events.filter(event => 
        event.date === formattedDate
      );
      
      const filteredJournalEntries = journalEntries.filter(entry => 
        entry.date === formattedDate
      );
      
      const allItems = [...filteredEvents, ...filteredJournalEntries];
      
      setSelectedDayItems(allItems);
    } else {
      setSelectedDayItems([]);
    }
  }, [selectedDate, events, journalEntries]);

  // Function to determine if a day has events or journal entries
  const getDayHasItems = (day: Date) => {
    const formattedDay = format(day, 'yyyy-MM-dd');
    return events.some(event => event.date === formattedDay) || 
           journalEntries.some(entry => entry.date === formattedDay);
  };

  // Filter items based on the active tab
  const getFilteredItems = () => {
    if (activeTab === "all") return selectedDayItems;
    if (activeTab === "events") return selectedDayItems.filter(item => item.type === 'event');
    if (activeTab === "journal") return selectedDayItems.filter(item => item.type === 'journal');
    return selectedDayItems;
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
      <h1 className="text-2xl font-bold mb-6">Calendar</h1>
      
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
              {selectedDayItems.length > 0 
                ? `${selectedDayItems.length} item${selectedDayItems.length > 1 ? 's' : ''} on ${selectedDate ? format(selectedDate, 'MMMM d, yyyy') : ''}`
                : `Select a date to view events and journal entries`}
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
                    hasItem: (date) => getDayHasItems(date),
                  }}
                  modifiersClassNames={{
                    hasItem: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary"
                  }}
                />
              </div>
            </div>
            
            {/* Display items for selected date */}
            {selectedDate && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-3">
                  Items on {format(selectedDate, 'MMMM d, yyyy')}
                </h3>
                
                <Tabs defaultValue="all" className="mb-4" onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="events">Events</TabsTrigger>
                    <TabsTrigger value="journal">Journal</TabsTrigger>
                  </TabsList>
                </Tabs>
                
                {loading ? (
                  <div className="flex items-center justify-center h-20">
                    <p className="text-muted-foreground">Loading...</p>
                  </div>
                ) : getFilteredItems().length > 0 ? (
                  <div className="space-y-4">
                    {getFilteredItems().map((item) => (
                      <div key={`${item.type}-${item.id}`} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">{item.title}</h3>
                            <div className="flex items-center text-sm text-muted-foreground mt-1">
                              {item.type === 'event' ? (
                                <>
                                  <CalendarIcon className="mr-1 h-4 w-4" />
                                  <span>
                                    {(item as Event).start_date === (item as Event).end_date 
                                      ? format(new Date(item.date), 'MMM d, yyyy')
                                      : `Influence: ${format(new Date((item as Event).start_date), 'MMM d')} - ${format(new Date((item as Event).end_date), 'MMM d, yyyy')}`}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <BookText className="mr-1 h-4 w-4" />
                                  <span>Journal Entry</span>
                                </>
                              )}
                            </div>
                            {item.type === 'journal' && (item as JournalEntry).content && (
                              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                {(item as JournalEntry).content}
                              </p>
                            )}
                          </div>
                          {item.type === 'event' && (item as Event).primary_event && (
                            <Badge variant="default" className="bg-primary">Primary</Badge>
                          )}
                        </div>
                        {item.type === 'event' && (item as Event).tags && (item as Event).tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {(item as Event).tags.map((tag, idx) => (
                              <Badge key={idx} variant="outline">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-20 text-center">
                    <p className="text-muted-foreground">No items found for this day.</p>
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

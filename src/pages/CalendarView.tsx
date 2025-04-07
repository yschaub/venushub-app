
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RelatedEvent {
  id: string;
  title: string;
  date: string;
}

const CalendarView: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [relatedEvents, setRelatedEvents] = useState<RelatedEvent[]>([]);
  const [loadingRelatedEvents, setLoadingRelatedEvents] = useState(false);
  
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });
      
      if (error) {
        console.error('Error fetching events:', error);
        return;
      }
      
      setEvents(data || []);
    } catch (error) {
      console.error('Error in fetchEvents:', error);
    } finally {
      setLoadingEvents(false);
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
        .select('id, title, date')
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

  const selectEvent = (event: any) => {
    setSelectedEvent(event);
    fetchRelatedEvents(event.id);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMMM d, yyyy');
  };

  const groupEventsByMonth = () => {
    const grouped: Record<string, any[]> = {};
    events.forEach(event => {
      const date = new Date(event.date);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(event);
    });
    return grouped;
  };

  const renderEventGroups = () => {
    const grouped = groupEventsByMonth();
    return Object.entries(grouped).map(([key, monthEvents]) => {
      const [year, month] = key.split('-').map(Number);
      const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
      return (
        <div key={key} className="mb-6">
          <h2 className="text-xl font-semibold mb-3">{`${monthName} ${year}`}</h2>
          <div className="space-y-2">
            {monthEvents.map(event => (
              <div 
                key={event.id} 
                className={`p-3 rounded-md cursor-pointer transition-colors ${selectedEvent?.id === event.id 
                  ? 'bg-primary/20 border-l-4 border-primary' 
                  : 'hover:bg-muted'}`}
                onClick={() => selectEvent(event)}
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">{event.title}</h3>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(event.date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Celestial Events Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <div className="flex justify-center p-6">
                  <p>Loading events...</p>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center p-6">
                  <p>No events found.</p>
                </div>
              ) : (
                <ScrollArea className="h-[70vh]">
                  {renderEventGroups()}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedEvent ? (
                <div className="text-center p-6 text-muted-foreground">
                  <p>Select an event to view details</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-bold">{selectedEvent.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(selectedEvent.date)}
                    </p>
                  </div>
                  
                  <div>
                    <Badge variant={selectedEvent.primary_event ? "default" : "outline"}>
                      {selectedEvent.primary_event ? 'Primary Event' : 'Secondary Event'}
                    </Badge>
                  </div>
                  
                  {selectedEvent.tags && selectedEvent.tags.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Tags:</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedEvent.tags.map((tag: string) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs bg-secondary/30"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Connected Events:</h3>
                    
                    {loadingRelatedEvents ? (
                      <p className="text-sm text-muted-foreground">Loading related events...</p>
                    ) : relatedEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No connected events.</p>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {relatedEvents.map(event => (
                          <div key={event.id} className="p-2 bg-muted rounded-sm">
                            <p className="font-medium text-sm">{event.title}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(event.date)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;

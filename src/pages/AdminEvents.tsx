import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Event {
    id: string;
    title: string;
    date: string;
    primary_event: boolean;
    tags: string[] | null;
    connectedEvents?: ConnectedEvent[];
    isExpanded?: boolean;
}

interface ConnectedEvent {
    id: string;
    title: string;
    date: string;
}

interface SystemTag {
    id: string;
    name: string;
    category: string;
}

const AdminEvents = () => {
    const [events, setEvents] = useState<Event[]>([]);
    const [tags, setTags] = useState<Record<string, SystemTag>>({});
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    
    const fetchEvents = async () => {
        try {
            setLoading(true);
            // Fetch all events sorted by date in ascending order
            const { data: eventsData, error: eventsError } = await supabase
                .from('events')
                .select('*')
                .order('date', { ascending: true });

            if (eventsError) {
                console.error('Error fetching events:', eventsError);
                toast({
                    variant: "destructive",
                    title: "Error fetching events",
                    description: eventsError.message
                });
                return;
            }

            // Collect all unique tag IDs across all events
            const tagIds = new Set<string>();
            eventsData?.forEach(event => {
                if (event.tags && event.tags.length > 0) {
                    event.tags.forEach(tagId => tagIds.add(tagId));
                }
            });

            // Fetch tag details if there are any tags
            if (tagIds.size > 0) {
                const { data: tagsData, error: tagsError } = await supabase
                    .from('system_tags')
                    .select('*')
                    .in('id', Array.from(tagIds));

                if (tagsError) {
                    console.error('Error fetching tags:', tagsError);
                    toast({
                        variant: "destructive",
                        title: "Error fetching tags",
                        description: tagsError.message
                    });
                } else {
                    // Create a map of tag ID to tag details
                    const tagsMap = {};
                    tagsData?.forEach(tag => {
                        tagsMap[tag.id] = tag;
                    });
                    setTags(tagsMap);
                }
            }

            // Convert DB events to our Event interface with empty connectedEvents arrays
            const typedEvents: Event[] = eventsData?.map(event => ({
                ...event,
                connectedEvents: [],
                isExpanded: false
            })) || [];

            // Fetch event relationships
            const { data: relationships, error: relationshipsError } = await supabase
                .from('event_relationships')
                .select('*');

            if (relationshipsError) {
                console.error('Error fetching event relationships:', relationshipsError);
                toast({
                    variant: "destructive",
                    title: "Error fetching relationships",
                    description: relationshipsError.message
                });
                setEvents(typedEvents);
            } else {
                // Create a map for quick lookups
                const eventsMap: Record<string, Event> = {};
                typedEvents.forEach(event => {
                    eventsMap[event.id] = event;
                });

                // Process relationships
                relationships?.forEach(rel => {
                    const event = eventsMap[rel.event_id];
                    const relatedEvent = eventsMap[rel.related_event_id];

                    if (event && relatedEvent) {
                        // Add related event to the event
                        event.connectedEvents?.push({
                            id: relatedEvent.id,
                            title: relatedEvent.title,
                            date: relatedEvent.date
                        });

                        // Add event to the related event (bi-directional relationship)
                        // Check if this relationship already exists in the opposite direction
                        const alreadyConnected = relatedEvent.connectedEvents?.some(
                            ce => ce.id === event.id
                        );

                        if (!alreadyConnected) {
                            relatedEvent.connectedEvents?.push({
                                id: event.id,
                                title: event.title,
                                date: event.date
                            });
                        }
                    }
                });

                // Sort connected events by date
                Object.values(eventsMap).forEach(event => {
                    event.connectedEvents?.sort((a, b) => 
                        new Date(a.date).getTime() - new Date(b.date).getTime()
                    );
                });

                setEvents(Object.values(eventsMap));
            }
        } catch (error) {
            console.error('Error in fetchEvents:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load events"
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const toggleExpand = (eventId: string) => {
        setEvents(events.map(event => 
            event.id === eventId 
                ? { ...event, isExpanded: !event.isExpanded } 
                : event
        ));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-muted-foreground">Loading events...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-10">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">All Events</h1>
                <Button 
                    variant="outline"
                    size="sm"
                    onClick={fetchEvents}
                    className="flex items-center gap-1"
                >
                    <Calendar className="h-4 w-4" />
                    Refresh Events
                </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Event Title</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Tags</TableHead>
                            <TableHead>Connected Events</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.map((event) => (
                            <React.Fragment key={event.id}>
                                <TableRow 
                                    className={cn(
                                        "cursor-pointer hover:bg-muted/80",
                                        event.isExpanded && "bg-muted/50"
                                    )}
                                    onClick={() => toggleExpand(event.id)}
                                >
                                    <TableCell className="px-2">
                                        {event.connectedEvents && event.connectedEvents.length > 0 ? (
                                            event.isExpanded ? 
                                                <ChevronDown className="h-4 w-4 text-muted-foreground" /> :
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <span className="w-4 block"></span>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">{event.title}</TableCell>
                                    <TableCell>{format(new Date(event.date), 'MMMM d, yyyy')}</TableCell>
                                    <TableCell>
                                        <Badge variant={event.primary_event ? "default" : "outline"}>
                                            {event.primary_event ? 'Primary' : 'Secondary'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1.5">
                                            {event.tags?.map((tagId) => (
                                                <Badge
                                                    key={tagId}
                                                    variant="outline"
                                                    className={cn(
                                                        "border-0 text-xs rounded-md px-2 py-0.5",
                                                        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                                                    )}
                                                >
                                                    {tags[tagId]?.name || tagId}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">
                                            {event.connectedEvents?.length || 0} connected events
                                        </span>
                                    </TableCell>
                                </TableRow>
                                {event.isExpanded && event.connectedEvents && event.connectedEvents.length > 0 && (
                                    <TableRow className="bg-muted/30">
                                        <TableCell colSpan={6} className="p-0">
                                            <div className="p-4">
                                                <h4 className="text-sm font-semibold mb-2">Connected Events:</h4>
                                                <ul className="space-y-2 pl-6">
                                                    {event.connectedEvents.map(connectedEvent => (
                                                        <li key={connectedEvent.id} className="flex items-center justify-between">
                                                            <span className="text-sm">{connectedEvent.title}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {format(new Date(connectedEvent.date), 'MMM d, yyyy')}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default AdminEvents;

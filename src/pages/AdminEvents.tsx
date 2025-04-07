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
import { ChevronDown, ChevronRight, Calendar, Trash2, Search, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Event {
    id: string;
    title: string;
    date: string;
    start_date: string;
    end_date: string;
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
    const [allEvents, setAllEvents] = useState<Event[]>([]); // Store all events for filtering
    const [tags, setTags] = useState<Record<string, SystemTag>>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
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

                // Set both events and allEvents when fetching
                const finalEvents = Object.values(eventsMap);
                setAllEvents(finalEvents);
                setEvents(finalEvents);
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

    // Filter events based on search query
    useEffect(() => {
        if (!searchQuery.trim()) {
            setEvents(allEvents);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = allEvents.filter(event => {
            const titleMatch = event.title.toLowerCase().includes(query);
            const dateMatch = format(new Date(event.date), 'MMMM d, yyyy').toLowerCase().includes(query);
            return titleMatch || dateMatch;
        });
        setEvents(filtered);
    }, [searchQuery, allEvents]);

    const toggleExpand = (eventId: string) => {
        setEvents(events.map(event =>
            event.id === eventId
                ? { ...event, isExpanded: !event.isExpanded }
                : event
        ));
    };

    const removeConnection = async (eventId: string, connectedEventId: string) => {
        try {
            // Delete the relationship from the database
            const { error } = await supabase
                .from('event_relationships')
                .delete()
                .or(`and(event_id.eq.${eventId},related_event_id.eq.${connectedEventId}),and(event_id.eq.${connectedEventId},related_event_id.eq.${eventId})`);

            if (error) {
                throw error;
            }

            // Update the UI in real-time
            setEvents(prevEvents => {
                return prevEvents.map(event => {
                    if (event.id === eventId || event.id === connectedEventId) {
                        return {
                            ...event,
                            connectedEvents: event.connectedEvents?.filter(
                                ce => ce.id !== (event.id === eventId ? connectedEventId : eventId)
                            )
                        };
                    }
                    return event;
                });
            });

            toast({
                title: "Success",
                description: "Connection removed successfully",
            });
        } catch (error) {
            console.error('Error removing connection:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to remove connection",
            });
        }
    };

    const addConnection = async (eventId: string, connectedEventId: string) => {
        try {
            // Check if connection already exists
            const existingConnections = events.find(e => e.id === eventId)?.connectedEvents;
            if (existingConnections?.some(ce => ce.id === connectedEventId)) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "These events are already connected",
                });
                return;
            }

            // Add the relationship to the database
            const { error } = await supabase
                .from('event_relationships')
                .insert([
                    { event_id: eventId, related_event_id: connectedEventId },
                    { event_id: connectedEventId, related_event_id: eventId }
                ]);

            if (error) {
                throw error;
            }

            // Update the UI in real-time
            setEvents(prevEvents => {
                return prevEvents.map(event => {
                    if (event.id === eventId || event.id === connectedEventId) {
                        const otherEvent = prevEvents.find(e => e.id === (event.id === eventId ? connectedEventId : eventId));
                        if (otherEvent) {
                            return {
                                ...event,
                                connectedEvents: [
                                    ...(event.connectedEvents || []),
                                    {
                                        id: otherEvent.id,
                                        title: otherEvent.title,
                                        date: otherEvent.date
                                    }
                                ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                            };
                        }
                    }
                    return event;
                });
            });

            toast({
                title: "Success",
                description: "Connection added successfully",
            });
        } catch (error) {
            console.error('Error adding connection:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to add connection",
            });
        }
    };

    const clearSearch = () => {
        setSearchQuery("");
        setEvents(allEvents);
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
            <div className="relative mb-6">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search events by title or date..."
                    className="pl-8 pr-8 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6"
                        onClick={clearSearch}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
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
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="text-sm font-semibold">Connected Events:</h4>
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8"
                                                                onClick={() => setSelectedEvent(event)}
                                                            >
                                                                <Plus className="h-4 w-4 mr-2" />
                                                                Add Connection
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Add Connection</DialogTitle>
                                                                <DialogDescription>
                                                                    Search for an event to connect with "{event.title}"
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="relative">
                                                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                                <Input
                                                                    placeholder="Search events..."
                                                                    className="pl-8"
                                                                    value={searchQuery}
                                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                                />
                                                            </div>
                                                            <ScrollArea className="h-[200px]">
                                                                <div className="space-y-2">
                                                                    {events.map(ev => (
                                                                        <div
                                                                            key={ev.id}
                                                                            className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                                                                            onClick={() => {
                                                                                addConnection(event.id, ev.id);
                                                                                setSearchQuery("");
                                                                            }}
                                                                        >
                                                                            <span>{ev.title}</span>
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {format(new Date(ev.date), 'MMM d, yyyy')}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </ScrollArea>
                                                            <DialogFooter>
                                                                <Button
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        setSearchQuery("");
                                                                        setSelectedEvent(null);
                                                                    }}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                </div>
                                                <ul className="space-y-2 pl-6">
                                                    {event.connectedEvents.map(connectedEvent => (
                                                        <li key={connectedEvent.id} className="flex items-center justify-between">
                                                            <span className="text-sm">{connectedEvent.title}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs text-muted-foreground">
                                                                    {format(new Date(connectedEvent.date), 'MMM d, yyyy')}
                                                                </span>
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6"
                                                                        >
                                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                                        </Button>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Remove Connection</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                Are you sure you want to remove the connection between "{event.title}" and "{connectedEvent.title}"? This action cannot be undone.
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                            <AlertDialogAction
                                                                                onClick={() => removeConnection(event.id, connectedEvent.id)}
                                                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                            >
                                                                                Remove Connection
                                                                            </AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </div>
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

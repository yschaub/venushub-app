import React, { useState, useEffect, useRef } from 'react';
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
import { Switch } from "@/components/ui/switch";

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
    const [allEvents, setAllEvents] = useState<Event[]>([]); // Store all events for filtering
    const [tags, setTags] = useState<Record<string, SystemTag>>({});
    const [allSystemTags, setAllSystemTags] = useState<SystemTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [connectionModalSearch, setConnectionModalSearch] = useState("");
    const [deleteModalSearch, setDeleteModalSearch] = useState("");
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [selectedEventForConnection, setSelectedEventForConnection] = useState<Event | null>(null);
    const [tagSearchQuery, setTagSearchQuery] = useState("");
    const [tempSelectedTags, setTempSelectedTags] = useState<string[]>([]);
    const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
    const [isDeleteEventModalOpen, setIsDeleteEventModalOpen] = useState(false);
    const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
    const newEventTitleRef = useRef<HTMLInputElement>(null);
    const newEventDateRef = useRef<HTMLInputElement>(null);
    const newEventPrimaryRef = useRef<HTMLInputElement>(null);
    const [newEventTags, setNewEventTags] = useState<string[]>([]);
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

            // Fetch all system tags at once
            const { data: allTagsData, error: tagsError } = await supabase
                .from('system_tags')
                .select('*')
                .order('name');

            if (tagsError) {
                console.error('Error fetching tags:', tagsError);
                toast({
                    variant: "destructive",
                    title: "Error fetching tags",
                    description: tagsError.message
                });
            } else {
                // Create a map of tag ID to tag details
                const tagsMap: Record<string, SystemTag> = {};
                allTagsData?.forEach(tag => {
                    tagsMap[tag.id] = tag;
                });
                setTags(tagsMap);
            }

            // Convert DB events to our Event interface with empty connectedEvents arrays
            const typedEvents: Event[] = eventsData?.map(event => ({
                id: event.id,
                title: event.title,
                date: event.date,
                primary_event: event.primary_event,
                tags: event.tags,
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

    const fetchSystemTags = async () => {
        try {
            const { data: tagsData, error: tagsError } = await supabase
                .from('system_tags')
                .select('*')
                .order('name');

            if (tagsError) {
                console.error('Error fetching system tags:', tagsError);
                toast({
                    variant: "destructive",
                    title: "Error fetching tags",
                    description: tagsError.message
                });
                return;
            }

            setAllSystemTags(tagsData || []);
        } catch (error) {
            console.error('Error in fetchSystemTags:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to load system tags"
            });
        }
    };

    const updateEventTags = async (eventId: string, newTags: string[]) => {
        try {
            const { error } = await supabase
                .from('events')
                .update({ tags: newTags })
                .eq('id', eventId);

            if (error) {
                throw error;
            }

            setEvents(prevEvents =>
                prevEvents.map(event =>
                    event.id === eventId
                        ? { ...event, tags: newTags }
                        : event
                )
            );

            toast({
                title: "Success",
                description: "Tags updated successfully"
            });
        } catch (error) {
            console.error('Error updating event tags:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update tags"
            });
        }
    };

    const handleNewEventSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEventTitleRef.current || !newEventDateRef.current) return;

        try {
            const { data, error } = await supabase
                .from('events')
                .insert([{
                    title: newEventTitleRef.current.value,
                    date: newEventDateRef.current.value,
                    primary_event: newEventPrimaryRef.current?.checked || false,
                    tags: newEventTags,
                }])
                .select()
                .single();

            if (error) {
                throw error;
            }

            // Add the new event to the list
            const newEventData: Event = {
                id: data.id,
                title: data.title,
                date: data.date,
                primary_event: data.primary_event,
                tags: data.tags,
                connectedEvents: [],
                isExpanded: false
            };

            setEvents(prevEvents => [...prevEvents, newEventData]);
            setAllEvents(prevEvents => [...prevEvents, newEventData]);

            // Reset the form
            if (newEventTitleRef.current) newEventTitleRef.current.value = '';
            if (newEventDateRef.current) newEventDateRef.current.value = '';
            if (newEventPrimaryRef.current) newEventPrimaryRef.current.checked = false;
            setNewEventTags([]);
            setIsNewEventModalOpen(false);

            toast({
                title: "Success",
                description: "Event created successfully"
            });
        } catch (error) {
            console.error('Error creating event:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to create event"
            });
        }
    };

    const deleteEvent = async () => {
        if (!eventToDelete) return;

        try {
            // First delete all relationships
            const { error: relationshipsError } = await supabase
                .from('event_relationships')
                .delete()
                .or(`event_id.eq.${eventToDelete.id},related_event_id.eq.${eventToDelete.id}`);

            if (relationshipsError) {
                throw relationshipsError;
            }

            // Then delete the event
            const { error: eventError } = await supabase
                .from('events')
                .delete()
                .eq('id', eventToDelete.id);

            if (eventError) {
                throw eventError;
            }

            // Update local state
            setEvents(prevEvents => prevEvents.filter(event => event.id !== eventToDelete.id));
            setAllEvents(prevEvents => prevEvents.filter(event => event.id !== eventToDelete.id));

            // Reset state
            setEventToDelete(null);
            setIsDeleteEventModalOpen(false);
            setSearchQuery("");

            toast({
                title: "Success",
                description: "Event deleted successfully"
            });
        } catch (error) {
            console.error('Error deleting event:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to delete event"
            });
        }
    };

    const handleEventTypeChange = async (eventId: string, newType: boolean) => {
        try {
            const { error } = await supabase
                .from('events')
                .update({ primary_event: newType })
                .eq('id', eventId);

            if (error) {
                throw error;
            }

            // Update the local state
            setEvents(prevEvents =>
                prevEvents.map(event =>
                    event.id === eventId
                        ? { ...event, primary_event: newType }
                        : event
                )
            );
            setAllEvents(prevEvents =>
                prevEvents.map(event =>
                    event.id === eventId
                        ? { ...event, primary_event: newType }
                        : event
                )
            );

            toast({
                title: "Success",
                description: "Event type updated successfully"
            });
        } catch (error) {
            console.error('Error updating event type:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update event type"
            });
        }
    };

    useEffect(() => {
        fetchEvents();
        fetchSystemTags();
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

    // Filter events for connection modal
    const getFilteredEventsForConnection = () => {
        const currentEvent = selectedEventForConnection || selectedEvent;
        if (!currentEvent) return [];

        const query = connectionModalSearch.trim().toLowerCase();
        const currentEventId = currentEvent.id;

        return allEvents.filter(event => {
            // Always exclude the current event
            if (event.id === currentEventId) return false;

            // If no search query, return all other events
            if (!query) return true;

            // Filter based on search query
            const titleMatch = event.title.toLowerCase().includes(query);
            const dateMatch = format(new Date(event.date), 'MMMM d, yyyy').toLowerCase().includes(query);
            return titleMatch || dateMatch;
        });
    };

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

    const filteredTags = allSystemTags.filter(tag =>
        tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase()) ||
        tag.category.toLowerCase().includes(tagSearchQuery.toLowerCase())
    );

    const handleOpenTagDialog = (event: Event) => {
        setSelectedEvent(event);
        setTempSelectedTags(event.tags || []);
        setTagSearchQuery("");
    };

    const handleSaveTags = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent row expansion
        if (!selectedEvent) return;

        try {
            const { error } = await supabase
                .from('events')
                .update({ tags: tempSelectedTags })
                .eq('id', selectedEvent.id);

            if (error) {
                throw error;
            }

            setEvents(prevEvents =>
                prevEvents.map(event =>
                    event.id === selectedEvent.id
                        ? { ...event, tags: tempSelectedTags }
                        : event
                )
            );

            toast({
                title: "Success",
                description: "Tags updated successfully"
            });
        } catch (error) {
            console.error('Error updating event tags:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to update tags"
            });
        } finally {
            setSelectedEvent(null);
            setTempSelectedTags([]);
        }
    };

    // Filter events for delete modal
    const getFilteredEventsForDelete = () => {
        if (!deleteModalSearch.trim()) {
            return allEvents;
        }

        const query = deleteModalSearch.toLowerCase();
        return allEvents.filter(event => {
            const titleMatch = event.title.toLowerCase().includes(query);
            const dateMatch = format(new Date(event.date), 'MMMM d, yyyy').toLowerCase().includes(query);
            return titleMatch || dateMatch;
        });
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
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchEvents}
                        className="flex items-center gap-1"
                    >
                        <Calendar className="h-4 w-4" />
                        Refresh Events
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsDeleteEventModalOpen(true)}
                        className="flex items-center gap-1"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete an Event
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => setIsNewEventModalOpen(true)}
                        className="flex items-center gap-1"
                    >
                        <Plus className="h-4 w-4" />
                        Add New Event
                    </Button>
                </div>
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
                                        "hover:bg-muted/80",
                                        event.isExpanded && "bg-muted/50"
                                    )}
                                >
                                    <TableCell className="px-2">
                                        {event.connectedEvents && event.connectedEvents.length > 0 ? (
                                            <button
                                                onClick={() => toggleExpand(event.id)}
                                                className="hover:bg-muted/80 p-1 rounded"
                                            >
                                                {event.isExpanded ?
                                                    <ChevronDown className="h-4 w-4 text-muted-foreground" /> :
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                            </button>
                                        ) : (
                                            <span className="w-4 block"></span>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">{event.title}</TableCell>
                                    <TableCell>{format(new Date(event.date), 'MMMM d, yyyy')}</TableCell>
                                    <TableCell>
                                        <Button
                                            variant={event.primary_event ? "default" : "outline"}
                                            size="sm"
                                            className="h-6 px-2 text-xs"
                                            onClick={() => handleEventTypeChange(event.id, !event.primary_event)}
                                        >
                                            {event.primary_event ? 'Primary' : 'Secondary'}
                                        </Button>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                            {event.tags && event.tags.length > 0 ? (
                                                <>
                                                    {event.tags.map((tagId) => (
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
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-xs text-muted-foreground"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleOpenTagDialog(event);
                                                                }}
                                                            >
                                                                Edit tags
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent onClick={(e) => e.stopPropagation()} className="max-w-2xl">
                                                            <DialogHeader>
                                                                <DialogTitle>Manage Tags for {event.title}</DialogTitle>
                                                                <DialogDescription>
                                                                    Select or search for tags to add to this event
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="space-y-4">
                                                                <div className="relative">
                                                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                                    <Input
                                                                        placeholder="Search tags by name or category..."
                                                                        className="pl-8"
                                                                        value={tagSearchQuery}
                                                                        onChange={(e) => setTagSearchQuery(e.target.value)}
                                                                    />
                                                                </div>
                                                                <ScrollArea className="h-[400px] pr-4">
                                                                    <div className="grid gap-2">
                                                                        {filteredTags.map((tag) => (
                                                                            <div
                                                                                key={tag.id}
                                                                                className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const newTags = tempSelectedTags.includes(tag.id)
                                                                                        ? tempSelectedTags.filter(id => id !== tag.id)
                                                                                        : [...tempSelectedTags, tag.id];
                                                                                    setTempSelectedTags(newTags);
                                                                                }}
                                                                            >
                                                                                <input
                                                                                    type="checkbox"
                                                                                    id={`tag-${tag.id}`}
                                                                                    checked={tempSelectedTags.includes(tag.id)}
                                                                                    readOnly
                                                                                    className="h-4 w-4 rounded border-gray-300 pointer-events-none"
                                                                                />
                                                                                <div className="flex flex-col flex-1">
                                                                                    <span className="text-sm font-medium">
                                                                                        {tag.name}
                                                                                    </span>
                                                                                    <span className="text-xs text-muted-foreground">
                                                                                        {tag.category}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </ScrollArea>
                                                            </div>
                                                            <DialogFooter>
                                                                <Button
                                                                    variant="outline"
                                                                    onClick={() => {
                                                                        setSelectedEvent(null);
                                                                        setTempSelectedTags([]);
                                                                    }}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                                <Button onClick={handleSaveTags}>
                                                                    Save Changes
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                </>
                                            ) : (
                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 px-2 text-xs text-muted-foreground"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenTagDialog(event);
                                                            }}
                                                        >
                                                            Add tags
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent onClick={(e) => e.stopPropagation()}>
                                                        <DialogHeader>
                                                            <DialogTitle>Manage Tags for {event.title}</DialogTitle>
                                                            <DialogDescription>
                                                                Select or search for tags to add to this event
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="space-y-4">
                                                            <div className="relative">
                                                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                                <Input
                                                                    placeholder="Search tags by name or category..."
                                                                    className="pl-8"
                                                                    value={tagSearchQuery}
                                                                    onChange={(e) => setTagSearchQuery(e.target.value)}
                                                                />
                                                            </div>
                                                            <ScrollArea className="h-[400px] pr-4">
                                                                <div className="grid gap-2">
                                                                    {filteredTags.map((tag) => (
                                                                        <div
                                                                            key={tag.id}
                                                                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const newTags = tempSelectedTags.includes(tag.id)
                                                                                    ? tempSelectedTags.filter(id => id !== tag.id)
                                                                                    : [...tempSelectedTags, tag.id];
                                                                                setTempSelectedTags(newTags);
                                                                            }}
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                id={`tag-${tag.id}`}
                                                                                checked={tempSelectedTags.includes(tag.id)}
                                                                                readOnly
                                                                                className="h-4 w-4 rounded border-gray-300 pointer-events-none"
                                                                            />
                                                                            <div className="flex flex-col flex-1">
                                                                                <span className="text-sm font-medium">
                                                                                    {tag.name}
                                                                                </span>
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    {tag.category}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </ScrollArea>
                                                        </div>
                                                        <DialogFooter>
                                                            <Button
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setSelectedEvent(null);
                                                                    setTempSelectedTags([]);
                                                                }}
                                                            >
                                                                Cancel
                                                            </Button>
                                                            <Button onClick={handleSaveTags}>
                                                                Save Changes
                                                            </Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">
                                            {event.connectedEvents && event.connectedEvents.length > 0 ? (
                                                <button
                                                    onClick={() => toggleExpand(event.id)}
                                                    className="hover:underline hover:text-muted-foreground"
                                                >
                                                    {`${event.connectedEvents.length} connected events`}
                                                </button>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 px-2 text-xs text-muted-foreground"
                                                    onClick={() => {
                                                        setSelectedEventForConnection(event);
                                                        setSearchQuery("");
                                                    }}
                                                >
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    Add connection
                                                </Button>
                                            )}
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
                                                                onClick={() => {
                                                                    setSelectedEventForConnection(event);
                                                                    setConnectionModalSearch("");
                                                                }}
                                                            >
                                                                <Plus className="h-4 w-4 mr-2" />
                                                                Add Connection
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Add Connection</DialogTitle>
                                                                <DialogDescription>
                                                                    Search for an event to connect with "{selectedEventForConnection?.title || selectedEvent?.title}"
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="relative">
                                                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                                <Input
                                                                    placeholder="Search events..."
                                                                    className="pl-8"
                                                                    value={connectionModalSearch}
                                                                    onChange={(e) => setConnectionModalSearch(e.target.value)}
                                                                />
                                                            </div>
                                                            <ScrollArea className="h-[200px]">
                                                                <div className="space-y-2">
                                                                    {getFilteredEventsForConnection().map(ev => (
                                                                        <div
                                                                            key={ev.id}
                                                                            className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                                                                            onClick={() => {
                                                                                if (selectedEventForConnection) {
                                                                                    addConnection(selectedEventForConnection.id, ev.id);
                                                                                    setConnectionModalSearch("");
                                                                                    setSelectedEventForConnection(null);
                                                                                }
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
                                                                        setConnectionModalSearch("");
                                                                        setSelectedEventForConnection(null);
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

            {/* Add Connection Dialog */}
            <Dialog open={selectedEventForConnection !== null} onOpenChange={(open) => {
                if (!open) {
                    setSelectedEventForConnection(null);
                    setConnectionModalSearch("");
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Connection</DialogTitle>
                        <DialogDescription>
                            Search for an event to connect with "{selectedEventForConnection?.title || selectedEvent?.title}"
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search events..."
                            className="pl-8"
                            value={connectionModalSearch}
                            onChange={(e) => setConnectionModalSearch(e.target.value)}
                        />
                    </div>
                    <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                            {getFilteredEventsForConnection().map(ev => (
                                <div
                                    key={ev.id}
                                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                                    onClick={() => {
                                        if (selectedEventForConnection) {
                                            addConnection(selectedEventForConnection.id, ev.id);
                                            setSelectedEventForConnection(null);
                                            setConnectionModalSearch("");
                                        }
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
                                setSelectedEventForConnection(null);
                                setConnectionModalSearch("");
                            }}
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add New Event Modal */}
            <Dialog open={isNewEventModalOpen} onOpenChange={setIsNewEventModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create New Event</DialogTitle>
                        <DialogDescription>
                            Fill in the details to create a new event
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleNewEventSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Event Title</label>
                            <input
                                type="text"
                                ref={newEventTitleRef}
                                placeholder="Enter event title"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Event Date</label>
                            <input
                                type="date"
                                ref={newEventDateRef}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                required
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                ref={newEventPrimaryRef}
                                id="primary_event"
                                className="h-4 w-4 rounded border-gray-300"
                            />
                            <label htmlFor="primary_event" className="text-sm font-medium">
                                Primary Event
                            </label>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tags</label>
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search tags..."
                                    className="pl-8"
                                    value={tagSearchQuery}
                                    onChange={(e) => setTagSearchQuery(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="h-[200px] pr-4">
                                <div className="grid gap-2">
                                    {filteredTags.map((tag) => (
                                        <div
                                            key={tag.id}
                                            className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                                            onClick={() => {
                                                setNewEventTags(prev =>
                                                    prev.includes(tag.id)
                                                        ? prev.filter(id => id !== tag.id)
                                                        : [...prev, tag.id]
                                                );
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                id={`tag-${tag.id}`}
                                                checked={newEventTags.includes(tag.id)}
                                                readOnly
                                                className="h-4 w-4 rounded border-gray-300 pointer-events-none"
                                            />
                                            <div className="flex flex-col flex-1">
                                                <span className="text-sm font-medium">
                                                    {tag.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {tag.category}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsNewEventModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit">
                                Create Event
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Event Dialog */}
            <Dialog open={isDeleteEventModalOpen} onOpenChange={setIsDeleteEventModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Event</DialogTitle>
                        <DialogDescription>
                            Search for an event to delete. This action will permanently remove the event and all its relationships.
                            <div className="mt-2 p-3 bg-destructive/10 text-destructive rounded-md">
                                <p className="font-medium">⚠️ Proceed with extreme caution!</p>
                                <p className="text-sm mt-1">
                                    Users will no longer be able to journal about this event, and the only way to find their journal entries will be via the "Journal Entries" section.
                                </p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search events..."
                            className="pl-8"
                            value={deleteModalSearch}
                            onChange={(e) => setDeleteModalSearch(e.target.value)}
                        />
                    </div>
                    <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                            {getFilteredEventsForDelete().map(ev => (
                                <div
                                    key={ev.id}
                                    className={cn(
                                        "flex items-center justify-between p-2 rounded-md cursor-pointer",
                                        eventToDelete?.id === ev.id
                                            ? "bg-destructive/10 text-destructive"
                                            : "hover:bg-muted"
                                    )}
                                    onClick={() => setEventToDelete(ev)}
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
                                setEventToDelete(null);
                                setIsDeleteEventModalOpen(false);
                                setDeleteModalSearch("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={deleteEvent}
                            disabled={!eventToDelete}
                        >
                            Delete Event
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminEvents;

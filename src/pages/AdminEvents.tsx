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

interface Event {
    id: string;
    title: string;
    date: string;
    start_date: string;
    end_date: string;
    primary_event: boolean;
    tags: string[] | null;
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

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                // Fetch all events sorted by date in ascending order
                const { data: eventsData, error: eventsError } = await supabase
                    .from('events')
                    .select('*')
                    .order('date', { ascending: true });

                if (eventsError) {
                    console.error('Error fetching events:', eventsError);
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
                    } else {
                        // Create a map of tag ID to tag details
                        const tagsMap = {};
                        tagsData?.forEach(tag => {
                            tagsMap[tag.id] = tag;
                        });
                        setTags(tagsMap);
                    }
                }

                setEvents(eventsData || []);
            } catch (error) {
                console.error('Error in fetchEvents:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-muted-foreground">Loading events...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-10">
            <h1 className="text-2xl font-bold mb-6">All Events</h1>
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Event Title</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Tags</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.map((event) => (
                            <TableRow key={event.id}>
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
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default AdminEvents; 
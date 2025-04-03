
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RelatedEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
}

export const fetchRelatedEvents = async (eventId: string) => {
  const { data: relationships, error: relationshipsError } = await supabase
    .from('event_relationships')
    .select('related_event_id')
    .eq('event_id', eventId);

  if (relationshipsError) {
    console.error('Error fetching event relationships:', relationshipsError);
    throw new Error('Failed to load event relationships');
  }

  const { data: inverseRelationships, error: inverseError } = await supabase
    .from('event_relationships')
    .select('event_id')
    .eq('related_event_id', eventId);

  if (inverseError) {
    console.error('Error fetching inverse event relationships:', inverseError);
    throw new Error('Failed to load inverse event relationships');
  }

  const relatedEventIds = [
    ...(relationships?.map(rel => rel.related_event_id) || []),
    ...(inverseRelationships?.map(rel => rel.event_id) || [])
  ];

  if (relatedEventIds.length === 0) {
    return [];
  }

  const { data: relatedEventsData, error: relatedEventsError } = await supabase
    .from('events')
    .select('id, title, start_date, end_date')
    .in('id', relatedEventIds);

  if (relatedEventsError) {
    console.error('Error fetching related events:', relatedEventsError);
    throw new Error('Failed to load related events');
  }

  return relatedEventsData || [];
};

export const useRelatedEvents = (eventId: string | undefined) => {
  return useQuery({
    queryKey: ['related-events', eventId],
    queryFn: () => fetchRelatedEvents(eventId!),
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

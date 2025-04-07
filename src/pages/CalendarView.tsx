
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

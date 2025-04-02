
const handleJournalAction = (e: React.MouseEvent) => {
  e.stopPropagation();

  if (!currentUser) {
    navigate('/auth');
    return;
  }

  if (selectedEvent?.hasJournal && selectedEvent?.journalId) {
    navigate(`/dashboard/journal/${selectedEvent.journalId}/edit`);
  } else if (selectedEvent) {
    navigate('/dashboard/journal/create', {
      state: {
        eventData: {
          id: selectedEvent.id,
          title: selectedEvent.title,
          tags: selectedEvent.tags || [],
          date: selectedEvent.eventDate || format(selectedEvent.start, 'yyyy-MM-dd') // Use saved eventDate if available
        }
      }
    });
  }
};

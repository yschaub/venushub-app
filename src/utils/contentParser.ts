/**
 * Parses HTML content to format annotations for display
 */
export const parseContent = (content: string) => {
    if (!content) return { content: '', annotations: [] };

    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const annotations: any[] = [];

    // Find all marks with annotation data attributes
    doc.querySelectorAll('mark[data-type="annotation"]').forEach(mark => {
        const id = mark.getAttribute('data-id') || '';
        const annotationContent = mark.getAttribute('data-content') || '';
        const selectedText = mark.textContent || '';
        const createdAt = mark.getAttribute('data-created-at') || '';

        // Create a new mark element with tooltip trigger
        const highlightMark = doc.createElement('mark');
        highlightMark.className = 'bg-yellow-100 dark:bg-yellow-900/30 px-0.5 rounded cursor-help hover:bg-yellow-200 dark:hover:bg-yellow-800/50 transition-colors';
        highlightMark.setAttribute('data-annotation-ref', id);
        highlightMark.setAttribute('data-content', annotationContent);
        highlightMark.setAttribute('data-created-at', createdAt);
        highlightMark.textContent = selectedText;

        // Replace the original mark with our highlighted version
        mark.replaceWith(highlightMark);

        annotations.push({
            id,
            content: annotationContent,
            selectedText,
            created_at: createdAt
        });
    });

    // Get the content with our highlight marks
    const cleanContent = doc.body.innerHTML;

    return {
        content: cleanContent,
        annotations
    };
}; 
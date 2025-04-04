import React, { useRef, useEffect } from 'react';
import { format } from 'date-fns';

interface AnnotationTooltipProps {
    hoveredAnnotation: {
        element: HTMLElement;
        content: string;
        created_at: string;
    } | null;
}

const AnnotationTooltip: React.FC<AnnotationTooltipProps> = ({ hoveredAnnotation }) => {
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!hoveredAnnotation || !tooltipRef.current) return;

        const updatePosition = () => {
            const rect = hoveredAnnotation.element.getBoundingClientRect();
            const tooltipHeight = tooltipRef.current!.offsetHeight;

            // Position the tooltip above the annotation
            const left = rect.left + window.scrollX;
            const top = rect.top + window.scrollY - tooltipHeight - 10; // 10px offset

            Object.assign(tooltipRef.current!.style, {
                left: `${left}px`,
                top: `${top}px`,
            });
        };

        updatePosition();
        window.addEventListener('scroll', updatePosition, { passive: true });
        window.addEventListener('resize', updatePosition, { passive: true });

        return () => {
            window.removeEventListener('scroll', updatePosition);
            window.removeEventListener('resize', updatePosition);
        };
    }, [hoveredAnnotation]);

    if (!hoveredAnnotation) return null;

    const date = new Date(hoveredAnnotation.created_at);
    const formattedDate = format(date, 'PPP p');

    return (
        <div
            ref={tooltipRef}
            className="fixed z-50 p-3 rounded-md bg-popover shadow-md w-72 text-sm"
            style={{ pointerEvents: 'none' }}
        >
            <div className="font-medium mb-1">Annotation</div>
            <div className="mb-2">{hoveredAnnotation.content}</div>
            <div className="text-xs text-muted-foreground">{formattedDate}</div>
        </div>
    );
};

export default AnnotationTooltip; 
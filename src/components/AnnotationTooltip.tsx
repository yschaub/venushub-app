import React, { useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

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
            // Get the position of the annotated text
            const rect = hoveredAnnotation.element.getBoundingClientRect();
            const tooltipHeight = tooltipRef.current!.offsetHeight;
            const tooltipWidth = tooltipRef.current!.offsetWidth;

            // Calculate top position (above the annotation)
            let top = rect.top - tooltipHeight - 10; // 10px offset

            // If tooltip would go off the top of the viewport, position it below the annotation
            if (top < 0) {
                top = rect.bottom + 10;
            }

            // Calculate left position (centered on the annotation)
            let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);

            // Make sure tooltip doesn't go off the sides of the viewport
            const rightEdge = left + tooltipWidth;
            const viewportWidth = window.innerWidth;

            if (left < 10) {
                left = 10; // 10px from left edge
            } else if (rightEdge > viewportWidth - 10) {
                left = viewportWidth - tooltipWidth - 10; // 10px from right edge
            }

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

    return (
        <div
            ref={tooltipRef}
            className="fixed z-50 p-3 rounded-md bg-popover shadow-md w-72 text-sm"
            style={{ pointerEvents: 'none' }}
        >
            <div className="mb-2">{hoveredAnnotation.content}</div>
            <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(hoveredAnnotation.created_at), { addSuffix: true })}
            </div>
        </div>
    );
};

export default AnnotationTooltip; 
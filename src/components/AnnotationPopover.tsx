import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface AnnotationPopoverProps {
    selectedText: string;
    annotationContent: string;
    onAnnotationChange: (content: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    position: { x: number; y: number } | null;
}

const AnnotationPopover: React.FC<AnnotationPopoverProps> = ({
    selectedText,
    annotationContent,
    onAnnotationChange,
    onSubmit,
    onCancel,
    position,
}) => {
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    useEffect(() => {
        if (!position) {
            setAdjustedPosition(null);
            return;
        }

        // Adjust position to ensure popover stays within viewport
        const popoverWidth = 300;
        const popoverHeight = 250; // Approximate height
        const padding = 10;

        let x = position.x;
        let y = position.y;

        // Check right edge
        if (x + popoverWidth > window.innerWidth - padding) {
            x = window.innerWidth - popoverWidth - padding;
        }

        // Check left edge
        if (x < padding) {
            x = padding;
        }

        // Check if popover would go above viewport
        if (y < popoverHeight + padding) {
            // Position below selection instead
            y = y + 20;
        }

        setAdjustedPosition({ x, y });
    }, [position]);

    if (!adjustedPosition) return null;

    return (
        <div
            className="fixed z-50 w-[300px] bg-popover text-popover-foreground shadow-md rounded-lg border annotation-popover"
            style={{
                top: `${adjustedPosition.y}px`,
                left: `${adjustedPosition.x}px`,
            }}
        >
            <div className="p-3">
                <p className="text-sm font-medium mb-2">Add comment</p>
                <p className="text-sm italic mb-2 bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded">
                    "{selectedText}"
                </p>
                <Textarea
                    value={annotationContent}
                    onChange={(e) => onAnnotationChange(e.target.value)}
                    placeholder="Write your comment..."
                    className="mb-2"
                    rows={3}
                    autoFocus
                />
                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onCancel}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={onSubmit}
                        disabled={!annotationContent.trim()}
                    >
                        Comment
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AnnotationPopover; 
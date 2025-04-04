import React, { useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseContent } from '@/utils/contentParser';
import AnnotationTooltip from './AnnotationTooltip';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';

interface Tag {
    id: string;
    name: string;
}

interface JournalEntryCardProps {
    entry: {
        id: string;
        title: string;
        content: string;
        date_created: string;
        tags?: string[];
    };
    allTags: Tag[];
    isEventTag?: (entryId: string, tagId: string) => boolean;
    narrativeId?: string;
}

const JournalEntryCard: React.FC<JournalEntryCardProps> = ({
    entry,
    allTags,
    isEventTag = () => false,
    narrativeId
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [hoveredAnnotation, setHoveredAnnotation] = useState<{
        element: HTMLElement;
        content: string;
        created_at: string;
    } | null>(null);

    // Parse content to properly display annotations
    const { content } = parseContent(entry.content || '');

    const getTagName = (tagId: string) => {
        const tag = allTags.find(t => t.id === tagId);
        return tag ? tag.name : 'Unknown';
    };

    const handleEditClick = () => {
        if (narrativeId) {
            navigate(`/dashboard/journal/${entry.id}/edit`, {
                state: {
                    returnTo: {
                        path: `/dashboard/narratives/${narrativeId}`,
                        narrativeId
                    }
                }
            });
        } else {
            navigate(`/dashboard/journal/${entry.id}/edit`);
        }
    };

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-base">{entry.title}</CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleEditClick}
                        className="flex items-center gap-1 text-muted-foreground hover:text-primary"
                    >
                        <Edit className="h-4 w-4" />
                        <span>Edit</span>
                    </Button>
                </div>
                <div className="flex items-center text-muted-foreground text-sm">
                    <BookOpen className="h-4 w-4 mr-1" />
                    <span>Created on {format(new Date(entry.date_created), 'PPP')}</span>
                </div>
            </CardHeader>

            <CardContent>
                <div
                    className="whitespace-pre-wrap prose dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: content }}
                    onMouseOver={(e) => {
                        const target = e.target as HTMLElement;
                        const mark = target.closest('mark[data-annotation-ref]') as HTMLElement;
                        if (mark) {
                            const content = mark.getAttribute('data-content');
                            const createdAt = mark.getAttribute('data-created-at');
                            if (content && createdAt) {
                                setHoveredAnnotation({
                                    element: mark,
                                    content,
                                    created_at: createdAt
                                });
                            }
                        }
                    }}
                    onMouseOut={() => {
                        setHoveredAnnotation(null);
                    }}
                />
            </CardContent>

            {entry.tags && entry.tags.length > 0 && (
                <CardFooter className="pt-0 flex flex-wrap gap-2">
                    {entry.tags.map(tagId => (
                        <Badge
                            key={tagId}
                            variant="outline"
                            className={cn(
                                "border-0",
                                isEventTag(entry.id, tagId)
                                    ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                            )}
                        >
                            {getTagName(tagId)}
                        </Badge>
                    ))}
                </CardFooter>
            )}

            <AnnotationTooltip hoveredAnnotation={hoveredAnnotation} />
        </Card>
    );
};

export default JournalEntryCard; 
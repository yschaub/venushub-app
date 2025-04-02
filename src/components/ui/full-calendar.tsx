import { VariantProps } from 'class-variance-authority';
import { monthEventVariants } from './calendar'; // Adjust this import path if needed

export type CalendarEvent = {
    id: string;
    start: Date;
    end: Date;
    title: string;
    color?: VariantProps<typeof monthEventVariants>['variant'];
    className?: string;
    hasJournal?: boolean;
    journalId?: string;
    tags?: string[];
    primary_event?: boolean;
    // Add these new properties
    eventDate?: string;
    startDate?: string;
    endDate?: string;
};

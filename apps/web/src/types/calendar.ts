// Calendar Source defines a calendar that events can be associated with
export interface CalendarSource {
  id: string;
  name: string;
  color: string;
  isEnabled: boolean;
}

// Calendar Event represents a single event on the calendar
export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO string
  end: string; // ISO string
  allDay: boolean;
  calendarId: string;
  color: string;
  description?: string;
  location?: string;
  recurrence?: RecurrenceRule;
  reminder?: ReminderSetting;
}

// Defines how an event repeats
export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number; // How often the recurrence repeats (default: 1)
  endDate?: string; // ISO string, when the recurrence ends
  endCount?: number; // Number of occurrences
  weekDays?: number[]; // Days of week (0-6, 0 is Sunday)
  monthDays?: number[]; // Days of month (1-31)
}

// Defines when to send a reminder for an event
export interface ReminderSetting {
  type: 'email' | 'notification' | 'both';
  timeBeforeStart: number; // In minutes
}

// Time slot for calendar views
export interface TimeSlot {
  time: Date;
  events: CalendarEvent[];
}

// Day cell for month view
export interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}
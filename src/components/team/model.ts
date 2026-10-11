export type EmployeeRole = 'front' | 'kitchen' | 'both' | 'unassigned';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type Period = 'lunch' | 'dinner';
export type RoleTab = 'front' | 'kitchen';

export interface Employee {
    id: string;
    name: string;
    role: EmployeeRole;
}

export interface WeeklyShift {
    id: string;
    employeeId: string;
    employeeName: string;
    role: RoleTab;
    dayOfWeek: DayOfWeek;
    period: Period;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const DISPLAY_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ─── Helpers ────────────────────────────────────────────────────────────────

export function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDisplayName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

// ─── Component ──────────────────────────────────────────────────────────────

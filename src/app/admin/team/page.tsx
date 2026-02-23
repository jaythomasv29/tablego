'use client';

import AdminLayout from '@/components/AdminLayout';
import { useEffect, useState, useRef } from 'react';
import { collection, getDocs, getDoc, doc, addDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import toast, { Toaster } from 'react-hot-toast';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    Users,
    ChefHat,
    CalendarOff,
    Sun,
    Moon,
    GripVertical,
    Trash2,
    Pencil,
    RotateCcw,
    CalendarX2,
    Repeat,
    Clock,
    User,
    Calendar,
    LogIn,
    LogOut,
    UserCog,
    Check,
    Sparkles,
    PanelLeftClose,
    PanelLeftOpen,
    DollarSign,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DayHours {
    lunch: { open: string; close: string; isOpen: boolean };
    dinner: { open: string; close: string; isOpen: boolean };
}

interface BusinessHours {
    [key: string]: DayHours;
}

type EmployeeRole = 'front' | 'kitchen' | 'both' | 'unassigned';

interface Employee {
    id: string;
    name: string;
    role: EmployeeRole;
}

interface SpecialDate {
    id: string;
    date: string;
    reason: string;
    closureType?: 'full' | 'lunch' | 'dinner';
}

/** A manual shift assignment for a specific date. */
interface ScheduleShift {
    id: string;
    employeeId: string;
    employeeName: string;
    role: 'front' | 'kitchen';
    date: string; // YYYY-MM-DD
    period: 'lunch' | 'dinner';
    startTime: string;
    endTime: string;
    actualTimeIn?: string;
    actualTimeOut?: string;
}

interface TipReport {
    id: string;
    date: string; // YYYY-MM-DD
    period: 'lunch' | 'dinner';
    creditCardTip: number;
    gratuityCharges: number;
    doorDashTip: number;
    uberTip: number;
    totalTips: number;
    updatedAt?: string | Date;
}

interface TipModalStaffEntry {
    key: string;
    employeeName: string;
    role: 'front' | 'kitchen';
    source: 'manual';
    scheduleId?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getDayName(date: Date): string {
    return DAY_NAMES[date.getDay()];
}

function getMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getWeekDates(startDate: Date): Date[] {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return d;
    });
}

function formatTimeShort(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const p = h >= 12 ? 'p' : 'a';
    const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return m === 0 ? `${dh}${p}` : `${dh}:${m.toString().padStart(2, '0')}${p}`;
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDisplayName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return name;
    const firstPart = parts.slice(0, -1).join(' ');
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstPart} ${lastInitial}.`;
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function getShiftDurationHours(startTime: string, endTime: string): number {
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    return Math.max(0, (end - start) / 60);
}

function formatHours(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

/** Ordered days for display (Mon → Sun) */
const DISPLAY_DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TeamView() {
    // Data state
    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()));
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [schedules, setSchedules] = useState<ScheduleShift[]>([]);
    const [tipReports, setTipReports] = useState<TipReport[]>([]);
    const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
    const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
    const [loading, setLoading] = useState(true);

    const [showSidebar, setShowSidebar] = useState(true);

    // Drag & drop state
    const [draggedEmployee, setDraggedEmployee] = useState<Employee | null>(null);
    const [dragOverCell, setDragOverCell] = useState<string | null>(null);
    const draggedRef = useRef<Employee | null>(null);

    // Edit modal state
    const [editingScheduleShift, setEditingScheduleShift] = useState<{
        shift: ScheduleShift;
        date: Date;
    } | null>(null);
    const [editStartTime, setEditStartTime] = useState('');
    const [editEndTime, setEditEndTime] = useState('');
    const [editActualIn, setEditActualIn] = useState('');
    const [editActualOut, setEditActualOut] = useState('');
    const [editingTipReport, setEditingTipReport] = useState<{ date: Date; period: 'lunch' | 'dinner'; report?: TipReport } | null>(null);
    const [tipCreditCard, setTipCreditCard] = useState('');
    const [tipGratuity, setTipGratuity] = useState('');
    const [tipDoorDash, setTipDoorDash] = useState('');
    const [tipUber, setTipUber] = useState('');
    const [tipAddEmployeeId, setTipAddEmployeeId] = useState('');

    // Add employee modal
    const [isAddingEmployee, setIsAddingEmployee] = useState(false);
    const [newEmployee, setNewEmployee] = useState<Omit<Employee, 'id'>>({ name: '', role: 'unassigned' });

    // Employee detail modal
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    // ─── Week Navigation ────────────────────────────────────────────────────

    const previousWeek = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() - 7);
        setCurrentWeekStart(d);
    };
    const nextWeek = () => {
        const d = new Date(currentWeekStart);
        d.setDate(d.getDate() + 7);
        setCurrentWeekStart(d);
    };
    const goToToday = () => setCurrentWeekStart(getMonday(new Date()));

    // ─── Data Fetching ──────────────────────────────────────────────────────

    useEffect(() => {
        (async () => {
            try {
                const d = await getDoc(doc(db, 'settings', 'businessHours'));
                if (d.exists()) setBusinessHours(d.data() as BusinessHours);
            } catch (e) { console.error('Error fetching business hours:', e); }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(collection(db, 'specialDates'));
                setSpecialDates(snap.docs.map(d => ({ id: d.id, ...d.data() } as SpecialDate)));
            } catch (e) { console.error('Error fetching special dates:', e); }
        })();
    }, []);

    useEffect(() => {
        return onSnapshot(collection(db, 'employees'), (snap) => {
            setEmployees(
                snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee))
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
        });
    }, []);

    useEffect(() => {
        return onSnapshot(collection(db, 'schedules'), (snap) => {
            setSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleShift)));
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        return onSnapshot(collection(db, 'tipReports'), (snap) => {
            setTipReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as TipReport)));
        });
    }, []);

    // ─── Business Logic ─────────────────────────────────────────────────────

    const getHolidayForDate = (date: Date): SpecialDate | null => {
        const ds = formatDate(date);
        return specialDates.find(sd => sd.date.substring(0, 10) === ds) || null;
    };

    const getDayStatus = (date: Date) => {
        const dayHours = businessHours?.[getDayName(date)] || null;
        const holiday = getHolidayForDate(date);
        const closureType = holiday?.closureType || (holiday ? 'full' : null);
        const lunchOpen = (dayHours?.lunch?.isOpen ?? false) && closureType !== 'full' && closureType !== 'lunch';
        const dinnerOpen = (dayHours?.dinner?.isOpen ?? false) && closureType !== 'full' && closureType !== 'dinner';
        const isFullDayClosure = closureType === 'full';
        return { dayHours, holiday, closureType, isFullDayClosure, lunchOpen, dinnerOpen, isOpen: lunchOpen || dinnerOpen };
    };

    /** Get all manual shifts + stats for selected week */
    const getEmployeeStats = (employeeId: string) => {
        const weekDateStrings = weekDates.map(formatDate);
        const empSchedules = schedules.filter(s => s.employeeId === employeeId && weekDateStrings.includes(s.date));

        const totalWeeklyHours = empSchedules.reduce((sum, s) => {
            return sum + getShiftDurationHours(s.startTime, s.endTime);
        }, 0);
        const shiftCount = empSchedules.length;

        // Group shifts by actual week dates for display
        const byDay = weekDates
            .map(date => ({
                day: getDayName(date),
                dateLabel: formatDate(date),
                shifts: empSchedules.filter(s => s.date === formatDate(date)),
            }))
            .filter(g => g.shifts.length > 0);

        return { empSchedules, totalWeeklyHours, shiftCount, byDay };
    };

    // ─── Drag & Drop Handlers ───────────────────────────────────────────────

    const handleDragStart = (e: React.DragEvent, employee: Employee) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ id: employee.id }));
        e.dataTransfer.effectAllowed = 'copy';
        setDraggedEmployee(employee);
        draggedRef.current = employee;
    };

    const handleDragEnd = () => {
        setDraggedEmployee(null);
        setDragOverCell(null);
        draggedRef.current = null;
    };

    const handleCellDragOver = (e: React.DragEvent, cellKey: string, _role: 'front' | 'kitchen') => {
        const emp = draggedRef.current;
        if (!emp) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDragOverCell(cellKey);
    };

    const handleCellDragLeave = () => setDragOverCell(null);

    const handleCellDrop = (e: React.DragEvent, period: 'lunch' | 'dinner', role: 'front' | 'kitchen', date: Date) => {
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            handleAddScheduleShift(data.id, date, period, role);
        } catch (err) {
            console.error(err);
        }
        setDraggedEmployee(null);
        setDragOverCell(null);
        draggedRef.current = null;
    };

    // ─── Manual Shift CRUD ──────────────────────────────────────────────────

    const handleAddScheduleShift = async (employeeId: string, date: Date, period: 'lunch' | 'dinner', targetRole: 'front' | 'kitchen') => {
        const employee = employees.find(e => e.id === employeeId);
        if (!employee) return;

        const dateStr = formatDate(date);

        // Prevent duplicate
        const dup = schedules.find(s =>
            s.employeeId === employeeId && s.date === dateStr && s.period === period && s.role === targetRole
        );
        if (dup) {
            toast.error(`${employee.name} is already assigned to this shift`);
            return;
        }

        const dayOfWeek = getDayName(date);
        const dayHours = businessHours?.[dayOfWeek];
        const periodHours = dayHours?.[period];
        const startTime = periodHours?.open || (period === 'lunch' ? '11:00' : '17:00');
        const endTime = periodHours?.close || (period === 'lunch' ? '15:00' : '22:00');

        try {
            await addDoc(collection(db, 'schedules'), {
                employeeId,
                employeeName: employee.name,
                role: targetRole,
                date: dateStr,
                period,
                startTime,
                endTime,
            });
            const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const section = targetRole === 'front' ? 'FOH' : 'Kitchen';
            toast.success(`${employee.name} → ${dayLabel} ${capitalize(period)} (${section})`);
        } catch {
            toast.error('Failed to add shift');
        }
    };

    const handleDeleteScheduleShift = async (shiftId: string) => {
        try {
            await deleteDoc(doc(db, 'schedules', shiftId));
            toast.success('Shift removed');
        } catch {
            toast.error('Failed to remove shift');
        }
        setEditingScheduleShift(null);
    };

    const handleEditScheduleShift = async (shiftId: string, startTime: string, endTime: string) => {
        try {
            await updateDoc(doc(db, 'schedules', shiftId), { startTime, endTime });
            toast.success('Shift times updated');
        } catch {
            toast.error('Failed to update');
        }
        setEditingScheduleShift(null);
    };

    const handleSaveScheduleModifiedTime = async (shiftId: string, actualTimeIn: string, actualTimeOut: string) => {
        try {
            await updateDoc(doc(db, 'schedules', shiftId), {
                actualTimeIn: actualTimeIn || null,
                actualTimeOut: actualTimeOut || null,
            });
            toast.success('Modified time saved');
        } catch {
            toast.error('Failed to save');
        }
        setEditingScheduleShift(null);
    };

    // ─── Employee CRUD ──────────────────────────────────────────────────────

    const handleAddEmployee = async () => {
        if (!newEmployee.name.trim()) {
            toast.error('Please enter employee name');
            return;
        }
        try {
            await addDoc(collection(db, 'employees'), newEmployee);
            toast.success(`${newEmployee.name} added`);
            setIsAddingEmployee(false);
            setNewEmployee({ name: '', role: 'unassigned' });
        } catch {
            toast.error('Failed to add employee');
        }
    };

    const handleDeleteEmployee = async (emp: Employee) => {
        if (!confirm(`Remove ${emp.name} and all their shifts?`)) return;
        try {
            await deleteDoc(doc(db, 'employees', emp.id));
            const empShifts = schedules.filter(s => s.employeeId === emp.id);
            for (const s of empShifts) {
                await deleteDoc(doc(db, 'schedules', s.id));
            }
            toast.success(`${emp.name} removed`);
        } catch {
            toast.error('Failed to remove employee');
        }
    };

    const handleUpdateEmployeeRole = async (emp: Employee, newRole: EmployeeRole) => {
        try {
            await updateDoc(doc(db, 'employees', emp.id), { role: newRole });
            const label = newRole === 'front' ? 'Front of House' : newRole === 'kitchen' ? 'Kitchen' : newRole === 'both' ? 'Both' : 'Unassigned';
            toast.success(`${emp.name} → ${label}`);
            // Update selectedEmployee if it's the same one being viewed
            if (selectedEmployee?.id === emp.id) {
                setSelectedEmployee({ ...emp, role: newRole });
            }
        } catch {
            toast.error('Failed to update role');
        }
    };

    // ─── Render Helpers ─────────────────────────────────────────────────────

    const weekDates = getWeekDates(currentWeekStart);
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const frontEmployees = employees.filter(e => e.role === 'front' || e.role === 'both');
    const kitchenEmployees = employees.filter(e => e.role === 'kitchen' || e.role === 'both');
    const unassignedEmployees = employees.filter(e => e.role === 'unassigned');

    /** Get manual shifts for a cell */
    const getShiftsForCell = (date: Date, period: 'lunch' | 'dinner', role: 'front' | 'kitchen'): ScheduleShift[] => {
        const dateStr = formatDate(date);
        return schedules.filter(s => s.date === dateStr && s.period === period && s.role === role);
    };

    const getTipReportForPeriod = (date: Date, period: 'lunch' | 'dinner'): TipReport | undefined => {
        const dateStr = formatDate(date);
        return tipReports.find(r => r.date === dateStr && r.period === period);
    };

    const parseTipValue = (v: string): number => {
        const parsed = Number(v);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const totalTipsFromInputs =
        parseTipValue(tipCreditCard) +
        parseTipValue(tipGratuity) +
        parseTipValue(tipDoorDash) +
        parseTipValue(tipUber);

    const openTipReportModal = (date: Date, period: 'lunch' | 'dinner') => {
        const report = getTipReportForPeriod(date, period);
        setEditingTipReport({ date, period, report });
        setTipCreditCard(report ? String(report.creditCardTip || 0) : '');
        setTipGratuity(report ? String(report.gratuityCharges || 0) : '');
        setTipDoorDash(report ? String(report.doorDashTip || 0) : '');
        setTipUber(report ? String(report.uberTip || 0) : '');
        setTipAddEmployeeId('');
    };

    const handleSaveTipReport = async () => {
        if (!editingTipReport) return;
        const dateStr = formatDate(editingTipReport.date);
        const payload = {
            date: dateStr,
            period: editingTipReport.period,
            creditCardTip: parseTipValue(tipCreditCard),
            gratuityCharges: parseTipValue(tipGratuity),
            doorDashTip: parseTipValue(tipDoorDash),
            uberTip: parseTipValue(tipUber),
            totalTips: totalTipsFromInputs,
            updatedAt: new Date().toISOString(),
        };

        try {
            const existing = editingTipReport.report || getTipReportForPeriod(editingTipReport.date, editingTipReport.period);
            if (existing) {
                await updateDoc(doc(db, 'tipReports', existing.id), payload);
            } else {
                await addDoc(collection(db, 'tipReports'), payload);
            }
            toast.success('Tip report saved');
            setEditingTipReport(null);
        } catch {
            toast.error('Failed to save tip report');
        }
    };

    const getTipModalStaffEntries = (date: Date, period: 'lunch' | 'dinner'): TipModalStaffEntry[] => {
        const frontShifts = getShiftsForCell(date, period, 'front').map((shift) => ({
            key: `ot-${shift.id}`,
            employeeName: shift.employeeName,
            role: shift.role,
            source: 'manual' as const,
            scheduleId: shift.id,
        }));

        return [...frontShifts]
            .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
    };

    const handleRemoveTipModalStaff = async (entry: TipModalStaffEntry) => {
        if (entry.scheduleId) {
            try {
                await deleteDoc(doc(db, 'schedules', entry.scheduleId));
                toast.success(`${entry.employeeName} removed from this shift`);
            } catch {
                toast.error('Failed to remove staff');
            }
        }
    };

    const handleAddStaffFromTipModal = async () => {
        if (!editingTipReport) return;
        if (!tipAddEmployeeId) {
            toast.error('Select a staff member');
            return;
        }
        await handleAddScheduleShift(
            tipAddEmployeeId,
            editingTipReport.date,
            editingTipReport.period,
            'front'
        );
        setTipAddEmployeeId('');
    };

    const tipModalStaffEntries = editingTipReport
        ? getTipModalStaffEntries(editingTipReport.date, editingTipReport.period)
        : [];

    /** Render a single schedule cell */
    const renderCell = (date: Date, period: 'lunch' | 'dinner', role: 'front' | 'kitchen') => {
        const dayOfWeek = getDayName(date);
        const { holiday, lunchOpen, dinnerOpen } = getDayStatus(date);
        const isPeriodOpen = period === 'lunch' ? lunchOpen : dinnerOpen;
        const cellKey = `${dayOfWeek}-${period}-${role}`;
        const isOver = dragOverCell === cellKey;
        const isDragging = !!draggedEmployee;
        const isToday = formatDate(date) === formatDate(new Date());

        // Holiday cell
        if (holiday && (holiday.closureType || 'full') === 'full') {
            return (
                <div key={cellKey} className="border-r p-2 min-h-[72px] bg-red-50/60 flex items-center justify-center">
                    <span className="text-[9px] text-red-400 text-center leading-tight">{holiday.reason}</span>
                </div>
            );
        }

        // Closed period cell
        if (!isPeriodOpen) {
            return <div key={cellKey} className="border-r p-2 min-h-[72px] bg-gray-50" />;
        }

        const cellShifts = getShiftsForCell(date, period, role);
        const tipReport = getTipReportForPeriod(date, period);
        const isFront = role === 'front';

        // Cell styles based on drag state
        let cellClasses = 'border-r p-1.5 min-h-[72px] transition-all duration-150';
        if (isToday) cellClasses += ' bg-blue-50/20';
        if (isOver) {
            cellClasses += isFront
                ? ' bg-blue-100/80 ring-2 ring-inset ring-blue-400 ring-dashed'
                : ' bg-orange-100/80 ring-2 ring-inset ring-orange-400 ring-dashed';
        } else if (isDragging) {
            cellClasses += isFront ? ' bg-blue-50/30' : ' bg-orange-50/30';
        }

        return (
            <div
                key={cellKey}
                className={cellClasses}
                onDragOver={(e) => handleCellDragOver(e, cellKey, role)}
                onDragLeave={handleCellDragLeave}
                onDrop={(e) => handleCellDrop(e, period, role, date)}
            >
                <div className="space-y-1">
                    {isFront && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                openTipReportModal(date, period);
                            }}
                            className={`w-full flex items-center justify-between px-2 py-1 rounded-md border text-[10px] font-medium transition-colors ${
                                tipReport
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                            }`}
                        >
                            <span className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                Tip Report
                            </span>
                            <span>{tipReport ? `$${Number(tipReport.totalTips || 0).toFixed(2)}` : 'Add'}</span>
                        </button>
                    )}

                    {/* Manual shifts */}
                    {cellShifts.map(shift => {
                        return (
                            <div
                                key={`ot-${shift.id}`}
                                onClick={() => {
                                    setEditingScheduleShift({ shift, date });
                                    setEditStartTime(shift.startTime);
                                    setEditEndTime(shift.endTime);
                                    setEditActualIn(shift.actualTimeIn || '');
                                    setEditActualOut(shift.actualTimeOut || '');
                                }}
                                className={`px-2 py-1.5 rounded-md text-xs cursor-pointer group relative transition-colors ring-1 ring-violet-400 ${
                                    isFront
                                        ? 'bg-violet-100 hover:bg-violet-200/80 text-violet-900'
                                        : 'bg-violet-100 hover:bg-violet-200/80 text-violet-900'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1">
                                        <Sparkles className="w-2.5 h-2.5 text-violet-500 flex-shrink-0" />
                                        <div className="font-semibold truncate text-[11px]">{formatDisplayName(shift.employeeName)}</div>
                                    </div>
                                    <button
                                        onClick={(ev) => {
                                            ev.stopPropagation();
                                            handleDeleteScheduleShift(shift.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-violet-200/80 transition-opacity flex-shrink-0"
                                        title="Remove shift"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Drop hint when dragging any employee */}
                    {isDragging && (
                        <div className={`p-2 border-2 border-dashed rounded-md text-center text-[10px] transition-colors ${
                            isFront
                                ? 'border-blue-300 text-blue-400'
                                : 'border-orange-300 text-orange-400'
                        }`}>
                            <Plus className="w-3 h-3 mx-auto mb-0.5" />
                            Drop to assign
                        </div>
                    )}
                </div>
            </div>
        );
    };

    /** Render a full row: period label + 7 day cells */
    const renderSectionRow = (period: 'lunch' | 'dinner', role: 'front' | 'kitchen') => (
        <div className="grid grid-cols-8 border-b">
            <div className="p-3 border-r flex items-center gap-2 bg-white">
                {period === 'lunch'
                    ? <Sun className="w-4 h-4 text-amber-500" />
                    : <Moon className="w-4 h-4 text-indigo-500" />
                }
                <span className="text-sm font-medium text-gray-600">{capitalize(period)}</span>
            </div>
            {weekDates.map(date => renderCell(date, period, role))}
        </div>
    );

    // ─── Render ─────────────────────────────────────────────────────────────

    return (
        <AdminLayout>
            <Toaster position="top-center" />
            <div className="p-6 bg-gray-50 min-h-screen">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Team Schedule</h1>
                            <p className="text-gray-500 mt-1">Drag employees to assign shifts for each day — any employee can work FOH or Kitchen</p>
                        </div>
                    </div>

                    {/* Week Navigation */}
                    <div className="flex items-center justify-between p-4 rounded-lg shadow-sm transition-colors bg-white">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="sm" onClick={previousWeek}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <h2 className="text-lg font-semibold text-gray-900">
                                {currentWeekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} –{' '}
                                {weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </h2>
                            <Button variant="outline" size="sm" onClick={nextWeek}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={goToToday}>
                                Today
                            </Button>
                        </div>
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowSidebar(prev => !prev)}
                                className="gap-1.5"
                            >
                                {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                                {showSidebar ? 'Hide Staff' : 'Show Staff'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Main Layout: Sidebar + Calendar */}
                <div className={`flex ${showSidebar ? 'gap-5' : 'gap-0'}`}>
                    {/* ─── Employee Sidebar ─────────────────────────────── */}
                    {showSidebar && (
                        <div className="w-52 flex-shrink-0 space-y-4">
                        {/* Front of House */}
                        <Card className="overflow-hidden">
                            <div className="bg-blue-50 px-3 py-2.5 border-b flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-semibold text-blue-900">Front of House</span>
                            </div>
                            <CardContent className="p-2 space-y-0.5">
                                {frontEmployees.length === 0 && (
                                    <p className="text-xs text-gray-400 text-center py-3">No staff yet</p>
                                )}
                                {frontEmployees.map(emp => {
                                    return (
                                        <div
                                            key={emp.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, emp)}
                                            onDragEnd={handleDragEnd}
                                            onClick={() => setSelectedEmployee(emp)}
                                            className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing border transition-all select-none ${
                                                draggedEmployee?.id === emp.id
                                                    ? 'opacity-40 border-blue-300 bg-blue-50'
                                                    : 'border-transparent hover:bg-blue-50 hover:border-blue-200'
                                            }`}
                                        >
                                            <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-sm font-medium text-gray-800 truncate">{formatDisplayName(emp.name)}</span>
                                                    {emp.role === 'both' && (
                                                        <span className="text-[9px] px-1 py-0.5 bg-purple-100 text-purple-600 rounded font-medium flex-shrink-0">Both</span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp); }}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded transition-opacity"
                                            >
                                                <Trash2 className="w-3 h-3 text-red-400" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        {/* Kitchen */}
                        <Card className="overflow-hidden">
                            <div className="bg-orange-50 px-3 py-2.5 border-b flex items-center gap-2">
                                <ChefHat className="w-4 h-4 text-orange-600" />
                                <span className="text-sm font-semibold text-orange-900">Kitchen</span>
                            </div>
                            <CardContent className="p-2 space-y-0.5">
                                {kitchenEmployees.length === 0 && (
                                    <p className="text-xs text-gray-400 text-center py-3">No staff yet</p>
                                )}
                                {kitchenEmployees.map(emp => {
                                    const stats = getEmployeeStats(emp.id);
                                    return (
                                        <div
                                            key={emp.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, emp)}
                                            onDragEnd={handleDragEnd}
                                            onClick={() => setSelectedEmployee(emp)}
                                            className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing border transition-all select-none ${
                                                draggedEmployee?.id === emp.id
                                                    ? 'opacity-40 border-orange-300 bg-orange-50'
                                                    : 'border-transparent hover:bg-orange-50 hover:border-orange-200'
                                            }`}
                                        >
                                            <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-sm font-medium text-gray-800 truncate">{formatDisplayName(emp.name)}</span>
                                                    {emp.role === 'both' && (
                                                        <span className="text-[9px] px-1 py-0.5 bg-purple-100 text-purple-600 rounded font-medium flex-shrink-0">Both</span>
                                                    )}
                                                </div>
                                                {stats.shiftCount > 0 && (
                                                    <span className="text-[10px] text-gray-400">{formatHours(stats.totalWeeklyHours)}/wk</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp); }}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 rounded transition-opacity"
                                            >
                                                <Trash2 className="w-3 h-3 text-red-400" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        {/* Unassigned */}
                        {unassignedEmployees.length > 0 && (
                            <Card className="overflow-hidden border-dashed">
                                <div className="bg-gray-50 px-3 py-2.5 border-b flex items-center gap-2">
                                    <UserCog className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm font-semibold text-gray-600">Unassigned</span>
                                    <Badge variant="outline" className="text-[10px] border-gray-300 text-gray-500 ml-auto">
                                        {unassignedEmployees.length}
                                    </Badge>
                                </div>
                                <CardContent className="p-2 space-y-0.5">
                                    {unassignedEmployees.map(emp => (
                                        <div
                                            key={emp.id}
                                            onClick={() => setSelectedEmployee(emp)}
                                            className="group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer border border-transparent hover:bg-gray-50 hover:border-gray-200 transition-all"
                                        >
                                            <UserCog className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <span className="text-sm font-medium text-gray-800 truncate block">{formatDisplayName(emp.name)}</span>
                                                <span className="text-[10px] text-amber-500">Needs role assignment</span>
                                            </div>
                                            {/* Quick role buttons */}
                                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleUpdateEmployeeRole(emp, 'front'); }}
                                                    className="p-1 rounded hover:bg-blue-100 text-blue-600 transition-colors"
                                                    title="Assign to Front of House"
                                                >
                                                    <Users className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleUpdateEmployeeRole(emp, 'kitchen'); }}
                                                    className="p-1 rounded hover:bg-orange-100 text-orange-600 transition-colors"
                                                    title="Assign to Kitchen"
                                                >
                                                    <ChefHat className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleUpdateEmployeeRole(emp, 'both'); }}
                                                    className="p-1 rounded hover:bg-purple-100 text-purple-600 transition-colors"
                                                    title="Assign to Both"
                                                >
                                                    <Check className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        {/* Add Employee */}
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setIsAddingEmployee(true)}
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Employee
                        </Button>

                        {/* Legend */}
                        <div className="space-y-2 text-[11px] text-gray-400 px-1">
                            <div className="flex items-center gap-1.5">
                                <GripVertical className="w-3.5 h-3.5" />
                                Drag to any section
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Sun className="w-3.5 h-3.5 text-amber-500" />
                                Lunch period
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Moon className="w-3.5 h-3.5 text-indigo-500" />
                                Dinner period
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />
                                Holiday
                            </div>
                            <div className="flex items-center gap-1.5">
                                <X className="w-3.5 h-3.5" />
                                Hover shift to remove week
                            </div>
                        </div>
                        </div>
                    )}

                    {/* ─── Calendar Grid ────────────────────────────────── */}
                    <div className="flex-1 overflow-x-auto">
                        <Card className="shadow-sm overflow-hidden">
                            <CardContent className="p-0">
                                {/* Day Headers */}
                                <div className="grid grid-cols-8 border-b bg-gray-50">
                                    <div className="p-3 border-r" />
                                    {weekDates.map((date, i) => {
                                        const isToday = formatDate(date) === formatDate(new Date());
                                        const { holiday, closureType, isFullDayClosure, lunchOpen, dinnerOpen, dayHours } = getDayStatus(date);

                                        return (
                                            <div key={i} className={`p-3 border-r text-center ${isToday ? 'bg-blue-50' : ''} ${isFullDayClosure ? 'bg-red-50/60' : ''}`}>
                                                <div className={`text-sm font-semibold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                                                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                                </div>
                                                <div className={`text-xs ${isToday ? 'text-blue-500' : 'text-gray-500'}`}>
                                                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                </div>

                                                {holiday && isFullDayClosure ? (
                                                    <Badge variant="outline" className="text-[9px] mt-1 border-red-300 text-red-600 bg-red-50">
                                                        <CalendarOff className="w-3 h-3 mr-0.5" />
                                                        {holiday.reason}
                                                    </Badge>
                                                ) : (
                                                    <div className="mt-1 space-y-0.5">
                                                        {holiday && closureType === 'lunch' && (
                                                            <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700 bg-amber-50">
                                                                Lunch Closed
                                                            </Badge>
                                                        )}
                                                        {holiday && closureType === 'dinner' && (
                                                            <Badge variant="outline" className="text-[9px] border-indigo-300 text-indigo-700 bg-indigo-50">
                                                                Dinner Closed
                                                            </Badge>
                                                        )}
                                                        {lunchOpen && dayHours && (
                                                            <div className="flex items-center justify-center gap-0.5 text-[9px] text-amber-600">
                                                                <Sun className="w-3 h-3" />
                                                                {formatTimeShort(dayHours.lunch.open)}-{formatTimeShort(dayHours.lunch.close)}
                                                            </div>
                                                        )}
                                                        {dinnerOpen && dayHours && (
                                                            <div className="flex items-center justify-center gap-0.5 text-[9px] text-indigo-600">
                                                                <Moon className="w-3 h-3" />
                                                                {formatTimeShort(dayHours.dinner.open)}-{formatTimeShort(dayHours.dinner.close)}
                                                            </div>
                                                        )}
                                                        {!lunchOpen && !dinnerOpen && (
                                                            <Badge variant="outline" className="text-[10px] border-gray-300 text-gray-400">
                                                                Closed
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Front of House */}
                                <div className="bg-blue-50/50 border-b px-3 py-2 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-blue-600" />
                                    <span className="font-semibold text-blue-900 text-sm">Front of House</span>
                                    <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700">
                                        {frontEmployees.length}
                                    </Badge>
                                </div>
                                {renderSectionRow('lunch', 'front')}
                                {renderSectionRow('dinner', 'front')}

                                {/* Kitchen */}
                                <div className="bg-orange-50/50 border-b px-3 py-2 flex items-center gap-2">
                                    <ChefHat className="w-4 h-4 text-orange-600" />
                                    <span className="font-semibold text-orange-900 text-sm">Kitchen</span>
                                    <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-700">
                                        {kitchenEmployees.length}
                                    </Badge>
                                </div>
                                {renderSectionRow('lunch', 'kitchen')}
                                {renderSectionRow('dinner', 'kitchen')}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* ─── Tip Report Modal ───────────────────────────────────── */}
                {editingTipReport && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                        onClick={() => setEditingTipReport(null)}
                    >
                        <div
                            className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-5 border-b">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Tip Report</h3>
                                    <p className="text-sm text-gray-500 mt-0.5">
                                        {capitalize(editingTipReport.period)} · {editingTipReport.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setEditingTipReport(null)}
                                    className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-5 space-y-3">
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Worked Staff</h4>
                                        <span className="text-[11px] text-gray-500">{tipModalStaffEntries.length} assigned</span>
                                    </div>

                                    {tipModalStaffEntries.length === 0 ? (
                                        <div className="text-xs text-gray-500">No staff assigned yet for this shift.</div>
                                    ) : (
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                            {tipModalStaffEntries.map((entry) => (
                                                <div key={entry.key} className="flex items-center justify-between gap-2 rounded-md bg-white border border-gray-200 px-2.5 py-1.5">
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-medium text-gray-800 truncate">{formatDisplayName(entry.employeeName)}</div>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-[9px] ${
                                                                    entry.role === 'front'
                                                                        ? 'border-blue-200 text-blue-700 bg-blue-50'
                                                                        : 'border-orange-200 text-orange-700 bg-orange-50'
                                                                }`}
                                                            >
                                                                {entry.role === 'front' ? 'FOH' : 'Kitchen'}
                                                            </Badge>
                                                            <Badge variant="secondary" className="text-[9px]">
                                                                Manual
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTipModalStaff(entry)}
                                                        className="p-1 rounded hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors"
                                                        title="Remove from this shift"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-12 gap-2 pt-1">
                                        <div className="col-span-7">
                                            <select
                                                value={tipAddEmployeeId}
                                                onChange={(e) => setTipAddEmployeeId(e.target.value)}
                                                className="w-full px-2.5 py-2 border border-gray-300 rounded-md text-xs bg-white"
                                            >
                                                <option value="">Add staff to this shift</option>
                                                {employees
                                                    .filter((emp) => emp.role === 'front' || emp.role === 'both')
                                                    .map((emp) => (
                                                        <option key={emp.id} value={emp.id}>
                                                            {formatDisplayName(emp.name)}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                        <div className="col-span-5">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full h-[34px] px-0"
                                                onClick={handleAddStaffFromTipModal}
                                            >
                                                Add
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 mb-1 block">Credit Card Tip</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={tipCreditCard}
                                            onChange={(e) => setTipCreditCard(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 mb-1 block">Gratuity Charges</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={tipGratuity}
                                            onChange={(e) => setTipGratuity(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 mb-1 block">DoorDash Tip</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={tipDoorDash}
                                            onChange={(e) => setTipDoorDash(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-gray-500 mb-1 block">Uber Tip</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={tipUber}
                                            onChange={(e) => setTipUber(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 flex items-center justify-between">
                                    <span className="text-sm font-medium text-emerald-700">Total Tips</span>
                                    <span className="text-lg font-bold text-emerald-800">${totalTipsFromInputs.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
                                <Button variant="outline" onClick={() => setEditingTipReport(null)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSaveTipReport} className="gap-1.5">
                                    <DollarSign className="w-4 h-4" />
                                    Save Tip Report
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Edit One-Time Shift Modal ─────────────────────────────── */}
                {editingScheduleShift && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                        onClick={() => setEditingScheduleShift(null)}
                    >
                        <div
                            className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[90vh] flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        {formatDisplayName(editingScheduleShift.shift.employeeName)}
                                    </h3>
                                    <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                                        <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                                        Shift · {capitalize(editingScheduleShift.shift.period)}
                                        <Badge variant="outline" className={`text-[9px] ml-1 ${
                                            editingScheduleShift.shift.role === 'front'
                                                ? 'border-blue-200 text-blue-600 bg-blue-50'
                                                : 'border-orange-200 text-orange-600 bg-orange-50'
                                        }`}>
                                            {editingScheduleShift.shift.role === 'front' ? 'FOH' : 'Kitchen'}
                                        </Badge>
                                    </p>
                                </div>
                                <button
                                    onClick={() => setEditingScheduleShift(null)}
                                    className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                                {/* Date indicator */}
                                <div className="text-xs text-violet-600 bg-violet-50 px-3 py-2 rounded-lg flex items-center gap-1.5 font-medium">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Shift date:{' '}
                                    <span className="font-bold">
                                        {editingScheduleShift.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                </div>

                                {/* Time inputs */}
                                <div>
                                    <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                                        Shift Time
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 mb-1 block">Start</label>
                                            <input
                                                type="time"
                                                value={editStartTime}
                                                onChange={e => setEditStartTime(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 mb-1 block">End</label>
                                            <input
                                                type="time"
                                                value={editEndTime}
                                                onChange={e => setEditEndTime(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    className="w-full justify-start gap-2"
                                    variant="outline"
                                    onClick={() => handleEditScheduleShift(editingScheduleShift.shift.id, editStartTime, editEndTime)}
                                >
                                    <Pencil className="w-4 h-4" />
                                    Save times
                                </Button>

                                <hr />

                                {/* Modified Time */}
                                <div>
                                    <div className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-green-600" />
                                        Modified Time
                                    </div>
                                    <p className="text-[11px] text-gray-400 mb-3">
                                        Adjust for early prep, late cleanup, or any schedule change.
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 mb-1 block">Time In</label>
                                            <input
                                                type="time"
                                                value={editActualIn}
                                                onChange={e => setEditActualIn(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 mb-1 block">Time Out</label>
                                            <input
                                                type="time"
                                                value={editActualOut}
                                                onChange={e => setEditActualOut(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                    {(editActualIn || editActualOut) && (
                                        <div className="mt-2 space-y-2">
                                            <Button
                                                className="w-full justify-start gap-2"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSaveScheduleModifiedTime(editingScheduleShift.shift.id, editActualIn, editActualOut)}
                                            >
                                                <Clock className="w-3.5 h-3.5" />
                                                Save modified time
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <hr />

                                {/* Delete */}
                                <Button
                                    className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    variant="ghost"
                                    onClick={() => handleDeleteScheduleShift(editingScheduleShift.shift.id)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Remove this shift
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Employee Detail Modal ──────────────────────────────────── */}
                {selectedEmployee && (() => {
                    const stats = getEmployeeStats(selectedEmployee.id);
                    const primaryRole = selectedEmployee.role;
                    const isFront = primaryRole === 'front';
                    const isBoth = primaryRole === 'both';
                    const isUnassigned = primaryRole === 'unassigned';
                    return (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                            onClick={() => setSelectedEmployee(null)}
                        >
                            <div
                                className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between p-5 border-b flex-shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl ${isUnassigned ? 'bg-gray-100' : isBoth ? 'bg-purple-100' : isFront ? 'bg-blue-100' : 'bg-orange-100'}`}>
                                            {isUnassigned
                                                ? <UserCog className="w-5 h-5 text-gray-500" />
                                                : isBoth
                                                    ? <Users className="w-5 h-5 text-purple-600" />
                                                    : isFront
                                                        ? <Users className="w-5 h-5 text-blue-600" />
                                                        : <ChefHat className="w-5 h-5 text-orange-600" />
                                            }
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">{formatDisplayName(selectedEmployee.name)}</h3>
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {isUnassigned ? (
                                                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">
                                                        Unassigned
                                                    </Badge>
                                                ) : isBoth ? (
                                                    <>
                                                        <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-50">FOH</Badge>
                                                        <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700 bg-orange-50">Kitchen</Badge>
                                                    </>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] ${
                                                            isFront
                                                                ? 'border-blue-300 text-blue-700 bg-blue-50'
                                                                : 'border-orange-300 text-orange-700 bg-orange-50'
                                                        }`}
                                                    >
                                                        {isFront ? 'Front of House' : 'Kitchen'}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedEmployee(null)}
                                        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Role Selector */}
                                <div className="px-5 pt-4 pb-2 border-b flex-shrink-0">
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assign Role</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            onClick={() => handleUpdateEmployeeRole(selectedEmployee, 'front')}
                                            className={`px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                                                primaryRole === 'front'
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600'
                                            }`}
                                        >
                                            <Users className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                                            FOH
                                        </button>
                                        <button
                                            onClick={() => handleUpdateEmployeeRole(selectedEmployee, 'kitchen')}
                                            className={`px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                                                primaryRole === 'kitchen'
                                                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                                                    : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50 text-gray-600'
                                            }`}
                                        >
                                            <ChefHat className="w-4 h-4 mx-auto mb-1 text-orange-500" />
                                            Kitchen
                                        </button>
                                        <button
                                            onClick={() => handleUpdateEmployeeRole(selectedEmployee, 'both')}
                                            className={`px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${
                                                primaryRole === 'both'
                                                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                                                    : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-600'
                                            }`}
                                        >
                                            <Check className="w-4 h-4 mx-auto mb-1 text-purple-500" />
                                            Both
                                        </button>
                                    </div>
                                </div>

                                {/* Stats Summary */}
                                <div className="grid grid-cols-2 gap-3 p-5 border-b flex-shrink-0">
                                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                                        <Clock className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                        <div className="text-2xl font-bold text-gray-900">
                                            {formatHours(stats.totalWeeklyHours)}
                                        </div>
                                        <div className="text-xs text-gray-500">per week</div>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                                        <Calendar className="w-5 h-5 text-gray-400 mx-auto mb-1" />
                                        <div className="text-2xl font-bold text-gray-900">
                                            {stats.shiftCount}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {stats.shiftCount === 1 ? 'shift' : 'shifts'} assigned
                                        </div>
                                    </div>
                                </div>

                                {/* Shift List */}
                                <div className="flex-1 overflow-y-auto p-5">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Weekly Schedule</h4>
                                    {stats.byDay.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                            <p className="text-sm text-gray-400">No shifts assigned yet</p>
                                            <p className="text-xs text-gray-400 mt-1">Drag this employee onto the calendar to assign shifts</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {stats.byDay.map(({ day, shifts: dayShifts }) => (
                                                <div key={day}>
                                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                                        {capitalize(day)}
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        {dayShifts.map(shift => {
                                                            const duration = getShiftDurationHours(shift.startTime, shift.endTime);
                                                            const shiftIsFront = shift.role === 'front';
                                                            return (
                                                                <div
                                                                    key={shift.id}
                                                                    className={`flex items-center justify-between p-3 rounded-lg ${
                                                                        shiftIsFront ? 'bg-blue-50' : 'bg-orange-50'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-center gap-2.5">
                                                                        {shift.period === 'lunch'
                                                                            ? <Sun className="w-4 h-4 text-amber-500" />
                                                                            : <Moon className="w-4 h-4 text-indigo-500" />
                                                                        }
                                                                        <div>
                                                                            <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                                                                                {capitalize(shift.period)}
                                                                                <Badge variant="outline" className={`text-[9px] ${
                                                                                    shiftIsFront
                                                                                        ? 'border-blue-200 text-blue-600 bg-blue-50'
                                                                                        : 'border-orange-200 text-orange-600 bg-orange-50'
                                                                                }`}>
                                                                                    {shiftIsFront ? 'FOH' : 'Kitchen'}
                                                                                </Badge>
                                                                            </div>
                                                                            <div className="text-xs text-gray-500">
                                                                                {formatTimeShort(shift.startTime)} – {formatTimeShort(shift.endTime)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-sm font-semibold text-gray-700">
                                                                            {formatHours(duration)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="p-4 border-t flex-shrink-0 flex items-center gap-3">
                                    <Button
                                        variant="ghost"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
                                        onClick={() => {
                                            setSelectedEmployee(null);
                                            handleDeleteEmployee(selectedEmployee);
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Remove Employee
                                    </Button>
                                    <div className="flex-1" />
                                    <Button variant="outline" onClick={() => setSelectedEmployee(null)}>
                                        Close
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* ─── Add Employee Modal ─────────────────────────────────── */}
                {isAddingEmployee && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                            <div className="flex items-center justify-between p-6 border-b">
                                <h3 className="text-xl font-bold">Add New Employee</h3>
                                <button
                                    onClick={() => setIsAddingEmployee(false)}
                                    className="p-1 hover:bg-gray-100 rounded-full"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={newEmployee.name}
                                        onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Primary Role <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={newEmployee.role}
                                        onChange={e => setNewEmployee({ ...newEmployee, role: e.target.value as EmployeeRole })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="unassigned">Unassigned (set later)</option>
                                        <option value="front">Front of House</option>
                                        <option value="kitchen">Kitchen</option>
                                        <option value="both">Both (FOH & Kitchen)</option>
                                    </select>
                                    <p className="text-xs text-gray-400 mt-1">Role can be changed at any time from the employee detail view.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-6 border-t bg-gray-50 rounded-b-xl">
                                <Button variant="outline" onClick={() => setIsAddingEmployee(false)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button onClick={handleAddEmployee} className="flex-1">
                                    Add Employee
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}

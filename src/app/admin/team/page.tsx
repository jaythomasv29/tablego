'use client';

import AdminLayout from '@/components/AdminLayout';
import { useEffect, useState, useRef } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import toast, { Toaster } from 'react-hot-toast';
import {
    Plus,
    X,
    Users,
    ChefHat,
    Sun,
    Moon,
    GripVertical,
    Trash2,
    UserCog,
    Check,
    PanelLeftClose,
    PanelLeftOpen,
    Printer,
    Share2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageTransition from '@/components/PageTransition';

// ─── Types ──────────────────────────────────────────────────────────────────

type EmployeeRole = 'front' | 'kitchen' | 'both' | 'unassigned';
type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
type Period = 'lunch' | 'dinner';
type RoleTab = 'front' | 'kitchen';

interface Employee {
    id: string;
    name: string;
    role: EmployeeRole;
}

interface WeeklyShift {
    id: string;
    employeeId: string;
    employeeName: string;
    role: RoleTab;
    dayOfWeek: DayOfWeek;
    period: Period;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DISPLAY_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// ─── Helpers ────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDisplayName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminTeam() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [weeklyShifts, setWeeklyShifts] = useState<WeeklyShift[]>([]);
    const [activeTab, setActiveTab] = useState<RoleTab>('front');
    const [loading, setLoading] = useState(true);
    const [showSidebar, setShowSidebar] = useState(true);

    // Drag state
    const [draggedEmployee, setDraggedEmployee] = useState<Employee | null>(null);
    const [dragOverCell, setDragOverCell] = useState<string | null>(null);
    const draggedRef = useRef<Employee | null>(null);

    // Modals
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
    const [isAddingEmployee, setIsAddingEmployee] = useState(false);
    const [newEmployee, setNewEmployee] = useState<{ name: string; role: EmployeeRole }>({ name: '', role: 'unassigned' });

    // ─── Firestore listeners ───────────────────────────────────────────────

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'employees'), (snap) => {
            setEmployees(
                snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as Employee))
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
        });
        return unsub;
    }, []);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'weeklySchedule'), (snap) => {
            setWeeklyShifts(snap.docs.map(d => ({ id: d.id, ...d.data() } as WeeklyShift)));
            setLoading(false);
        });
        return unsub;
    }, []);

    // ─── Derived data ──────────────────────────────────────────────────────

    const getShiftsForCell = (day: DayOfWeek, period: Period, role: RoleTab): WeeklyShift[] =>
        weeklyShifts.filter(s => s.dayOfWeek === day && s.period === period && s.role === role);

    const frontEmployees = employees.filter(e => e.role === 'front' || e.role === 'both');
    const kitchenEmployees = employees.filter(e => e.role === 'kitchen' || e.role === 'both');
    const unassignedEmployees = employees.filter(e => e.role === 'unassigned');

    // ─── Employee handlers ─────────────────────────────────────────────────

    const handleAddEmployee = async () => {
        if (!newEmployee.name.trim()) {
            toast.error('Name is required');
            return;
        }
        await addDoc(collection(db, 'employees'), {
            name: newEmployee.name.trim(),
            role: newEmployee.role,
        });
        toast.success(`${newEmployee.name.trim()} added`);
        setNewEmployee({ name: '', role: 'unassigned' });
        setIsAddingEmployee(false);
    };

    const handleDeleteEmployee = async (emp: Employee) => {
        if (!confirm(`Remove ${emp.name} from the team? Their scheduled shifts will also be removed.`)) return;
        await deleteDoc(doc(db, 'employees', emp.id));
        const empShifts = weeklyShifts.filter(s => s.employeeId === emp.id);
        for (const s of empShifts) {
            await deleteDoc(doc(db, 'weeklySchedule', s.id));
        }
        toast.success(`${emp.name} removed`);
        setSelectedEmployee(null);
    };

    const handleUpdateEmployeeRole = async (emp: Employee, role: EmployeeRole) => {
        await updateDoc(doc(db, 'employees', emp.id), { role });
        setSelectedEmployee(prev => prev ? { ...prev, role } : null);
        toast.success('Role updated');
    };

    // ─── Schedule handlers ─────────────────────────────────────────────────

    const handleAddWeeklyShift = async (employeeId: string, dayOfWeek: DayOfWeek, period: Period, role: RoleTab) => {
        const employee = employees.find(e => e.id === employeeId);
        if (!employee) return;

        const dup = weeklyShifts.find(
            s => s.employeeId === employeeId && s.dayOfWeek === dayOfWeek && s.period === period && s.role === role
        );
        if (dup) {
            toast.error(`${employee.name} is already in this slot`);
            return;
        }

        await addDoc(collection(db, 'weeklySchedule'), {
            employeeId,
            employeeName: employee.name,
            role,
            dayOfWeek,
            period,
        });
    };

    const handleRemoveWeeklyShift = async (shiftId: string) => {
        await deleteDoc(doc(db, 'weeklySchedule', shiftId));
    };

    // ─── Drag handlers ─────────────────────────────────────────────────────

    const handleDragStart = (e: React.DragEvent, employee: Employee) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ id: employee.id }));
        e.dataTransfer.effectAllowed = 'copy';
        setDraggedEmployee(employee);
        draggedRef.current = employee;
    };

    const handleDragEnd = () => {
        setDraggedEmployee(null);
        draggedRef.current = null;
        setDragOverCell(null);
    };

    const handleCellDrop = (e: React.DragEvent, day: DayOfWeek, period: Period, role: RoleTab) => {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        handleAddWeeklyShift(data.id, day, period, role);
        setDragOverCell(null);
        setDraggedEmployee(null);
        draggedRef.current = null;
    };

    // ─── Print / Share ─────────────────────────────────────────────────────

    const handlePrint = () => window.print();

    const handleShare = async () => {
        const lines: string[] = ['📅 Thaiphoon Weekly Schedule\n'];

        for (const [sectionLabel, role] of [['👥 Front of House', 'front'], ['🍳 Kitchen', 'kitchen']] as [string, RoleTab][]) {
            lines.push(sectionLabel);
            for (const period of ['lunch', 'dinner'] as Period[]) {
                const dayNames = DISPLAY_DAYS.map(day => {
                    const shifts = getShiftsForCell(day, period, role);
                    return shifts.length ? shifts.map(s => formatDisplayName(s.employeeName)).join(', ') : '—';
                });
                lines.push(`  ${capitalize(period)}: ${DISPLAY_DAYS.map((d, i) => `${capitalize(d.slice(0, 3))}: ${dayNames[i]}`).join(' | ')}`);
            }
            lines.push('');
        }

        const text = lines.join('\n');

        if (navigator.share) {
            try {
                await navigator.share({ title: 'Thaiphoon Weekly Schedule', text });
            } catch {
                // user cancelled — do nothing
            }
        } else {
            await navigator.clipboard.writeText(text);
            toast.success('Schedule copied to clipboard');
        }
    };

    // ─── Render helpers ────────────────────────────────────────────────────

    const renderCell = (day: DayOfWeek, period: Period) => {
        const role = activeTab;
        const cellKey = `${day}-${period}-${role}`;
        const isOver = dragOverCell === cellKey;
        const isDragging = !!draggedEmployee;
        const cellShifts = getShiftsForCell(day, period, role);

        const isFOH = role === 'front';
        const overBg = isFOH ? 'bg-blue-100/80 ring-2 ring-inset ring-blue-400 ring-dashed' : 'bg-orange-100/80 ring-2 ring-inset ring-orange-400 ring-dashed';
        const idleBg = isDragging ? (isFOH ? 'bg-blue-50/40' : 'bg-orange-50/40') : '';
        const chipBg = isFOH ? 'bg-blue-100 ring-blue-300 text-blue-900' : 'bg-orange-100 ring-orange-300 text-orange-900';
        const hintColor = isFOH ? 'border-blue-300 text-blue-400' : 'border-orange-300 text-orange-400';

        return (
            <div
                key={cellKey}
                className={`border-r p-1.5 min-h-[88px] transition-all duration-100 ${isOver ? overBg : idleBg}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverCell(cellKey); }}
                onDragLeave={() => setDragOverCell(null)}
                onDrop={(e) => handleCellDrop(e, day, period, role)}
            >
                <div className="space-y-1">
                    {cellShifts.map(shift => (
                        <div
                            key={shift.id}
                            className={`px-2 py-1.5 rounded-md text-xs group ring-1 ${chipBg}`}
                        >
                            <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold truncate text-[11px]">
                                    {formatDisplayName(shift.employeeName)}
                                </span>
                                <button
                                    onClick={() => handleRemoveWeeklyShift(shift.id)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/60 transition-opacity flex-shrink-0"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {isDragging && cellShifts.length === 0 && (
                        <div className={`p-2 border-2 border-dashed rounded-md text-center text-[10px] ${hintColor}`}>
                            <Plus className="w-3 h-3 mx-auto mb-0.5" />
                            Drop here
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderRow = (period: Period) => (
        <div key={period} className="grid grid-cols-8 border-b last:border-b-0">
            {/* Row label */}
            <div className="p-3 border-r flex items-center gap-2 bg-gray-50">
                {period === 'lunch'
                    ? <Sun className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    : <Moon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                }
                <span className="text-sm font-medium text-gray-600">{capitalize(period)}</span>
            </div>
            {DISPLAY_DAYS.map(day => renderCell(day, period))}
        </div>
    );

    const renderEmployeeChip = (emp: Employee, color: 'blue' | 'orange' | 'gray') => {
        const bg = color === 'blue' ? 'bg-blue-50 border-blue-200' : color === 'orange' ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200';
        const text = color === 'blue' ? 'text-blue-800' : color === 'orange' ? 'text-orange-800' : 'text-gray-700';
        return (
            <div
                key={emp.id}
                draggable
                onDragStart={(e) => handleDragStart(e, emp)}
                onDragEnd={handleDragEnd}
                onClick={() => setSelectedEmployee(emp)}
                className={`flex items-center gap-2 px-2.5 py-2 border rounded-lg cursor-grab active:cursor-grabbing hover:shadow-sm transition-all ${bg} ${draggedEmployee?.id === emp.id ? 'opacity-40' : ''}`}
            >
                <GripVertical className={`w-3.5 h-3.5 flex-shrink-0 opacity-40 ${text}`} />
                <span className={`text-xs font-medium truncate ${text}`}>{formatDisplayName(emp.name)}</span>
                {emp.role === 'both' && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-300 text-purple-600 bg-purple-50 ml-auto flex-shrink-0">Both</Badge>
                )}
            </div>
        );
    };

    // ─── Loading ───────────────────────────────────────────────────────────

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                </div>
            </AdminLayout>
        );
    }

    // ─── Main render ───────────────────────────────────────────────────────

    return (
        <AdminLayout>
            <PageTransition>
                <Toaster
                    position="top-center"
                    toastOptions={{
                        duration: 3000,
                        style: { background: '#363636', color: '#fff', zIndex: 9999 },
                    }}
                />

                {/* Print styles */}
                <style>{`
                    @media print {
                        body * { visibility: hidden !important; }
                        #print-schedule { display: block !important; visibility: visible !important; position: fixed; inset: 0; padding: 32px; background: white; }
                        #print-schedule * { visibility: visible !important; }
                    }
                `}</style>

                {/* Header */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Team Schedule</h1>
                        <p className="text-gray-500 mt-1 text-sm">Drag staff onto the grid to build the recurring weekly schedule.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleShare}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                        >
                            <Share2 className="w-4 h-4" />
                            Share
                        </button>
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            Print
                        </button>
                        <button
                            onClick={() => setShowSidebar(v => !v)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                        >
                            {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                            {showSidebar ? 'Hide Staff' : 'Show Staff'}
                        </button>
                    </div>
                </div>

                <div className="flex gap-4 items-start">

                    {/* ── Sidebar ─────────────────────────────────────────── */}
                    {showSidebar && (
                        <div className="w-52 flex-shrink-0 space-y-3">

                            {/* Front of House */}
                            <Card>
                                <CardContent className="p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-blue-50 rounded-md">
                                            <Users className="w-3.5 h-3.5 text-blue-500" />
                                        </div>
                                        <span className="text-xs font-semibold text-gray-700">Front of House</span>
                                        <Badge variant="outline" className="text-[10px] px-1.5 ml-auto">{frontEmployees.length}</Badge>
                                    </div>
                                    <div className="space-y-1.5">
                                        {frontEmployees.length === 0 ? (
                                            <p className="text-[11px] text-gray-400 text-center py-2">No staff yet</p>
                                        ) : (
                                            frontEmployees.map(e => renderEmployeeChip(e, 'blue'))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Kitchen */}
                            <Card>
                                <CardContent className="p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-orange-50 rounded-md">
                                            <ChefHat className="w-3.5 h-3.5 text-orange-500" />
                                        </div>
                                        <span className="text-xs font-semibold text-gray-700">Kitchen</span>
                                        <Badge variant="outline" className="text-[10px] px-1.5 ml-auto">{kitchenEmployees.length}</Badge>
                                    </div>
                                    <div className="space-y-1.5">
                                        {kitchenEmployees.length === 0 ? (
                                            <p className="text-[11px] text-gray-400 text-center py-2">No staff yet</p>
                                        ) : (
                                            kitchenEmployees.map(e => renderEmployeeChip(e, 'orange'))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Unassigned */}
                            {unassignedEmployees.length > 0 && (
                                <Card className="border-dashed">
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="p-1.5 bg-gray-50 rounded-md">
                                                <UserCog className="w-3.5 h-3.5 text-gray-400" />
                                            </div>
                                            <span className="text-xs font-semibold text-gray-500">Unassigned</span>
                                            <Badge variant="outline" className="text-[10px] px-1.5 ml-auto">{unassignedEmployees.length}</Badge>
                                        </div>
                                        <div className="space-y-1.5">
                                            {unassignedEmployees.map(emp => (
                                                <div key={emp.id} className="group">
                                                    {renderEmployeeChip(emp, 'gray')}
                                                    <div className="hidden group-hover:flex gap-1 mt-1 px-1">
                                                        <button
                                                            onClick={() => handleUpdateEmployeeRole(emp, 'front')}
                                                            className="flex-1 text-[10px] py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors font-medium"
                                                        >
                                                            FOH
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateEmployeeRole(emp, 'kitchen')}
                                                            className="flex-1 text-[10px] py-1 bg-orange-50 text-orange-600 rounded hover:bg-orange-100 transition-colors font-medium"
                                                        >
                                                            Kitchen
                                                        </button>
                                                        <button
                                                            onClick={() => handleUpdateEmployeeRole(emp, 'both')}
                                                            className="flex-1 text-[10px] py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 transition-colors font-medium"
                                                        >
                                                            Both
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Add Employee */}
                            <button
                                onClick={() => setIsAddingEmployee(true)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Add Employee
                            </button>
                        </div>
                    )}

                    {/* ── Grid ────────────────────────────────────────────── */}
                    <div className="flex-1 min-w-0">
                        <Card className="overflow-hidden">
                            {/* Tab Bar */}
                            <div className="flex border-b bg-white">
                                {(['front', 'kitchen'] as RoleTab[]).map(tab => {
                                    const isActive = activeTab === tab;
                                    const color = tab === 'front'
                                        ? isActive ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-blue-500'
                                        : isActive ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-orange-500';
                                    return (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${color}`}
                                        >
                                            {tab === 'front'
                                                ? <Users className="w-4 h-4" />
                                                : <ChefHat className="w-4 h-4" />
                                            }
                                            {tab === 'front' ? 'Front of House' : 'Kitchen'}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Column Headers */}
                            <div className="grid grid-cols-8 border-b bg-gray-50">
                                <div className="p-3 border-r" />
                                {DISPLAY_DAYS.map(day => (
                                    <div key={day} className="p-3 border-r last:border-r-0 text-center">
                                        <span className="text-sm font-semibold text-gray-700 capitalize">
                                            {day.slice(0, 3)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Rows */}
                            <div>
                                {renderRow('lunch')}
                                {renderRow('dinner')}
                            </div>
                        </Card>

                        {/* Legend */}
                        <div className="mt-3 flex items-center gap-5 px-1 text-xs text-gray-400">
                            <span className="flex items-center gap-1.5">
                                <GripVertical className="w-3.5 h-3.5" />
                                Drag to assign
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Sun className="w-3.5 h-3.5 text-amber-400" />
                                Lunch
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                                Dinner
                            </span>
                            <span className="flex items-center gap-1.5">
                                <X className="w-3 h-3" />
                                Hover chip to remove
                            </span>
                        </div>
                    </div>
                </div>

                {/* ─── Employee Detail Modal ──────────────────────────────── */}
                {selectedEmployee && (() => {
                    const emp = selectedEmployee;
                    const isFront = emp.role === 'front';
                    const isBoth = emp.role === 'both';
                    const isUnassigned = emp.role === 'unassigned';
                    const iconBg = isUnassigned ? 'bg-gray-100' : isBoth ? 'bg-purple-100' : isFront ? 'bg-blue-100' : 'bg-orange-100';
                    return (
                        <div
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                            onClick={() => setSelectedEmployee(null)}
                        >
                            <div
                                className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between p-5 border-b">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-xl ${iconBg}`}>
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
                                            <h3 className="text-lg font-bold text-gray-900">{formatDisplayName(emp.name)}</h3>
                                            <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                                {isUnassigned ? (
                                                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">Unassigned</Badge>
                                                ) : isBoth ? (
                                                    <>
                                                        <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-50">FOH</Badge>
                                                        <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700 bg-orange-50">Kitchen</Badge>
                                                    </>
                                                ) : (
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[10px] ${isFront ? 'border-blue-300 text-blue-700 bg-blue-50' : 'border-orange-300 text-orange-700 bg-orange-50'}`}
                                                    >
                                                        {isFront ? 'Front of House' : 'Kitchen'}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedEmployee(null)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Role Selector */}
                                <div className="p-5 border-b">
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Assign Role</div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([
                                            { role: 'front' as EmployeeRole, label: 'FOH', icon: <Users className="w-4 h-4 mx-auto mb-1 text-blue-500" />, active: 'border-blue-500 bg-blue-50 text-blue-700', inactive: 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600' },
                                            { role: 'kitchen' as EmployeeRole, label: 'Kitchen', icon: <ChefHat className="w-4 h-4 mx-auto mb-1 text-orange-500" />, active: 'border-orange-500 bg-orange-50 text-orange-700', inactive: 'border-gray-200 hover:border-orange-300 hover:bg-orange-50 text-gray-600' },
                                            { role: 'both' as EmployeeRole, label: 'Both', icon: <Check className="w-4 h-4 mx-auto mb-1 text-purple-500" />, active: 'border-purple-500 bg-purple-50 text-purple-700', inactive: 'border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-600' },
                                        ]).map(({ role, label, icon, active, inactive }) => (
                                            <button
                                                key={role}
                                                onClick={() => handleUpdateEmployeeRole(emp, role)}
                                                className={`px-3 py-2 rounded-lg text-xs font-medium border-2 transition-all ${emp.role === role ? active : inactive}`}
                                            >
                                                {icon}
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="p-4 flex items-center gap-3">
                                    <Button
                                        variant="ghost"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
                                        onClick={() => handleDeleteEmployee(emp)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Remove
                                    </Button>
                                    <div className="flex-1" />
                                    <Button variant="outline" onClick={() => setSelectedEmployee(null)}>Close</Button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* ─── Print-only view ───────────────────────────────────── */}
                <div id="print-schedule" className="hidden">
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 11, color: '#A3B18A', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Thaiphoon Restaurant</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#121212' }}>Weekly Schedule</div>
                    </div>
                    {(['front', 'kitchen'] as RoleTab[]).map(role => (
                        <div key={role} style={{ marginBottom: 28 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: role === 'front' ? '#1d4ed8' : '#c2410c', marginBottom: 8 }}>
                                {role === 'front' ? 'Front of House' : 'Kitchen'}
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 64, border: '1px solid #e5e7eb', padding: '6px 10px', background: '#f9fafb', textAlign: 'left' }} />
                                        {DISPLAY_DAYS.map(day => (
                                            <th key={day} style={{ border: '1px solid #e5e7eb', padding: '6px 10px', background: '#f9fafb', textAlign: 'center', fontWeight: 600, textTransform: 'capitalize' }}>
                                                {day.slice(0, 3)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(['lunch', 'dinner'] as Period[]).map(period => (
                                        <tr key={period}>
                                            <td style={{ border: '1px solid #e5e7eb', padding: '8px 10px', background: '#f9fafb', fontWeight: 600, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                                                {capitalize(period)}
                                            </td>
                                            {DISPLAY_DAYS.map(day => {
                                                const shifts = getShiftsForCell(day, period, role);
                                                return (
                                                    <td key={day} style={{ border: '1px solid #e5e7eb', padding: '8px 10px', verticalAlign: 'top', minWidth: 80 }}>
                                                        {shifts.map(s => (
                                                            <div key={s.id} style={{ marginBottom: 2 }}>{formatDisplayName(s.employeeName)}</div>
                                                        ))}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>

                {/* ─── Add Employee Modal ─────────────────────────────────── */}
                {isAddingEmployee && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                            <div className="flex items-center justify-between p-6 border-b">
                                <h3 className="text-xl font-bold">Add New Employee</h3>
                                <button onClick={() => setIsAddingEmployee(false)} className="p-1 hover:bg-gray-100 rounded-full">
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
                                        onKeyDown={e => e.key === 'Enter' && handleAddEmployee()}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="John Doe"
                                        autoFocus
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
                                    <p className="text-xs text-gray-400 mt-1">Role can be changed anytime from the employee detail view.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-6 border-t bg-gray-50 rounded-b-xl">
                                <Button variant="outline" onClick={() => setIsAddingEmployee(false)} className="flex-1">Cancel</Button>
                                <Button onClick={handleAddEmployee} className="flex-1">Add Employee</Button>
                            </div>
                        </div>
                    </div>
                )}

            </PageTransition>
        </AdminLayout>
    );
}

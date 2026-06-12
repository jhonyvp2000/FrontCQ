"use client";

import { useState } from "react";
import { format, parseISO, addDays, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, User, ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
function calculateDetailedAge(dobValue: Date | string | null | undefined): string {
    if (!dobValue) return "?";
    const birthDate = typeof dobValue === "string" ? new Date(dobValue) : dobValue;
    if (isNaN(birthDate.getTime())) return "?";

    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();

    if (days < 0) {
        const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        days += prevMonth.getDate();
        months--;
    }

    if (months < 0) {
        months += 12;
        years--;
    }

    if (years < 1) {
        const mStr = String(months).padStart(2, "0");
        const dStr = String(days).padStart(2, "0");
        return `${mStr}m${dStr}d`;
    }

    return String(years).padStart(2, "0") + "a";
}

export const formatPatientDemographics = (patientPii: any, patient: any, bedNumber?: string | null) => {
    const fullName = `${patientPii?.nombres || ''} ${patientPii?.apellidos || ''}`.trim();
    if (!fullName || fullName === 'Desconocido') return <span className="text-zinc-500 font-normal">Desconocido</span>;

    let sexStr = '?';
    const sexo = patient?.sexo || patientPii?.sexo;
    if (sexo) {
        if (sexo.toUpperCase().startsWith('F')) sexStr = 'F';
        else if (sexo.toUpperCase().startsWith('M')) sexStr = 'M';
        else sexStr = sexo.substring(0, 1).toUpperCase();
    }

    let ageStr = '?';
    const dob = patient?.fechaNacimiento || patientPii?.fechaNacimiento || patientPii?.fecha_nacimiento;
    if (dob) {
        ageStr = calculateDetailedAge(dob);
    }

    const hcStr = patientPii?.historiaClinica || '?';
    const dni = patientPii?.dni || patientPii?.carnetExtranjeria || patientPii?.pasaporte || patientPii?.numeroDocumento || patient?.dni || '';
    const bloodGroupRh = patientPii?.bloodGroupRh;

    return (
        <span className="inline">
            <span className="font-bold text-zinc-950 dark:text-zinc-100">{fullName}</span>{' '}
            <span className="font-normal text-zinc-950 dark:text-zinc-100">
                {dni} ({sexStr} {ageStr} HC: {hcStr}{bloodGroupRh ? ` GFS: ${bloodGroupRh}` : ''}){bedNumber ? ` C: ${bedNumber}` : ''}
            </span>
        </span>
    );
};

export function SurgeryTimeline({ surgeriesData, salas, displayDate, setDisplayDate, diagnoses = [], procedures = [], interventions = [], staff, onClose }: { surgeriesData: any[], salas: any[], displayDate: string, setDisplayDate: (d: string) => void, diagnoses?: any[], procedures?: any[], interventions?: any[], staff?: any, onClose?: () => void }) {
    const parsedDate = displayDate ? new Date(displayDate + "T12:00:00") : new Date();

    // Helper to get consistent hours ignoring browser local timezone cache
    const getLimaTime = (d: Date) => {
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }).format(d).split(':');
        return { h: parseInt(parts[0], 10), m: parseInt(parts[1], 10) };
    };

    const nextDay = () => setDisplayDate(format(addDays(parsedDate, 1), 'yyyy-MM-dd'));
    const prevDay = () => setDisplayDate(format(addDays(parsedDate, -1), 'yyyy-MM-dd'));
    const today = () => setDisplayDate(format(new Date(), 'yyyy-MM-dd'));

    // Tiempo actual para la línea rastreadora en vivo
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        // Actualiza la línea de tiempo cada minuto (60000ms) UX Premium
        const interval = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    // Determinar si el día mostrado en el canvas es hoy
    const isShowingToday = isSameDayStr(parsedDate, new Date());
    
    // Calcular altura del indicador rojo según los 13 bloques visuales (07:00 a 20:00)
    const { h: curH, m: curM } = getLimaTime(currentTime);
    const currentHour = curH + (curM / 60);
    const isTimelineActive = currentHour >= 7 && currentHour <= 20.5;
    const timeIndicatorTop = ((currentHour - 7) / 13) * 100;

    // Utilidad para buscar colisiones en el mismo día
    function isSameDayStr(d1: Date | string, d2: Date) {
        const date1 = new Date(d1);
        return date1.getFullYear() === d2.getFullYear() &&
            date1.getMonth() === d2.getMonth() &&
            date1.getDate() === d2.getDate();
    }

    // Escala de tiempo: 07:00 a 20:00
    const timeSlots = Array.from({ length: 14 }).map((_, i) => i + 7);
    const isWeekView = salas.length === 1;

    // Configuración dinámica del Eje X
    const columnsConfig = isWeekView
        ? Array.from({ length: 7 }).map((_, i) => {
            const day = addDays(startOfWeek(parsedDate, { weekStartsOn: 1 }), i);
            return {
                id: format(day, "yyyy-MM-dd"),
                name: format(day, "EEEE dd", { locale: es }),
                date: day,
                salaId: salas[0].id
            };
        })
        : [
            ...salas.map(sala => ({
                id: sala.id,
                name: sala.name,
                date: parsedDate,
                salaId: sala.id
            })),
            {
                id: "unassigned",
                name: "Por Asignar",
                date: parsedDate,
                salaId: null // special identifier for unassigned
            }
        ];

    // Helper functions para el canvas
    const getSurgeryPosition = (dateStr: Date | string, durationStr: string) => {
        const date = new Date(dateStr);
        const { h, m } = getLimaTime(date);
        const startHour = h + m / 60;

        let durationHours = 1;
        if (durationStr?.toLowerCase().includes('30 min')) durationHours = 0.5;
        else if (durationStr?.toLowerCase().includes('1 hora')) durationHours = 1;
        else if (durationStr?.toLowerCase().includes('2 hor')) durationHours = 2;
        else if (durationStr?.toLowerCase().includes('3 hor')) durationHours = 3;
        else if (durationStr?.toLowerCase().includes('4')) durationHours = 4;
        else durationHours = parseInt(durationStr) || 1;

        // Boundaries
        const renderStartHour = Math.max(7, Math.min(20, startHour));
        const gridTop = ((renderStartHour - 7) / 13) * 100;
        const height = (durationHours / 13) * 100;

        return { top: `${gridTop}%`, height: `${height}%` };
    };

    return (
        <div className="flex flex-col bg-white dark:bg-[#121212] fixed inset-0 z-[100] w-screen h-screen overflow-hidden">
            {/* Header del Canvas */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/20">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                        <CalendarIcon size={18} className="text-[var(--color-hospital-blue)]" />
                        Canvas de Programación Quirúrgica {isWeekView && `(${salas[0].name})`}
                    </h3>
                </div>

                <div className="flex items-center gap-3">
                    {onClose && (
                        <button onClick={onClose} className="flex items-center gap-2 px-4 py-2 shrink-0 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800/50 hover:bg-red-100 hover:text-red-700 text-red-600 transition-all shadow-sm tooltip font-bold text-sm" title="Cerrar y volver a la tabla">
                            <X size={16} strokeWidth={2.5} /> Cerrar Timeline
                        </button>
                    )}
                </div>
            </div>

            {/* Canvas Body */}
            <div className="flex flex-1 overflow-auto relative bg-[#fafafa] dark:bg-[#0a0a0a]">
                <div className="w-16 flex-none bg-[#fafafa] dark:bg-[#0a0a0a] border-r border-zinc-200 dark:border-zinc-800 z-10 sticky left-0">
                    <div className="h-12 border-b border-zinc-200 dark:border-zinc-800"></div> {/* Corner Spacer */}
                    <div className="relative h-[800px] w-full">
                        {timeSlots.map(hour => (
                            <div key={hour} className="absolute w-full flex justify-center" style={{ top: `${((hour - 7) / 13) * 100}%`, transform: 'translateY(-50%)' }}>
                                <span className="text-[10px] font-bold text-zinc-400 bg-[#fafafa] dark:bg-[#0a0a0a] px-1">{hour}:00</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* X-Axis Config (Rooms & Days) */}
                <div className="flex-1 min-w-0">
                    {/* Header Columns: Salas o Dias */}
                    <div className="flex h-12 sticky top-0 z-10 bg-white dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
                        {columnsConfig.map(col => {
                            const isSelectedDay = isWeekView && isSameDayStr(col.date, parsedDate);
                            return (
                                <div key={col.id} className={`flex-1 min-w-0 border-r border-zinc-200/50 dark:border-zinc-800 p-2 flex items-center justify-center transition-colors ${isSelectedDay ? 'bg-blue-50/50 dark:bg-blue-900/20 border-b-2 border-b-blue-500' : ''}`}>
                                    <span className={`font-bold text-xs uppercase ${isWeekView ? 'capitalize' : ''} truncate ${isSelectedDay ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                        {col.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Matrix */}
                    <div className="flex relative">
                        {/* Background Grid Lines */}
                        <div className="absolute inset-0 pointer-events-none">
                            {timeSlots.map(hour => (
                                <div key={hour} className="absolute left-0 right-0 border-t border-zinc-200 dark:border-zinc-800/80 w-full" style={{ top: `${((hour - 7) / 13) * 100}%` }}></div>
                            ))}
                            
                            {/* LÍNEA DE TIEMPO REAL INDICADORA (TRACKER ROJO) */}
                            {isShowingToday && isTimelineActive && (
                                <div 
                                    className="absolute left-0 right-0 z-40 flex items-center shadow-lg transition-all duration-1000 ease-in-out" 
                                    style={{ top: `${timeIndicatorTop}%`, transform: 'translateY(-50%)' }}
                                >
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] -ml-1.5 animate-pulse"></div>
                                    <div className="h-[2px] bg-red-500/80 w-full relative">
                                        <div className="absolute -top-4 right-2 text-[10px] font-bold text-red-500 bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 px-1.5 rounded shadow-sm flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span> 
                                            {`${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}`}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {columnsConfig.map(col => {
                            // Filtrar cirugías para esta columna específica
                            const colSurgeries = surgeriesData.filter(s =>
                                (col.salaId === null ? !s.operatingRoom?.id : s.operatingRoom?.id === col.salaId) &&
                                isSameDayStr(s.surgery.scheduledDate, col.date)
                            );

                            const isUnassigned = col.salaId === null;
                            return (
                                <div key={col.id} className={`flex-1 min-w-0 border-r border-dashed border-zinc-200 dark:border-zinc-800/50 relative h-[800px] ${isWeekView && isSameDayStr(col.date, parsedDate) ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''} ${isUnassigned ? 'bg-zinc-100/50 dark:bg-zinc-900/30' : ''}`}> {/* 10 slots * 80px */}

                                    {/* Tarjetas Flotantes */}
                                    <AnimatePresence>
                                        {colSurgeries.map((s, idx) => {
                                            const { top, height } = getSurgeryPosition(s.surgery.scheduledDate, s.surgery.estimatedDuration || "1");
                                            const colorMap: Record<string, { bg: string, border: string, ribbon: string }> = {
                                                'scheduled': { bg: 'var(--color-blue-50)', border: 'var(--color-blue-200)', ribbon: 'bg-blue-500' },
                                                'in_progress': { bg: 'var(--color-amber-50)', border: 'var(--color-amber-200)', ribbon: 'bg-amber-500' },
                                                'anesthesia_start': { bg: 'var(--color-purple-50)', border: 'var(--color-purple-200)', ribbon: 'bg-purple-500' },
                                                'pre_incision': { bg: 'var(--color-fuchsia-50)', border: 'var(--color-fuchsia-200)', ribbon: 'bg-fuchsia-500' },
                                                'surgery_end': { bg: 'var(--color-cyan-50)', border: 'var(--color-cyan-200)', ribbon: 'bg-cyan-500' },
                                                'patient_exit': { bg: 'var(--color-orange-50)', border: 'var(--color-orange-200)', ribbon: 'bg-orange-500' },
                                                'urpa_exit': { bg: 'var(--color-indigo-50)', border: 'var(--color-indigo-200)', ribbon: 'bg-indigo-500' },
                                                'completed': { bg: 'var(--color-emerald-50)', border: 'var(--color-emerald-200)', ribbon: 'bg-emerald-500' },
                                                'cancelled': { bg: 'var(--color-red-50)', border: 'var(--color-red-200)', ribbon: 'bg-red-500' }
                                            };

                                            const isTBD = s.surgery.isTimeDefined === false;
                                            const status = s.surgery.status;
                                            const colors = colorMap[status] || colorMap['scheduled'];

                                            return (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    key={s.surgery.id}
                                                    className={`${isTBD ? 'relative mx-1 mt-1 border-dashed border-[2px]' : 'absolute left-1 right-1'} rounded-lg border shadow-sm py-1.5 px-1.5 overflow-hidden flex flex-col cursor-pointer transition-shadow group z-20`}
                                                    style={isTBD ? {
                                                        backgroundColor: colors.bg,
                                                        borderColor: colors.border,
                                                        minHeight: '60px'
                                                    } : {
                                                        top,
                                                        height,
                                                        minHeight: 'max-content',
                                                        backgroundColor: colors.bg,
                                                        borderColor: colors.border,
                                                        paddingBottom: '8px'
                                                    }}
                                                >
                                                    <div className={`w-1.5 absolute left-0 top-0 bottom-0 ${colors.ribbon} ${isTBD ? 'opacity-50' : ''}`}></div>

                                                    <div className="flex justify-between items-start pl-1.5 pr-0.5 w-full gap-1">
                                                        <span className="text-[11px] font-bold text-zinc-900 leading-none mt-0.5 break-words whitespace-normal relative w-full">
                                                            {isTBD && <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-black px-1 rounded border border-amber-200 dark:border-amber-700/50 uppercase tracking-tighter">Por definir</span>}
                                                            {formatPatientDemographics(s.patientPii, s.patient, s.surgery.bedNumber)}
                                                        </span>
                                                        {s.surgery.urgencyType === 'EMERGENCIA' && (
                                                            <span className="bg-rose-500 text-white px-1 py-0.5 rounded-[3px] text-[8px] uppercase tracking-widest animate-pulse shadow-sm shrink-0 leading-none">
                                                                EMER
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="text-[10px] text-blue-800 dark:text-blue-300 font-normal pl-1.5 mt-1 w-full pr-1 leading-[1.15] break-words whitespace-normal">
                                                        {s.diagnoses && s.diagnoses.length > 0 && typeof diagnoses !== 'undefined' ? (
                                                            <span className="mr-1" title={diagnoses.find(d => d.id === s.diagnoses[0])?.name}>
                                                                <span className="opacity-80">Dx:</span> {diagnoses.find(d => d.id === s.diagnoses[0])?.code} - {diagnoses.find(d => d.id === s.diagnoses[0])?.name}.
                                                            </span>
                                                        ) : s.surgery.diagnosis ? (
                                                            <span className="mr-1" title={s.surgery.diagnosis}>
                                                                <span className="opacity-80">Dx:</span> {s.surgery.diagnosis.split(',')[0]}.
                                                            </span>
                                                        ) : null}

                                                        {s.interventions && s.interventions.length > 0 && typeof interventions !== 'undefined' && (
                                                            <span className="mr-1" title={interventions.find(i => i.id === s.interventions[0])?.name}>
                                                                <span className="opacity-80">In:</span> {interventions.find(i => i.id === s.interventions[0])?.name}.
                                                            </span>
                                                        )}

                                                        {s.procedures && s.procedures.length > 0 && typeof procedures !== 'undefined' && (
                                                            <span className="mr-1" title={procedures.find(p => p.id === s.procedures[0])?.name}>
                                                                <span className="opacity-80">Px:</span> {procedures.find(p => p.id === s.procedures[0])?.code} - {procedures.find(p => p.id === s.procedures[0])?.name}.
                                                            </span>
                                                        )}

                                                        {s.surgery.notes && (
                                                            <span title={s.surgery.notes}>
                                                                <span className="opacity-80">Nota:</span> {s.surgery.notes}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {s.team && s.team.length > 0 && (
                                                        <div className="pl-1.5 opacity-90 group-hover:opacity-100 pt-1 text-[10px] leading-tight break-words whitespace-normal w-full pr-1">
                                                            {s.team.map((t: any) => {
                                                                const firstName = (t.staff.name || '').split(' ')[0] || '';
                                                                const firstLastName = (t.staff.lastname || '').split(' ')[0] || '';
                                                                const shortName = `${firstName} ${firstLastName}`.trim();
                                                                const roleStr = t.role === 'CIRUJANO' ? 'Cx' : t.role === 'ANESTESIOLOGO' ? 'An' : (() => {
                                                                    let profName = t.staff?.professionName || t.professionName;
                                                                    if (!profName && staff?.nurses) {
                                                                        const nurse = staff.nurses.find((n: any) => n.id === t.staff.id);
                                                                        if (nurse) profName = nurse.professionName;
                                                                    }
                                                                    if (!profName) {
                                                                        if (t.role === 'INSTRUMENTISTA') return 'In';
                                                                        if (t.role === 'CIRCULANTE') return 'Ci';
                                                                        return 'CI';
                                                                    }
                                                                    if (profName.includes('INSTRUMENTISTA')) return 'In';
                                                                    if (profName.includes('CIRCULANTE')) return 'Ci';
                                                                    return 'CI';
                                                                })();
                                                                const colorClass = 'text-zinc-900 dark:text-zinc-100';
                                                                return (
                                                                    <span key={t.staff.id} className="inline mr-1 font-normal">
                                                                        <span className="opacity-80">{roleStr}:</span> <span className={colorClass}>{shortName}</span>
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )
                                        })}
                                    </AnimatePresence>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

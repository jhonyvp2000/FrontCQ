"use client";

import { useState, useEffect, Fragment } from "react";
import { LayoutGrid, List as ListIcon, Calendar, ArrowUp, ArrowDown, User, Clock, Hourglass, CheckCircle2, XCircle, FileText, Activity, AlertCircle, Pencil, CopyPlus, AlertTriangle, X, Filter, Search, Maximize2, Minimize2, LogOut } from "lucide-react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateSurgeryStatus } from "@/app/actions/cirugias";
import { signOut } from "next-auth/react";
import { SurgeryTimeline } from "@/components/ui/surgery-timeline";
import { AnimatePresence, motion } from "framer-motion";

function getFormattedDate(dateValue: Date | string | null | undefined, isTimeDefined: boolean = true): React.ReactNode {
    if (!dateValue) return 'Fecha no definida';
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    if (isNaN(date.getTime())) return 'Fecha inválida';

    if (isTimeDefined === false) {
        const datePart = new Intl.DateTimeFormat('es-PE', {
            timeZone: 'America/Lima',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }).format(date);
        return (
            <span className="flex items-center gap-1.5">
                {datePart}
                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shadow-sm">Por definir</span>
            </span>
        );
    }

    return new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date).replace(/[\u202f\u00a0]/g, ' ');
}

function formatDateOnly(dateValue: Date | string | null | undefined): string {
    if (!dateValue) return 'N/A';
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    if (isNaN(date.getTime())) return 'Inválida';
    return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', year: 'numeric' }).format(date).replace(/[\u202f\u00a0]/g, ' ');
}

function formatTimeOnly(dateValue: Date | string | null | undefined): string {
    if (!dateValue) return 'N/A';
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    if (isNaN(date.getTime())) return 'Inválida';
    return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }).format(date).replace(/[\u202f\u00a0]/g, ' ');
}

function formatForDateTimeLocal(dateValue: Date | string | null | undefined): string {
    if (!dateValue) return '';
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    if (isNaN(date.getTime())) return '';
    
    // Adjust to Lima timezone for consistency
    const limaDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Lima' }));
    
    const year = limaDate.getFullYear();
    const month = String(limaDate.getMonth() + 1).padStart(2, '0');
    const day = String(limaDate.getDate()).padStart(2, '0');
    const hours = String(limaDate.getHours()).padStart(2, '0');
    const minutes = String(limaDate.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}
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
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{fullName}</span>{' '}
            <span className="font-normal text-zinc-900 dark:text-zinc-100">
                {dni} ({sexStr} {ageStr} HC: {hcStr}{bloodGroupRh ? ` GFS: ${bloodGroupRh}` : ''}){bedNumber ? ` C: ${bedNumber}` : ''}
            </span>
        </span>
    );
};

export const formatDemographicsOnly = (patientPii: any, patient: any, bedNumber?: string | null) => {
    let sexStr = '?';
    const sexo = patient?.sexo || patientPii?.sexo;
    if (sexo) {
        if (sexo.toUpperCase().startsWith('F')) sexStr = 'F';
        else if (sexo.toUpperCase().startsWith('M')) sexStr = 'M';
        else sexStr = sexo.substring(0, 1).toUpperCase();
    }

    let ageStr = '?';
    const dob = patient?.fechaNacimiento || patientPii?.fecha_nacimiento || patientPii?.fechaNacimiento;
    if (dob) {
        ageStr = calculateDetailedAge(dob);
    }

    const hcStr = patientPii?.historiaClinica || '?';
    const bloodGroupRh = patientPii?.bloodGroupRh;
    return `(${sexStr} ${ageStr} HC: ${hcStr}${bloodGroupRh ? ` GFS: ${bloodGroupRh}` : ''})${bedNumber ? ` C: ${bedNumber}` : ''}`;
};

export function SurgeryTvTable({ surgeriesData, salas, sortParams, specialties, staff, permissions = [], diagnoses = [], procedures = [], interventions = [], patients = [], initialDate = "", initialDateNew = "", forceTvMode = false, currentUser = null }: { surgeriesData: any[], salas: any[], sortParams: any, specialties?: any[], staff?: any, permissions?: string[], diagnoses?: any[], procedures?: any[], interventions?: any[], patients?: any[], initialDate?: string, initialDateNew?: string, forceTvMode?: boolean, currentUser?: { name: string; lastname: string } | null }) {
    const canEdit = permissions.includes('editar:programacion');
    const canCancel = permissions.includes('cancelar:programacion');
    const canAdvancePhase = permissions.includes('avanzar_fase:programacion');
    const canDuplicate = permissions.includes('duplicar:programacion');
    const canDelete = permissions.includes('eliminar:programacion');
    const canViewReport = permissions.includes('ver:reporte_operatorio');
    const canChangeStatus = permissions.includes('ciclar_estado:programacion');
    const canEditTimes = permissions.includes('editar_tiempos_fases:programacion');
    const router = useRouter();
    const [optimisticStatuses, setOptimisticStatuses] = useState<Record<string, string>>({});
    const [pendingStatuses, setPendingStatuses] = useState<Record<string, boolean>>({});

    const handleQuickStatusCycle = async (id: string, currentStatus: string) => {
        if (pendingStatuses[id]) return;

        let nextStatus = 'scheduled';
        const optStatus = optimisticStatuses[id] || currentStatus;
        if (optStatus === 'scheduled') nextStatus = 'in_progress';
        else if (['in_progress', 'anesthesia_start', 'pre_incision', 'surgery_end', 'patient_exit', 'urpa_exit'].includes(optStatus)) nextStatus = 'completed';
        else if (optStatus === 'completed') nextStatus = 'cancelled';
        else if (optStatus === 'cancelled') nextStatus = 'scheduled';

        setOptimisticStatuses(prev => ({ ...prev, [id]: nextStatus }));
        setPendingStatuses(prev => ({ ...prev, [id]: true }));

        try {
            const formData = new FormData();
            formData.append("id", id);
            formData.append("status", nextStatus);
            await updateSurgeryStatus(formData);
            router.refresh();
        } catch (e) {
            console.error("Failed to cycle status", e);
            setOptimisticStatuses(prev => ({ ...prev, [id]: optStatus }));
        } finally {
            setPendingStatuses(prev => ({ ...prev, [id]: false }));
        }
    };

    const getRowBgColor = (status: string) => {
        if (status === 'scheduled') return "bg-white dark:bg-zinc-900";
        if (['in_progress', 'anesthesia_start', 'pre_incision', 'surgery_end', 'patient_exit', 'urpa_exit'].includes(status)) return "bg-yellow-100 dark:bg-yellow-900/40";
        if (status === 'completed') return "bg-emerald-100 dark:bg-emerald-900/40";
        if (status === 'cancelled') return "bg-red-100 dark:bg-red-900/40";
        return "bg-white dark:bg-zinc-900";
    };

    const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    const [editingSurgery, setEditingSurgery] = useState<any>(null);
    const [editingTimesSurgery, setEditingTimesSurgery] = useState<any>(null);
    const [cancellingSurgery, setCancellingSurgery] = useState<any>(null);
    const [cancelConfirmText, setCancelConfirmText] = useState<string>("");
    const [errorModalMsg, setErrorModalMsg] = useState<string>("");
    const [transitionModal, setTransitionModal] = useState<{ isOpen: boolean, surgeryId: string, targetPhase: string, patientName: string, initialTime?: string, urgencyType?: string }>({ isOpen: false, surgeryId: '', targetPhase: '', patientName: '' });
    const currentSort = sortParams?.sort === 'asc' ? 'asc' : 'desc';

    // Auto-Refresh Polling Effect (Realtime UX)
    // Refreshes the server-injected props every 60 seconds to detect updates made by other users,
    // ensuring the Timeline Canvas and List are always up to date automatically.
    // Local modifications already trigger instant refreshes via `revalidatePath` in Server Actions.
    useEffect(() => {
        const interval = setInterval(() => {
            router.refresh();
        }, 60000);
        return () => clearInterval(interval);
    }, [router]);

    // Listener global para encadenamiento automático de flujos ("Confirmar Cirugía +")
    useEffect(() => {
        const handleOpenModal = (e: any) => {
            if (e.detail) {
                setTransitionModal(e.detail);
            }
        };
        window.addEventListener('OPEN_TRANSITION_MODAL', handleOpenModal);
        return () => window.removeEventListener('OPEN_TRANSITION_MODAL', handleOpenModal);
    }, []);

    // Atajo de teclado global: tecla 'F' para abrir/cerrar filtros
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            if (
                activeEl &&
                (activeEl.tagName === "INPUT" ||
                 activeEl.tagName === "TEXTAREA" ||
                 activeEl.tagName === "SELECT" ||
                 activeEl.getAttribute("contenteditable") === "true")
            ) {
                return;
            }
            if (e.key.toLowerCase() === "f") {
                e.preventDefault();
                setIsFilterOpen(prev => !prev);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Estados para Filtros de Lista
    const [filterDate, setFilterDate] = useState<string>(initialDate);
    const [filterDateNew, setFilterDateNew] = useState<string>(initialDateNew);
    const [dateError, setDateError] = useState<boolean>(false);

    useEffect(() => {
        setFilterDate(initialDate);
    }, [initialDate]);

    useEffect(() => {
        setFilterDateNew(initialDateNew);
    }, [initialDateNew]);

    const [filterPatient, setFilterPatient] = useState<string>("");
    const [filterRoom, setFilterRoom] = useState<string[]>([]);
    const [filterSpecialty, setFilterSpecialty] = useState<string[]>([]);
    const [filterStaff, setFilterStaff] = useState<string[]>([]);
    const [searchStaffFilter, setSearchStaffFilter] = useState<string>("");
    const [filterStatus, setFilterStatus] = useState<string[]>([]);
    const [filterCopri, setFilterCopri] = useState<string>("all");
    const [filterRescheduled, setFilterRescheduled] = useState<string>("all");
    const [filterAnesthesia, setFilterAnesthesia] = useState<string[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);
    const [isListFullscreen, setIsListFullscreen] = useState<boolean>(forceTvMode || false);
    const [isBrowserFullscreen, setIsBrowserFullscreen] = useState<boolean>(false);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const toggleDropdown = (name: string) => {
        setOpenDropdown(prev => prev === name ? null : name);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.dropdown-container')) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const enterNativeFullscreen = async () => {
        try {
            const docEl = document.documentElement as any;
            if (docEl.requestFullscreen) {
                await docEl.requestFullscreen();
            } else if (docEl.webkitRequestFullscreen) {
                await docEl.webkitRequestFullscreen();
            } else if (docEl.mozRequestFullScreen) {
                await docEl.mozRequestFullScreen();
            } else if (docEl.msRequestFullscreen) {
                await docEl.msRequestFullscreen();
            }
        } catch (err) {
            console.error("Error al ingresar a pantalla completa nativa:", err);
        }
    };

    const handleToggleFullscreen = async () => {
        const nextFullscreen = !isListFullscreen;
        setIsListFullscreen(nextFullscreen);

        try {
            const isCurrentlyFS = !!(
                document.fullscreenElement ||
                (document as any).webkitFullscreenElement ||
                (document as any).mozFullScreenElement ||
                (document as any).msFullscreenElement
            );

            if (!nextFullscreen) {
                // Minimizar: Salir de pantalla completa nativa si está activa
                if (isCurrentlyFS) {
                    if (document.exitFullscreen) {
                        await document.exitFullscreen();
                    } else if ((document as any).webkitExitFullscreen) {
                        await (document as any).webkitExitFullscreen();
                    } else if ((document as any).mozCancelFullScreen) {
                        await (document as any).mozCancelFullScreen();
                    } else if ((document as any).msExitFullscreen) {
                        await (document as any).msExitFullscreen();
                    }
                }
            } else {
                // Maximizar: Entrar en pantalla completa nativa
                const docEl = document.documentElement as any;
                if (docEl.requestFullscreen) {
                    await docEl.requestFullscreen();
                } else if (docEl.webkitRequestFullscreen) {
                    await docEl.webkitRequestFullscreen();
                } else if (docEl.mozRequestFullScreen) {
                    await docEl.mozRequestFullScreen();
                } else if (docEl.msRequestFullscreen) {
                    await docEl.msRequestFullscreen();
                }
            }
        } catch (err) {
            console.error("Error al alternar pantalla completa:", err);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFS = !!(
                document.fullscreenElement ||
                (document as any).webkitFullscreenElement ||
                (document as any).mozFullScreenElement ||
                (document as any).msFullscreenElement
            );
            setIsBrowserFullscreen(isFS);
            if (!isFS) {
                setIsListFullscreen(false);
            } else {
                setIsListFullscreen(true);
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
        document.addEventListener("mozfullscreenchange", handleFullscreenChange);
        document.addEventListener("MSFullscreenChange", handleFullscreenChange);

        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
            document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
            document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
            document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
        };
    }, []);

    const [sortConfig, setSortConfig] = useState<Array<{ key: string, direction: 'asc' | 'desc' }>>([]);
    const [showSortLimitAlert, setShowSortLimitAlert] = useState(false);

    const handleSort = (key: string) => {
        setSortConfig(prev => {
            const existingIndex = prev.findIndex(c => c.key === key);
            
            if (existingIndex >= 0) {
                const existing = prev[existingIndex];
                if (existing.direction === 'asc') {
                    // Clic 2: Cambiar a desc
                    const next = [...prev];
                    next[existingIndex] = { key, direction: 'desc' };
                    return next;
                } else {
                    // Clic 3: Remover
                    return prev.filter((_, idx) => idx !== existingIndex);
                }
            } else {
                // Clic 1: Nuevo
                if (prev.length >= 3) {
                    setShowSortLimitAlert(true);
                    setTimeout(() => setShowSortLimitAlert(false), 4500);
                    return prev;
                }
                return [...prev, { key, direction: 'asc' }];
            }
        });
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        const idx = sortConfig.findIndex(c => c.key === columnKey);
        if (idx === -1) return <ArrowUp size={12} className="text-zinc-300 dark:text-zinc-500 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />;
        
        const config = sortConfig[idx];
        return (
            <div className="flex items-center ml-1">
                {config.direction === 'asc' 
                    ? <ArrowUp size={12} className="text-[var(--color-hospital-blue)] opacity-100" />
                    : <ArrowDown size={12} className="text-[var(--color-hospital-blue)] opacity-100" />
                }
                {sortConfig.length > 0 && (
                    <span className="text-[9px] font-bold text-[var(--color-hospital-blue)] ml-0.5 leading-none bg-blue-50 dark:bg-blue-900/30 px-1 py-[1px] rounded" title={`Prioridad ${idx + 1}`}>
                        {idx + 1}
                    </span>
                )}
            </div>
        );
    };

    const handleDatesChange = (newDateAnt: string, newDateNew: string) => {
        let finalDateNew = newDateNew;
        let isError = false;

        // Si el cambio proviene de "Fecha Fin" (newDateNew es igual al filterDateNew actual),
        // igualamos inmediatamente la fecha de inicio a la nueva fecha de fin.
        if (newDateNew === filterDateNew) {
            finalDateNew = newDateAnt;
        } else {
            // Si el cambio proviene de "Fecha Inicio" (newDateNew cambió), aplicamos la validación normal
            if (newDateAnt && newDateNew) {
                if (newDateNew > newDateAnt) {
                    isError = true;
                }
            }
        }

        if (isError) {
            setDateError(true);
            setErrorModalMsg("La fecha de inicio (nuevo) no puede ser posterior a la fecha de fin (antiguo).");
            setFilterDate(newDateAnt);
            setFilterDateNew(newDateNew);
            return;
        }

        setDateError(false);
        setFilterDate(newDateAnt);
        setFilterDateNew(finalDateNew);

        const params = new URLSearchParams();
        if (newDateAnt) {
            params.set("date", newDateAnt);
        } else {
            params.set("date", "");
        }
        if (finalDateNew) {
            params.set("dateNew", finalDateNew);
        } else {
            params.set("dateNew", "");
        }
        if (sortParams?.sort) params.set("sort", sortParams.sort);
        router.push(`?${params.toString()}`);
    };

    const handleDateChange = (newDate: string) => {
        handleDatesChange(newDate, filterDateNew);
    };

    // Filtros Universales (Paciente y Estado)
    const baseFilteredSurgeries = surgeriesData.filter(s => {
        if (filterPatient.trim() !== "") {
            const searchTerms = filterPatient.toLowerCase().split(/\s+/).filter(Boolean);
            const fullName = `${s.patient?.name || ''} ${s.patientPii?.nombres || ''} ${s.patientPii?.apellidos || ''}`.toLowerCase();
            const dni = `${s.patientPii?.dni || ''}`.toLowerCase();
            const combinedString = `${fullName} ${dni}`;
            
            // Multivariable AND: TODAS las palabras escritas deben existir en el nombre completo o DNI, sin importar el orden
            const matchesAll = searchTerms.every(term => combinedString.includes(term));
            if (!matchesAll) return false;
        }

        if (filterStatus.length > 0) {
            let statusMatches = false;
            
            for (const fs of filterStatus) {
                const isMissingData = (s: any) => {
                    return (
                        !s.surgery.patientId ||
                        !s.diagnoses || s.diagnoses.length === 0 ||
                        !s.interventions || s.interventions.length === 0 ||
                        !s.surgery.surgeryType || s.surgery.surgeryType.trim() === '' ||
                        !s.surgery.urgencyType || s.surgery.urgencyType.trim() === '' ||
                        !s.surgery.specialtyId ||
                        !s.surgery.origin || s.surgery.origin.trim() === '' ||
                        !s.surgery.requestDate ||
                        !s.surgery.scheduledDate ||
                        !s.surgery.operatingRoomId ||
                        !s.surgery.estimatedDuration || s.surgery.estimatedDuration.trim() === '' ||
                        !s.team ||
                        !s.team.some((t: any) => t.role === 'ANESTESIOLOGO') ||
                        !s.team.some((t: any) => t.role === 'ENFERMERO') ||
                        !s.surgery.anesthesiaType || s.surgery.anesthesiaType.trim() === ''
                    );
                };

                if (fs === 'completed_incomplete') {
                    if (s.surgery.status === 'completed' && isMissingData(s)) {
                        statusMatches = true;
                        break;
                    }
                } else if (fs === 'completed') {
                    if (s.surgery.status === 'completed' && !isMissingData(s)) {
                        statusMatches = true;
                        break;
                    }
                } else {
                    if (s.surgery.status === fs) {
                        statusMatches = true;
                        break;
                    }
                }
            }

            if (!statusMatches) return false;
        }

        return true;
    });

    // Filtros Locales de Lista (Quirófano) - Fecha ya se filtró en el backend
    const filteredSurgeries = baseFilteredSurgeries.filter(s => {

        if (filterRoom.length > 0 && (!s.operatingRoom?.id || !filterRoom.includes(s.operatingRoom.id))) {
            return false;
        }

        if (filterSpecialty.length > 0 && (!s.specialty?.id || !filterSpecialty.includes(s.specialty.id))) {
            return false;
        }

        if (filterStaff.length > 0) {
            if (!s.team || s.team.length === 0) return false;
            const hasMatchedStaff = filterStaff.some(staffId => 
                s.team.some((t: any) => t.staff?.id === staffId || t.staffId === staffId)
            );
            if (!hasMatchedStaff) return false;
        }

        if (filterCopri !== 'all') {
            const isCopri = s.surgery.isFromCopri === true;
            if (filterCopri === 'true' && !isCopri) return false;
            if (filterCopri === 'false' && isCopri) return false;
        }

        if (filterRescheduled !== 'all') {
            const isRescheduled = s.surgery.isRescheduled === true;
            if (filterRescheduled === 'true' && !isRescheduled) return false;
            if (filterRescheduled === 'false' && isRescheduled) return false;
        }

        if (filterAnesthesia.length > 0) {
            const hasNoneOption = filterAnesthesia.includes("NONE");
            const hasAnesthesia = s.surgery.anesthesiaType && s.surgery.anesthesiaType.trim() !== "";
            if (!hasAnesthesia) {
                if (!hasNoneOption) return false;
            } else {
                const surgeryTypes = s.surgery.anesthesiaType.split(',').map((t: string) => t.trim());
                const hasMatchedAnesthesia = filterAnesthesia.some((type) => surgeryTypes.includes(type));
                if (!hasMatchedAnesthesia) return false;
            }
        }

        return true;
    });

    const compareByKey = (a: any, b: any, key: string) => {
        if (key === 'especialidad') {
            const nameA = a.specialty?.name || '';
            const nameB = b.specialty?.name || '';
            return nameA.localeCompare(nameB);
        }
        if (key === 'sala') {
            const nameA = a.operatingRoom?.name || '';
            const nameB = b.operatingRoom?.name || '';
            return nameA.localeCompare(nameB);
        }
        if (key === 'hora') {
            const timeA = a.surgery.scheduledDate ? new Date(a.surgery.scheduledDate).getTime() : 0;
            const timeB = b.surgery.scheduledDate ? new Date(b.surgery.scheduledDate).getTime() : 0;
            return timeA - timeB;
        }
        if (key === 'paciente') {
            const nameA = `${a.patientPii?.nombres || ''} ${a.patientPii?.apellidos || ''}`.trim();
            const nameB = `${b.patientPii?.nombres || ''} ${b.patientPii?.apellidos || ''}`.trim();
            return nameA.localeCompare(nameB);
        }
        if (key === 'tipo') {
            const typeA = a.surgery.surgeryType || '';
            const typeB = b.surgery.surgeryType || '';
            return typeA.localeCompare(typeB);
        }
        return 0;
    };

    const sortedSurgeries = [...filteredSurgeries].sort((a, b) => {
        if (!sortConfig || sortConfig.length === 0) return 0;
        
        for (const config of sortConfig) {
            const multiplier = config.direction === 'asc' ? 1 : -1;
            const comp = compareByKey(a, b, config.key);
            if (comp !== 0) {
                return comp * multiplier;
            }
        }
        return 0;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'scheduled':
                return <span className="bg-blue-50 text-[var(--color-hospital-blue)] px-3 py-1.5 rounded-full text-xs font-bold border border-blue-200/50 flex flex-nowrap items-center gap-1.5 w-max shadow-sm"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div> Programada</span>;
            case 'in_progress':
                return <span className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold border border-amber-200/50 flex flex-nowrap items-center gap-1.5 w-max shadow-sm"><div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div> En Quirófano</span>;
            case 'anesthesia_start':
                return <span className="bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full text-xs font-bold border border-purple-200/50 flex flex-nowrap items-center gap-1.5 w-max shadow-sm"><div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></div> Anestesia Inducida</span>;
            case 'pre_incision':
                return <span className="bg-fuchsia-50 text-fuchsia-700 px-3 py-1.5 rounded-full text-xs font-bold border border-fuchsia-200/50 flex flex-nowrap items-center gap-1.5 w-max shadow-sm"><div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 animate-pulse"></div> Antes de Incisión</span>;
            case 'surgery_end':
                return <span className="bg-cyan-50 text-cyan-700 px-3 py-1.5 rounded-full text-xs font-bold border border-cyan-200/50 flex flex-nowrap items-center gap-1.5 w-max shadow-sm"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></div> Término de Cirugía</span>;
            case 'patient_exit':
                return <span className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full text-xs font-bold border border-orange-200/50 flex flex-nowrap items-center gap-1.5 w-max shadow-sm"><div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div> Salida Paciente</span>;
            case 'urpa_exit':
                return <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-xs font-bold border border-indigo-200/50 flex flex-nowrap items-center gap-1.5 w-max shadow-sm"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div> Salida URPA</span>;
            case 'completed':
                return <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-200/50 flex flex-nowrap items-center gap-1.5 w-max shadow-sm"><CheckCircle2 size={12} className="text-emerald-500" /> Finalizada</span>;
            case 'cancelled':
                return <span className="bg-red-50 text-red-700 px-3 py-1.5 rounded-full text-xs font-bold border border-red-200/50 flex flex-nowrap items-center gap-1.5 w-max shadow-sm"><XCircle size={12} className="text-red-500" /> Suspendida</span>;
            default:
                return <span className="bg-zinc-100 text-zinc-600 px-3 py-1.5 rounded-full text-xs font-bold border border-zinc-200 flex flex-nowrap items-center gap-1.5 w-max shadow-sm"><AlertCircle size={12} /> Desconocido</span>;
        }
    };

    const handleStatusUpdate = async (formData: FormData) => {
        const res = await updateSurgeryStatus(formData);
        if (res?.error) {
            setErrorModalMsg(res.error);
        } else {
            router.refresh();
        }
    };

    const todayStr = new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).split(' ')[0];
    const hasActiveFilters = 
        filterPatient !== "" ||
        filterRoom.length > 0 ||
        filterStatus.length > 0 ||
        filterSpecialty.length > 0 ||
        filterStaff.length > 0 ||
        filterCopri !== "all" ||
        filterRescheduled !== "all" ||
        filterAnesthesia.length > 0 ||
        filterDate !== todayStr ||
        filterDateNew !== todayStr;

    return (
        <div className={`bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 overflow-hidden shadow-sm flex flex-col ${isListFullscreen ? 'fixed inset-0 z-[100] w-screen h-screen rounded-none' : 'relative rounded-3xl h-full ring-1 ring-zinc-100 dark:ring-zinc-800/50'}`}>
            {/* Banner de Pantalla Completa para Modo TV */}
            {forceTvMode && isListFullscreen && !isBrowserFullscreen && (
                <div 
                    onClick={enterNativeFullscreen}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-800 text-white px-4 py-3 text-center text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer hover:from-blue-500 hover:to-indigo-500 transition-all select-none shadow-md z-[110] border-b border-blue-500/30 animate-pulse-slow"
                >
                    <Activity size={16} className="animate-pulse text-blue-200 shrink-0" />
                    <span>Modo TV Activo. Para una visualización óptima a pantalla completa (tipo Netflix), <strong>haz clic aquí</strong> o presiona <strong>F11</strong>.</span>
                </div>
            )}

            {/* Notificación de límite de ordenamiento */}
            <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-[200] transition-all duration-300 pointer-events-none ${showSortLimitAlert ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                <div className="bg-rose-50 dark:bg-rose-900/90 text-rose-700 dark:text-rose-100 px-5 py-3 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-800 flex items-center gap-3 backdrop-blur-md">
                    <AlertCircle size={20} className="text-rose-500 shrink-0" />
                    <p className="text-sm font-bold tracking-tight">Solo se permite un máximo de 3 criterios de ordenamiento simultáneos. Quite un criterio para continuar.</p>
                </div>
            </div>
            
            {/* Header de Configuración y Toggles */}
            <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/20">
                <div>
                    <h3 className="font-bold text-lg text-zinc-900 dark:text-white flex items-center tracking-tight">
                        <Activity size={20} className="mr-2 text-[var(--color-hospital-blue)]" />
                        Agenda Central Intervenciones
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1 font-medium">Panel de control</p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-200/50 dark:border-emerald-800/50 shadow-sm hidden sm:block">
                        {surgeriesData.filter(s => s.surgery.status !== 'cancelled').length} Activas
                    </span>

                    {currentUser && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm hidden md:flex shrink-0 select-none">
                            <div className="w-6 h-6 rounded-full bg-[var(--color-hospital-blue)] text-white text-[10px] font-bold flex items-center justify-center shadow-sm shrink-0">
                                {(() => {
                                    const n = currentUser.name?.trim().charAt(0) || "";
                                    const l = currentUser.lastname?.trim().charAt(0) || "";
                                    return `${n}${l}`.toUpperCase();
                                })()}
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-250 leading-tight">
                                    {currentUser.name} {currentUser.lastname}
                                </span>
                                <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-500 leading-none mt-0.5">
                                    Conectado
                                </span>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={async () => {
                            await signOut({ redirect: false });
                            window.location.href = "/login";
                        }}
                        className="bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-2 rounded-xl text-xs font-bold border border-red-200/50 dark:border-red-900/50 shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
                        title="Cerrar sesión"
                    >
                        <LogOut size={14} />
                        <span className="hidden sm:inline">Cerrar Sesión</span>
                    </button>

                    {viewMode === 'list' && (
                        <button
                            onClick={handleToggleFullscreen}
                            className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 p-2 rounded-xl transition-colors border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-2"
                            title={isListFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                        >
                            {isListFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                    )}
                    <div className="bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl flex items-center gap-1 border border-zinc-200 dark:border-zinc-700 shadow-inner">
                        <button
                            onClick={() => setViewMode('list')}
                            title="Vista Lista"
                            className={`flex items-center justify-center p-2 rounded-lg text-sm font-semibold transition-all duration-300 ${viewMode === 'list' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-600' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                        >
                            <ListIcon size={16} />
                        </button>
                        <button
                            onClick={() => { setViewMode('timeline'); setIsListFullscreen(false); }}
                            title="Vista Timeline (Línea de Tiempo)"
                            className={`flex items-center justify-center p-2 rounded-lg text-sm font-semibold transition-all duration-300 ${viewMode === 'timeline' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-600' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                        >
                            <LayoutGrid size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Control Panel de Filtros - Diseño Premium */}
            {!isListFullscreen && (
                <div className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${isFilterOpen ? 'bg-blue-50 text-[var(--color-hospital-blue)] dark:bg-blue-900/20' : 'bg-zinc-100/80 hover:bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
                        >
                            <Filter size={16} />
                            Filtros Dinámicos
                        </button>
                        {hasActiveFilters && (
                            <button
                                onClick={() => {
                                    handleDatesChange(todayStr, todayStr);
                                    setFilterPatient('');
                                    setFilterRoom([]);
                                    setFilterStatus([]);
                                    setFilterSpecialty([]);
                                    setFilterStaff([]);
                                    setFilterCopri('all');
                                    setFilterRescheduled('all');
                                    setFilterAnesthesia([]);
                                }}
                                className="text-xs font-semibold text-zinc-500 hover:text-red-500 hover:underline px-2 transition-colors"
                            >
                                Limpiar Filtros
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-zinc-500 max-w-[600px] justify-end uppercase tracking-widest hidden lg:flex">
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Programada</span>
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Ingreso Qx</span>
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div> Anestesia</span>
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500"></div> Antes Incisión</span>
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500"></div> Tér. Cirugía</span>
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div> Salida Pac.</span>
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> URPA</span>
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Finalizada</span>
                            <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Suspendida</span>
                        </div>
                        <div className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800 shrink-0">
                            Mostrando <span className="text-zinc-900 dark:text-zinc-100 font-bold">{filteredSurgeries.length}</span> registros
                        </div>
                    </div>
                </div>

                <AnimatePresence>
                    {isFilterOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-10 gap-4 pt-2 pb-2">
                                {/* Buscador de Paciente */}
                                <div className="flex flex-col gap-1 w-full">
                                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1">Paciente</span>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Search size={14} className="text-zinc-400 group-focus-within:text-[var(--color-hospital-blue)] transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Buscar paciente o DNI..."
                                            value={filterPatient}
                                            onChange={(e) => setFilterPatient(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-zinc-800 dark:text-zinc-200 placeholder-zinc-400"
                                        />
                                    </div>
                                </div>

                                {/* Selector de Fecha */}
                                <div className="flex flex-col gap-1 w-full">
                                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1">Fecha Fin (Hasta / Única)</span>
                                    <div className="relative group w-full">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Calendar size={14} className="text-zinc-400 group-focus-within:text-[var(--color-hospital-blue)] transition-colors" />
                                        </div>
                                        <input
                                            type="date"
                                            value={filterDate}
                                            onChange={(e) => handleDatesChange(e.target.value, filterDateNew)}
                                            className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-zinc-800 dark:text-zinc-200 [color-scheme:light] dark:[color-scheme:dark]"
                                        />
                                    </div>
                                </div>

                                {/* Selector Múltiple de Quirófano */}
                                <div className="flex flex-col gap-1 w-full dropdown-container">
                                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1">Quirófano</span>
                                    <div className="relative z-50">
                                        <div 
                                            onClick={() => toggleDropdown('room')}
                                            className={`w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer flex justify-between items-center transition-all bg-white dark:bg-zinc-900 ${openDropdown === 'room' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-blue-500/50'}`}
                                        >
                                            <span className="truncate pr-2">
                                                {filterRoom.length === 0 
                                                    ? "Todas las Salas" 
                                                    : filterRoom.length === 1
                                                        ? (salas.find(s => s.id === filterRoom[0])?.name || filterRoom[0])
                                                        : `${filterRoom.length} Salas Seleccionadas`}
                                            </span>
                                            <svg className={`w-4 h-4 text-zinc-400 transition-colors flex-shrink-0 ${openDropdown === 'room' ? 'text-[var(--color-hospital-blue)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                        <div className={`absolute top-[calc(100%-8px)] left-0 w-full pt-3 transition-all duration-200 z-50 ${openDropdown === 'room' ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                                            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl flex flex-col overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                                                <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80">
                                                    <div className="flex items-center justify-between px-1">
                                                        <button type="button" onClick={() => setFilterRoom(salas.map(s => s.id))} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline mb-0.5 mt-0.5">SEL. TODAS</button>
                                                        <button type="button" onClick={() => setFilterRoom([])} className="text-[11px] font-bold text-zinc-500 hover:text-red-500 hover:underline mb-0.5 mt-0.5">NINGUNA</button>
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto p-1.5 flex flex-col custom-scrollbar max-h-[250px]">
                                                    {salas.map(s => (
                                                        <label key={s.id} className="flex items-center gap-3 px-2 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 rounded-lg cursor-pointer transition-colors group/label border-b border-zinc-100/50 last:border-0 dark:border-zinc-700/30">
                                                            <input 
                                                                type="checkbox" 
                                                                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-[var(--color-hospital-blue)] focus:ring-[var(--color-hospital-blue)] bg-white dark:bg-zinc-900 cursor-pointer"
                                                                checked={filterRoom.includes(s.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setFilterRoom([...filterRoom, s.id]);
                                                                    } else {
                                                                        setFilterRoom(filterRoom.filter(id => id !== s.id));
                                                                    }
                                                                }}
                                                            />
                                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover/label:text-zinc-900 dark:group-hover/label:text-white select-none whitespace-normal leading-tight">{s.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Selector Múltiple de Especialidad */}
                                <div className="flex flex-col gap-1 w-full dropdown-container">
                                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1">Especialidad</span>
                                    <div className="relative z-40">
                                        <div 
                                            onClick={() => toggleDropdown('specialty')}
                                            className={`w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer flex justify-between items-center transition-all bg-white dark:bg-zinc-900 ${openDropdown === 'specialty' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-blue-500/50'}`}
                                        >
                                            <span className="truncate pr-2">
                                                {filterSpecialty.length === 0 
                                                    ? "Cualquier Especialidad" 
                                                    : filterSpecialty.length === 1
                                                        ? (specialties?.find(s => s.id === filterSpecialty[0])?.name || filterSpecialty[0])
                                                        : `${filterSpecialty.length} Espec. Selecc.`}
                                            </span>
                                            <svg className={`w-4 h-4 text-zinc-400 transition-colors flex-shrink-0 ${openDropdown === 'specialty' ? 'text-[var(--color-hospital-blue)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                        <div className={`absolute top-[calc(100%-8px)] left-0 w-full pt-3 transition-all duration-200 z-50 ${openDropdown === 'specialty' ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                                            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl flex flex-col overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                                                <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80">
                                                    <div className="flex items-center justify-between px-1">
                                                        <button type="button" onClick={() => setFilterSpecialty(specialties?.map(s => s.id) || [])} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline mb-0.5 mt-0.5">SEL. TODAS</button>
                                                        <button type="button" onClick={() => setFilterSpecialty([])} className="text-[11px] font-bold text-zinc-500 hover:text-red-500 hover:underline mb-0.5 mt-0.5">NINGUNA</button>
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto p-1.5 flex flex-col custom-scrollbar max-h-[250px]">
                                                    {specialties?.map(s => (
                                                        <label key={s.id} className="flex items-center gap-3 px-2 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 rounded-lg cursor-pointer transition-colors group/label border-b border-zinc-100/50 last:border-0 dark:border-zinc-700/30">
                                                            <input 
                                                                type="checkbox" 
                                                                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-[var(--color-hospital-blue)] focus:ring-[var(--color-hospital-blue)] bg-white dark:bg-zinc-900 cursor-pointer"
                                                                checked={filterSpecialty.includes(s.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setFilterSpecialty([...filterSpecialty, s.id]);
                                                                    } else {
                                                                        setFilterSpecialty(filterSpecialty.filter(id => id !== s.id));
                                                                    }
                                                                }}
                                                            />
                                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover/label:text-zinc-900 dark:group-hover/label:text-white select-none whitespace-normal leading-tight">{s.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Selector Múltiple de Profesional */}
                                <div className="flex flex-col gap-1 w-full dropdown-container">
                                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1">Profesional</span>
                                    <div className="relative z-30">
                                        <div 
                                            onClick={() => toggleDropdown('staff')}
                                            className={`w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer flex justify-between items-center transition-all bg-white dark:bg-zinc-900 ${openDropdown === 'staff' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-blue-500/50'}`}
                                        >
                                            <span className="truncate pr-2">
                                                {filterStaff.length === 0 
                                                    ? "Cualquier Profesional" 
                                                    : filterStaff.length === 1
                                                        ? (() => {
                                                            const allStaff = [...(staff?.surgeons || []), ...(staff?.anesthesiologists || []), ...(staff?.nurses || [])];
                                                            const found = allStaff.find(s => s.id === filterStaff[0]);
                                                            return found ? `${found.name?.split(' ')[0]} ${found.lastname?.split(' ')[0]}` : filterStaff[0];
                                                        })()
                                                        : `${filterStaff.length} Prof. Selecc.`}
                                            </span>
                                            <svg className={`w-4 h-4 text-zinc-400 transition-colors flex-shrink-0 ${openDropdown === 'staff' ? 'text-[var(--color-hospital-blue)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                        <div className={`absolute top-[calc(100%-8px)] left-0 w-full pt-3 transition-all duration-200 z-50 ${openDropdown === 'staff' ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                                            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl flex flex-col overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                                                <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80">
                                                    <div className="mb-2 relative">
                                                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                                                            <Search size={12} className="text-zinc-400" />
                                                        </div>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Buscar profesional..." 
                                                            value={searchStaffFilter}
                                                            onChange={(e) => setSearchStaffFilter(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-full pl-7 pr-2 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-zinc-800 dark:text-zinc-200 placeholder-zinc-400"
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between px-1">
                                                        <button type="button" onClick={() => setFilterStaff([...(staff?.surgeons || []), ...(staff?.anesthesiologists || []), ...(staff?.nurses || [])].map((s: any) => s.id))} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline mb-0.5 mt-0.5">SEL. TODOS</button>
                                                        <button type="button" onClick={() => setFilterStaff([])} className="text-[11px] font-bold text-zinc-500 hover:text-red-500 hover:underline mb-0.5 mt-0.5">NINGUNO</button>
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto p-1.5 flex flex-col custom-scrollbar max-h-[250px]">
                                                    {[...(staff?.surgeons || []), ...(staff?.anesthesiologists || []), ...(staff?.nurses || [])]
                                                        .sort((a: any, b: any) => {
                                                            const aName = `${a.lastname || ''} ${a.name || ''}`.trim().toLowerCase();
                                                            const bName = `${b.lastname || ''} ${b.name || ''}`.trim().toLowerCase();
                                                            return aName.localeCompare(bName);
                                                        })
                                                        .filter((s: any) => {
                                                            if (!searchStaffFilter.trim()) return true;
                                                            const searchTerms = searchStaffFilter.toLowerCase().split(/\s+/).filter(Boolean);
                                                            const fullName = `${s.lastname || ''} ${s.name || ''}`.toLowerCase();
                                                            return searchTerms.every(term => fullName.includes(term));
                                                        })
                                                        .map((s: any) => (
                                                        <label key={`filter-staff-${s.id}`} className="flex items-center gap-3 px-2 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 rounded-lg cursor-pointer transition-colors group/label border-b border-zinc-100/50 last:border-0 dark:border-zinc-700/30">
                                                            <input 
                                                                type="checkbox" 
                                                                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-[var(--color-hospital-blue)] focus:ring-[var(--color-hospital-blue)] bg-white dark:bg-zinc-900 cursor-pointer"
                                                                checked={filterStaff.includes(s.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setFilterStaff([...filterStaff, s.id]);
                                                                    } else {
                                                                        setFilterStaff(filterStaff.filter(id => id !== s.id));
                                                                    }
                                                                }}
                                                            />
                                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover/label:text-zinc-900 dark:group-hover/label:text-white select-none whitespace-normal leading-tight">{s.lastname} {s.name}</span>
                                                        </label>
                                                    ))}
                                                    {[...(staff?.surgeons || []), ...(staff?.anesthesiologists || []), ...(staff?.nurses || [])].filter((s: any) => {
                                                        if (!searchStaffFilter.trim()) return true;
                                                        const searchTerms = searchStaffFilter.toLowerCase().split(/\s+/).filter(Boolean);
                                                        const fullName = `${s.lastname || ''} ${s.name || ''}`.toLowerCase();
                                                        return searchTerms.every(term => fullName.includes(term));
                                                    }).length === 0 && (
                                                        <div className="py-4 text-center text-xs text-zinc-500 font-medium">
                                                            No se encontraron profesionales
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Selector Múltiple de Estado */}
                                <div className="flex flex-col gap-1 w-full dropdown-container">
                                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1">Estado</span>
                                    <div className="relative z-20">
                                        <div 
                                            onClick={() => toggleDropdown('status')}
                                            className={`w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer flex justify-between items-center transition-all bg-white dark:bg-zinc-900 ${openDropdown === 'status' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-blue-500/50'}`}
                                        >
                                            <span className="truncate pr-2">
                                                {filterStatus.length === 0 
                                                    ? "Cualquier Estado" 
                                                    : filterStatus.length === 1
                                                        ? [
                                                            { id: 'scheduled', name: 'Programadas' },
                                                            { id: 'in_progress', name: 'En Quirófano' },
                                                            { id: 'anesthesia_start', name: 'Anestesia Iniciada' },
                                                            { id: 'pre_incision', name: 'Pre-Incisión' },
                                                            { id: 'surgery_end', name: 'Término Cirugía' },
                                                            { id: 'patient_exit', name: 'Salida Paciente' },
                                                            { id: 'urpa_exit', name: 'Salida URPA' },
                                                            { id: 'completed', name: 'Finalizadas' },
                                                            { id: 'completed_incomplete', name: 'Finalizadas (Incompletas)' },
                                                            { id: 'cancelled', name: 'Suspendidas' }
                                                          ].find(s => s.id === filterStatus[0])?.name || filterStatus[0]
                                                        : `${filterStatus.length} Estados Selecc.`}
                                            </span>
                                            <svg className={`w-4 h-4 text-zinc-400 transition-colors flex-shrink-0 ${openDropdown === 'status' ? 'text-[var(--color-hospital-blue)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                        <div className={`absolute top-[calc(100%-8px)] left-0 w-full pt-3 transition-all duration-200 z-50 ${openDropdown === 'status' ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                                            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl flex flex-col overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                                                <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80">
                                                    <div className="flex items-center justify-between px-1">
                                                        <button type="button" onClick={() => setFilterStatus(['scheduled','in_progress','anesthesia_start','pre_incision','surgery_end','patient_exit','urpa_exit','completed','completed_incomplete','cancelled'])} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline mb-0.5 mt-0.5">SEL. TODOS</button>
                                                        <button type="button" onClick={() => setFilterStatus([])} className="text-[11px] font-bold text-zinc-500 hover:text-red-500 hover:underline mb-0.5 mt-0.5">NINGUNO</button>
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto p-1.5 flex flex-col custom-scrollbar max-h-[250px]">
                                                    {[
                                                        { id: 'scheduled', name: 'Programadas' },
                                                        { id: 'in_progress', name: 'En Quirófano' },
                                                        { id: 'anesthesia_start', name: 'Anestesia Iniciada' },
                                                        { id: 'pre_incision', name: 'Pre-Incisión' },
                                                        { id: 'surgery_end', name: 'Término Cirugía' },
                                                        { id: 'patient_exit', name: 'Salida Paciente' },
                                                        { id: 'urpa_exit', name: 'Salida URPA' },
                                                        { id: 'completed', name: 'Finalizadas' },
                                                        { id: 'completed_incomplete', name: 'Finalizadas (Datos Incompletos)' },
                                                        { id: 'cancelled', name: 'Suspendidas' }
                                                    ].map(s => (
                                                        <label key={s.id} className="flex items-center gap-3 px-2 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 rounded-lg cursor-pointer transition-colors group/label border-b border-zinc-100/50 last:border-0 dark:border-zinc-700/30">
                                                            <input 
                                                                type="checkbox" 
                                                                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-[var(--color-hospital-blue)] focus:ring-[var(--color-hospital-blue)] bg-white dark:bg-zinc-900 cursor-pointer"
                                                                checked={filterStatus.includes(s.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setFilterStatus([...filterStatus, s.id]);
                                                                    } else {
                                                                        setFilterStatus(filterStatus.filter(id => id !== s.id));
                                                                    }
                                                                }}
                                                            />
                                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover/label:text-zinc-900 dark:group-hover/label:text-white select-none whitespace-normal leading-tight">{s.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Filtro Viene COPRI */}
                                <div className="flex flex-col gap-1 w-full">
                                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1">COPRI</span>
                                    <div className="relative group z-10">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Filter size={14} className="text-zinc-400 group-focus-within:text-[var(--color-hospital-blue)] transition-colors" />
                                        </div>
                                        <select
                                            value={filterCopri}
                                            onChange={(e) => setFilterCopri(e.target.value)}
                                            className="w-full pl-9 pr-8 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-zinc-800 dark:text-zinc-200 appearance-none"
                                        >
                                            <option value="all">Filtro COPRI: Todos</option>
                                            <option value="true">Solo Viene COPRI</option>
                                            <option value="false">Sin COPRI</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Selector Múltiple de Anestesia */}
                                <div className="flex flex-col gap-1 w-full dropdown-container">
                                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1">Anestesia</span>
                                    <div className="relative z-[25]">
                                        <div 
                                            onClick={() => toggleDropdown('anesthesia')}
                                            className={`w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border rounded-xl text-sm font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer flex justify-between items-center transition-all bg-white dark:bg-zinc-900 ${openDropdown === 'anesthesia' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-blue-500/50'}`}
                                        >
                                            <span className="truncate pr-2">
                                                {filterAnesthesia.length === 0
                                                    ? "Cualquier Anestesia"
                                                    : filterAnesthesia.length === 1
                                                        ? [
                                                            { id: "RAQ", name: "Raquídea" },
                                                            { id: "EPI", name: "Epidural" },
                                                            { id: "AGB", name: "Gen. Balanceada" },
                                                            { id: "AGE", name: "Gen. Endovenosa" },
                                                            { id: "AGI", name: "Gen. Inhalatoria" },
                                                            { id: "BLOQ", name: "Bloqueo Reg." },
                                                            { id: "LOCL", name: "Local" },
                                                            { id: "SEDA", name: "Sedación" },
                                                            { id: "NONE", name: "Sin Anestesia" },
                                                          ].find((s) => s.id === filterAnesthesia[0])?.name || filterAnesthesia[0]
                                                        : `${filterAnesthesia.length} Anest. Selecc.`}
                                            </span>
                                            <svg className={`w-4 h-4 text-zinc-400 transition-colors flex-shrink-0 ${openDropdown === 'anesthesia' ? 'text-[var(--color-hospital-blue)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                        <div className={`absolute top-[calc(100%-8px)] left-0 w-full pt-3 transition-all duration-200 z-50 ${openDropdown === 'anesthesia' ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                                            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl flex flex-col overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                                                <div className="p-2 border-b border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80">
                                                    <div className="flex items-center justify-between px-1">
                                                        <button type="button" onClick={() => setFilterAnesthesia(["RAQ", "EPI", "AGB", "AGE", "AGI", "BLOQ", "LOCL", "SEDA", "NONE"])} className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline mb-0.5 mt-0.5">SEL. TODAS</button>
                                                        <button type="button" onClick={() => setFilterAnesthesia([])} className="text-[11px] font-bold text-zinc-500 hover:text-red-500 hover:underline mb-0.5 mt-0.5">NINGUNA</button>
                                                    </div>
                                                </div>
                                                <div className="overflow-y-auto p-1.5 flex flex-col custom-scrollbar max-h-[250px]">
                                                    {[
                                                        { id: "RAQ", name: "Raquídea" },
                                                        { id: "EPI", name: "Epidural" },
                                                        { id: "AGB", name: "Gen. Balanceada" },
                                                        { id: "AGE", name: "Gen. Endovenosa" },
                                                        { id: "AGI", name: "Gen. Inhalatoria" },
                                                        { id: "BLOQ", name: "Bloqueo Reg." },
                                                        { id: "LOCL", name: "Local" },
                                                        { id: "SEDA", name: "Sedación" },
                                                        { id: "NONE", name: "Sin Anestesia" },
                                                    ].map((s) => (
                                                        <label key={s.id} className="flex items-center gap-3 px-2 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 rounded-lg cursor-pointer transition-colors group/label border-b border-zinc-100/50 last:border-0 dark:border-zinc-700/30">
                                                            <input 
                                                                type="checkbox" 
                                                                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-[var(--color-hospital-blue)] focus:ring-[var(--color-hospital-blue)] bg-white dark:bg-zinc-900 cursor-pointer"
                                                                checked={filterAnesthesia.includes(s.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setFilterAnesthesia([...filterAnesthesia, s.id]);
                                                                    } else {
                                                                        setFilterAnesthesia(filterAnesthesia.filter((id) => id !== s.id));
                                                                    }
                                                                }}
                                                            />
                                                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 group-hover/label:text-zinc-900 dark:group-hover/label:text-white select-none whitespace-normal leading-tight">{s.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Filtro Reprogramado */}
                                <div className="flex flex-col gap-1 w-full">
                                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1">Reprogramado</span>
                                    <div className="relative group z-10">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Filter size={14} className="text-zinc-400 group-focus-within:text-[var(--color-hospital-blue)] transition-colors" />
                                        </div>
                                        <select
                                            value={filterRescheduled}
                                            onChange={(e) => setFilterRescheduled(e.target.value)}
                                            className="w-full pl-9 pr-8 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-zinc-800 dark:text-zinc-200 appearance-none"
                                        >
                                            <option value="all">Filtro Reprogramado: Todos</option>
                                            <option value="true">Solo Reprogramados</option>
                                            <option value="false">Sin Reprogramar</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                            <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Selector de Fecha Nuevo */}
                                <div className="flex flex-col gap-1 w-full">
                                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider pl-1">Fecha Inicio (Desde)</span>
                                    <div className="relative group w-full">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Calendar size={14} className="text-zinc-400 group-focus-within:text-[var(--color-hospital-blue)] transition-colors" />
                                        </div>
                                        <input
                                            type="date"
                                            value={filterDateNew}
                                            disabled={!filterDate}
                                            max={filterDate}
                                            onChange={(e) => handleDatesChange(filterDate, e.target.value)}
                                            className={`w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800/80 border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 transition-all text-zinc-800 dark:text-zinc-200 [color-scheme:light] dark:[color-scheme:dark] ${dateError ? 'border-red-500 ring-2 ring-red-500/20 focus:ring-red-500/30 focus:border-red-500' : 'border-zinc-200 dark:border-zinc-700 focus:ring-blue-500/30 focus:border-blue-500'}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            )}

            {/* Content Area */}
            <div className="flex-grow flex flex-col min-h-0">
                <AnimatePresence mode="wait">
                    {viewMode === 'timeline' ? null : (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col flex-grow min-h-0"
                        >
                            {/* Listado de Cirugías Mejorado */}
                            {filteredSurgeries.length === 0 ? (
                                <div className="p-12 text-center flex flex-col items-center justify-center flex-grow bg-zinc-50/30 dark:bg-zinc-900/10">
                                    <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-6 shadow-inner">
                                        <Calendar size={32} className="text-zinc-400 dark:text-zinc-500" />
                                    </div>
                                    <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-200 mb-2">Pizarra en blanco</h3>
                                    <p className="text-zinc-500 dark:text-zinc-400 max-w-sm font-medium">No hay intervenciones programadas para este filtro. Utiliza el panel lateral para agendar la primera cirugía del día.</p>
                                </div>
                            ) : (
                                <div className="overflow-auto flex-grow bg-white dark:bg-zinc-900 custom-scrollbar">
                                    <table className="w-full text-left border-collapse border-y border-zinc-300 dark:border-zinc-700">
                                        <thead className="sticky top-0 z-20">
                                            <tr className="border-b border-zinc-300 dark:border-zinc-700 bg-zinc-50/95 dark:bg-zinc-800/95 backdrop-blur-md">
                                                <th scope="col" className="px-1 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest w-[1%] whitespace-nowrap text-center">N°</th>
                                                <th scope="col" className={`px-3 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest ${forceTvMode ? 'px-1 max-w-[150px] truncate' : 'min-w-[70px] max-w-[100px]'}`}>
                                                    <div className="flex items-center cursor-pointer group select-none" onClick={() => handleSort('especialidad')}>
                                                        Especialidad
                                                        <SortIcon columnKey="especialidad" />
                                                    </div>
                                                </th>
                                                <th scope="col" className={`py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest text-center ${forceTvMode ? 'px-1 w-[1%] whitespace-nowrap' : 'px-3 min-w-[35px]'}`}>
                                                    <div className="flex items-center justify-center cursor-pointer group select-none" onClick={() => handleSort('sala')}>
                                                        Sala
                                                        <SortIcon columnKey="sala" />
                                                    </div>
                                                </th>
                                                <th scope="col" className={`py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest text-center ${forceTvMode ? 'px-1 w-[1%] whitespace-nowrap' : 'px-3 min-w-[70px]'}`}>
                                                    <div className="flex items-center justify-center cursor-pointer group select-none" onClick={() => handleSort('hora')}>
                                                        {forceTvMode ? 'Hora' : 'Hora-Dur'}
                                                        <SortIcon columnKey="hora" />
                                                    </div>
                                                </th>
                                                <th scope="col" className={`py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest ${forceTvMode ? 'px-1 max-w-[350px] truncate' : 'px-3 min-w-[130px] max-w-[200px]'}`}>
                                                    <div className="flex items-center cursor-pointer group select-none" onClick={() => handleSort('paciente')}>
                                                        Paciente
                                                        <SortIcon columnKey="paciente" />
                                                    </div>
                                                </th>
                                                <th scope="col" className="hidden px-3 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest min-w-[80px]">
                                                    <div className="flex items-center cursor-pointer group select-none" onClick={() => handleSort('tipo')}>
                                                        Tipo / Urg.
                                                        <SortIcon columnKey="tipo" />
                                                    </div>
                                                </th>
                                                <th scope="col" className={`py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest ${forceTvMode ? 'px-1 max-w-[650px] truncate' : 'px-3 min-w-[330px] max-w-[430px]'}`}>Diagnóstico / Intervención</th>
                                                <th scope="col" className={`py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest ${forceTvMode ? 'px-1 min-w-[100px] whitespace-nowrap' : 'px-3 min-w-[160px]'}`}>Equipo</th>
                                                {!forceTvMode && <th scope="col" className="px-3 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest min-w-[85px]">Estado</th>}
                                                {!forceTvMode && <th scope="col" className="px-3 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest min-w-[80px] text-center">F. Sol-Pro</th>}
                                                {!isListFullscreen && !forceTvMode && (
                                                    <th scope="col" className="px-3 py-4 pl-4 text-right text-xs font-bold text-zinc-500 uppercase tracking-widest min-w-[80px] sticky right-0 z-30 bg-zinc-50/95 dark:bg-zinc-800/95 shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)] before:content-[''] before:absolute before:inset-y-0 before:-left-[1px] before:w-[1px] before:bg-zinc-200 dark:before:bg-zinc-700">Gestión</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-zinc-900 border-b border-zinc-300 dark:border-zinc-700">
                                            {sortedSurgeries.map((row, index) => {
                                                const effectiveStatus = optimisticStatuses[row.surgery.id] || row.surgery.status;
                                                const isPending = pendingStatuses[row.surgery.id] || false;
                                                
                                                const logicalPhase = (() => {
                                                    if (row.surgery.status === 'cancelled') return 'cancelled';
                                                    if (!row.surgery.actualStartTime) return 'scheduled';
                                                    if (!row.surgery.anesthesiaStartTime) return 'in_progress';
                                                    if (!row.surgery.preIncisionTime) return 'anesthesia_start';
                                                    if (!row.surgery.surgeryEndTime) return 'pre_incision';
                                                    if (!row.surgery.patientExitTime) return 'surgery_end';
                                                    if (!row.surgery.urpaExitTime) return 'patient_exit';
                                                    if (row.surgery.status === 'completed') return 'completed';
                                                    return 'urpa_exit';
                                                })();

                                                let pillClasses = "";
                                                let pillContent = null;
                                                if (effectiveStatus === 'scheduled') {
                                                    pillClasses = "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/50";
                                                    pillContent = <><div className="w-1.5 h-1.5 rounded-full bg-zinc-400"></div> Programado</>;
                                                } else if (['in_progress', 'anesthesia_start', 'pre_incision', 'surgery_end', 'patient_exit', 'urpa_exit'].includes(effectiveStatus)) {
                                                    pillClasses = "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50";
                                                    pillContent = <><div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></div> En proceso</>;
                                                } else if (effectiveStatus === 'completed') {
                                                    pillClasses = "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800/50 hover:bg-red-100 dark:hover:bg-red-900/50";
                                                    pillContent = <><CheckCircle2 size={12} className="text-emerald-500" /> Finalizado</>;
                                                } else if (effectiveStatus === 'cancelled') {
                                                    pillClasses = "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800";
                                                    pillContent = <><XCircle size={12} className="text-red-500" /> Suspendido</>;
                                                }
                                                return (
                                                <tr key={row.surgery.id} className={`transition-all duration-300 group text-sm border-b border-zinc-300 dark:border-zinc-700 last:border-0 hover:brightness-95 dark:hover:brightness-125 ${getRowBgColor(effectiveStatus)}`}>
                                                    <td className={`px-1 whitespace-nowrap text-zinc-500 font-medium align-middle text-center w-[1%] ${forceTvMode ? 'py-1' : 'py-3'}`}>
                                                        {index + 1}
                                                    </td>
                                                    <td className={`px-3 align-middle ${forceTvMode ? 'py-1 px-1 max-w-[150px]' : 'py-3 max-w-[120px]'}`}>
                                                        {forceTvMode ? (
                                                            <div className="line-clamp-2 whitespace-normal break-words text-xs text-zinc-900 dark:text-zinc-100 font-bold leading-tight w-full" title={row.specialty?.name || ''}>
                                                                <span className="mr-1">{row.specialty?.name || '-'}</span>
                                                                {row.surgery.isFromCopri && (
                                                                    <span className="text-[9px] inline-block px-1.5 py-0.5 rounded border font-bold uppercase text-center bg-blue-50 text-blue-600 border-blue-200 align-middle leading-none">
                                                                        Viene COPRI
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col">
                                                                <div className="text-xs text-zinc-900 dark:text-zinc-100 font-bold leading-tight line-clamp-3 break-words whitespace-normal" title={row.specialty?.name || ''}>
                                                                    {row.specialty?.name || '-'}
                                                                </div>
                                                                {row.surgery.isFromCopri && (
                                                                    <div className="mt-1.5 block">
                                                                        <span className="text-[9px] inline-block px-1.5 py-0.5 rounded border font-bold uppercase text-center bg-blue-50 text-blue-600 border-blue-200">
                                                                            Viene COPRI
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className={`whitespace-nowrap align-middle text-center ${forceTvMode ? 'py-1 px-1 w-[1%]' : 'py-3 px-3'}`}>
                                                        <div className={`flex justify-center text-[13px] font-bold text-left ${forceTvMode ? 'items-center' : 'items-start'}`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${forceTvMode ? '' : 'mt-1.5'} ${row.operatingRoom?.name ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                                            <span className={`leading-tight ${forceTvMode ? 'whitespace-nowrap' : 'whitespace-normal break-words max-w-[40px]'}`} title={row.operatingRoom?.name || 'S/A'}>
                                                                {row.operatingRoom?.name || 'S/A'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className={`whitespace-nowrap align-middle text-center ${forceTvMode ? 'py-1 px-1 w-[1%]' : 'py-3 px-3'}`}>
                                                        <div className={`flex items-center justify-center ${forceTvMode ? 'flex-row gap-2' : 'flex-col gap-1.5'}`}>
                                                            <div className="text-[13px] font-bold text-amber-700 dark:text-amber-400">
                                                                {row.surgery.isTimeDefined ? formatTimeOnly(row.surgery.scheduledDate) : '00:00'}
                                                            </div>
                                                            {!forceTvMode && (
                                                                <div className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                                                                    {row.surgery.estimatedDuration || '-'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className={`align-middle ${forceTvMode ? 'py-1 px-1 max-w-[350px]' : 'py-3 px-3 max-w-[200px]'}`}>
                                                        <div className={`text-xs leading-tight ${forceTvMode ? 'line-clamp-2 whitespace-normal break-words w-full' : 'flex flex-col whitespace-normal break-words'}`}>
                                                            {row.patientPii?.dni === '00000000' || row.patientPii?.nombres === 'POR DEFINIR' ? (
                                                                <span className="font-bold text-zinc-500 italic uppercase tracking-wider">POR DEFINIR</span>
                                                            ) : (
                                                                <span className={`${forceTvMode ? '' : 'flex flex-wrap'}`}>
                                                                    <span className="font-bold text-zinc-900 dark:text-white mr-1" title={row.patientPii?.nombres ? `${row.patientPii.nombres} ${row.patientPii.apellidos}` : 'Desconocido'}>
                                                                        {row.patientPii?.nombres && row.patientPii.nombres !== 'Desconocido' ? `${row.patientPii.nombres} ${row.patientPii.apellidos}` : 'Desconocido'}
                                                                    </span>
                                                                    <span className="text-[11px] text-zinc-900 dark:text-white font-mono tracking-tight mr-1">
                                                                        {row.patientPii?.dni || row.patientPii?.carnetExtranjeria || row.patientPii?.pasaporte || 'S/Doc'}
                                                                    </span>
                                                                    <span className="text-[11px] text-zinc-900 dark:text-white font-sans tracking-normal mr-1">
                                                                        {formatDemographicsOnly(row.patientPii, row.patient, row.surgery?.bedNumber)}
                                                                    </span>
                                                                    {row.surgery.insuranceType && (
                                                                        <span className="text-[8px] px-1 py-[1px] rounded border font-bold uppercase bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 inline-block align-middle leading-none mr-1">
                                                                            {row.surgery.insuranceType}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="hidden px-3 py-3 whitespace-nowrap align-middle">
                                                        <div className="flex flex-col gap-1 items-start">
                                                        </div>
                                                    </td>
                                                    <td className={`align-middle ${forceTvMode ? 'py-1 px-1 max-w-[650px]' : 'py-3 px-3 min-w-[330px] max-w-[430px]'}`}>
                                                        <div className="flex flex-wrap items-center gap-1 mb-2">
                                                            {row.surgery.surgeryType && (
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase shadow-sm inline-flex items-center leading-none ${row.surgery.surgeryType.toLowerCase().includes('mayor') ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'}`}>
                                                                    {row.surgery.surgeryType}
                                                                </span>
                                                            )}
                                                            {row.surgery.urgencyType && (
                                                                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase shadow-sm inline-flex items-center leading-none ${row.surgery.urgencyType.toUpperCase() === 'EMERGENCIA' ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'}`}>
                                                                    {row.surgery.urgencyType}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {forceTvMode ? (
                                                            (() => {
                                                                const items: React.ReactNode[] = [];

                                                                // 1. Notas internas
                                                                if (row.surgery.notes) {
                                                                    items.push(
                                                                        <span key="notes" className="text-zinc-750 dark:text-zinc-300 font-medium" title={row.surgery.notes}>
                                                                            <span className="opacity-85 font-bold text-zinc-900 dark:text-zinc-100">Nota:</span> {row.surgery.notes}
                                                                        </span>
                                                                    );
                                                                }

                                                                // 1.5. Motivo de suspensión
                                                                if (row.surgery.status === 'cancelled' && row.surgery.cancellationReason) {
                                                                    items.push(
                                                                        <span key="cancellation" className="text-red-600 dark:text-red-400 font-bold border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded-full inline-block text-[9px]" title={row.surgery.cancellationReason}>
                                                                            Motivo Suspensión: {row.surgery.cancellationReason}
                                                                        </span>
                                                                    );
                                                                }

                                                                // 2. Tipo de intervención
                                                                if (row.interventions && row.interventions.length > 0 && typeof interventions !== 'undefined') {
                                                                    items.push(
                                                                        <span key="interventions" className="text-emerald-700 dark:text-emerald-400 font-medium" title={interventions.find(int => int.id === row.interventions[0])?.name}>
                                                                            <span className="opacity-80 font-bold">In:</span> {interventions.find(int => int.id === row.interventions[0])?.name || row.interventions[0]} {row.interventions.length > 1 ? ` (+${row.interventions.length - 1})` : ''}
                                                                        </span>
                                                                    );
                                                                }

                                                                // 3. Diagnósticos
                                                                if (row.diagnoses && row.diagnoses.length > 0 && typeof diagnoses !== 'undefined') {
                                                                    items.push(
                                                                        <span key="diagnosis" className="text-blue-700 dark:text-blue-400 font-semibold" title={diagnoses.find(dx => dx.id === row.diagnoses[0])?.name}>
                                                                            <span className="opacity-80">Dx:</span> {diagnoses.find(dx => dx.id === row.diagnoses[0])?.code || row.diagnoses[0]} - {diagnoses.find(dx => dx.id === row.diagnoses[0])?.name || ''} {row.diagnoses.length > 1 ? ` (+${row.diagnoses.length - 1})` : ''}
                                                                        </span>
                                                                    );
                                                                } else if (row.surgery.diagnosis) {
                                                                    items.push(
                                                                        <span key="diagnosis" className="text-blue-700 dark:text-blue-400 font-semibold" title={row.surgery.diagnosis}>
                                                                            <span className="opacity-80">Dx:</span> {row.surgery.diagnosis}
                                                                        </span>
                                                                    );
                                                                }

                                                                // 4. Procedimientos
                                                                if (row.procedures && row.procedures.length > 0 && typeof procedures !== 'undefined') {
                                                                    items.push(
                                                                        <span key="procedures" className="text-purple-700 dark:text-purple-400 font-medium" title={procedures.find(pr => pr.id === row.procedures[0])?.name}>
                                                                            <span className="opacity-80 font-bold">Pr:</span> {procedures.find(pr => pr.id === row.procedures[0])?.name || row.procedures[0]} {row.procedures.length > 1 ? ` (+${row.procedures.length - 1})` : ''}
                                                                        </span>
                                                                    );
                                                                }

                                                                // 5. Tipo de anestesia
                                                                if (row.surgery.anesthesiaType) {
                                                                    items.push(
                                                                        <span key="anesthesia" className="inline-flex gap-1 align-middle">
                                                                            {row.surgery.anesthesiaType.split(',').filter(Boolean).map((typeCode: string) => {
                                                                                const trimmed = typeCode.trim();
                                                                                const anesthesiaMap: Record<string, string> = {
                                                                                    'RAQ': 'Raquídea',
                                                                                    'EPI': 'Epidural',
                                                                                    'AGB': 'Gen. Balanceada',
                                                                                    'AGE': 'Gen. Endovenosa',
                                                                                    'AGI': 'Gen. Inhalatoria',
                                                                                    'BLOQ': 'Bloqueo Reg.',
                                                                                    'LOCL': 'Local',
                                                                                    'SEDA': 'Sedación'
                                                                                };
                                                                                const label = anesthesiaMap[trimmed] || trimmed;
                                                                                return (
                                                                                    <span key={trimmed} className="text-[9px] px-1 py-[0.5px] rounded border font-bold uppercase bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border-sky-200/60 dark:border-sky-800/60 inline-flex items-center leading-none align-middle">
                                                                                        {label}
                                                                                    </span>
                                                                                );
                                                                            })}
                                                                        </span>
                                                                    );
                                                                }

                                                                return (
                                                                    <div className="line-clamp-2 text-[11px] leading-tight break-words text-zinc-700 dark:text-zinc-300 w-full whitespace-normal">
                                                                        {items.map((item, idx) => (
                                                                            <Fragment key={idx}>
                                                                                {idx > 0 && <span className="text-zinc-300 dark:text-zinc-700 font-normal mx-1 align-middle">•</span>}
                                                                                {item}
                                                                            </Fragment>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            })()
                                                        ) : (
                                                            <div className="flex w-full flex-col gap-1.5">
                                                                {/* 1. Diagnósticos */}
                                                                {row.diagnoses && row.diagnoses.length > 0 && typeof diagnoses !== 'undefined' ? (
                                                                    <div className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold leading-tight line-clamp-3 break-words whitespace-normal" title={diagnoses.find(dx => dx.id === row.diagnoses[0])?.name}>
                                                                        <span className="opacity-80">Dx:</span> {diagnoses.find(dx => dx.id === row.diagnoses[0])?.code || row.diagnoses[0]} - {diagnoses.find(dx => dx.id === row.diagnoses[0])?.name || ''} {row.diagnoses.length > 1 ? `(+${row.diagnoses.length - 1})` : ''}
                                                                    </div>
                                                                ) : row.surgery.diagnosis ? (
                                                                    <div className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold leading-tight line-clamp-3 break-words whitespace-normal" title={row.surgery.diagnosis}>
                                                                        <span className="opacity-80">Dx:</span> {row.surgery.diagnosis}
                                                                    </div>
                                                                ) : null}

                                                                {/* 2. Procedimientos */}
                                                                {row.procedures && row.procedures.length > 0 && typeof procedures !== 'undefined' && (
                                                                    <div className="text-[11px] text-purple-700 dark:text-purple-400 font-medium leading-tight line-clamp-3 break-words whitespace-normal" title={procedures.find(pr => pr.id === row.procedures[0])?.name}>
                                                                        <span className="opacity-80 font-bold">Pr:</span> {procedures.find(pr => pr.id === row.procedures[0])?.name || row.procedures[0]} {row.procedures.length > 1 ? `(+${row.procedures.length - 1})` : ''}
                                                                    </div>
                                                                )}

                                                                {/* 3. Tipo de intervención */}
                                                                {row.interventions && row.interventions.length > 0 && typeof interventions !== 'undefined' && (
                                                                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium leading-tight line-clamp-3 break-words whitespace-normal" title={interventions.find(int => int.id === row.interventions[0])?.name}>
                                                                        <span className="opacity-80 font-bold">In:</span> {interventions.find(int => int.id === row.interventions[0])?.name || row.interventions[0]} {row.interventions.length > 1 ? `(+${row.interventions.length - 1})` : ''}
                                                                    </div>
                                                                )}

                                                                {/* 4. Notas internas */}
                                                                {row.surgery.notes && (
                                                                    <div className="text-[10px] text-black dark:text-white leading-tight font-medium line-clamp-2" title={row.surgery.notes}>
                                                                        {row.surgery.notes}
                                                                    </div>
                                                                )}

                                                                {/* Motivo de suspensión */}
                                                                {row.surgery.status === 'cancelled' && row.surgery.cancellationReason && (
                                                                    <div className="mt-1.5 block">
                                                                        <span className="text-[10px] inline-block px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800/50 font-bold bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 max-w-full break-words leading-normal" title={row.surgery.cancellationReason}>
                                                                            Motivo Suspensión: {row.surgery.cancellationReason}
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {/* 5. Tipo de anestesia */}
                                                                {row.surgery.anesthesiaType && (
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {row.surgery.anesthesiaType.split(',').filter(Boolean).map((typeCode: string) => {
                                                                            const trimmed = typeCode.trim();
                                                                            const anesthesiaMap: Record<string, string> = {
                                                                                'RAQ': 'Raquídea',
                                                                                'EPI': 'Epidural',
                                                                                'AGB': 'Gen. Balanceada',
                                                                                'AGE': 'Gen. Endovenosa',
                                                                                'AGI': 'Gen. Inhalatoria',
                                                                                'BLOQ': 'Bloqueo Reg.',
                                                                                'LOCL': 'Local',
                                                                                'SEDA': 'Sedación'
                                                                            };
                                                                            const label = anesthesiaMap[trimmed] || trimmed;
                                                                            return (
                                                                                <span key={trimmed} className="text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border-sky-200/60 dark:border-sky-800/60 shadow-sm inline-flex items-center leading-none">
                                                                                    Anestesia: {label}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className={`align-middle ${forceTvMode ? 'py-1 px-1 min-w-[100px]' : 'py-3 px-3 max-w-[250px]'}`}>
                                                        {row.team && row.team.length > 0 ? (() => {
                                                            const surgeons = row.team.filter((t: any) => t.role === 'CIRUJANO');
                                                            const anesthesiologists = row.team.filter((t: any) => t.role === 'ANESTESIOLOGO');
                                                            
                                                            const getRoleCode = (t: any) => {
                                                                if (t.role === 'INSTRUMENTISTA') return 'In';
                                                                if (t.role === 'CIRCULANTE') return 'Ci';
                                                                let profName = t.staff?.professionName || t.professionName;
                                                                if (!profName && typeof staff !== 'undefined' && staff?.nurses) {
                                                                    const nurse = staff.nurses.find((n: any) => n.id === t.staff.id);
                                                                    if (nurse) profName = nurse.professionName;
                                                                }
                                                                if (profName?.includes('INSTRUMENTISTA')) return 'In';
                                                                if (profName?.includes('CIRCULANTE')) return 'Ci';
                                                                return 'Other';
                                                            };

                                                            const instrumentistas = row.team.filter((t: any) => t.role !== 'CIRUJANO' && t.role !== 'ANESTESIOLOGO' && getRoleCode(t) === 'In');
                                                            const circulantes = row.team.filter((t: any) => t.role !== 'CIRUJANO' && t.role !== 'ANESTESIOLOGO' && getRoleCode(t) === 'Ci');
                                                            const others = row.team.filter((t: any) => t.role !== 'CIRUJANO' && t.role !== 'ANESTESIOLOGO' && getRoleCode(t) === 'Other');

                                                            const renderTeamGroup = (members: any[], prefix: string, colorClass: string) => {
                                                                if (!members || members.length === 0) return null;
                                                                if (forceTvMode) {
                                                                    return (
                                                                        <span className="font-medium">
                                                                            <span className={`font-bold ${colorClass}`}>{prefix}:</span>{' '}
                                                                            {members.map((t: any, idx: number) => (
                                                                                <span key={`${row.surgery.id}-${t.staff.id}`} className="text-zinc-900 dark:text-zinc-100 font-bold" title={`${t.role}: ${t.staff.name} ${t.staff.lastname}`}>
                                                                                    {t.staff.name?.split(' ')[0]} {t.staff.lastname?.split(' ')[0]}{idx < members.length - 1 ? ', ' : ''}
                                                                                </span>
                                                                            ))}
                                                                        </span>
                                                                    );
                                                                }
                                                                return (
                                                                    <div className="flex items-start gap-x-1">
                                                                        <span className={`font-bold ${colorClass} shrink-0`}>{prefix}:</span>
                                                                        <div className="flex gap-x-1.5 flex-wrap">
                                                                            {members.map((t: any, idx: number) => (
                                                                                <span key={`${row.surgery.id}-${t.staff.id}`} className="text-zinc-900 dark:text-zinc-100 font-bold" title={`${t.role}: ${t.staff.name} ${t.staff.lastname}`}>
                                                                                    {t.staff.name?.split(' ')[0]} {t.staff.lastname?.split(' ')[0]}{idx < members.length - 1 ? ',' : ''}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            };

                                                            if (forceTvMode) {
                                                                const groups = [
                                                                    { members: surgeons, prefix: 'Cx', color: 'text-blue-700 dark:text-blue-400' },
                                                                    { members: anesthesiologists, prefix: 'An', color: 'text-emerald-700 dark:text-emerald-400' },
                                                                    { members: instrumentistas, prefix: 'In', color: 'text-sky-700 dark:text-sky-400' },
                                                                    { members: circulantes, prefix: 'Ci', color: 'text-sky-700 dark:text-sky-400' },
                                                                    { members: others, prefix: 'CI', color: 'text-zinc-500 dark:text-zinc-400' }
                                                                ].filter(g => g.members && g.members.length > 0);

                                                                return (
                                                                    <div className="line-clamp-2 text-[11px] leading-tight break-words text-zinc-700 dark:text-zinc-300 w-full whitespace-normal">
                                                                        {groups.map((group, idx) => (
                                                                            <Fragment key={idx}>
                                                                                {idx > 0 && <span className="text-zinc-300 dark:text-zinc-700 font-normal mx-1 align-middle">•</span>}
                                                                                {renderTeamGroup(group.members, group.prefix, group.color)}
                                                                            </Fragment>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <div className="text-[11px] leading-tight flex flex-col gap-0.5">
                                                                    {renderTeamGroup(surgeons, 'Cx', 'text-blue-700 dark:text-blue-400')}
                                                                    {renderTeamGroup(anesthesiologists, 'An', 'text-emerald-700 dark:text-emerald-400')}
                                                                    {renderTeamGroup(instrumentistas, 'In', 'text-sky-700 dark:text-sky-400')}
                                                                    {renderTeamGroup(circulantes, 'Ci', 'text-sky-700 dark:text-sky-400')}
                                                                    {renderTeamGroup(others, 'CI', 'text-zinc-500 dark:text-zinc-400')}
                                                                </div>
                                                            );
                                                        })() : <span className="text-xs text-zinc-400">-</span>}
                                                    </td>

                                                    {!forceTvMode && (
                                                        <td className="px-3 py-3 whitespace-nowrap align-middle">
                                                            {canChangeStatus ? (
                                                                <button 
                                                                    onClick={() => handleQuickStatusCycle(row.surgery.id, row.surgery.status)}
                                                                    disabled={isPending}
                                                                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border flex flex-nowrap items-center justify-center gap-1.5 shadow-sm transition-all duration-300 cursor-pointer hover:scale-105 active:scale-95 ${pillClasses} ${isPending ? 'opacity-50 scale-95' : ''}`}
                                                                    title="Clic para cambiar estado visual"
                                                                >
                                                                    {pillContent}
                                                                </button>
                                                            ) : (
                                                                <div 
                                                                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border flex flex-nowrap items-center justify-center gap-1.5 shadow-sm cursor-default opacity-90 ${pillClasses}`}
                                                                    title="No tienes permisos para cambiar el estado rápidamente"
                                                                >
                                                                    {pillContent}
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}
                                                    {!forceTvMode && (
                                                        <td className="px-3 py-3 whitespace-nowrap align-middle text-center">
                                                            <div className="flex flex-col items-center justify-center gap-1.5">
                                                                <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium tracking-tight">
                                                                    {formatDateOnly(row.surgery.requestDate)}
                                                                </div>
                                                                <div className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold tracking-tight">
                                                                    {formatDateOnly(row.surgery.scheduledDate)}
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {!isListFullscreen && !forceTvMode && (
                                                        <td className="px-3 py-3 whitespace-nowrap text-right align-middle sticky right-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50/50 dark:group-hover:bg-zinc-800/50 transition-colors shadow-[-5px_0_10px_-5px_rgba(0,0,0,0.1)] before:content-[''] before:absolute before:inset-y-0 before:-left-[1px] before:w-[1px] before:bg-zinc-100 dark:before:bg-zinc-800/50">
                                                            <div className="flex justify-end gap-2 items-center opacity-70 group-hover:opacity-100 transition-opacity duration-300">
                                                                {/* Flujo de Estados con Modal de Tiempo */}
                                                                {logicalPhase === 'scheduled' && canAdvancePhase && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setTransitionModal({
                                                                                isOpen: true,
                                                                                surgeryId: row.surgery.id,
                                                                                targetPhase: 'in_progress',
                                                                                patientName: `${row.patientPii?.nombres || ''} ${row.patientPii?.apellidos || ''}`.trim() || 'Desconocido',
                                                                                urgencyType: row.surgery.urgencyType || 'ELECTIVO'
                                                                            });
                                                                        }}
                                                                        className="text-amber-700 hover:text-white hover:bg-amber-600 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-xl transition-all duration-300 border border-amber-200 hover:scale-[1.02] text-xs font-bold shadow-sm"
                                                                    >
                                                                        Ingreso a Quirófano
                                                                    </button>
                                                                )}

                                                                {logicalPhase === 'in_progress' && canAdvancePhase && (
                                                                    <button
                                                                        onClick={() => setTransitionModal({ 
                                                                            isOpen: true, 
                                                                            surgeryId: row.surgery.id, 
                                                                            targetPhase: 'anesthesia_start', 
                                                                            patientName: `${row.patientPii?.nombres || ''} ${row.patientPii?.apellidos || ''}`,
                                                                            initialTime: formatForDateTimeLocal(row.surgery.actualStartTime),
                                                                            urgencyType: row.surgery.urgencyType || 'ELECTIVO'
                                                                        })}
                                                                        className="text-purple-700 hover:text-white hover:bg-purple-600 bg-purple-50 dark:bg-purple-900/20 px-3 py-1.5 rounded-lg transition-all text-xs font-bold shadow-sm whitespace-nowrap border border-purple-200/50"
                                                                    >
                                                                        Inic. Anestesia &rarr;
                                                                    </button>
                                                                )}

                                                                {logicalPhase === 'anesthesia_start' && canAdvancePhase && (
                                                                    <button
                                                                        onClick={() => setTransitionModal({ 
                                                                            isOpen: true, 
                                                                            surgeryId: row.surgery.id, 
                                                                            targetPhase: 'pre_incision', 
                                                                            patientName: `${row.patientPii?.nombres || ''} ${row.patientPii?.apellidos || ''}`,
                                                                            initialTime: formatForDateTimeLocal(row.surgery.anesthesiaStartTime),
                                                                            urgencyType: row.surgery.urgencyType || 'ELECTIVO'
                                                                        })}
                                                                        className="text-rose-700 hover:text-white hover:bg-rose-600 bg-rose-50 dark:bg-rose-900/20 px-3 py-1.5 rounded-lg transition-all text-xs font-bold shadow-sm whitespace-nowrap border border-rose-200/50"
                                                                    >
                                                                        Antes Incisión &rarr;
                                                                    </button>
                                                                )}

                                                                {logicalPhase === 'pre_incision' && canAdvancePhase && (
                                                                    <button
                                                                        onClick={() => setTransitionModal({ 
                                                                            isOpen: true, 
                                                                            surgeryId: row.surgery.id, 
                                                                            targetPhase: 'surgery_end', 
                                                                            patientName: `${row.patientPii?.nombres || ''} ${row.patientPii?.apellidos || ''}`,
                                                                            initialTime: formatForDateTimeLocal(row.surgery.preIncisionTime),
                                                                            urgencyType: row.surgery.urgencyType || 'ELECTIVO'
                                                                        })}
                                                                        className="text-cyan-700 hover:text-white hover:bg-cyan-600 bg-cyan-50 dark:bg-cyan-900/20 px-3 py-1.5 rounded-lg transition-all text-xs font-bold shadow-sm whitespace-nowrap border border-cyan-200/50"
                                                                    >
                                                                        Término Cirugía &rarr;
                                                                    </button>
                                                                )}

                                                                {logicalPhase === 'surgery_end' && canAdvancePhase && (
                                                                    <button
                                                                        onClick={() => setTransitionModal({ 
                                                                            isOpen: true, 
                                                                            surgeryId: row.surgery.id, 
                                                                            targetPhase: 'patient_exit', 
                                                                            patientName: `${row.patientPii?.nombres || ''} ${row.patientPii?.apellidos || ''}`,
                                                                            initialTime: formatForDateTimeLocal(row.surgery.surgeryEndTime),
                                                                            urgencyType: row.surgery.urgencyType || 'ELECTIVO'
                                                                        })}
                                                                        className="text-orange-700 hover:text-white hover:bg-orange-600 bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-lg transition-all text-xs font-bold shadow-sm whitespace-nowrap border border-orange-200/50"
                                                                    >
                                                                        Salida Paciente &rarr;
                                                                    </button>
                                                                )}

                                                                {logicalPhase === 'patient_exit' && canAdvancePhase && (
                                                                    <div className="flex gap-1.5 items-center">
                                                                        <button
                                                                            onClick={() => setTransitionModal({ 
                                                                                isOpen: true, 
                                                                                surgeryId: row.surgery.id, 
                                                                                targetPhase: 'urpa_exit', 
                                                                                patientName: `${row.patientPii?.nombres || ''} ${row.patientPii?.apellidos || ''}`,
                                                                                initialTime: formatForDateTimeLocal(row.surgery.patientExitTime),
                                                                                urgencyType: row.surgery.urgencyType || 'ELECTIVO'
                                                                            })}
                                                                            className="text-indigo-700 hover:text-white hover:bg-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-1.5 rounded-lg transition-all text-[11px] font-bold shadow-sm whitespace-nowrap border border-indigo-200/50"
                                                                        >
                                                                            Pase URPA &rarr;
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setTransitionModal({ 
                                                                                isOpen: true, 
                                                                                surgeryId: row.surgery.id, 
                                                                                targetPhase: 'completed', 
                                                                                patientName: `${row.patientPii?.nombres || ''} ${row.patientPii?.apellidos || ''}`,
                                                                                initialTime: formatForDateTimeLocal(row.surgery.patientExitTime),
                                                                                urgencyType: row.surgery.urgencyType || 'ELECTIVO'
                                                                            })}
                                                                            className="text-emerald-700 hover:text-white hover:bg-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg transition-all text-xs font-bold shadow-sm whitespace-nowrap flex items-center gap-1 border border-emerald-200/50"
                                                                        >
                                                                            <CheckCircle2 size={13} /> Alta
                                                                        </button>
                                                                    </div>
                                                                )}

                                                                {logicalPhase === 'urpa_exit' && canAdvancePhase && (
                                                                    <button
                                                                        onClick={() => setTransitionModal({ 
                                                                            isOpen: true, 
                                                                            surgeryId: row.surgery.id, 
                                                                            targetPhase: 'completed', 
                                                                            patientName: `${row.patientPii?.nombres || ''} ${row.patientPii?.apellidos || ''}`,
                                                                            initialTime: formatForDateTimeLocal(row.surgery.urpaExitTime),
                                                                            urgencyType: row.surgery.urgencyType || 'ELECTIVO'
                                                                        })}
                                                                        className="text-emerald-700 hover:text-white hover:bg-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl transition-all duration-300 border border-emerald-200 hover:scale-[1.02] text-xs font-bold shadow-sm flex items-center gap-1.5 whitespace-nowrap"
                                                                    >
                                                                        <CheckCircle2 size={14} /> Finalizar
                                                                    </button>
                                                                )}

                                                                {logicalPhase === 'scheduled' && canCancel && (
                                                                    <button type="button" onClick={() => { setCancellingSurgery(row); setCancelConfirmText(""); }} className="text-zinc-400 hover:text-amber-600 hover:bg-amber-50 p-2.5 rounded-xl transition-all" title="Suspender Evento">
                                                                        <XCircle size={18} />
                                                                    </button>
                                                                )}

                                                                {specialties && staff && (
                                                                    <>
                                                                        {canEditTimes && (
                                                                            <button onClick={() => setEditingTimesSurgery(row)} className="text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 p-2.5 rounded-xl transition-all" title="Ver/Editar Tiempos y Fases">
                                                                                <Clock size={18} />
                                                                            </button>
                                                                        )}
                                                                        {canEdit && (
                                                                            <button onClick={() => setEditingSurgery(row)} className="text-zinc-400 hover:text-blue-600 hover:bg-blue-50 p-2.5 rounded-xl transition-all" title="Editar Programación">
                                                                                <Pencil size={18} />
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}

                                                                {canDuplicate && (
                                                                    <button onClick={() => window.dispatchEvent(new CustomEvent('CLONE_SURGERY', { detail: row }))} className="text-zinc-400 hover:text-[var(--color-hospital-blue)] hover:bg-blue-50 p-2.5 rounded-xl transition-all inline-block ml-1" title="Duplicar / Re-Agendar Cirugía">
                                                                        <CopyPlus size={18} />
                                                                    </button>
                                                                )}

                                                                {logicalPhase === 'completed' && canViewReport && (
                                                                    <Link href={`/dashboard/programaciones/${row.surgery.id}/reporte`} className="inline-flex items-center text-zinc-500 hover:text-[var(--color-hospital-blue)] hover:bg-blue-50 p-2.5 rounded-xl transition-all tooltip bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700" title="Ver Reporte Operatorio">
                                                                        <FileText size={18} />
                                                                    </Link>
                                                                )}

                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {typeof document !== "undefined" && createPortal(
                <AnimatePresence>
                    {errorModalMsg && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setErrorModalMsg("")}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200/50 dark:border-zinc-800 z-10 w-full max-w-md overflow-hidden relative"
                            >
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500"></div>
                                <div className="p-6 pt-8 text-center sm:text-left flex flex-col sm:flex-row gap-5 items-center sm:items-start">
                                    <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center shrink-0">
                                        <AlertTriangle size={24} className="text-amber-500" />
                                    </div>
                                    <div className="flex-1 mt-1">
                                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                                            Aviso de Validación
                                        </h3>
                                        <p className="text-[13px] text-zinc-600 dark:text-zinc-400 font-medium whitespace-pre-wrap leading-relaxed">
                                            {errorModalMsg}
                                        </p>
                                    </div>
                                </div>
                                <div className="px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                                    <button
                                        onClick={() => setErrorModalMsg("")}
                                        className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-zinc-900 font-bold rounded-xl transition-all w-full sm:w-auto shadow-sm"
                                    >
                                        Entendido
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {typeof document !== "undefined" && createPortal(
                <AnimatePresence>
                    {cancellingSurgery && (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setCancellingSurgery(null)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                className="bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200/50 dark:border-zinc-800 z-10 w-full max-w-md overflow-hidden relative"
                            >
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500"></div>
                                <form action={handleStatusUpdate} onSubmit={() => setCancellingSurgery(null)}>
                                    <input type="hidden" name="id" value={cancellingSurgery.surgery.id} />
                                    <input type="hidden" name="status" value="cancelled" />

                                    <div className="p-6 pt-8 text-center sm:text-left">
                                        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center mx-auto sm:mx-0 shrink-0 mb-4">
                                            <XCircle size={24} className="text-amber-500" />
                                        </div>
                                        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                                            ¿Suspender Cirugía?
                                        </h3>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium whitespace-pre-wrap mb-4">
                                            Esta acción cambiará la programación de <strong className="text-zinc-700 dark:text-zinc-300">{cancellingSurgery.patient?.name || 'este paciente'}</strong> a un estado suspendida. No podrá volver a editarla, solo eliminarla o clonarla para crear un nuevo registro.
                                        </p>

                                        {/* Motivo de la suspensión (Opcional) */}
                                        <div className="mb-4 text-left">
                                            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-2">
                                                Motivo de la suspensión (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                name="cancellation_reason"
                                                placeholder="Ej: Paciente no apto, falta de insumos..."
                                                className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                                            />
                                        </div>

                                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50 mb-5 text-left">
                                            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block mb-2">
                                                Para confirmar, escriba <strong className="text-amber-600 dark:text-amber-400 select-all">{cancellingSurgery.patientPii?.dni || 'SUSPENDER'}</strong>
                                            </label>
                                            <input
                                                type="text"
                                                value={cancelConfirmText}
                                                onChange={(e) => setCancelConfirmText(e.target.value)}
                                                placeholder="Escribir confirmación aquí..."
                                                className="w-full px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-sm font-medium"
                                            />
                                        </div>
                                    </div>
                                    <div className="px-6 py-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setCancellingSurgery(null)}
                                            className="px-5 py-2.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-semibold transition-colors text-sm"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={cancelConfirmText !== (cancellingSurgery.patientPii?.dni || 'SUSPENDER')}
                                            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:hover:bg-amber-500 text-white font-bold rounded-xl transition-all shadow-sm text-sm flex items-center gap-2"
                                        >
                                            Confirmar Suspensión
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {mounted && createPortal(
                <AnimatePresence>
                    {viewMode === 'timeline' && (
                        <motion.div
                            key="timeline-fullscreen"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="relative z-[100]"
                        >
                            <SurgeryTimeline surgeriesData={baseFilteredSurgeries} salas={filterRoom.length === 0 ? salas : salas.filter(s => filterRoom.includes(s.id))} displayDate={filterDate} setDisplayDate={handleDateChange} diagnoses={diagnoses} procedures={procedures} interventions={interventions} staff={staff} onClose={() => setViewMode('list')} />
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}

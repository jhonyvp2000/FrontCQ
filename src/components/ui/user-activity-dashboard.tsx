"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar, 
  ShieldAlert, 
  ShieldCheck, 
  Search, 
  Filter, 
  Award, 
  Loader2, 
  AlertCircle,
  FileText,
  FileSpreadsheet,
  UserCheck
} from "lucide-react";
import { getUserSurgeryStatsAction, getUserSurgeryHistoryAction } from "@/app/actions/user-analytics";
import * as XLSX from "xlsx";

interface UserActivityDashboardProps {
  userId: string;
}

export function UserActivityDashboard({ userId }: UserActivityDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  // Filter & Pagination States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState("TODAY");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    if (userId) {
      loadDashboardData();
    }
  }, [userId]);

  const loadDashboardData = async () => {
    setLoading(true);
    const [statsRes, historyRes] = await Promise.all([
      getUserSurgeryStatsAction(userId),
      getUserSurgeryHistoryAction(userId)
    ]);

    if (statsRes.success) {
      setStats(statsRes.stats);
    }

    if (historyRes.success && historyRes.history) {
      setHistory(historyRes.history);
    }

    setLoading(false);
  };

  // 1. Base Filtered History (matching Search, Role, and Date filters)
  const baseFilteredHistory = useMemo(() => {
    let result = [...history];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(item => 
        (item.diagnosis && item.diagnosis.toLowerCase().includes(q)) ||
        (item.procedure && item.procedure.toLowerCase().includes(q)) ||
        (item.roomName && item.roomName.toLowerCase().includes(q)) ||
        (item.roleInSurgery && item.roleInSurgery.toLowerCase().includes(q)) ||
        (item.patient?.name && item.patient.name.toLowerCase().includes(q)) ||
        (item.patient?.dni && item.patient.dni.toLowerCase().includes(q)) ||
        (item.patient?.hcNumber && item.patient.hcNumber.toLowerCase().includes(q))
      );
    }

    if (roleFilter !== "ALL") {
      result = result.filter(item => item.roleInSurgery === roleFilter);
    }

    // Date Range Filtering
    if (datePreset !== "ALL") {
      const now = new Date();

      if (datePreset === "TODAY") {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        result = result.filter(item => {
          if (!item.surgeryDate) return false;
          const d = new Date(item.surgeryDate);
          return d >= startOfDay && d <= endOfDay;
        });
      } else if (datePreset === "THIS_WEEK") {
        const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1);
        const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - dayOfWeek), 23, 59, 59, 999);
        result = result.filter(item => {
          if (!item.surgeryDate) return false;
          const d = new Date(item.surgeryDate);
          return d >= startOfWeek && d <= endOfWeek;
        });
      } else if (datePreset === "THIS_MONTH") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        result = result.filter(item => {
          if (!item.surgeryDate) return false;
          const d = new Date(item.surgeryDate);
          return d >= startOfMonth && d <= endOfMonth;
        });
      } else if (datePreset === "LAST_MONTH") {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        result = result.filter(item => {
          if (!item.surgeryDate) return false;
          const d = new Date(item.surgeryDate);
          return d >= startOfLastMonth && d <= endOfLastMonth;
        });
      } else if (datePreset === "THIS_YEAR") {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        result = result.filter(item => {
          if (!item.surgeryDate) return false;
          const d = new Date(item.surgeryDate);
          return d >= startOfYear && d <= endOfYear;
        });
      } else if (datePreset === "CUSTOM") {
        if (startDate) {
          const start = new Date(startDate + "T00:00:00");
          result = result.filter(item => {
            if (!item.surgeryDate) return false;
            return new Date(item.surgeryDate) >= start;
          });
        }
        if (endDate) {
          const end = new Date(endDate + "T23:59:59.999");
          result = result.filter(item => {
            if (!item.surgeryDate) return false;
            return new Date(item.surgeryDate) <= end;
          });
        }
      }
    }

    return result;
  }, [history, searchTerm, roleFilter, datePreset, startDate, endDate]);

  // 2. Final Filtered History (table items, with statusFilter)
  const filteredHistory = useMemo(() => {
    if (statusFilter === "ALL") return baseFilteredHistory;

    return baseFilteredHistory.filter(item => {
      if (statusFilter === "completed") return item.status === "completed";
      if (statusFilter === "cancelled") return item.status === "cancelled";
      if (statusFilter === "scheduled") {
        return ['scheduled', 'in_progress', 'anesthesia_start', 'pre_incision', 'surgery_end', 'patient_exit', 'urpa_exit'].includes(item.status);
      }
      return item.status === statusFilter;
    });
  }, [baseFilteredHistory, statusFilter]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, roleFilter, datePreset, startDate, endDate]);

  // 3. Dynamic Stats calculated from baseFilteredHistory
  const dynamicStats = useMemo(() => {
    const totalSurgeries = baseFilteredHistory.length;
    const completedSurgeries = baseFilteredHistory.filter(item => item.status === 'completed').length;
    const scheduledSurgeries = baseFilteredHistory.filter(item => 
      ['scheduled', 'in_progress', 'anesthesia_start', 'pre_incision', 'surgery_end', 'patient_exit', 'urpa_exit'].includes(item.status)
    ).length;
    const cancelledSurgeries = baseFilteredHistory.filter(item => item.status === 'cancelled').length;

    const effectivenessRate = totalSurgeries > 0 
      ? Math.round((completedSurgeries / totalSurgeries) * 100) 
      : 0;

    const mayorCount = baseFilteredHistory.filter(item => item.surgeryType === 'Cirugía Mayor').length;
    const menorCount = baseFilteredHistory.filter(item => item.surgeryType === 'Cirugía Menor').length;
    const electivasCount = baseFilteredHistory.filter(item => item.urgencyType === 'ELECTIVO').length;
    const emergenciaCount = baseFilteredHistory.filter(item => item.urgencyType === 'EMERGENCIA').length;

    const rolesBreakdown: Record<string, number> = {};
    baseFilteredHistory.forEach(item => {
      const r = item.roleInSurgery || "ASISTENCIAL";
      rolesBreakdown[r] = (rolesBreakdown[r] || 0) + 1;
    });

    return {
      totalSurgeries,
      completedSurgeries,
      scheduledSurgeries,
      cancelledSurgeries,
      effectivenessRate,
      typeBreakdown: { mayor: mayorCount, menor: menorCount },
      urgencyBreakdown: { electiva: electivasCount, emergencia: emergenciaCount },
      rolesBreakdown
    };
  }, [baseFilteredHistory]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedHistory = filteredHistory.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
        <Loader2 size={36} className="animate-spin text-blue-600 mb-3" />
        <p className="text-xs font-semibold">Cargando tus estadísticas e historial asistencial...</p>
      </div>
    );
  }

  // Export handlers for filtered records
  const handleExportExcel = () => {
    if (filteredHistory.length === 0) return;

    // Build enriched data rows
    const exportData = filteredHistory.map((item, index) => {
      const dateStr = item.surgeryDate 
        ? new Date(item.surgeryDate).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : "";
      const statusLabel = item.status === 'completed' ? 'Realizada' : item.status === 'cancelled' ? 'Suspendida' : 'Programada';

      return {
        "N°": index + 1,
        "Fecha Cirugía": dateStr,
        "Quirófano / Sala": item.roomName || "",
        "Paciente": item.patient?.name || "",
        "Historia Clínica": item.patient?.hcNumber || "",
        "DNI Paciente": item.patient?.dni || "",
        "Diagnóstico": item.diagnosis || "",
        "Procedimiento / Intervención": item.procedure || "",
        "Tipo Cirugía": item.surgeryType || "",
        "Urgencia": item.urgencyType || "",
        "Rol Asistencial": item.roleInSurgery || "",
        "Estado": statusLabel,
      };
    });

    // Create Worksheet & set column widths
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    const colWidths = [
      { wch: 6 },   // N°
      { wch: 15 },  // Fecha
      { wch: 20 },  // Sala
      { wch: 25 },  // Paciente
      { wch: 18 },  // HC
      { wch: 14 },  // DNI
      { wch: 40 },  // Diagnostico
      { wch: 45 },  // Procedimiento
      { wch: 18 },  // Tipo
      { wch: 15 },  // Urgencia
      { wch: 26 },  // Rol
      { wch: 15 },  // Estado
    ];
    worksheet["!cols"] = colWidths;

    // Create Workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Actividad Quirúrgica");

    // Save as true native .xlsx file
    const todayStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(workbook, `Reporte_Actividad_Quirurgica_${todayStr}.xlsx`);
  };

  const handleExportPDF = () => {
    if (filteredHistory.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const todayStr = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });

    const rowsHtml = filteredHistory.map(item => {
      const dateStr = item.surgeryDate 
        ? new Date(item.surgeryDate).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
        : "";
      const statusLabel = item.status === 'completed' ? 'Realizada' : item.status === 'cancelled' ? 'Suspendida' : 'Programada';
      const statusColor = item.status === 'completed' ? '#059669' : item.status === 'cancelled' ? '#dc2626' : '#2563eb';

      return `
        <tr>
          <td>${dateStr}<br/><small style="color:#666">${item.roomName}</small></td>
          <td><b>${item.patient?.name || ''}</b><br/><small style="color:#666">${item.patient?.hcNumber || ''}</small></td>
          <td><b>${item.procedure}</b><br/><small style="color:#666">Dx: ${item.diagnosis}</small></td>
          <td><b>${item.surgeryType}</b> / ${item.urgencyType}</td>
          <td><span style="background:#f3f4f6;padding:3px 6px;border-radius:4px;font-weight:bold">${item.roleInSurgery}</span></td>
          <td style="text-align:right;font-weight:bold;color:${statusColor}">${statusLabel}</td>
        </tr>
      `;
    }).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte de Actividad Quirúrgica - OGESS / MINSA</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
          .header { text-align: center; border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 20px; }
          .header h2 { margin: 0; color: #0056b3; font-size: 18px; }
          .header p { margin: 4px 0 0; color: #555; font-size: 12px; }
          .meta { margin-bottom: 15px; font-size: 12px; color: #444; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; color: #475569; }
          td { border-bottom: 1px solid #e2e8f0; padding: 8px; vertical-align: top; }
          .footer { margin-top: 25px; text-align: right; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 8px; }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>HOSPITAL II-2 TARAPOTO - CENTRAL QUIRÚRGICA</h2>
          <p>Reporte Oficial de Actividad Quirúrgica y Producción Asistencial</p>
        </div>
        <div class="meta">
          <div><b>Fecha de Emisión:</b> ${todayStr} | <b>Total Registros:</b> ${filteredHistory.length}</div>
          <div><b>Conforme a Ley N° 29733 (Protección de Datos Personales)</b></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Fecha / Sala</th>
              <th>Paciente / HC</th>
              <th>Intervención / Diagnóstico</th>
              <th>Tipo / Urgencia</th>
              <th>Rol Asistencial</th>
              <th style="text-align:right">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="footer">
          Documento generado automáticamente desde el Sistema FrontCQ • OGESS San Martín
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const uniqueRoles = Array.from(new Set(history.map(h => h.roleInSurgery)));

  return (
    <div className="space-y-6">
      {/* Top Banner Disclaimer */}
      <div className="p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/50 flex items-start gap-3">
        <ShieldCheck size={20} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200">
          <p className="font-bold">Registro de Producción Asistencial y Protección de Datos Personales</p>
          <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
            Conforme a la Ley N° 29733 (Protección de Datos Personales) y Secreto Médico, la información del paciente se muestra completa para las cirugías del día de hoy en turno. En cirugías anteriores o futuras se mantiene enmascarada (iniciales e Historia Clínica).
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Card 1: Total Surgeries */}
        <div 
          onClick={() => setStatusFilter("ALL")}
          className={`p-4 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
            statusFilter === "ALL" 
              ? "bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 ring-2 ring-blue-500/30 shadow-md shadow-blue-500/10" 
              : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-zinc-700"
          }`}
          title="Ver todas las cirugías según los filtros activos"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Participadas</span>
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <Activity size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-zinc-900 dark:text-white leading-none">
              {dynamicStats.totalSurgeries}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
              Cirugías registradas en tu historial
            </p>
          </div>
        </div>

        {/* Card 2: Completed / Rate */}
        <div 
          onClick={() => setStatusFilter("completed")}
          className={`p-4 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
            statusFilter === "completed" 
              ? "bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-500/30 shadow-md shadow-emerald-500/10" 
              : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-zinc-700"
          }`}
          title="Filtrar solo cirugías realizadas"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Realizadas</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                {dynamicStats.completedSurgeries}
              </p>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                ({dynamicStats.effectivenessRate}%)
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
              Efectividad de cumplimiento
            </p>
          </div>
        </div>

        {/* Card 3: Scheduled / In Progress */}
        <div 
          onClick={() => setStatusFilter("scheduled")}
          className={`p-4 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
            statusFilter === "scheduled" 
              ? "bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 ring-2 ring-amber-500/30 shadow-md shadow-amber-500/10" 
              : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-800 hover:border-amber-300 dark:hover:border-zinc-700"
          }`}
          title="Filtrar solo cirugías programadas o en curso"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Programadas / En Curso</span>
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-none">
              {dynamicStats.scheduledSurgeries}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
              Cirugías pendientes o activas
            </p>
          </div>
        </div>

        {/* Card 4: Cancelled / Suspended */}
        <div 
          onClick={() => setStatusFilter("cancelled")}
          className={`p-4 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
            statusFilter === "cancelled" 
              ? "bg-red-50/90 dark:bg-red-950/40 border-red-400 dark:border-red-700 ring-2 ring-red-500/30 shadow-md shadow-red-500/10" 
              : "bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-zinc-700"
          }`}
          title="Filtrar solo cirugías suspendidas"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Suspendidas</span>
            <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
              <XCircle size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-red-600 dark:text-red-400 leading-none">
              {dynamicStats.cancelledSurgeries}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
              Cirugías no ejecutadas
            </p>
          </div>
        </div>
      </div>

      {/* Breakdown Chips Row */}
      <div className="p-3.5 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1">Tipo Cirugía:</span>
          <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
            Mayor: {dynamicStats.typeBreakdown.mayor}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            Menor: {dynamicStats.typeBreakdown.menor}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1">Urgencia:</span>
          <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
            Emergencia: {dynamicStats.urgencyBreakdown.emergencia}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            Electivo: {dynamicStats.urgencyBreakdown.electiva}
          </span>
        </div>
      </div>

      {/* Roles Breakdown Chips */}
      {dynamicStats.rolesBreakdown && Object.keys(dynamicStats.rolesBreakdown).length > 0 && (
        <div className="p-3.5 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
            Participación por Rol Quirúrgico
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(dynamicStats.rolesBreakdown).map(([role, count]) => (
              <div 
                key={role}
                className="px-3 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center gap-2 text-xs"
              >
                <UserCheck size={14} className="text-blue-600 dark:text-blue-400" />
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{role}:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por diagnóstico, procedimiento, sala..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <Search size={14} className="absolute left-2.5 top-2.5 text-zinc-400" />
        </div>

        {/* Export Buttons & Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          {/* Excel Export Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={filteredHistory.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 transition-colors shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar registros filtrados a Excel"
          >
            <FileSpreadsheet size={14} /> Excel
          </button>

          {/* PDF Export Button */}
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={filteredHistory.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 transition-colors shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar / Imprimir reporte filtrado en PDF"
          >
            <FileText size={14} /> PDF
          </button>

          {/* Date Filter Dropdown */}
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="ALL">🗓️ Todas las Fechas</option>
            <option value="TODAY">🟢 Hoy</option>
            <option value="THIS_WEEK">📅 Esta Semana</option>
            <option value="THIS_MONTH">📆 Este Mes</option>
            <option value="LAST_MONTH">⏪ Mes Anterior</option>
            <option value="THIS_YEAR">📊 Año {new Date().getFullYear()}</option>
            <option value="CUSTOM">🔍 Rango Personalizado...</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="completed">Realizadas</option>
            <option value="scheduled">Programadas</option>
            <option value="in_progress">En Curso</option>
            <option value="cancelled">Suspendidas</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="ALL">Todos los Roles</option>
            {uniqueRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom Date Range Picker Expanded Bar */}
      {datePreset === "CUSTOM" && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-blue-50/60 dark:bg-zinc-800/60 border border-blue-200/80 dark:border-zinc-700">
          <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
            <Calendar size={14} className="text-blue-600 dark:text-blue-400" /> Rango Personalizado:
          </span>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Desde:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">Hasta:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="px-2 py-1 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
            >
              <XCircle size={14} /> Limpiar Rango
            </button>
          )}
        </div>
      )}

      {/* History Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3">Fecha / Sala</th>
                <th className="px-4 py-3">Paciente (Ley 29733)</th>
                <th className="px-4 py-3">Diagnóstico / Intervención</th>
                <th className="px-4 py-3">Tu Rol</th>
                <th className="px-4 py-3 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {paginatedHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-zinc-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-xs">No se encontraron cirugías registradas.</p>
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((item) => {
                  const dateStr = item.surgeryDate 
                    ? new Date(item.surgeryDate).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
                    : "Fecha n/a";

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                      {/* Date & Room */}
                      <td className="px-4 py-3">
                        <p className="font-bold text-zinc-900 dark:text-white flex items-center gap-1">
                          <Calendar size={13} className="text-zinc-400" /> {dateStr}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-semibold mt-0.5">
                          {item.roomName}
                        </p>
                      </td>

                      {/* Patient PII */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">
                            {item.patient?.name || "Sin datos paciente"}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {item.patient?.hcNumber && (
                              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                {item.patient.hcNumber}
                              </span>
                            )}
                            {item.patient?.isMasked ? (
                              <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-0.5" title="Enmascarado por Ley de Protección de Datos Personales en cirugías históricas/futuras">
                                <ShieldAlert size={11} /> Protegido
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5" title="Acceso completo permitido en cirugía del día de hoy">
                                <ShieldCheck size={11} /> Turno Hoy
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Diagnosis / Procedure & Pills */}
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-bold text-zinc-900 dark:text-white line-clamp-1">
                          {item.procedure}
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                          Dx: {item.diagnosis}
                        </p>

                        {/* Pills inline row */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {/* Surgery Type Pill */}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            item.surgeryType?.toLowerCase().includes('mayor')
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          }`}>
                            {item.surgeryType}
                          </span>

                          {/* Urgency Type Pill */}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            item.urgencyType?.toUpperCase() === 'EMERGENCIA'
                              ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          }`}>
                            {item.urgencyType}
                          </span>
                        </div>
                      </td>

                      {/* User Role */}
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold border border-zinc-200/80 dark:border-zinc-700 inline-block">
                          {item.roleInSurgery}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-right">
                        {item.status === 'completed' && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold inline-flex items-center gap-1">
                            <CheckCircle2 size={12} /> Realizada
                          </span>
                        )}
                        {item.status === 'cancelled' && (
                          <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold inline-flex items-center gap-1">
                            <XCircle size={12} /> Suspendida
                          </span>
                        )}
                        {item.status !== 'completed' && item.status !== 'cancelled' && (
                          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold inline-flex items-center gap-1">
                            <Clock size={12} /> Programada
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredHistory.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 rounded-b-2xl text-xs text-zinc-600 dark:text-zinc-400">
            <p className="font-semibold text-[11px]">
              Mostrando <span className="font-bold text-zinc-900 dark:text-white">{startIndex + 1}</span> a <span className="font-bold text-zinc-900 dark:text-white">{Math.min(startIndex + itemsPerPage, filteredHistory.length)}</span> de <span className="font-bold text-zinc-900 dark:text-white">{filteredHistory.length}</span> cirugías
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-bold disabled:opacity-40 transition-all text-xs cursor-pointer disabled:cursor-not-allowed"
              >
                &larr; Anterior
              </button>
              
              <span className="font-mono font-bold text-xs px-2 text-zinc-700 dark:text-zinc-300">
                Página {currentPage} de {totalPages || 1}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 font-bold disabled:opacity-40 transition-all text-xs cursor-pointer disabled:cursor-not-allowed"
              >
                Siguiente &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

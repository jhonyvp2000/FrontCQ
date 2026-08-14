"use client";

import React, { useState, useEffect } from "react";
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
  UserCheck
} from "lucide-react";
import { getUserSurgeryStatsAction, getUserSurgeryHistoryAction } from "@/app/actions/user-analytics";

interface UserActivityDashboardProps {
  userId: string;
}

export function UserActivityDashboard({ userId }: UserActivityDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<any[]>([]);

  // Filter & Pagination States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
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
      setFilteredHistory(historyRes.history);
    }

    setLoading(false);
  };

  // Apply filters
  useEffect(() => {
    let result = [...history];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.diagnosis.toLowerCase().includes(q) ||
        item.procedure.toLowerCase().includes(q) ||
        item.roomName.toLowerCase().includes(q) ||
        item.roleInSurgery.toLowerCase().includes(q) ||
        (item.patient?.name && item.patient.name.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "ALL") {
      result = result.filter(item => item.status === statusFilter);
    }

    if (roleFilter !== "ALL") {
      result = result.filter(item => item.roleInSurgery === roleFilter);
    }

    setFilteredHistory(result);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, roleFilter, history]);

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

  // Distinct roles in user's history for filter dropdown
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
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Total Participadas</span>
            <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              <Activity size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-zinc-900 dark:text-white leading-none">
              {stats?.totalSurgeries || 0}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
              Cirugías registradas en tu historial
            </p>
          </div>
        </div>

        {/* Card 2: Completed / Rate */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Realizadas</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">
                {stats?.completedSurgeries || 0}
              </p>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                ({stats?.effectivenessRate || 0}%)
              </span>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
              Efectividad de cumplimiento
            </p>
          </div>
        </div>

        {/* Card 3: Scheduled / In Progress */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Programadas / En Curso</span>
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 leading-none">
              {stats?.scheduledSurgeries || 0}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
              Cirugías pendientes o activas
            </p>
          </div>
        </div>

        {/* Card 4: Cancelled / Suspended */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Suspendidas</span>
            <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
              <XCircle size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-red-600 dark:text-red-400 leading-none">
              {stats?.cancelledSurgeries || 0}
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
            Mayor: {stats?.typeBreakdown?.mayor || 0}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            Menor: {stats?.typeBreakdown?.menor || 0}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1">Urgencia:</span>
          <span className="px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
            Emergencia: {stats?.urgencyBreakdown?.emergencia || 0}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
            Electivo: {stats?.urgencyBreakdown?.electivo || 0}
          </span>
        </div>
      </div>

      {/* Roles Breakdown Chips */}
      {stats?.rolesBreakdown && Object.keys(stats.rolesBreakdown).length > 0 && (
        <div className="p-3.5 rounded-xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800">
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
            Participación por Rol Quirúrgico
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.rolesBreakdown).map(([role, count]) => (
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

        {/* Filters */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
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

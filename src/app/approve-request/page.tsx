"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Hospital,
  ArrowRight
} from "lucide-react";
import { getAccountRequestByTokenAction, processAccountApprovalAction } from "@/app/actions/account-request";

function ApproveRequestContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestData, setRequestData] = useState<{
    id: string;
    userId: string;
    dni: string;
    tuitionCode: string;
    requestedEmail: string;
    phone?: string;
    status: string;
    createdAt: string | Date;
    doctorName: string;
  } | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<{
    success: boolean;
    status?: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Token de aprobación no proporcionado o enlace inválido.");
      setIsLoading(false);
      return;
    }

    async function loadRequest() {
      try {
        const res = await getAccountRequestByTokenAction(token!);
        if (!res.success || !res.request) {
          setError(res.message || "No se encontró la solicitud de activación.");
        } else {
          setRequestData(res.request as any);
        }
      } catch (err) {
        setError("Error al cargar los datos de la solicitud.");
      } finally {
        setIsLoading(false);
      }
    }

    loadRequest();
  }, [token]);

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!token) return;
    setIsProcessing(true);
    setError(null);

    try {
      const res = await processAccountApprovalAction(token, action);
      setProcessResult(res);
      if (res.success && requestData) {
        setRequestData({ ...requestData, status: action === 'approve' ? 'APPROVED' : 'REJECTED' });
      }
    } catch (err) {
      setError("Ocurrió un error inesperado al procesar la acción.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl z-10"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <Hospital className="w-3.5 h-3.5" />
          Jefatura de Centro Quirúrgico
        </div>
        <h1 className="text-2xl font-extrabold text-white flex items-center justify-center gap-2">
          <ShieldCheck className="w-7 h-7 text-cyan-400" />
          Aprobación de Acceso Asistencial
        </h1>
        <p className="text-slate-400 text-xs mt-1">
          Sistema de Gestión Quirúrgica BackCQ / FrontCQ
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-12 text-center text-slate-400 space-y-3">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs">Cargando solicitud de acceso...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-rose-950/60 border border-rose-800/60 rounded-xl p-4 text-xs text-rose-300 flex items-start gap-3 my-4">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-200">Atención</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Process Result Banners */}
      {processResult && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-xl p-4 mb-6 border text-xs flex items-start gap-3 ${
            processResult.success && processResult.status === 'APPROVED'
              ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-200"
              : "bg-rose-950/80 border-rose-500/50 text-rose-200"
          }`}
        >
          {processResult.status === 'APPROVED' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="font-bold text-sm">
              {processResult.status === 'APPROVED' ? '¡Acceso Habilitado!' : 'Solicitud Procesada'}
            </p>
            <p className="mt-1">{processResult.message}</p>
          </div>
        </motion.div>
      )}

      {/* Request Data Card */}
      {requestData && !isLoading && (
        <div className="space-y-6">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase">Estado Solicitud</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  requestData.status === 'PENDING'
                    ? "bg-amber-950 border border-amber-500/50 text-amber-400"
                    : requestData.status === 'APPROVED'
                    ? "bg-emerald-950 border border-emerald-500/50 text-emerald-400"
                    : "bg-rose-950 border border-rose-500/50 text-rose-400"
                }`}
              >
                {requestData.status === 'PENDING' ? 'PENDIENTE' : requestData.status === 'APPROVED' ? 'APROBADA' : 'RECHAZADA'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Profesional Solicitante:</span>
                <span className="font-bold text-white text-sm">{requestData.doctorName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">DNI:</span>
                <span className="font-semibold text-slate-200">{requestData.dni}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Colegiatura:</span>
                <span className="font-semibold text-cyan-400">{requestData.tuitionCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Correo Notificaciones:</span>
                <span className="font-semibold text-slate-200">{requestData.requestedEmail}</span>
              </div>
              {requestData.phone && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Teléfono Celular:</span>
                  <span className="font-semibold text-slate-200">{requestData.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons for Pending Requests */}
          {requestData.status === 'PENDING' && !processResult?.success && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleAction('approve')}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 px-6 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{isProcessing ? 'Procesando...' : '✔ Aprobar Acceso (1-Clic)'}</span>
              </button>

              <button
                onClick={() => handleAction('reject')}
                disabled={isProcessing}
                className="w-full bg-slate-800 hover:bg-rose-950/80 hover:border-rose-700/50 text-slate-300 hover:text-rose-300 font-semibold py-3 px-6 rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 disabled:opacity-50 transition-all"
              >
                <XCircle className="w-4 h-4" />
                <span>Rechazar Solicitud</span>
              </button>
            </div>
          )}

          <div className="pt-2 text-center">
            <Link
              href="/login"
              className="text-xs text-slate-400 hover:text-cyan-400 inline-flex items-center gap-1 transition-colors"
            >
              Volver al Inicio de Sesión <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function ApproveRequestPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      <Suspense fallback={
        <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Cargando...</p>
        </div>
      }>
        <ApproveRequestContent />
      </Suspense>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Image as ImageIcon, CheckCircle2, AlertCircle, AlertTriangle, Info, Sparkles, ZoomIn } from "lucide-react";
import { SystemAnnouncement } from "@/types/announcement";

interface AnnouncementImageModalProps {
  announcement: SystemAnnouncement | null;
  onClose: () => void;
  onOpenProfileContacts?: () => void;
}

export function AnnouncementImageModal({
  announcement,
  onClose,
  onOpenProfileContacts,
}: AnnouncementImageModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  if (!announcement) return null;

  const severityColors = {
    danger: {
      bg: "bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800",
      text: "text-rose-700 dark:text-rose-300",
      badge: "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30",
      btn: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/30",
      icon: <AlertCircle className="text-rose-600 shrink-0" size={20} />,
    },
    warning: {
      bg: "bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800",
      text: "text-amber-700 dark:text-amber-300",
      badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
      btn: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/30",
      icon: <AlertTriangle className="text-amber-600 shrink-0" size={20} />,
    },
    info: {
      bg: "bg-sky-50 dark:bg-sky-950/80 border-sky-200 dark:border-sky-800",
      text: "text-sky-700 dark:text-sky-300",
      badge: "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30",
      btn: "bg-sky-600 hover:bg-sky-700 text-white shadow-sky-500/30",
      icon: <Sparkles className="text-sky-600 shrink-0" size={20} />,
    },
    success: {
      bg: "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-300",
      badge: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
      btn: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/30",
      icon: <CheckCircle2 className="text-emerald-600 shrink-0" size={20} />,
    },
  };

  const style = severityColors[announcement.severity || "info"];

  const handlePrimaryAction = () => {
    if (announcement.actionType === "OPEN_PROFILE_CONTACTS") {
      onClose();
      if (onOpenProfileContacts) onOpenProfileContacts();
    } else if (announcement.actionType === "EXTERNAL_LINK" && announcement.customUrl) {
      window.open(announcement.customUrl, "_blank");
    } else {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className={`relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl border shadow-2xl bg-white dark:bg-zinc-900 ${style.bg}`}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200/60 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              {style.icon}
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${style.badge}`}>
                  {announcement.severity === "danger"
                    ? "Requisito Importante"
                    : announcement.severity === "warning"
                    ? "Aviso Operativo"
                    : announcement.severity === "success"
                    ? "Confirmado"
                    : "Comunicado Institucional"}
                </span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white mt-0.5 leading-tight">
                  {announcement.title}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-full hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content Layout */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-130px)] space-y-6">
            <div className={`grid grid-cols-1 ${announcement.imageUrl ? "md:grid-cols-2" : "grid-cols-1"} gap-6 items-center`}>
              
              {/* Infographic Image Area */}
              {announcement.imageUrl ? (
                <div className="relative group rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950 flex items-center justify-center min-h-[220px]">
                  {!imageLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-800 animate-pulse text-zinc-400">
                      <ImageIcon size={32} />
                      <span className="text-xs font-semibold">Cargando infografía...</span>
                    </div>
                  )}
                  <img
                    src={announcement.imageUrl}
                    alt={announcement.imageAlt || announcement.title}
                    onLoad={() => setImageLoaded(true)}
                    onClick={() => setIsZoomed(!isZoomed)}
                    className={`w-full h-auto max-h-[340px] object-contain transition-transform duration-300 cursor-pointer ${
                      isZoomed ? "scale-125 z-50" : "group-hover:scale-105"
                    }`}
                  />
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded-lg text-[10px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <ZoomIn size={12} /> Clic para ampliar
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/60 flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Información Asistencial</h4>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                      Comunicado oficial del Hospital II-2 Tarapoto dirigido al personal asistencial.
                    </p>
                  </div>
                </div>
              )}

              {/* Text Message & Action Panel */}
              <div className="space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-line font-medium">
                    {announcement.message}
                  </p>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center gap-3">
                  {announcement.actionLabel && (
                    <button
                      onClick={handlePrimaryAction}
                      className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-102 cursor-pointer ${style.btn}`}
                    >
                      <span>{announcement.actionLabel}</span>
                      {announcement.actionType === "EXTERNAL_LINK" ? (
                        <ExternalLink size={14} />
                      ) : (
                        <span>→</span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-semibold text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-all cursor-pointer text-center"
                  >
                    Entendido / Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, AlertTriangle, Sparkles, CheckCircle2, X, ChevronLeft, ChevronRight, Megaphone, Settings } from "lucide-react";
import { SystemAnnouncement, AnnouncementSeverity } from "@/types/announcement";
import { getUserAnnouncementsAction, dismissAnnouncementAction } from "@/app/actions/announcements";
import { AnnouncementImageModal } from "./announcement-image-modal";

interface AnnouncementBannerProps {
  userId?: string;
  isAdmin?: boolean;
  onOpenProfileContacts?: () => void;
  onOpenAdminModal?: () => void;
}

export function AnnouncementBanner({
  userId,
  isAdmin = false,
  onOpenProfileContacts,
  onOpenAdminModal,
}: AnnouncementBannerProps) {
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeModalAnnouncement, setActiveModalAnnouncement] = useState<SystemAnnouncement | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (userId) {
      loadAnnouncements();
    }
  }, [userId]);

  const loadAnnouncements = async () => {
    if (!userId) return;
    const res = await getUserAnnouncementsAction(userId);
    if (res.success && res.announcements) {
      setAnnouncements(res.announcements);
      if (currentIndex >= res.announcements.length) {
        setCurrentIndex(0);
      }
    }
  };

  // Auto rotation if multiple announcements exist
  useEffect(() => {
    if (announcements.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [announcements.length, isPaused]);

  if (!announcements || announcements.length === 0) {
    if (isAdmin && onOpenAdminModal) {
      return (
        <div className="bg-zinc-100 dark:bg-zinc-800/40 border-b border-zinc-200/60 dark:border-zinc-800 px-4 py-1.5 flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Megaphone size={14} className="text-zinc-400" /> Sin comunicados activos programados
          </span>
          <button
            onClick={onOpenAdminModal}
            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
          >
            <Settings size={12} /> 📢 Crear / Gestionar Comunicados
          </button>
        </div>
      );
    }
    return null;
  }

  const currentAnn = announcements[currentIndex] || announcements[0];

  const severityStyles: Record<
    AnnouncementSeverity,
    { bg: string; border: string; text: string; icon: React.ReactNode; btn: string }
  > = {
    danger: {
      bg: "bg-rose-500/15 dark:bg-rose-950/40",
      border: "border-rose-500/40",
      text: "text-rose-900 dark:text-rose-200",
      icon: <AlertCircle className="text-rose-600 dark:text-rose-400 animate-pulse shrink-0" size={16} />,
      btn: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20",
    },
    warning: {
      bg: "bg-amber-500/15 dark:bg-amber-950/40",
      border: "border-amber-500/40",
      text: "text-amber-900 dark:text-amber-200",
      icon: <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0" size={16} />,
      btn: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20",
    },
    info: {
      bg: "bg-sky-500/15 dark:bg-sky-950/40",
      border: "border-sky-500/40",
      text: "text-sky-900 dark:text-sky-200",
      icon: <Sparkles className="text-sky-600 dark:text-sky-400 shrink-0" size={16} />,
      btn: "bg-sky-600 hover:bg-sky-700 text-white shadow-sky-500/20",
    },
    success: {
      bg: "bg-emerald-500/15 dark:bg-emerald-950/40",
      border: "border-emerald-500/40",
      text: "text-emerald-900 dark:text-emerald-200",
      icon: <CheckCircle2 className="text-emerald-600 dark:text-emerald-400 shrink-0" size={16} />,
      btn: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20",
    },
  };

  const currentStyle = severityStyles[currentAnn.severity || "info"];

  const handleBannerClick = () => {
    if (currentAnn.actionType === "OPEN_PROFILE_CONTACTS") {
      if (onOpenProfileContacts) onOpenProfileContacts();
    } else {
      setActiveModalAnnouncement(currentAnn);
    }
  };

  const handleDismiss = async (e: React.MouseEvent, annId: string) => {
    e.stopPropagation();
    if (!userId || !annId) return;

    if (annId.startsWith("system-")) {
      // System rules can't be manually dismissed
      if (onOpenProfileContacts) onOpenProfileContacts();
      return;
    }

    await dismissAnnouncementAction(userId, annId);
    setAnnouncements((prev) => prev.filter((a) => a.id !== annId));
    if (currentIndex >= announcements.length - 1) {
      setCurrentIndex(0);
    }
  };

  return (
    <>
      <div
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className={`relative w-full border-b backdrop-blur-md transition-all duration-300 z-[110] select-none ${currentStyle.bg} ${currentStyle.border}`}
      >
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          
          {/* Main Message Block */}
          <div
            onClick={handleBannerClick}
            className="flex-1 flex items-center gap-2.5 cursor-pointer group min-w-0"
          >
            {currentStyle.icon}
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <span className={`text-xs font-bold truncate ${currentStyle.text}`}>
                {currentAnn.message}
              </span>
              {currentAnn.actionLabel && (
                <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold shadow-sm transition-transform group-hover:scale-105 shrink-0 ${currentStyle.btn}`}>
                  {currentAnn.actionLabel} →
                </span>
              )}
            </div>
          </div>

          {/* Right Controls Area */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Multi-announcement Pagination Pill */}
            {announcements.length > 1 && (
              <div className="flex items-center gap-1 bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                <button
                  onClick={() => setCurrentIndex((prev) => (prev === 0 ? announcements.length - 1 : prev - 1))}
                  className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <span>{currentIndex + 1}/{announcements.length}</span>
                <button
                  onClick={() => setCurrentIndex((prev) => (prev + 1) % announcements.length)}
                  className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* Admin Backoffice Trigger Button */}
            {isAdmin && onOpenAdminModal && (
              <button
                onClick={onOpenAdminModal}
                title="📢 Administrar Comunicados"
                className="p-1 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-zinc-700 dark:text-zinc-200 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-semibold px-2"
              >
                <Megaphone size={13} />
                <span className="hidden md:inline">Gestionar</span>
              </button>
            )}

            {/* Dismiss Button (for non-system rules) */}
            {!currentAnn.isSystemRule && (
              <button
                onClick={(e) => handleDismiss(e, currentAnn.id)}
                title="Entendido / Ocultar este aviso"
                className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-white rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-all cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Image / Infographic Detail Modal */}
      <AnnouncementImageModal
        announcement={activeModalAnnouncement}
        onClose={() => setActiveModalAnnouncement(null)}
        onOpenProfileContacts={onOpenProfileContacts}
      />
    </>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Edit2, Trash2, Megaphone, Calendar, Eye, Image as ImageIcon, ShieldAlert, CheckCircle2, AlertTriangle, Sparkles, User, Users, Globe, Save } from "lucide-react";
import { SystemAnnouncement, AnnouncementSeverity, AnnouncementTargetType, AnnouncementActionType } from "@/types/announcement";
import { getAllAnnouncementsAdminAction, createOrUpdateAnnouncementAdminAction, toggleAnnouncementStatusAdminAction, deleteAnnouncementAdminAction } from "@/app/actions/announcements";

interface AnnouncementsAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  adminUserId: string;
  onAnnouncementsUpdated?: () => void;
}

export function AnnouncementsAdminModal({
  isOpen,
  onClose,
  adminUserId,
  onAnnouncementsUpdated,
}: AnnouncementsAdminModalProps) {
  const [activeTab, setActiveTab] = useState<"list" | "form">("list");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<AnnouncementSeverity>("info");
  const [targetType, setTargetType] = useState<AnnouncementTargetType>("ALL");
  const [targetRoleId, setTargetRoleId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [actionLabel, setActionLabel] = useState("");
  const [actionType, setActionType] = useState<AnnouncementActionType>("OPEN_IMAGE_MODAL");
  const [customUrl, setCustomUrl] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (isOpen && adminUserId) {
      loadData();
    }
  }, [isOpen, adminUserId]);

  const loadData = async () => {
    setLoading(true);
    setFeedback(null);
    const res = await getAllAnnouncementsAdminAction(adminUserId);
    if (res.success && res.announcements) {
      setAnnouncements(res.announcements);
      if (res.roles) setRoles(res.roles);
    } else if (res.message) {
      setFeedback({ type: "error", text: res.message });
    }
    setLoading(false);
  };

  const handleResetForm = () => {
    setEditingId(null);
    setTitle("");
    setMessage("");
    setSeverity("info");
    setTargetType("ALL");
    setTargetRoleId("");
    setTargetUserId("");
    setImageUrl("");
    setImageAlt("");
    setActionLabel("");
    setActionType("OPEN_IMAGE_MODAL");
    setCustomUrl("");
    setValidFrom("");
    setValidUntil("");
    setIsActive(true);
  };

  const handleOpenCreateForm = () => {
    handleResetForm();
    setActiveTab("form");
  };

  const handleOpenEditForm = (ann: SystemAnnouncement) => {
    setEditingId(ann.id);
    setTitle(ann.title || "");
    setMessage(ann.message || "");
    setSeverity(ann.severity || "info");
    setTargetType(ann.targetType || "ALL");
    setTargetRoleId(ann.targetRoleId || "");
    setTargetUserId(ann.targetUserId || "");
    setImageUrl(ann.imageUrl || "");
    setImageAlt(ann.imageAlt || "");
    setActionLabel(ann.actionLabel || "");
    setActionType(ann.actionType || "OPEN_IMAGE_MODAL");
    setCustomUrl(ann.customUrl || "");

    // Format dates for datetime-local input
    if (ann.validFrom) {
      const d = new Date(ann.validFrom);
      setValidFrom(d.toISOString().slice(0, 16));
    } else setValidFrom("");

    if (ann.validUntil) {
      const d = new Date(ann.validUntil);
      setValidUntil(d.toISOString().slice(0, 16));
    } else setValidUntil("");

    setIsActive(ann.isActive);
    setActiveTab("form");
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setFeedback({ type: "error", text: "El título y el mensaje son obligatorios." });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const res = await createOrUpdateAnnouncementAdminAction(adminUserId, {
      id: editingId || undefined,
      title,
      message,
      severity,
      targetType,
      targetRoleId: targetType === "ROLE" ? targetRoleId : undefined,
      targetUserId: targetType === "USER" ? targetUserId : undefined,
      imageUrl: imageUrl.trim() || undefined,
      imageAlt: imageAlt.trim() || undefined,
      actionLabel: actionLabel.trim() || undefined,
      actionType,
      customUrl: customUrl.trim() || undefined,
      validFrom: validFrom ? validFrom : undefined,
      validUntil: validUntil ? validUntil : undefined,
      isActive,
    });

    setSubmitting(false);

    if (res.success) {
      setFeedback({ type: "success", text: res.message || "Guardado exitosamente." });
      loadData();
      if (onAnnouncementsUpdated) onAnnouncementsUpdated();
      setTimeout(() => {
        setActiveTab("list");
        handleResetForm();
      }, 1200);
    } else {
      setFeedback({ type: "error", text: res.message || "Error al guardar el anuncio." });
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const res = await toggleAnnouncementStatusAdminAction(adminUserId, id, !currentStatus);
    if (res.success) {
      loadData();
      if (onAnnouncementsUpdated) onAnnouncementsUpdated();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este comunicado institucional?")) return;
    const res = await deleteAnnouncementAdminAction(adminUserId, id);
    if (res.success) {
      loadData();
      if (onAnnouncementsUpdated) onAnnouncementsUpdated();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Megaphone size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  📢 Gestión Administrable de Comunicados
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Configura anuncios por grado de atención, destinatarios y vigencia por fechas.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("list")}
                className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === "list"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                📋 Comunicados Vigentes ({announcements.length})
              </button>
              <button
                onClick={handleOpenCreateForm}
                className={`py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "form"
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <Plus size={14} /> {editingId ? "Editar Comunicado" : "Nuevo Comunicado"}
              </button>
            </div>
          </div>

          {/* Feedback Toast */}
          {feedback && (
            <div
              className={`px-6 py-2.5 text-xs font-bold flex items-center justify-between ${
                feedback.type === "success"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-b border-emerald-500/20"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-b border-rose-500/20"
              }`}
            >
              <span>{feedback.text}</span>
              <button onClick={() => setFeedback(null)} className="text-zinc-500 hover:text-zinc-800">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Main Body Section */}
          <div className="p-6 overflow-y-auto flex-1">
            {activeTab === "list" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Listado de Anuncios Programados
                  </span>
                  <button
                    onClick={handleOpenCreateForm}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                  >
                    <Plus size={14} /> Crear Nuevo Anuncio
                  </button>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-xs text-zinc-500">Cargando anuncios...</div>
                ) : announcements.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                    <Megaphone size={32} className="mx-auto text-zinc-400 mb-2" />
                    <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                      No hay comunicados administrables registrados aún.
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Haz clic en "Crear Nuevo Anuncio" para publicar un comunicado con nivel de atención.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((ann) => (
                      <div
                        key={ann.id}
                        className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Severity Badge */}
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                                ann.severity === "danger"
                                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                                  : ann.severity === "warning"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                                  : ann.severity === "success"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
                              }`}
                            >
                              {ann.severity === "danger"
                                ? "🔴 Crítico"
                                : ann.severity === "warning"
                                ? "🟡 Advertencia"
                                : ann.severity === "success"
                                ? "🟢 Éxito"
                                : "🔵 Información"}
                            </span>

                            {/* Target Scope Badge */}
                            <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold border border-zinc-200 dark:border-zinc-700 flex items-center gap-1">
                              {ann.targetType === "ALL" ? (
                                <>
                                  <Globe size={11} /> Todos los usuarios
                                </>
                              ) : ann.targetType === "ROLE" ? (
                                <>
                                  <Users size={11} /> Rol: {ann.targetRoleName || "Rol Asistencial"}
                                </>
                              ) : (
                                <>
                                  <User size={11} /> Usuario Específico
                                </>
                              )}
                            </span>

                            {/* Reads count */}
                            <span className="text-[10px] font-semibold text-zinc-500 flex items-center gap-1">
                              <Eye size={11} /> {ann.readsCount || 0} confirmaciones
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">
                            {ann.title}
                          </h4>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                            {ann.message}
                          </p>

                          {/* Date boundaries */}
                          <div className="flex items-center gap-3 text-[11px] text-zinc-400 pt-1">
                            <span className="flex items-center gap-1">
                              <Calendar size={11} /> Inicio: {ann.validFrom ? new Date(ann.validFrom).toLocaleDateString() : "Inmediato"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={11} /> Expira: {ann.validUntil ? new Date(ann.validUntil).toLocaleDateString() : "Sin fecha límite"}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-zinc-100 dark:border-zinc-800 w-full md:w-auto justify-end">
                          <button
                            onClick={() => handleToggleStatus(ann.id, ann.isActive)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              ann.isActive
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
                                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300"
                            }`}
                          >
                            {ann.isActive ? "Activo 🟢" : "Pausado ⏸️"}
                          </button>
                          <button
                            onClick={() => handleOpenEditForm(ann)}
                            className="p-2 text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-all"
                            title="Editar Comunicado"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(ann.id)}
                            className="p-2 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-all"
                            title="Eliminar Comunicado"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Create / Edit Form */
              <form onSubmit={handleSubmitForm} className="space-y-6">
                <div className="space-y-4">
                  {/* Title & Severity */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Título del Comunicado *
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej. Capacitación de Ficha Quirúrgica"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Grado de Atención (Color) *
                      </label>
                      <select
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value as AnnouncementSeverity)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="danger">🔴 Crítico / Peligro (Rojo)</option>
                        <option value="warning">🟡 Advertencia (Ámbar)</option>
                        <option value="info">🔵 Información (Azul)</option>
                        <option value="success">🟢 Éxito (Verde)</option>
                      </select>
                    </div>
                  </div>

                  {/* Message Body */}
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Mensaje del Banner *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Texto dinámico explicativo que aparecerá en el banner superior..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Target Scope */}
                  <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 space-y-3">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
                      Alcance de Destinatarios (`targetType`)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${targetType === "ALL" ? "border-blue-600 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"}`}>
                        <input
                          type="radio"
                          name="targetType"
                          value="ALL"
                          checked={targetType === "ALL"}
                          onChange={() => setTargetType("ALL")}
                          className="hidden"
                        />
                        <Globe size={16} /> Todos los usuarios
                      </label>
                      <label className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${targetType === "ROLE" ? "border-blue-600 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"}`}>
                        <input
                          type="radio"
                          name="targetType"
                          value="ROLE"
                          checked={targetType === "ROLE"}
                          onChange={() => setTargetType("ROLE")}
                          className="hidden"
                        />
                        <Users size={16} /> Por Rol Asistencial
                      </label>
                      <label className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${targetType === "USER" ? "border-blue-600 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-bold" : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"}`}>
                        <input
                          type="radio"
                          name="targetType"
                          value="USER"
                          checked={targetType === "USER"}
                          onChange={() => setTargetType("USER")}
                          className="hidden"
                        />
                        <User size={16} /> Por Usuario Específico
                      </label>
                    </div>

                    {targetType === "ROLE" && (
                      <div className="pt-2">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                          Seleccionar Rol Asistencial Destino
                        </label>
                        <select
                          value={targetRoleId}
                          onChange={(e) => setTargetRoleId(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        >
                          <option value="">-- Seleccionar Rol --</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {targetType === "USER" && (
                      <div className="pt-2">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                          ID de Usuario / DNI Destino
                        </label>
                        <input
                          type="text"
                          value={targetUserId}
                          onChange={(e) => setTargetUserId(e.target.value)}
                          placeholder="Ingresa el ID del usuario destino"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Date Boundaries */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Fecha y Hora de Inicio (`validFrom`)
                      </label>
                      <input
                        type="datetime-local"
                        value={validFrom}
                        onChange={(e) => setValidFrom(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      />
                      <span className="text-[10px] text-zinc-400">Dejar en blanco para publicación inmediata.</span>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Fecha y Hora de Expiración (`validUntil`)
                      </label>
                      <input
                        type="datetime-local"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      />
                      <span className="text-[10px] text-zinc-400">Dejar en blanco para publicación permanente.</span>
                    </div>
                  </div>

                  {/* Infographic Image Settings */}
                  <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 space-y-3">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <ImageIcon size={14} className="text-blue-500" /> Infografía / Imagen del Modal (Opcional)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <input
                          type="text"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="Ruta o URL: ej. /announcements/guia.png"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={imageAlt}
                          onChange={(e) => setImageAlt(e.target.value)}
                          placeholder="Leyenda o texto alternativo de la imagen"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Button Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Texto del Botón de Acción
                      </label>
                      <input
                        type="text"
                        value={actionLabel}
                        onChange={(e) => setActionLabel(e.target.value)}
                        placeholder="Ej. Ver Guía Explicativa"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                        Tipo de Acción
                      </label>
                      <select
                        value={actionType}
                        onChange={(e) => setActionType(e.target.value as AnnouncementActionType)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                      >
                        <option value="OPEN_IMAGE_MODAL">Abrir Modal de Infografía</option>
                        <option value="OPEN_PROFILE_CONTACTS">Abrir Perfil (Validar Correo)</option>
                        <option value="EXTERNAL_LINK">Enlace Externo (URL)</option>
                      </select>
                    </div>

                    {actionType === "EXTERNAL_LINK" && (
                      <div>
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                          URL Externa
                        </label>
                        <input
                          type="url"
                          value={customUrl}
                          onChange={(e) => setCustomUrl(e.target.value)}
                          placeholder="https://ejemplo.com"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Footer Actions */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      handleResetForm();
                      setActiveTab("list");
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
                  >
                    <Save size={14} /> {submitting ? "Guardando..." : editingId ? "Actualizar Comunicado" : "Publicar Comunicado"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

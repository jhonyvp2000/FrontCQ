"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  Award, 
  MapPin, 
  Lock, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search,
  ShieldCheck
} from "lucide-react";
import { 
  getUserProfileSelfAction, 
  getUbigeoSuggestionsAction, 
  updateUserProfileSelfAction,
  sendContactVerificationOtpAction,
  confirmContactVerificationOtpAction
} from "@/app/actions/account-request";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onProfileUpdated?: () => void;
}

export function UserProfileModal({ isOpen, onClose, userId, onProfileUpdated }: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");

  // Form State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Read-only user data
  const [name, setName] = useState("");
  const [lastname, setLastname] = useState("");
  const [dni, setDni] = useState("");
  const [professionName, setProfessionName] = useState("");

  // Editable fields
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tuitionCode, setTuitionCode] = useState("");
  
  // Ubigeo search & selection
  const [ubigeoCode, setUbigeoCode] = useState("");
  const [ubigeoSearchText, setUbigeoSearchText] = useState("");
  const [ubigeoSuggestions, setUbigeoSuggestions] = useState<Array<{ code: string; departamento: string; provincia: string; distrito: string; label: string }>>([]);
  const [isSearchingUbigeo, setIsSearchingUbigeo] = useState(false);
  const [showUbigeoDropdown, setShowUbigeoDropdown] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Verification states
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [emailVerifiedAt, setEmailVerifiedAt] = useState<string | null>(null);
  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState<string | null>(null);

  // OTP Verification Modal State
  const [otpModalType, setOtpModalType] = useState<"email" | "phone" | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isConfirmingOtp, setIsConfirmingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpMessage, setOtpMessage] = useState("");

  // Load Profile on Open
  useEffect(() => {
    if (isOpen && userId) {
      setActiveTab("profile");
      loadProfileData();
    } else {
      resetForm();
    }
  }, [isOpen, userId]);

  const loadProfileData = async () => {
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const res = await getUserProfileSelfAction(userId);
    if (res.success && res.profile) {
      setName(res.profile.name);
      setLastname(res.profile.lastname);
      setDni(res.profile.dni);
      setProfessionName(res.profile.professionName);

      setEmail(res.profile.email);
      setPhone(res.profile.phone || "");
      setTuitionCode(res.profile.tuitionCode || "");
      setUbigeoCode(res.profile.ubigeoCode || "");
      setUbigeoSearchText(res.profile.ubigeoLabel || "");

      setIsEmailVerified(!!res.profile.isEmailVerified);
      setIsPhoneVerified(!!res.profile.isPhoneVerified);
      setEmailVerifiedAt(res.profile.emailVerifiedAt || null);
      setPhoneVerifiedAt(res.profile.phoneVerifiedAt || null);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setActiveTab("profile");
    setErrorMessage("");
    setSuccessMessage("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setUbigeoSuggestions([]);
    setShowUbigeoDropdown(false);
    setOtpModalType(null);
    setOtpCode("");
    setOtpError("");
    setOtpMessage("");
  };

  // Handle OTP Verification Trigger
  const handleStartOtpVerification = async (type: "email" | "phone") => {
    setOtpModalType(type);
    setOtpCode("");
    setOtpError("");
    setOtpMessage("");
    setIsSendingOtp(true);

    const res = await sendContactVerificationOtpAction(userId, type);
    setIsSendingOtp(false);

    if (res.success) {
      setOtpMessage(res.message);
    } else {
      setOtpError(res.message);
    }
  };

  const handleConfirmOtpCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpModalType) return;
    setOtpError("");
    setIsConfirmingOtp(true);

    const res = await confirmContactVerificationOtpAction(userId, otpModalType, otpCode);
    setIsConfirmingOtp(false);

    if (res.success) {
      setSuccessMessage(res.message);
      if (otpModalType === "email") {
        setIsEmailVerified(true);
      } else {
        setIsPhoneVerified(true);
      }
      setOtpModalType(null);
      if (onProfileUpdated) onProfileUpdated();
    } else {
      setOtpError(res.message);
    }
  };

  // Handle Ubigeo Search
  const handleUbigeoSearchChange = async (val: string) => {
    setUbigeoSearchText(val);
    if (!val || val.trim().length < 2) {
      setUbigeoSuggestions([]);
      setShowUbigeoDropdown(false);
      return;
    }

    setIsSearchingUbigeo(true);
    const res = await getUbigeoSuggestionsAction(val);
    if (res.success && res.suggestions) {
      setUbigeoSuggestions(res.suggestions);
      setShowUbigeoDropdown(true);
    }
    setIsSearchingUbigeo(false);
  };

  const handleSelectUbigeo = (code: string, label: string) => {
    setUbigeoCode(code);
    setUbigeoSearchText(label);
    setShowUbigeoDropdown(false);
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    // Front validations
    if (!email || !email.includes("@")) {
      setErrorMessage("Por favor ingresa una dirección de correo electrónico válida.");
      return;
    }

    if (phone && !/^\d{9}$/.test(phone.trim())) {
      setErrorMessage("El número celular debe contener exactamente 9 dígitos numéricos.");
      return;
    }

    if (activeTab === "password") {
      if (!currentPassword) {
        setErrorMessage("Debes ingresar tu contraseña actual.");
        return;
      }
      if (!newPassword || newPassword.length < 8) {
        setErrorMessage("La nueva contraseña debe tener al menos 8 caracteres.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMessage("Las contraseñas no coinciden.");
        return;
      }
    }

    setSubmitting(true);
    const res = await updateUserProfileSelfAction({
      userId,
      email,
      phone,
      tuitionCode,
      ubigeoCode,
      currentPassword: activeTab === "password" ? currentPassword : undefined,
      newPassword: activeTab === "password" ? newPassword : undefined,
    });

    if (res.success) {
      setSuccessMessage(res.message || "Perfil actualizado con éxito.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (onProfileUpdated) {
        onProfileUpdated();
      }

      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    } else {
      setErrorMessage(res.message || "Ocurrió un error al actualizar el perfil.");
    }

    setSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden my-4 max-h-[90vh] flex flex-col transition-all duration-300"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-[var(--color-hospital-blue)] dark:text-blue-400">
                <User size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white leading-tight">
                  Mi Perfil
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Gestión de datos de contacto y seguridad del usuario
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 pt-2 shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                activeTab === "profile"
                  ? "border-[var(--color-hospital-blue)] text-[var(--color-hospital-blue)] dark:text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
              }`}
            >
              <User size={15} /> Contacto
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("password")}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                activeTab === "password"
                  ? "border-[var(--color-hospital-blue)] text-[var(--color-hospital-blue)] dark:text-blue-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
              }`}
            >
              <Lock size={15} /> Seguridad
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <Loader2 size={32} className="animate-spin text-blue-600 mb-3" />
                <p className="text-xs font-semibold">Cargando información de tu perfil...</p>
              </div>
            ) : (
              <>
                {/* Alert Messages */}
                {errorMessage && (
                  <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-medium flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* TAB 1: Contact & Staff Data */}
                {activeTab === "profile" && (
                  <div className="space-y-4">
                    {/* Read-Only Info Card */}
                    <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                          Profesional Registrado
                        </p>
                        <p className="text-sm font-bold text-zinc-900 dark:text-white">
                          {name} {lastname}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          DNI: <span className="font-mono font-semibold">{dni}</span> {professionName ? `• ${professionName}` : ""}
                        </p>
                      </div>
                      <ShieldCheck size={28} className="text-emerald-500/80" />
                    </div>

                    {/* Email Input & Verification Status */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <Mail size={14} className="text-zinc-400" /> Correo Electrónico
                        </label>
                        {isEmailVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                            <CheckCircle2 size={11} /> Verificado ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartOtpVerification("email")}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/30 transition-all cursor-pointer shadow-sm hover:scale-105"
                          >
                            <AlertCircle size={11} /> ⚠️ Sin Verificar • Validar ahora
                          </button>
                        )}
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ejemplo: doctor@gmail.com"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      />
                    </div>

                    {/* Phone Input & Verification Status */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                          <Phone size={14} className="text-zinc-400" /> Teléfono / Celular (9 dígitos)
                        </label>
                        {isPhoneVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                            <CheckCircle2 size={11} /> Verificado ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartOtpVerification("phone")}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/30 transition-all cursor-pointer shadow-sm hover:scale-105"
                          >
                            <AlertCircle size={11} /> ⚠️ Sin Verificar • Validar ahora
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        maxLength={9}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="Ejemplo: 955662693"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-mono"
                      />
                    </div>

                    {/* OTP Modal Overlay Card */}
                    <AnimatePresence>
                      {otpModalType && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-4 rounded-2xl bg-zinc-900 border border-amber-500/40 shadow-xl space-y-3 overflow-hidden"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                              <Key size={16} />
                              <span>Verificación de 2 Pasos ({otpModalType === "email" ? "Correo" : "Celular"})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setOtpModalType(null)}
                              className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {otpMessage && (
                            <p className="text-[11px] text-zinc-300 leading-relaxed bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-750 font-mono">
                              {otpMessage}
                            </p>
                          )}

                          {otpError && (
                            <p className="text-[11px] text-rose-400 font-semibold bg-rose-950/60 p-2 rounded-lg border border-rose-800">
                              {otpError}
                            </p>
                          )}

                          <div className="space-y-3 pt-1">
                            <div>
                              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                                Ingresa el código de 6 dígitos enviado:
                              </label>
                              <input
                                type="text"
                                maxLength={6}
                                autoFocus
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (otpCode.length === 6 && !isConfirmingOtp) {
                                      handleConfirmOtpCode(e);
                                    }
                                  }
                                }}
                                placeholder="123456"
                                className="w-full px-3 py-2 text-center tracking-[0.5em] font-mono text-base font-extrabold rounded-xl border border-amber-500/60 bg-zinc-950 text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setOtpModalType(null)}
                                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleConfirmOtpCode(e)}
                                disabled={isConfirmingOtp || otpCode.length !== 6}
                                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 text-zinc-950 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                              >
                                {isConfirmingOtp ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin" /> Verificando...
                                  </>
                                ) : (
                                  <>
                                    Confirmar Código <CheckCircle2 size={13} />
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Tuition Code Input */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                        <Award size={14} className="text-zinc-400" /> Código de Colegiatura Oficial (CMP / CEP)
                      </label>
                      <input
                        type="text"
                        maxLength={12}
                        value={tuitionCode}
                        onChange={(e) => setTuitionCode(e.target.value.toUpperCase())}
                        placeholder="Ejemplo: 61872"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all font-mono uppercase"
                      />
                    </div>

                    {/* Ubigeo Autocomplete Input */}
                    <div className="relative">
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                        <MapPin size={14} className="text-zinc-400" /> Ubigeo / Distrito de Residencia
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={ubigeoSearchText}
                          onChange={(e) => handleUbigeoSearchChange(e.target.value)}
                          onFocus={() => {
                            if (ubigeoSuggestions.length > 0) setShowUbigeoDropdown(true);
                          }}
                          placeholder="Escribe tu distrito (ej: Tarapoto, Morales, etc.)"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white pr-8 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                        />
                        <div className="absolute right-2.5 top-2.5 text-zinc-400">
                          {isSearchingUbigeo ? (
                            <Loader2 size={14} className="animate-spin text-blue-500" />
                          ) : (
                            <Search size={14} />
                          )}
                        </div>
                      </div>

                      {/* Dropdown Suggestions */}
                      {showUbigeoDropdown && ubigeoSuggestions.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                          {ubigeoSuggestions.map((item) => (
                            <button
                              key={item.code}
                              type="button"
                              onClick={() => handleSelectUbigeo(item.code, item.label)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-zinc-700/60 text-zinc-800 dark:text-zinc-200 border-b border-zinc-100 dark:border-zinc-750 last:border-none"
                            >
                              <p className="font-semibold">{item.distrito}</p>
                              <p className="text-[10px] text-zinc-400">{item.departamento} / {item.provincia} • Code: {item.code}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: Change Password */}
                {activeTab === "password" && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 text-xs font-medium">
                      🔒 Ingresa tu contraseña actual únicamente si deseas establecer una nueva contraseña de acceso.
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                        <Key size={14} className="text-zinc-400" /> Contraseña Actual
                      </label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                        <Lock size={14} className="text-zinc-400" /> Nueva Contraseña (mínimo 6 caracteres)
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                        <Lock size={14} className="text-zinc-400" /> Confirmar Nueva Contraseña
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[var(--color-hospital-blue)] hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Guardando...
                      </>
                    ) : (
                      "Guardar Cambios"
                    )}
                  </button>
                </div>
              </>
            )}
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

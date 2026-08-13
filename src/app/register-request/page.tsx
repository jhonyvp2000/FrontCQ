"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  UserCheck,
  Building2,
  Mail,
  Phone,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  KeyRound,
  Hospital,
  ShieldAlert,
  WifiOff
} from "lucide-react";
import {
  validateStaffIdentityAction,
  submitAccountActivationRequestAction,
  checkIsInternalNetworkAction
} from "@/app/actions/account-request";

export default function RegisterRequestPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Network Verification State
  const [isCheckingIp, setIsCheckingIp] = useState(true);
  const [isInternalNetwork, setIsInternalNetwork] = useState(true);
  const [clientIp, setClientIp] = useState("");

  // Step 1 Form Data
  const [dni, setDni] = useState("");
  const [tuitionCode, setTuitionCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Verified User Info
  const [verifiedUser, setVerifiedUser] = useState<{
    id: string;
    dni: string;
    name: string;
    lastname: string;
    fullName: string;
    email: string;
    tuitionCode: string;
    professionName: string;
  } | null>(null);

  // Step 2 & 3 Form Data
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function verifyNetwork() {
      try {
        const res = await checkIsInternalNetworkAction();
        setIsInternalNetwork(res.isInternal);
        setClientIp(res.clientIp);
      } catch (err) {
        setIsInternalNetwork(false);
      } finally {
        setIsCheckingIp(false);
      }
    }
    verifyNetwork();
  }, []);

  // Step 1: Handle Identity Verification
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);

    if (!dni || dni.length !== 8) {
      setVerifyError("El DNI debe tener exactamente 8 dígitos.");
      return;
    }

    if (!tuitionCode.trim()) {
      setVerifyError("Por favor ingresa tu código de colegiatura profesional (Ej: CMP 074821).");
      return;
    }

    setIsVerifying(true);
    try {
      const res = await validateStaffIdentityAction({ dni, tuitionCode });
      if (!res.success) {
        setVerifyError(res.message || "Error al verificar la identidad del personal.");
      } else if (res.user) {
        setVerifiedUser(res.user);
        setEmail(res.user.email || "");
        setStep(2);
      }
    } catch (err) {
      setVerifyError("Ocurrió un problema de conexión. Inténtalo nuevamente.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 2: Validate Contact Info
  const handleNextToStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!email || !email.includes("@")) {
      setSubmitError("Ingresa un correo electrónico válido.");
      return;
    }

    setStep(3);
  };

  // Step 3: Handle Final Submission
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!password || password.length < 6) {
      setSubmitError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("Las contraseñas no coinciden. Por favor verifícalas.");
      return;
    }

    if (!verifiedUser) return;

    setIsSubmitting(true);
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://192.168.41.25:3108';

      const res = await submitAccountActivationRequestAction({
        userId: verifiedUser.id,
        dni: verifiedUser.dni,
        tuitionCode: verifiedUser.tuitionCode,
        email,
        phone,
        password,
        baseUrl,
      });

      if (!res.success) {
        setSubmitError(res.message || "Ocurrió un problema al enviar la solicitud.");
      } else {
        setSuccessMessage(res.message || "Solicitud enviada correctamente.");
        setStep(4);
      }
    } catch (err) {
      setSubmitError("Error inesperado al enviar la solicitud.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading Network Check
  if (isCheckingIp) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-slate-400">Verificando perímetro de red institucional...</p>
      </div>
    );
  }

  // 2. Restricted Network Screen if accessing from outside hospital network
  if (!isInternalNetwork) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-slate-900/90 border border-rose-800/50 rounded-2xl p-6 md:p-8 text-center shadow-2xl backdrop-blur-xl z-10 space-y-5"
        >
          <div className="w-16 h-16 bg-rose-950 border-2 border-rose-500/60 rounded-full flex items-center justify-center mx-auto text-rose-400 shadow-xl shadow-rose-500/20">
            <ShieldAlert className="w-9 h-9" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 text-xs font-bold uppercase tracking-wider">
            <WifiOff className="w-3.5 h-3.5" />
            Acceso Restringido por Red
          </div>

          <h1 className="text-xl font-bold text-white leading-snug">
            Proceso Disponible Únicamente en Red Interna
          </h1>

          <p className="text-xs text-slate-300 leading-relaxed">
            Por estrictas políticas de seguridad informática e identidad del <strong>Hospital II-2 Tarapoto</strong>, la habilitación de cuentas asistenciales solo puede realizarse desde computadoras conectadas a la red local del hospital (Subredes `192.168.x.x` / `10.x.x.x`).
          </p>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-400 text-left space-y-1">
            <div className="flex justify-between items-center text-slate-300">
              <span>Tu IP detectada:</span>
              <strong className="text-rose-400 font-mono">{clientIp || 'Externa / Pública'}</strong>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span>Estado Perímetro:</span>
              <strong className="text-rose-400">Fuera de Red Hospitalaria</strong>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/login"
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl text-xs inline-flex items-center gap-2 border border-slate-700 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Volver al Inicio de Sesión
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // 3. Normal Step Form Screen for Internal Hospital Network
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Dynamic Background Gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl z-10"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <Hospital className="w-3.5 h-3.5" />
            Hospital II-2 Tarapoto (Red Interna)
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
            <ShieldCheck className="w-7 h-7 text-cyan-400" />
            Activación de Cuenta Asistencial
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Portal de Solicitud de Acceso Web para Personal Quirúrgico
          </p>
        </div>

        {/* Step Progress Bar */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-800 -z-0 -translate-y-1/2" />
          <div
            className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 -z-0 -translate-y-1/2"
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          />

          {[
            { s: 1, label: "Identidad", icon: Stethoscope },
            { s: 2, label: "Contacto", icon: Mail },
            { s: 3, label: "Seguridad", icon: Lock },
            { s: 4, label: "Confirmación", icon: CheckCircle2 },
          ].map(({ s, label, icon: Icon }) => {
            const isCompleted = step > s;
            const isCurrent = step === s;
            return (
              <div key={s} className="flex flex-col items-center z-10">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                    isCompleted
                      ? "bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30"
                      : isCurrent
                      ? "bg-slate-900 border-2 border-cyan-400 text-cyan-400 shadow-md shadow-cyan-500/20"
                      : "bg-slate-800 text-slate-500 border border-slate-700"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-xs mt-1.5 font-medium ${
                    isCurrent || isCompleted ? "text-cyan-400" : "text-slate-500"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Dynamic Step Content */}
        <AnimatePresence mode="wait">
          {/* STEP 1: Verify Identity & Tuition Code */}
          {step === 1 && (
            <motion.form
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleVerify}
              className="space-y-5"
            >
              <div className="bg-cyan-950/40 border border-cyan-800/40 rounded-xl p-4 text-xs text-cyan-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <p>
                  Para verificar tu identidad sin riesgo de suplantación, ingresa tu <strong>DNI</strong> y tu <strong>Código de Colegiatura Oficial (CMP, CEP, etc.)</strong> pre-registrado en el hospital.
                </p>
              </div>

              {verifyError && (
                <div className="bg-rose-950/60 border border-rose-800/60 rounded-xl p-4 text-xs text-rose-300 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <p>{verifyError}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  DNI (Documento Nacional de Identidad)
                </label>
                <div className="relative">
                  <UserCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    maxLength={8}
                    value={dni}
                    onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ej: 00811435"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Código de Colegiatura Oficial (CMP / CEP)
                </label>
                <div className="relative">
                  <Stethoscope className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    value={tuitionCode}
                    onChange={(e) => setTuitionCode(e.target.value)}
                    placeholder="Ej: CMP 074821"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <Link
                  href="/login"
                  className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver al Login
                </Link>

                <button
                  type="submit"
                  disabled={isVerifying}
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-cyan-600/20 disabled:opacity-50 transition-all"
                >
                  {isVerifying ? (
                    <span>Verificando...</span>
                  ) : (
                    <>
                      <span>Verificar Identidad</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.form>
          )}

          {/* STEP 2: Contact Details */}
          {step === 2 && verifiedUser && (
            <motion.form
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleNextToStep3}
              className="space-y-5"
            >
              {/* Professional Profile Badge */}
              <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400 font-bold text-lg">
                  {verifiedUser.name.charAt(0)}
                  {verifiedUser.lastname.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    {verifiedUser.fullName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span className="text-cyan-400 font-semibold">{verifiedUser.professionName}</span>
                    <span>•</span>
                    <span>Colegiatura: <strong className="text-slate-200">{verifiedUser.tuitionCode}</strong></span>
                  </div>
                </div>
              </div>

              {submitError && (
                <div className="bg-rose-950/60 border border-rose-800/60 rounded-xl p-4 text-xs text-rose-300 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <p>{submitError}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Correo Electrónico (Personal / Institucional)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@minsa.gob.pe o correo personal"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  👉 <strong>Importante:</strong> En este buzón recibirás las notificaciones de tus cirugías programadas por BackCQ.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Teléfono Celular de Contacto (Opcional)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: 942123456"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Anterior
                </button>

                <button
                  type="submit"
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-cyan-600/20 transition-all"
                >
                  <span>Continuar a Seguridad</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.form>
          )}

          {/* STEP 3: Password & Security */}
          {step === 3 && (
            <motion.form
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSubmitRequest}
              className="space-y-5"
            >
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-cyan-400">Establece tu Contraseña Personal de Acceso</p>
                <p>Esta contraseña te permitirá ingresar a <strong>FrontCQ</strong> y a la plataforma quirúrgica <strong>BackCQ</strong>.</p>
              </div>

              {submitError && (
                <div className="bg-rose-950/60 border border-rose-800/60 rounded-xl p-4 text-xs text-rose-300 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <p>{submitError}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Confirmar Nueva Contraseña
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita la contraseña"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Anterior
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-6 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <span>Enviando Solicitud...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Enviar a Jefatura CQ</span>
                    </>
                  )}
                </button>
              </div>
            </motion.form>
          )}

          {/* STEP 4: Success & Confirmation */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4 space-y-5"
            >
              <div className="w-16 h-16 bg-emerald-950 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <h2 className="text-xl font-bold text-white">
                ¡Solicitud Registrada Exitosamente!
              </h2>

              <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                {successMessage || "Se ha enviado una alerta de aprobación en 1-Clic a la Jefatura de Centro Quirúrgico. Tan pronto como aprueben tu acceso, podrás ingresar al sistema."}
              </p>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 text-left space-y-2">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Profesional:</span>
                  <strong className="text-white">{verifiedUser?.fullName}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Correo Notificaciones:</span>
                  <strong className="text-cyan-400">{email}</strong>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  href="/login"
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-xl text-sm inline-flex items-center gap-2 border border-slate-700 transition-all"
                >
                  Volver al Inicio de Sesión
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

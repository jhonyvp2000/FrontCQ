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
  WifiOff,
  Calendar,
  User,
  Info,
  Clock,
  Ban
} from "lucide-react";
import {
  validateStaffIdentityAction,
  verifySurgicalChallengeAction,
  submitAccountActivationRequestAction,
  checkIsInternalNetworkAction
} from "@/app/actions/account-request";

export default function RegisterRequestPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

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
    hasSurgeryHistory?: boolean;
    staffSurgeriesCount?: number;
  } | null>(null);

  // Step 2 Surgical Challenge Data
  const [patientDni, setPatientDni] = useState("");
  const [surgeryDate, setSurgeryDate] = useState("");
  const [isVerifyingSurgical, setIsVerifyingSurgical] = useState(false);
  const [surgicalError, setSurgicalError] = useState<string | null>(null);
  const [isPermanentlyBlocked, setIsPermanentlyBlocked] = useState(false);
  const [isTemporarilyBlocked, setIsTemporarilyBlocked] = useState(false);

  // Step 3 & 4 Form Data
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

  // Step 1: Handle Initial DNI & Tuition Verification
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    setIsPermanentlyBlocked(false);
    setIsTemporarilyBlocked(false);

    if (!dni || dni.length < 6 || dni.length > 12) {
      setVerifyError("El DNI o Carnet de Extranjería debe contener entre 6 y 12 caracteres.");
      return;
    }

    if (!tuitionCode.trim() || tuitionCode.trim().length > 12) {
      setVerifyError("El código de colegiatura oficial no debe exceder los 12 caracteres.");
      return;
    }

    setIsVerifying(true);
    try {
      const res = await validateStaffIdentityAction({ dni, tuitionCode });
      if (!res.success) {
        if (res.isPermanentlyBlocked) {
          setIsPermanentlyBlocked(true);
        } else if (res.isTemporarilyBlocked) {
          setIsTemporarilyBlocked(true);
        }
        setVerifyError(res.message || "Error al verificar la identidad del personal.");
      } else if (res.user) {
        setVerifiedUser(res.user);
        setEmail(res.user.email || "");
        setStep(2); // Move to Surgical Challenge
      }
    } catch (err) {
      setVerifyError("Ocurrió un problema de conexión. Inténtalo nuevamente.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 2: Handle Surgical Challenge Verification
  const handleVerifySurgicalChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setSurgicalError(null);

    if (!patientDni || patientDni.length < 6 || patientDni.length > 12) {
      setSurgicalError("El DNI o Carnet de Extranjería del paciente debe contener entre 6 y 12 caracteres.");
      return;
    }

    if (!surgeryDate) {
      setSurgicalError("Por favor selecciona la fecha exacta de la intervención quirúrgica.");
      return;
    }

    if (!verifiedUser) return;

    setIsVerifyingSurgical(true);
    try {
      const res = await verifySurgicalChallengeAction({
        staffDni: verifiedUser.dni,
        staffUserId: verifiedUser.id,
        patientDni,
        surgeryDate,
      });

      if (!res.success) {
        if (res.isPermanentlyBlocked) {
          setIsPermanentlyBlocked(true);
        } else if (res.isTemporarilyBlocked) {
          setIsTemporarilyBlocked(true);
        }
        setSurgicalError(res.message || "Error al convalidar datos quirúrgicos en BackCQ.");
      } else {
        setStep(3); // Advance to Contact Info
      }
    } catch (err) {
      setSurgicalError("Error de conexión al consultar las cirugías de BackCQ.");
    } finally {
      setIsVerifyingSurgical(false);
    }
  };

  // Step 3: Handle Direct Account Activation Submission
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setSubmitError("🔒 Por favor ingresa un correo electrónico con formato válido (ejemplo: usuario@dominio.com).");
      return;
    }

    const cleanPhone = phone.trim();
    if (cleanPhone.length > 0 && cleanPhone.length !== 9) {
      setSubmitError("🔒 El número celular debe ser únicamente numérico y tener exactamente 9 dígitos (ejemplo: 942685774).");
      return;
    }

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
        setSubmitError(res.message || "Ocurrió un problema al activar la cuenta.");
      } else {
        setSuccessMessage(res.message || "Cuenta activada exitosamente.");
        setStep(4); // Move to Success Screen directly
      }
    } catch (err) {
      setSubmitError("Error inesperado al activar la cuenta.");
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
              <ArrowLeft className="w-4 h-4" />
              Volver al Iniciar Sesión
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-xs font-semibold">
            <Hospital className="w-3.5 h-3.5" />
            Hospital II-2 Tarapoto — Sistema CQ
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Activación de Cuenta Asistencial
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Proceso de habilitación de usuario para personal registrado en la programación quirúrgica.
          </p>
        </div>

        {/* Step Progress Indicator */}
        <div className="flex items-center justify-between px-2 sm:px-6">
          {[
            { s: 1, label: "Identidad" },
            { s: 2, label: "Actividad CQ" },
            { s: 3, label: "Contacto y Seguridad" },
          ].map((st, idx) => {
            const isCompleted = step > st.s || step === 4;
            const isCurrent = step === st.s;
            return (
              <div key={st.s} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted
                      ? "bg-emerald-500 text-slate-950 font-extrabold"
                      : isCurrent
                      ? "bg-cyan-500 text-slate-950 ring-4 ring-cyan-500/20"
                      : "bg-slate-800 text-slate-500 border border-slate-700"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : st.s}
                </div>
                <span
                  className={`hidden md:inline text-xs font-medium ${
                    isCurrent ? "text-cyan-400 font-bold" : isCompleted ? "text-emerald-400" : "text-slate-500"
                  }`}
                >
                  {st.label}
                </span>
                {idx < 2 && <div className="w-4 sm:w-8 h-0.5 bg-slate-800 hidden sm:block" />}
              </div>
            );
          })}
        </div>

        {/* Card Container */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <AnimatePresence mode="wait">
            {/* STEP 1: IDENTIDAD (DNI + COLEGIATURA) */}
            {step === 1 && (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleVerify}
                className="space-y-5"
              >
                <div className="border-b border-slate-800 pb-4">
                  <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-cyan-400" />
                    Paso 1: Validación de Personal Asistencial
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Ingresa tus credenciales oficiales para verificar tu registro previo en la base de datos de personal.
                  </p>
                </div>

                {verifyError && (
                  <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    isPermanentlyBlocked || isTemporarilyBlocked
                      ? "bg-rose-950/90 border-rose-700 text-rose-200"
                      : "bg-rose-950/80 border-rose-800 text-rose-300"
                  }`}>
                    {isPermanentlyBlocked ? (
                      <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    ) : isTemporarilyBlocked ? (
                      <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span>{verifyError}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Número de DNI / Carnet de Extranjería (Máximo 12 caracteres)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={12}
                        disabled={isPermanentlyBlocked || isTemporarilyBlocked}
                        value={dni}
                        onChange={(e) => setDni(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
                        placeholder="Ej: 45892104 o 000123456789"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono disabled:opacity-50"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Código de Colegiatura Oficial (Máximo 12 caracteres)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={12}
                        disabled={isPermanentlyBlocked || isTemporarilyBlocked}
                        value={tuitionCode}
                        onChange={(e) => setTuitionCode(e.target.value.toUpperCase().slice(0, 12))}
                        placeholder="Ej: CMP 074821 o CEP 59841"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono disabled:opacity-50"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <Link
                    href="/login"
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Volver al Login
                  </Link>

                  <button
                    type="submit"
                    disabled={isVerifying || isPermanentlyBlocked || isTemporarilyBlocked}
                    className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold px-5 py-3 rounded-xl text-xs inline-flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    {isVerifying ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        Continuar a Actividad CQ <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {/* STEP 2: DESAFÍO DE ACTIVIDAD QUIRÚRGICA REAL */}
            {step === 2 && verifiedUser && (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleVerifySurgicalChallenge}
                className="space-y-5"
              >
                <div className="border-b border-slate-800 pb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                      <Stethoscope className="w-5 h-5 text-amber-400" />
                      Paso 2: Desafío de Actividad Quirúrgica Real
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/50">
                      Anti-Suplantación BackCQ
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Hola <strong>Dr(a). {verifiedUser.fullName}</strong>. Para prevenir la suplantación de tu cuenta, ingresa los datos de una intervención quirúrgica en la que hayas participado:
                  </p>
                </div>

                {surgicalError && (
                  <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                    isPermanentlyBlocked || isTemporarilyBlocked
                      ? "bg-rose-950/90 border-rose-700 text-rose-200"
                      : "bg-rose-950/80 border-rose-800 text-rose-300"
                  }`}>
                    {isPermanentlyBlocked ? (
                      <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    ) : isTemporarilyBlocked ? (
                      <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span>{surgicalError}</span>
                  </div>
                )}

                {/* CASO A: SI POSEE HISTORIAL QUIRÚRGICO REGISTRADO EN BACKCQ */}
                {verifiedUser.hasSurgeryHistory ? (
                  <div className="space-y-4">
                    {/* Campo 1: DNI o Carnet de Extranjería del Paciente */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-cyan-400" />
                        1. DNI / Carnet de Extranjería de un Paciente Atendido / Operado por Ud.
                      </label>
                      <input
                        type="text"
                        maxLength={12}
                        disabled={isPermanentlyBlocked || isTemporarilyBlocked}
                        value={patientDni}
                        onChange={(e) => setPatientDni(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())}
                        placeholder="Ej: 74852910 o 000987654321"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono disabled:opacity-50"
                        required
                      />
                    </div>

                    {/* Campo 2: Fecha Exacta de la Cirugía */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                        2. Fecha Exacta de la Intervención Quirúrgica (Día / Mes / Año)
                      </label>
                      <input
                        type="date"
                        disabled={isPermanentlyBlocked || isTemporarilyBlocked}
                        value={surgeryDate}
                        onChange={(e) => setSurgeryDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 transition-all font-mono disabled:opacity-50"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  /* CASO B: SI ES UN PROFESIONAL NUEVO SIN CIRUGÍAS PREVIAS EN BACKCQ */
                  <div className="p-4 rounded-xl bg-slate-950 border border-cyan-800/40 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold">
                      <Info className="w-4 h-4" />
                      <span>Personal sin participaciones quirúrgicas previas registradas</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Actualmente no registras participaciones quirúrgicas pasadas en la base de datos de Centro Quirúrgico. Haz clic en <strong>"Continuar a Contacto"</strong> para enviar tu solicitud directamente a la Jefatura de Centro Quirúrgico para su revisión manual.
                    </p>
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Atrás
                  </button>

                  {verifiedUser.hasSurgeryHistory ? (
                    <button
                      type="submit"
                      disabled={isVerifyingSurgical || isPermanentlyBlocked || isTemporarilyBlocked}
                      className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold px-5 py-3 rounded-xl text-xs inline-flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
                    >
                      {isVerifyingSurgical ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          Convalidando BackCQ...
                        </>
                      ) : (
                        <>
                          Verificar Cirugía <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5 py-3 rounded-xl text-xs inline-flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
                    >
                      Continuar a Contacto <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.form>
            )}

            {/* STEP 3: CONTACTO Y CREACIÓN DE CONTRASEÑA (ACTIVACIÓN DIRECTA) */}
            {step === 3 && verifiedUser && (
              <motion.form
                key="step3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleSubmitRequest}
                className="space-y-5"
              >
                <div className="border-b border-slate-800 pb-4">
                  <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-cyan-400" />
                    Paso 3: Contacto y Creación de Contraseña
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Ingresa tu correo, celular y define tu contraseña de acceso para finalizar la activación de tu cuenta.
                  </p>
                </div>

                {submitError && (
                  <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Correo Electrónico Institucional / Personal
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ejemplo@hospitaltarapoto.gob.pe o usuario@gmail.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Número Telefónico / Celular Actual (Opcional - Exactamente 9 dígitos numéricos)
                    </label>
                    <input
                      type="tel"
                      maxLength={9}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 9))}
                      placeholder="Ej: 942685774"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Nueva Contraseña de Acceso
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Confirmar Contraseña
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repite tu contraseña"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Atrás
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs inline-flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        Activando Cuenta...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Finalizar y Activar Cuenta
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {/* STEP 4: ÉXITO Y ACTIVACIÓN DIRECTA */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4 space-y-5"
              >
                <div className="w-16 h-16 bg-emerald-950 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/20">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-extrabold text-white">
                    ¡Cuenta Habilitada Exitosamente!
                  </h2>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    {successMessage || "Tu cuenta de usuario ha sido activada de manera automática. Ya puedes ingresar a los sistemas FrontCQ y BackCQ."}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Estado de la Cuenta:</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                      HABILITADO / ACTIVO
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Usuario Asistencial:</span>
                    <strong className="text-slate-200">{verifiedUser?.fullName}</strong>
                  </div>
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                    💡 La convalidación del desafío quirúrgico garantizó tu identidad. Tu acceso ha sido habilitado sin requerir tiempos de espera.
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href="/login"
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-3 px-6 rounded-xl text-xs inline-flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all font-bold"
                  >
                    Iniciar Sesión en FrontCQ <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

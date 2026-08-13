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
  MapPin,
  Smartphone
} from "lucide-react";
import {
  validateStaffIdentityAction,
  verifyNethosChallengeAction,
  submitAccountActivationRequestAction,
  checkIsInternalNetworkAction
} from "@/app/actions/account-request";

const SAN_MARTIN_DISTRICTS = [
  "TARAPOTO",
  "MORALES",
  "LA BANDA DE SHILCAYO",
  "CACATACHI",
  "LAMAS",
  "SAN ANTONIO",
  "SAUCE",
  "SHAPAJA",
  "CHAZUTA",
  "JUANJUI",
  "MOYOBAMBA",
  "RIOJA",
  "BELLAVISTA",
  "PICOTA",
  "TOCACHE",
  "OTRO / FUERA DE SAN MARTIN"
];

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
    nethosHasPhone?: boolean;
    nethosPhoneMask?: string;
  } | null>(null);

  // Step 2 NETHOS Challenge Data
  const [birthDate, setBirthDate] = useState("");
  const [district, setDistrict] = useState("");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [isVerifyingNethos, setIsVerifyingNethos] = useState(false);
  const [nethosError, setNethosError] = useState<string | null>(null);

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
        setStep(2); // Move to NETHOS Challenge
      }
    } catch (err) {
      setVerifyError("Ocurrió un problema de conexión. Inténtalo nuevamente.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 2: Handle NETHOS Challenge Verification
  const handleVerifyNethosChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setNethosError(null);

    if (!birthDate) {
      setNethosError("Por favor selecciona tu fecha de nacimiento.");
      return;
    }

    if (!district.trim()) {
      setNethosError("Por favor selecciona o ingresa tu distrito de residencia registrado.");
      return;
    }

    if (verifiedUser?.nethosHasPhone && (!phoneLast4 || phoneLast4.length !== 4)) {
      setNethosError("Por favor ingresa los 4 últimos dígitos de tu celular registrado.");
      return;
    }

    setIsVerifyingNethos(true);
    try {
      const res = await verifyNethosChallengeAction({
        dni,
        birthDate,
        district,
        phoneLast4,
      });

      if (!res.success) {
        setNethosError(res.message || "Error al convalidar identidad con la ficha NETHOS.");
      } else {
        setStep(3); // Advance to Contact Info
      }
    } catch (err) {
      setNethosError("Error de conexión al validar con la base de datos NETHOS.");
    } finally {
      setIsVerifyingNethos(false);
    }
  };

  // Step 3: Validate Contact Info
  const handleNextToSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!email || !email.includes("@")) {
      setSubmitError("Ingresa un correo electrónico válido.");
      return;
    }

    setStep(4); // Move to Password step
  };

  // Step 4: Handle Final Submission
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
        setStep(5);
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
            { s: 2, label: "Desafío NETHOS" },
            { s: 3, label: "Contacto" },
            { s: 4, label: "Seguridad" },
          ].map((st, idx) => {
            const isCompleted = step > st.s || step === 5;
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
                {idx < 3 && <div className="w-4 sm:w-8 h-0.5 bg-slate-800 hidden sm:block" />}
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
                  <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{verifyError}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Número de DNI (8 dígitos)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={8}
                        value={dni}
                        onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                        placeholder="Ej: 45892104"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Código de Colegiatura Oficial (CMP, CEP, etc.)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={tuitionCode}
                        onChange={(e) => setTuitionCode(e.target.value.toUpperCase())}
                        placeholder="Ej: CMP 074821 o CEP 59841"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono"
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
                    disabled={isVerifying}
                    className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 font-bold px-5 py-3 rounded-xl text-xs inline-flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    {isVerifying ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      <>
                        Continuar a Desafío NETHOS <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {/* STEP 2: DESAFÍO NETHOS (CONOCIMIENTO PRIVADO) */}
            {step === 2 && verifiedUser && (
              <motion.form
                key="step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleVerifyNethosChallenge}
                className="space-y-5"
              >
                <div className="border-b border-slate-800 pb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-amber-400" />
                      Paso 2: Desafío de Identidad Confidencial NETHOS
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800/50">
                      Anti-Suplantación
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Hola <strong>Dr(a). {verifiedUser.fullName}</strong>. Para prevenir la suplantación de tu cuenta, responde a los siguientes datos confidenciales registrados en tu ficha hospitalaria NETHOS:
                  </p>
                </div>

                {nethosError && (
                  <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{nethosError}</span>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Desafío 1: Fecha de Nacimiento */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                      1. Fecha de Nacimiento Exacta (Día / Mes / Año)
                    </label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 transition-all font-mono"
                      required
                    />
                  </div>

                  {/* Desafío 2: Distrito de Residencia/Nacimiento */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      2. Distrito de Residencia Registrado en NETHOS
                    </label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 transition-all"
                      required
                    >
                      <option value="">-- Selecciona tu Distrito --</option>
                      {SAN_MARTIN_DISTRICTS.map((dist) => (
                        <option key={dist} value={dist}>
                          {dist}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Desafío 3: Confirmación de Teléfono Celular (Si existe en NETHOS) */}
                  {verifiedUser.nethosHasPhone && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                        3. Últimos 4 dígitos de tu Celular ({verifiedUser.nethosPhoneMask})
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={phoneLast4}
                        onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, ""))}
                        placeholder="Ej: 5774"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono"
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Atrás
                  </button>

                  <button
                    type="submit"
                    disabled={isVerifyingNethos}
                    className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 text-slate-950 font-bold px-5 py-3 rounded-xl text-xs inline-flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    {isVerifyingNethos ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        Convalidando NETHOS...
                      </>
                    ) : (
                      <>
                        Verificar Identidad <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {/* STEP 3: CONTACTO (CORREO Y TELÉFONO) */}
            {step === 3 && verifiedUser && (
              <motion.form
                key="step3"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleNextToSecurity}
                className="space-y-5"
              >
                <div className="border-b border-slate-800 pb-4">
                  <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-cyan-400" />
                    Paso 3: Correo Electrónico y Contacto
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Confirma tu correo para recibir las notificaciones y confirmaciones de programación quirúrgica.
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
                      Número Telefónico / Celular Actual
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      placeholder="Ej: 942685774"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-mono"
                    />
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
                    className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-5 py-3 rounded-xl text-xs inline-flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
                  >
                    Definir Contraseña <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.form>
            )}

            {/* STEP 4: SEGURIDAD (CONTRASEÑA Y CONFIRMACIÓN) */}
            {step === 4 && verifiedUser && (
              <motion.form
                key="step4"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleSubmitRequest}
                className="space-y-5"
              >
                <div className="border-b border-slate-800 pb-4">
                  <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-cyan-400" />
                    Paso 4: Creación de Contraseña Segura
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Crea tu contraseña de acceso para ingresar al sistema BackCQ / FrontCQ.
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
                      Nueva Contraseña
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
                      Confirmar Nueva Contraseña
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la contraseña"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
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
                        Enviando Solicitud...
                      </>
                    ) : (
                      <>
                        Enviar Solicitud a Jefatura <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}

            {/* STEP 5: ÉXITO Y NOTIFICACIÓN */}
            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4 space-y-5"
              >
                <div className="w-16 h-16 bg-emerald-950 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-xl shadow-emerald-500/20">
                  <CheckCircle2 className="w-9 h-9" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-extrabold text-white">
                    ¡Solicitud de Activación Enviada!
                  </h2>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    {successMessage || "Tu solicitud de activación de cuenta ha sido registrada correctamente."}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Estado de Solicitud:</span>
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-bold">
                      PENDIENTE DE APROBACIÓN (JEFATURA CQ)
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Notificación Enviada a:</span>
                    <strong className="text-slate-200">Jefatura / Coordinación CQ</strong>
                  </div>
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                    💡 La Jefatura de Centro Quirúrgico revisará tu solicitud y la aprobará mediante el sistema de 1-Clic.
                  </div>
                </div>

                <div className="pt-2">
                  <Link
                    href="/login"
                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl text-xs inline-flex items-center gap-2 border border-slate-700 transition-all"
                  >
                    Volver a Iniciar Sesión <ArrowRight className="w-4 h-4" />
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

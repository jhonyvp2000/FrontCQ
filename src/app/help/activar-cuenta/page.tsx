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
  Wifi,
  WifiOff,
  Calendar,
  User,
  Info,
  Clock,
  ChevronDown,
  HelpCircle,
  Sparkles,
  ExternalLink,
  LockKeyhole
} from "lucide-react";
import { checkIsInternalNetworkAction } from "@/app/actions/account-request";

export default function HelpActivateAccountPage() {
  const [isCheckingIp, setIsCheckingIp] = useState(true);
  const [isInternalNetwork, setIsInternalNetwork] = useState(false);
  const [clientIp, setClientIp] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    async function verifyNetwork() {
      try {
        const res = await checkIsInternalNetworkAction();
        setIsInternalNetwork(res.isInternal);
        setClientIp(res.clientIp || "");
      } catch (err) {
        setIsInternalNetwork(false);
      } finally {
        setIsCheckingIp(false);
      }
    }
    verifyNetwork();
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqList = [
    {
      question: "¿Puedo leer esta guía desde mi celular o desde mi casa?",
      answer: "¡Sí! Esta guía informativa es totalmente pública y accesible desde cualquier conexión a Internet (móvil, wifi de casa o extranet) las 24 horas del día."
    },
    {
      question: "¿Por qué el formulario de solicitud debe llenarse desde la Red del Hospital?",
      answer: "Por estrictas políticas de seguridad del Ministerio de Salud (MINSA) y la Ley N° 29733 de Protección de Datos Personales, la verificación de cirugías e historia clínica del paciente requiere que el equipo esté conectado a la Intranet institucional (192.168.x.x)."
    },
    {
      question: "¿Qué es el 'Reto Quirúrgico de Seguridad'?",
      answer: "Es un mecanismo automático que comprueba que tú eres realmente el profesional médico. Te solicitará ingresar el DNI de un paciente y la fecha exacta de una cirugía en la que hayas participado previamente."
    },
    {
      question: "¿Qué ocurre si me equivoco 3 veces en el Reto Quirúrgico?",
      answer: "Para evitar intentos no autorizados, el sistema activará un bloqueo temporal de 15 minutos para tu DNI o número de teléfono. Transcurrido ese tiempo podrás intentarlo nuevamente."
    },
    {
      question: "¿Qué hago si el sistema me dice que mi DNI o Colegiatura no se encuentra registrado?",
      answer: "Si eres personal asistencial recién ingresante y tu información aún no figura en la base de datos de cirugías, puedes comunicarte con la Oficina de Informática/Sistemas de la OGESS para el registro inicial."
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 flex flex-col selection:bg-blue-500 selection:text-white font-sans">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[140px]" />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-xl px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-3 group">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 group-hover:scale-105 transition-transform">
              <Hospital size={22} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide leading-none">
                HOSPITAL II-2 TARAPOTO
              </h1>
              <p className="text-[11px] text-zinc-400 font-medium">
                Central Quirúrgica • Material de Ayuda
              </p>
            </div>
          </Link>

          <Link
            href="/login"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 transition-colors border border-zinc-700/60"
          >
            <ArrowLeft size={14} /> Volver al Login
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 py-8 md:py-12 space-y-10">
        
        {/* Banner de Estado de Red */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 md:p-5 rounded-2xl bg-zinc-850 border border-zinc-750 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            {isCheckingIp ? (
              <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 animate-pulse">
                <Clock size={20} className="text-zinc-500" />
              </div>
            ) : isInternalNetwork ? (
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <Wifi size={20} />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <WifiOff size={20} />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">
                  {isCheckingIp
                    ? "Verificando tu conexión de red..."
                    : isInternalNetwork
                    ? "Red Hospitalaria Detectada (Intranet)"
                    : "Conexión Externa (Internet / Móvil)"}
                </h3>
                {clientIp && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
                    IP: {clientIp}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                {isInternalNetwork
                  ? "Te encuentras dentro de la red del hospital. Puedes ingresar al formulario de activación inmediatamente."
                  : "Esta guía es totalmente legible desde cualquier lugar. Para llenar el formulario final de activación deberás conectarte desde una PC del hospital."}
              </p>
            </div>
          </div>

          <div className="shrink-0 w-full md:w-auto">
            {isInternalNetwork ? (
              <Link
                href="/register-request"
                className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/25"
              >
                Ir a Solicitar Activación <ArrowRight size={14} />
              </Link>
            ) : (
              <span className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 bg-zinc-800/60 border border-zinc-700 cursor-not-allowed">
                <LockKeyhole size={14} className="text-amber-400" /> Solicitud requiere Intranet
              </span>
            )}
          </div>
        </motion.div>

        {/* Headline Hero */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold border border-blue-500/20 mb-1">
            <Sparkles size={14} /> Personal Médico y Asistencial
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            ¿Cómo activar tu cuenta en Central Quirúrgica?
          </h2>
          <p className="text-xs md:text-sm text-zinc-400 font-medium leading-relaxed">
            Sigue estos 5 pasos para habilitar tu usuario en el sistema de programación y monitoreo de cirugías del Hospital II-2 Tarapoto.
          </p>
        </div>

        {/* 5 STEPS VISUAL CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* STEP 1 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl bg-zinc-850 border border-zinc-750 hover:border-blue-500/40 transition-all group flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/30">
                  01
                </span>
                <Stethoscope size={22} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Identificación Profesional
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Ingresa tu <strong className="text-zinc-200">DNI de 8 dígitos</strong> y tu código de colegiatura médica (<strong className="text-zinc-200">CMP</strong> para Médicos/Anestesiólogos o <strong className="text-zinc-200">CEP</strong> para Enfermeros).
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400 shrink-0" /> Valida que sean correctos y que estén registrados en la institución
            </div>
          </motion.div>

          {/* STEP 2 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-6 rounded-2xl bg-zinc-850 border border-zinc-750 hover:border-amber-500/40 transition-all group flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                  02
                </span>
                <KeyRound size={22} className="text-zinc-500 group-hover:text-amber-400 transition-colors" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Reto Quirúrgico de Seguridad
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Para confirmar tu identidad, responde al desafío ingresando el <strong className="text-zinc-200">DNI de un paciente</strong> y la <strong className="text-zinc-200">fecha exacta</strong> de una cirugía en la que participaste.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-amber-400/90 flex items-center gap-1.5 font-medium">
              <ShieldAlert size={14} className="shrink-0" /> Máximo 3 intentos (Anti-suplantación)
            </div>
          </motion.div>

          {/* STEP 3 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-6 rounded-2xl bg-zinc-850 border border-zinc-750 hover:border-emerald-500/40 transition-all group flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center border border-emerald-500/30">
                  03
                </span>
                <Mail size={22} className="text-zinc-500 group-hover:text-emerald-400 transition-colors" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Datos de Contacto y Ubigeo
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Registra tu <strong className="text-zinc-200">correo electrónico</strong>, un número de <strong className="text-zinc-200">celular único de 9 dígitos</strong> y tu distrito de residencia (Ubigeo).
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center gap-1.5">
              <Phone size={14} className="text-blue-400" /> Verificación de número telefónico único
            </div>
          </motion.div>

          {/* STEP 4 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-6 rounded-2xl bg-zinc-850 border border-zinc-750 hover:border-purple-500/40 transition-all group flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 font-bold text-xs flex items-center justify-center border border-purple-500/30">
                  04
                </span>
                <Lock size={22} className="text-zinc-500 group-hover:text-purple-400 transition-colors" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Contraseña de Acceso
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Crea tu clave de acceso personal con un mínimo de <strong className="text-zinc-200">8 caracteres</strong>. Esta será tu contraseña para iniciar sesión en Central Quirúrgica.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-zinc-500 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-purple-400" /> Encriptado seguro con bcrypt
            </div>
          </motion.div>

          {/* STEP 5 */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="p-6 rounded-2xl bg-zinc-850 border border-zinc-750 hover:border-blue-500/40 transition-all group flex flex-col justify-between md:col-span-2 lg:col-span-2"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center border border-blue-500/30">
                  05
                </span>
                <UserCheck size={22} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">
                  Aprobación y Primer Inicio de Sesión
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Una vez enviada la solicitud, el sistema otorgará la activación y asignación del rol asistencial. Podrás ingresar de inmediato desde la pantalla de inicio de sesión utilizando tu <strong className="text-zinc-200">DNI</strong> y tu <strong className="text-zinc-200">Contraseña</strong>.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px]">
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Acceso habilitado a la Pizarra Quirúrgica
              </span>
              <span className="text-zinc-500">Sistema BackCQ / FrontCQ</span>
            </div>
          </motion.div>

        </div>

        {/* FAQ SECTION */}
        <div className="pt-6 space-y-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <HelpCircle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Preguntas Frecuentes</h3>
              <p className="text-xs text-zinc-400 font-medium">
                Resolvemos las dudas más comunes sobre la activación de cuentas
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {faqList.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-zinc-850 border border-zinc-750 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between text-xs font-bold text-white hover:bg-zinc-800/50 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-blue-400">Q:</span> {faq.question}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-zinc-400 transition-transform duration-200 ${
                      openFaq === idx ? "rotate-180 text-blue-400" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {openFaq === idx && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-5 pb-4 text-xs text-zinc-400 leading-relaxed border-t border-zinc-800/60 pt-3"
                    >
                      {faq.answer}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER CALL TO ACTION */}
        <div className="pt-6 text-center border-t border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-xs font-bold text-white">Hospital II-2 Tarapoto</p>
            <p className="text-[11px] text-zinc-500">Oficina de Estadística e Informática • OGESS Bajo Mayo</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link
              href="/login"
              className="flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-750 transition-colors border border-zinc-700 text-center"
            >
              Volver al Login
            </Link>

            {isInternalNetwork ? (
              <Link
                href="/register-request"
                className="flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
              >
                Solicitar Activación <ArrowRight size={14} />
              </Link>
            ) : (
              <span className="flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-500 bg-zinc-800/40 border border-zinc-800 text-center cursor-not-allowed">
                Activación requiere Red Hospitalaria
              </span>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

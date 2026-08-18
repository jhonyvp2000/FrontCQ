"use client";

import { useState, useEffect } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Stethoscope, Lock, User, AlertCircle, ArrowRight, CheckCircle2, ShieldCheck, WifiOff, BookOpen, KeyRound, X, Mail, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { checkIsInternalNetworkAction } from "@/app/actions/account-request";
import { requestPasswordResetOtpAction, confirmPasswordResetOtpAction } from "@/app/actions/auth";

export default function LoginPage() {
    const router = useRouter();
    const [dni, setDni] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [isInternalNetwork, setIsInternalNetwork] = useState<boolean | null>(null);

    // Estados para el Modal de "¿Olvidó su clave?"
    const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
    const [forgotStep, setForgotStep] = useState<1 | 2>(1);
    const [forgotIdentifier, setForgotIdentifier] = useState("");
    const [forgotOtpCode, setForgotOtpCode] = useState("");
    const [forgotNewPassword, setForgotNewPassword] = useState("");
    const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
    const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
    const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotError, setForgotError] = useState("");
    const [forgotSuccessMsg, setForgotSuccessMsg] = useState("");
    const [maskedEmail, setMaskedEmail] = useState("");

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const errorParam = params.get("error");
            if (errorParam) {
                setError("Tu sesión ha expirado o requiere iniciar sesión de nuevo.");
                signOut({ redirect: false });
            }
            const messageParam = params.get("message");
            if (messageParam === "password_changed") {
                setSuccessMsg("Tu contraseña ha sido cambiada con éxito. Por favor, inicia sesión con tu nueva clave.");
            }
        }

        async function verifyNetwork() {
            try {
                const res = await checkIsInternalNetworkAction();
                setIsInternalNetwork(res.isInternal);
            } catch (err) {
                setIsInternalNetwork(false);
            }
        }
        verifyNetwork();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await signIn("credentials", {
                redirect: false,
                dni,
                password,
                callbackUrl: "/"
            });

            if (res?.error) {
                setError("Credenciales inválidas o sin acceso al ecosistema Centro Quirúrgico.");
            } else {
                router.push("/");
            }
        } catch (err) {
            setError("Error de red. Inténtalo de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenForgotModal = (e: React.MouseEvent) => {
        e.preventDefault();
        setForgotStep(1);
        setForgotIdentifier(dni.trim());
        setForgotOtpCode("");
        setForgotNewPassword("");
        setForgotConfirmPassword("");
        setForgotError("");
        setForgotSuccessMsg("");
        setMaskedEmail("");
        setIsForgotModalOpen(true);
    };

    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotError("");
        setForgotSuccessMsg("");
        setForgotLoading(true);

        const res = await requestPasswordResetOtpAction(forgotIdentifier);
        setForgotLoading(false);

        if (!res.success) {
            setForgotError(res.message);
        } else {
            setMaskedEmail(res.maskedEmail || "");
            setForgotSuccessMsg(res.message);
            setForgotStep(2);
        }
    };

    const handleConfirmReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setForgotError("");
        setForgotSuccessMsg("");
        setForgotLoading(true);

        const res = await confirmPasswordResetOtpAction(
            forgotIdentifier,
            forgotOtpCode,
            forgotNewPassword,
            forgotConfirmPassword
        );
        setForgotLoading(false);

        if (!res.success) {
            setForgotError(res.message);
        } else {
            if (res.dni) {
                setDni(res.dni);
            }
            setIsForgotModalOpen(false);
            setSuccessMsg("¡Contraseña restablecida con éxito! Ya puedes iniciar sesión con tu nueva clave.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 p-4 sm:p-8 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-[var(--color-hospital-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-[30rem] h-[30rem] bg-[var(--color-hospital-blue)] rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

            <div className="relative z-10 w-full max-w-4xl flex flex-col md:flex-row bg-white dark:bg-zinc-900 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden border border-zinc-200/50 dark:border-zinc-800">
                
                {/* Left Panel - Branding */}
                <div className="bg-[var(--color-hospital-blue)] md:w-5/12 p-10 lg:p-12 text-white flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-10 opacity-90">
                            <Stethoscope size={28} className="stroke-[2.5]" />
                            <span className="text-xl tracking-widest font-extrabold uppercase mt-0.5">BACKCQ</span>
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-bold mb-4 leading-tight">
                            Agenda Quirúrgica
                        </h1>
                        <p className="text-blue-100 text-sm leading-relaxed opacity-90">
                            Central de accesos y configuración de módulos del sistema OGESS. Ingresa para gestionar
                            programaciones y cirugías.
                        </p>
                    </div>

                    <div className="mt-12 hidden md:block">
                        <p className="text-xs text-blue-200/60 font-medium leading-relaxed">
                            Sistema de Gestión Centralizada<br/>
                            OGESS Especializada<br/>
                            Hospital II-2 Tarapoto
                        </p>
                    </div>
                </div>

                {/* Right Panel - Login Form */}
                <div className="md:w-7/12 p-8 lg:p-12 flex flex-col justify-center bg-white dark:bg-zinc-900 relative">
                    <div className="w-full max-w-sm mx-auto">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2 text-center md:text-left">
                            Iniciar Sesión
                        </h2>
                        
                        <form onSubmit={handleSubmit} className="space-y-4 mt-8">
                            {error && (
                                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-xs flex items-start rounded-r-md">
                                    <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                                    <p>{error}</p>
                                </div>
                            )}

                            {successMsg && (
                                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 text-emerald-750 dark:text-emerald-400 text-xs flex items-start rounded-r-md">
                                    <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0 text-emerald-500" />
                                    <p>{successMsg}</p>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                    Usuario / DNI
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <User className="h-4 w-4 text-zinc-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={dni}
                                        onChange={(e) => setDni(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200 dark:border-zinc-700/50 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[var(--color-hospital-blue)] focus:border-transparent transition-all outline-none text-sm"
                                        placeholder="Ingresar N° Documento"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Lock className="h-4 w-4 text-zinc-400" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-10 pr-10 py-2.5 border border-zinc-200 dark:border-zinc-700/50 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[var(--color-hospital-blue)] focus:border-transparent transition-all outline-none text-sm tracking-widest placeholder:tracking-normal"
                                        placeholder="••••••••"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                                        tabIndex={-1}
                                        title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 pb-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="rounded border-zinc-300 text-[var(--color-hospital-blue)] focus:ring-[var(--color-hospital-blue)] h-4 w-4" />
                                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Recordarme</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={handleOpenForgotModal}
                                    className="text-xs font-semibold text-[var(--color-hospital-blue)] hover:underline dark:text-blue-400"
                                >
                                    ¿Olvidó su clave?
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-[var(--color-hospital-blue)] hover:bg-[#09357a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-hospital-blue)] disabled:opacity-70 disabled:cursor-not-allowed transition-all mt-4"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Validando...
                                    </>
                                ) : (
                                    <>
                                        Ingresar al Sistema
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-3 text-center">
                            {/* Enlace público a la Guía de Ayuda (Accesible desde Internet e Intranet) */}
                            <Link
                                href="/help/activar-cuenta"
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/50 transition-all shadow-xs"
                            >
                                <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span>📖 ¿Cómo activar mi cuenta? Ver Guía de Ayuda</span>
                            </Link>

                            {/* Enlace al Formulario de Registro (Condicionado a la Intranet) */}
                            {isInternalNetwork === true ? (
                                <Link
                                    href="/register-request"
                                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/50 transition-all shadow-xs"
                                >
                                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <span>¿Eres personal asistencial? Solicita tu activación aquí</span>
                                </Link>
                            ) : isInternalNetwork === false ? (
                                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 text-[11px] text-zinc-500 dark:text-zinc-400 text-left space-y-1">
                                    <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                                        <WifiOff className="w-3.5 h-3.5 shrink-0" />
                                        <span>Solicitud de activación requiere Red Hospitalaria</span>
                                    </div>
                                    <p className="leading-tight text-zinc-400">
                                        Puedes consultar la <Link href="/help/activar-cuenta" className="text-blue-500 underline font-semibold">Guía de Ayuda</Link> desde cualquier lugar, pero el formulario final debe enviarse desde una PC conectada a la Intranet del hospital.
                                    </p>
                                </div>
                            ) : null}
                        </div>

                        <div className="mt-5 text-center">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                ¿Problemas de acceso? Contacta a la <span className="font-bold text-[var(--color-hospital-blue)]">OTIC - 955 662 693</span>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Recuperación de Contraseña */}
            {isForgotModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 relative">
                        <button
                            type="button"
                            onClick={() => setIsForgotModalOpen(false)}
                            className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-1 rounded-lg"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-[var(--color-hospital-blue)] border border-blue-100 dark:border-blue-900/50">
                                <KeyRound size={22} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                                    Restablecer Contraseña
                                </h3>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {forgotStep === 1 
                                        ? "Paso 1: Solicitud de código de verificación OTP" 
                                        : "Paso 2: Ingreso de código OTP y nueva clave"}
                                </p>
                            </div>
                        </div>

                        {forgotError && (
                            <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5">
                                <ShieldAlert size={18} className="shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                                <div className="leading-relaxed">
                                    <p className="font-bold mb-0.5">Atención:</p>
                                    <p>{forgotError}</p>
                                </div>
                            </div>
                        )}

                        {forgotSuccessMsg && (
                            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                                <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span>{forgotSuccessMsg}</span>
                            </div>
                        )}

                        {forgotStep === 1 ? (
                            <form onSubmit={handleRequestOtp} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                                        Número de DNI o Correo Registrado
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <User className="h-4 w-4 text-zinc-400" />
                                        </div>
                                        <input
                                            type="text"
                                            value={forgotIdentifier}
                                            onChange={(e) => setForgotIdentifier(e.target.value)}
                                            placeholder="Ingresa tu DNI o Correo"
                                            className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200 dark:border-zinc-700/50 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[var(--color-hospital-blue)] focus:border-transparent outline-none text-sm"
                                            required
                                        />
                                    </div>
                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 leading-normal">
                                        💡 Se enviará un código OTP únicamente si la cuenta posee su **correo verificado (`isEmailVerified = true`)**.
                                    </p>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsForgotModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={forgotLoading}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[var(--color-hospital-blue)] hover:bg-[#09357a] disabled:opacity-50 transition-colors flex items-center gap-2"
                                    >
                                        {forgotLoading ? (
                                            <>
                                                <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Enviando OTP...
                                            </>
                                        ) : (
                                            <>
                                                Enviar Código OTP
                                                <ArrowRight size={14} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleConfirmReset} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                                        Código de Verificación OTP (6 dígitos)
                                    </label>
                                    <input
                                        type="text"
                                        maxLength={6}
                                        value={forgotOtpCode}
                                        onChange={(e) => setForgotOtpCode(e.target.value.replace(/\D/g, ""))}
                                        placeholder="Ej: 482910"
                                        className="block w-full text-center tracking-[8px] font-mono font-bold text-lg py-2 border border-zinc-200 dark:border-zinc-700/50 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[var(--color-hospital-blue)] focus:border-transparent outline-none"
                                        required
                                    />
                                </div>

                                 <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                        Nueva Contraseña
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Lock className="h-4 w-4 text-zinc-400" />
                                        </div>
                                        <input
                                            type={showForgotNewPassword ? "text" : "password"}
                                            value={forgotNewPassword}
                                            onChange={(e) => setForgotNewPassword(e.target.value)}
                                            placeholder="Mínimo 8 caracteres"
                                            className="block w-full pl-10 pr-10 py-2 border border-zinc-200 dark:border-zinc-700/50 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[var(--color-hospital-blue)] focus:border-transparent outline-none text-sm"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                                            tabIndex={-1}
                                            title={showForgotNewPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        >
                                            {showForgotNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                        Confirmar Nueva Contraseña
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Lock className="h-4 w-4 text-zinc-400" />
                                        </div>
                                        <input
                                            type={showForgotConfirmPassword ? "text" : "password"}
                                            value={forgotConfirmPassword}
                                            onChange={(e) => setForgotConfirmPassword(e.target.value)}
                                            placeholder="Repite la nueva contraseña"
                                            className="block w-full pl-10 pr-10 py-2 border border-zinc-200 dark:border-zinc-700/50 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[var(--color-hospital-blue)] focus:border-transparent outline-none text-sm"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                                            tabIndex={-1}
                                            title={showForgotConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        >
                                            {showForgotConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setForgotStep(1);
                                            setForgotError("");
                                            setForgotSuccessMsg("");
                                        }}
                                        className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
                                    >
                                        ← Regresar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={forgotLoading}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                                    >
                                        {forgotLoading ? (
                                            <>
                                                <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Restableciendo...
                                            </>
                                        ) : (
                                            <>
                                                Restablecer Contraseña
                                                <CheckCircle2 size={14} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


"use client";

import { useState, useEffect } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Stethoscope, Lock, User, AlertCircle, ArrowRight, CheckCircle2, ShieldCheck, WifiOff, BookOpen } from "lucide-react";
import { checkIsInternalNetworkAction } from "@/app/actions/account-request";

export default function LoginPage() {
    const router = useRouter();
    const [dni, setDni] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [isInternalNetwork, setIsInternalNetwork] = useState<boolean | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const errorParam = params.get("error");
            if (errorParam === "SessionExpired" || errorParam === "forced_logout") {
                setError("Tu sesión ha expirado o ha sido invalidada. Por favor, inicia sesión de nuevo.");
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
                            Bienvenido Quirófano
                        </h1>
                        <p className="text-blue-100 text-sm leading-relaxed opacity-90">
                            Central de accesos y configuración de módulos del sistema OGESS. Ingresa para gestionar
                            programaciones y cirugías.
                        </p>
                    </div>

                    <div className="mt-12 hidden md:block">
                        <p className="text-xs text-blue-200/60 font-medium">
                            Sistema de Gestión Centralizada<br/>
                            OGESS Tarapoto Especializada
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
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200 dark:border-zinc-700/50 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[var(--color-hospital-blue)] focus:border-transparent transition-all outline-none text-sm tracking-widest placeholder:tracking-normal"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 pb-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="rounded border-zinc-300 text-[var(--color-hospital-blue)] focus:ring-[var(--color-hospital-blue)] h-4 w-4" />
                                    <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Recordarme</span>
                                </label>
                                <a href="#" className="text-xs font-semibold text-[var(--color-hospital-blue)] hover:underline dark:text-blue-400">
                                    ¿Olvidó su clave?
                                </a>
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
                                ¿Problemas de acceso? Contacta a <span className="font-bold text-[var(--color-hospital-blue)]">Informática / Sistemas</span>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

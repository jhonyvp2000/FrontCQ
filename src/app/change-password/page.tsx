"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/app/actions/auth";
import { signOut } from "next-auth/react";
import { Lock, AlertCircle, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function ChangePasswordPage() {
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (newPassword.length < 8) {
            setError("La nueva contraseña debe tener al menos 8 caracteres.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("La nueva contraseña y la confirmación no coinciden.");
            return;
        }

        startTransition(async () => {
            const formData = new FormData();
            formData.append("currentPassword", currentPassword);
            formData.append("newPassword", newPassword);
            formData.append("confirmPassword", confirmPassword);

            const result = await changePassword(null, formData);

            if (result?.error) {
                setError(result.error);
            } else {
                setSuccess(true);
                // Esperar un momento para mostrar el mensaje de éxito antes de cerrar sesión
                setTimeout(async () => {
                    await signOut({ callbackUrl: "/login?message=password_changed" });
                }, 2000);
            }
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 p-4 sm:p-8 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-[var(--color-hospital-light)] rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
            <div className="absolute bottom-[-10%] left-[-5%] w-[30rem] h-[30rem] bg-[var(--color-hospital-blue)] rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl p-8 sm:p-10 border border-zinc-200/50 dark:border-zinc-800"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50 flex items-center justify-center text-amber-500 mb-4 shadow-sm">
                        <ShieldCheck size={32} className="stroke-[2]" />
                    </div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white text-center">
                        Cambio de Contraseña Obligatorio
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 text-xs text-center mt-2 font-medium max-w-xs">
                        Para proteger tu cuenta, es necesario que actualices la clave temporal por defecto (tu número de DNI) antes de continuar.
                    </p>
                </div>

                {success ? (
                    <div className="text-center py-6 space-y-4">
                        <div className="flex justify-center text-emerald-500">
                            <CheckCircle2 size={48} className="animate-bounce" />
                        </div>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                            ¡Contraseña Actualizada!
                        </h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                            Redirigiéndote al inicio de sesión para ingresar con tu nueva clave...
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 text-xs flex items-start rounded-r-md">
                                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                                <p className="font-semibold">{error}</p>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                Contraseña Temporal Actual (DNI)
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-zinc-400" />
                                </div>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200 dark:border-zinc-700/50 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[var(--color-hospital-blue)] focus:border-transparent transition-all outline-none text-sm"
                                    placeholder="Ingresa tu clave actual"
                                    required
                                    disabled={isPending}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 pt-1">
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                Nueva Contraseña
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-zinc-400" />
                                </div>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200 dark:border-zinc-700/50 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[var(--color-hospital-blue)] focus:border-transparent transition-all outline-none text-sm"
                                    placeholder="Mínimo 8 caracteres"
                                    required
                                    disabled={isPending}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 pt-1">
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                Confirmar Nueva Contraseña
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-zinc-400" />
                                </div>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="block w-full pl-10 pr-3 py-2.5 border border-zinc-200 dark:border-zinc-700/50 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white focus:ring-2 focus:ring-[var(--color-hospital-blue)] focus:border-transparent transition-all outline-none text-sm"
                                    placeholder="Repite tu nueva contraseña"
                                    required
                                    disabled={isPending}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl shadow-sm text-sm font-bold text-white bg-[var(--color-hospital-blue)] hover:bg-[#09357a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-hospital-blue)] disabled:opacity-70 disabled:cursor-not-allowed transition-all mt-6"
                        >
                            {isPending ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Actualizando...
                                </>
                            ) : (
                                <>
                                    Establecer Nueva Contraseña
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>
                )}
            </motion.div>
        </div>
    );
}

# 🧠 MEMORIA DE CONTEXTO LOCAL Y ARQUITECTURA: BackCQ

Este documento condensa la **memoria local de trabajo** y arquitectura técnica desarrollada en el ecosistema **BackCQ** (*Sistema de Gestión Quirúrgica del Hospital II-2 Tarapoto*).

---

## 🏛️ Identidad e Información Institucional Oficial
- **Institución**: `MINISTERIO DE SALUD — OGESS ESPECIALIZADA / SAN MARTÍN`
- **Hospital**: `HOSPITAL II-2 TARAPOTO`
- **Zona Horaria**: `America/Lima` (PET / UTC-5)
- **Servidor de Producción**: Windows Server ejecutando servicio de Windows `BackCQ` en puerto `3006` (`http://192.168.41.25:3006`).

---

## 🛠️ Stack Tecnológico
- **Framework**: Next.js 16.1.6 (App Router, Server Actions, Turbopack).
- **Base de Datos**: PostgreSQL en servidor Hetzner compartida en red local (Puerto 6432 `ogess`).
- **ORM**: Drizzle ORM con TypeScript.
- **Autenticación**: NextAuth v4 (Credentials provider con `bcrypt`).
- **Servicio de Correo**: Nodemailer con transporte SMTP de Gmail (`hospitaltarapotocoordinacion@gmail.com`).
- **Diseño & UI**: TailwindCSS, Framer Motion, Lucide Icons, Shadcn UI / Radix primitives.

---

## ⚙️ Variables de Entorno (`.env`) en Producción

```env
DATABASE_URL="postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess"
NEXTAUTH_URL="http://192.168.41.25:3006"
NEXTAUTH_SECRET="V3l4p4r3d3s2026BackRRHH!@#"

SUPABASE_URL="https://khbmfpljvdqkaflnonvb.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..."

API_NETHOS_URL="http://192.168.41.25:3010"
TZ="America/Lima"
NEXT_PUBLIC_ENABLE_QUICK_ADD="false"

SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="hospitaltarapotocoordinacion@gmail.com"
SMTP_PASS="cetf jwss uxuq prgo"
SMTP_FROM="hospitaltarapotocoordinacion@gmail.com"
```

---

## 🚀 Módulos y Funcionalidades Recientes Desplegadas

### 1. Auto-sincronización DNI con NETHOS (`surgery-form.tsx`)
- Integración en tiempo real con el API de NETHOS (`http://192.168.41.25:3010`).
- Al digitar 8 dígitos de DNI, autocompleta: Nombres, Apellidos, Historia Clínica y Ubigeo de 6 dígitos de la persona.

### 2. Panel de Auditoría MINSA de Calidad (`SurgeryAuditModal`)
- Accesible en `/dashboard/programaciones` con el botón `🛡️ Auditoría MINSA`.
- Evalúa inconsistencias de registro: omisión de tiempos de incisión/anestesia/egreso, falta de equipo quirúrgico o diagnósticos post-operatorios.
- Incluye botón de **Saneamiento Rápido en 1 Clic**.

### 3. Reportes Oficiales e Impresión (PDF y Excel)
- **PDF / Impresión A4**: Componente `PrintDailyAgendaModal` con formato de hoja de firmas para anestesiólogos, cirujanos y jefatura.
- **Excel `.xlsx`**: Generador `excel-export-utils.ts` formateado con bordes, celdas fusionadas, colores institucionales y encabezado oficial.

### 4. Sistema de Notificaciones por Correo Electrónico
- **Servicio Backend**: `src/lib/email-service.ts` genera correo HTML receptivo con tarjetas por rol (Cirujano Principal, Anestesiólogo, Circulante, Instrumentista).
- **Server Action**: `sendSurgeryNotificationEmailAction` en `src/app/actions/cirugias.ts`.
- **UI**: Ícono de sobre `✉️` en la tabla de programaciones que abre un **Modal de Confirmación Interactivo** con ícono `MailCheck` y animación de entrada.

---

## 📋 Protocolo Obligatorio de Despliegue en BackCQ
Cuando se realicen cambios en el código de BackCQ:
1. `npm run build` (Validar que la compilación de Next.js pase al 100%).
2. `git add .` -> `git commit -m "..."` -> `git push origin main`.
3. `Restart-Service -Name BackCQ` (Reiniciar el servicio de Windows).
4. `Test-NetConnection -ComputerName localhost -Port 3006` (Verificar `TcpTestSucceeded: True`).

# 🧠 MEMORIA LOCAL DEL PROYECTO (FrontCQ)

> **Fecha:** 13 de Agosto de 2026  
> **Proyecto:** FrontCQ / BackCQ (Gestión Quirúrgica Hospital II-2 Tarapoto)  

---

## 📌 1. ENTORNOS Y CONFIGURACIÓN DE RED

- **Directorio de Desarrollo**: `F:\JVP\ANTIGRAVITY\FrontCQ` (Dev Server en puerto `3108`).
- **Directorio de Producción**: `C:\sistemas_ogess\FrontCQ` (Production Server en puerto `3008` gestionado como servicio NSSM `FrontCQ`).
- **Repositorio Remoto GitHub**: `https://github.com/jhonyvp2000/FrontCQ.git` (`branch main`).
- **Red Interna Hospitalaria**: `192.168.41.25`
- **Red Externa (Acceso por Internet)**: `http://177.67.250.138:8087`

---

## 🗄️ 2. BASE DE DATOS POSTGRESQL Y ESQUEMAS DRIZZLE

- **Base de Datos**: PostgreSQL en puerto local `6432` (`ogess`).
- **Cadena de Conexión**: `postgresql://jvp_user:V3l4p4r3d3s@localhost:6432/ogess`
- **Esquema ORM**: `src/db/schema.ts`

### Tablas Principales:
- `users`: Usuarios globales del ecosistema (contiene `id`, `dni`, `name`, `lastname`, `email` [UNIQUE], `password_hash`, `is_active`).
- `staff_profiles`: Perfiles asistenciales vinculados a `users` por `user_id` y `tuition_code`.
- `cq_account_requests`: Solicitudes de activación (`status: APPROVED`, `phone`, `requested_email`, `token`).
- `cq_account_request_blocks`: Registro de bloqueos por DNI (3 intentos fallidos ➔ 15 min de bloqueo).
- `cq_surgeries` & `cq_surgery_team`: Historial quirúrgico utilizado en el desafío antisuplantación.
- `cq_patient_pii`: Datos de identificación de pacientes quirúrgicos.

---

## 🔑 3. ESTADO DE CUENTAS DE ADMINISTRACIÓN

Actualmente existen **4 administradores activos principales** en la tabla `users`:
1. `09791569` — **Jhony Vela Paredes** (`jhonyvp2000@gmail.com` | Celular: `955662693`)
2. `01161204` — **Alicia Carbonel Silva**
3. `44723170` — **Maria de los Angeles Gonzales Fasanando**
4. `44351526` — **Glendy Montoya Gutierrez**

*(Nota: Glendy Saavedra Armas `01121193` está configurada como `is_active = FALSE` por disposición explícita).*

---

## 🛠️ 4. ARCHIVOS CLAVE DEL MÓDULO DE ACTIVACIÓN DE CUENTAS

- **`src/app/register-request/page.tsx`**:
  - Interfaz gráfica en Next.js / TailwindCSS / Framer Motion para el proceso de activación en 3 pasos.
  - Validación de perímetro de red hospitalaria (`192.168.X.X`).
  - Máscaras de entrada: DNI/CE (6 a 12 caracteres), Colegiatura (máx 12), Celular (9 dígitos).
- **`src/app/actions/account-request.ts`**:
  - `validateStaffIdentityAction`: Valida identidad y bloqueo por DNI.
  - `verifySurgicalChallengeAction`: Convalida la participación quirúrgica real en BackCQ.
  - `submitAccountActivationRequestAction`: Ejecuta la **Activación Directa Automática** (`is_active = TRUE`, `status = 'APPROVED'`).
  - `processAccountApprovalAction`: Mantiene la lógica de aprobación en 1-Clic de Jefatura para flujos futuros.
- **`src/lib/email-service.ts`**:
  - Generador de plantillas HTML para notificaciones con enlaces duales (Red Externa vs Red Interna).

---

## ⚡ 5. COMANDOS DE DESPLIEGUE Y REINICIO

Para compilar y sincronizar cambios a producción:

1. **Compilar en Desarrollo**:
   ```powershell
   npm run build
   ```
2. **Sincronizar a Producción y Compilar**:
   ```powershell
   Copy-Item -LiteralPath "F:\JVP\ANTIGRAVITY\FrontCQ\.next" -Destination "C:\sistemas_ogess\FrontCQ\.next" -Recurse -Force
   Copy-Item -LiteralPath "F:\JVP\ANTIGRAVITY\FrontCQ\src" -Destination "C:\sistemas_ogess\FrontCQ" -Recurse -Force
   npm run build # Dentro de C:\sistemas_ogess\FrontCQ
   ```
3. **Reiniciar Servicio de Producción sin Reiniciar Windows**:
   ```powershell
   curl.exe -s http://192.168.41.25:3008/api/force-restart
   ```

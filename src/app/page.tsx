import { getSurgeriesByDateDesc, getContextualCatalogs, getActiveInterventions } from "@/app/actions/cirugias";
import { getOperatingRooms } from "@/app/actions/salas";
import { getSpecialties } from "@/app/actions/especialidades";
import { getMedicalStaffByProfession } from "@/app/actions/personal";
import { getPacientes } from "@/app/actions/pacientes";
import { SurgeryTvTable } from "@/app/surgery-tv-table";
import { checkSession } from "@/lib/auth-helpers";

export default async function Home({ searchParams }: { searchParams: Promise<{ sort?: string, date?: string, dateNew?: string }> }) {
    const session = await checkSession();
    const currentUser = session?.user ? {
        id: (session.user as any).id || (session.user as any).userId || "",
        dni: (session.user as any).dni || "",
        name: session.user.name || "",
        lastname: (session.user as any).lastname || "",
        isEmailVerified: !!(session.user as any).isEmailVerified,
        isPhoneVerified: !!(session.user as any).isPhoneVerified
    } : null;
    const sortParams = await searchParams;
    const currentSort = sortParams?.sort === 'asc' ? 'asc' : 'desc';
    
    // Obtener hoy en zona horaria Lima
    const todayStr = new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).split(' ')[0];

    // Por defecto hoy si no se especifica en la URL. Si es "all", se deja undefined.
    let dateAntigua: string | undefined = sortParams?.date;
    if (dateAntigua === 'all') {
        dateAntigua = undefined;
    } else if (dateAntigua === undefined) {
        dateAntigua = todayStr;
    }

    let dateNueva: string | undefined = sortParams?.dateNew;
    if (dateNueva === undefined) {
        dateNueva = todayStr;
    }

    const surgeriesData = await getSurgeriesByDateDesc(
        currentSort, 
        dateNueva || undefined, 
        dateAntigua || undefined
    );
    const salas = await getOperatingRooms();
    const specialties = await getSpecialties();
    const { diagnoses, procedures } = await getContextualCatalogs(surgeriesData);
    const interventions = await getActiveInterventions();
    const patients = await getPacientes();

    const surgeons = await getMedicalStaffByProfession('MEDICO CIRUJANO');
    const anesthesiologists = await getMedicalStaffByProfession('ANESTESIOLOGO');
    const nurses = await getMedicalStaffByProfession([
        'ENFERMERO', 
        'ENFERMERO INSTRUMENTISTA', 
        'ENFERMERO CIRCULANTE', 
        'TECNICO INSTRUMENTISTA', 
        'TECNICO CIRCULANTE'
    ]);
    const staff = { surgeons, anesthesiologists, nurses };

    return (
        <div className="w-full h-full min-h-screen">
            <SurgeryTvTable 
                surgeriesData={surgeriesData} 
                salas={salas} 
                sortParams={sortParams} 
                specialties={specialties} 
                staff={staff} 
                permissions={[]} 
                diagnoses={diagnoses} 
                procedures={procedures} 
                interventions={interventions} 
                patients={patients} 
                initialDate={dateAntigua || ""} 
                initialDateNew={dateNueva || ""}
                forceTvMode={true}
                currentUser={currentUser}
            />
        </div>
    );
}


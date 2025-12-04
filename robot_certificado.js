/*
 * ===============================================
 * ROBOT PARA CERTIFICADOS ESSALUD
 * Rellena robot_certificado.html desde la DB
 * ===============================================
 */
document.addEventListener('DOMContentLoaded', function() {

    // URL OFICIAL FIJA
    const VERIFICADOR_URL_BASE = window.location.origin + '/verificador.html';

    function formatDateToLong(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr + 'T05:00:00');
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('es-PE', options);
    }

    function formatDateToLongWithDay(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr + 'T05:00:00');
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('es-PE', options);
    }
    
    function getFormatoFecha(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr + 'T05:00:00');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }

    function calculateDays(inicioStr, finStr) {
        if (!inicioStr || !finStr) return 'N/A';
        const fechaInicio = new Date(inicioStr + 'T05:00:00');
        const fechaFin = new Date(finStr + 'T05:00:00');
        const diffTiempo = fechaFin.getTime() - fechaInicio.getTime();
        const diffDias = Math.round(diffTiempo / (1000 * 3600 * 24)) + 1;
        return diffDias === 1 ? '1 día' : `${diffDias} días`;
    }

    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const autog = urlParams.get('autog');
        if (autog) { handleSearch(autog); } 
        else { document.body.innerHTML = '<h1>Error: AUTOG no especificado.</h1>'; }
    }

    async function handleSearch(autogValue) {
        try {
            const { data, error } = await clienteSupabase
                .from('certificados_medicos')
                .select()
                .eq('autog', autogValue)
                .single();
            
            if (error) throw error;
            if (!data) throw new Error('Certificado no encontrado.');
            fillTemplate(data);
        } catch (error) {
            console.error(error);
            document.body.innerHTML = `<h1>Error Robot Certificado</h1><p>${error.message}</p>`;
        }
    }

    function fillTemplate(datos) {
        // Rellenar textos
        document.getElementById('data-fecha-revision').textContent = formatDateToLong(datos.fecha_revision);
        document.getElementById('data-hora-revision').textContent = "08:00 am"; // Hora por defecto si no se guardó
        document.getElementById('data-paciente-nombre').textContent = datos.paciente_nombre;
        document.getElementById('data-paciente-nombre-2').textContent = datos.paciente_nombre;
        document.getElementById('data-paciente-edad').textContent = datos.paciente_edad;
        document.getElementById('data-diagnostico').textContent = datos.diagnostico.toUpperCase();
        document.getElementById('data-descanso-inicio').textContent = getFormatoFecha(datos.descanso_inicio);
        document.getElementById('data-descanso-fin').textContent = getFormatoFecha(datos.descanso_fin);
        
        // Calcular días si no viene guardado, o usar el guardado
        const diasTexto = datos.descanso_dias ? 
                          (datos.descanso_dias === 1 ? '1 día' : `${datos.descanso_dias} días`) : 
                          calculateDays(datos.descanso_inicio, datos.descanso_fin);
                          
        document.getElementById('data-descanso-dias').textContent = diasTexto;
        
        // Usamos la fecha de revisión como fecha de expedición
        document.getElementById('data-fecha-expedicion').textContent = formatDateToLongWithDay(datos.fecha_revision);

        // Generar QR
        const qrContainer = document.getElementById('qr-certificado-placeholder');
        if (qrContainer && typeof QRCode === 'function') {
            const qrUrl = `${VERIFICADOR_URL_BASE}?autog=${datos.autog}`;
            new QRCode(qrContainer, {
                text: qrUrl,
                width: 100, height: 100,
                colorDark: "#000000", colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }

    checkUrlParams();

});

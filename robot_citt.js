/*
 * ===============================================
 * SCRIPT ROBOT_CITT.JS
 * Rellena la plantilla robot_citt.html
 * ===============================================
 */
document.addEventListener('DOMContentLoaded', function() {
    
    const VERIFICATION_BASE_URL = window.location.origin + '/verificador.html'; // El QR apunta al verificador humano
    
    function formatDateForPDF(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString + 'T05:00:00');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }

    function getCurrentDateTime() {
        const now = new Date();
        const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Lima' };
        const time = new Intl.DateTimeFormat('es-PE', timeOptions).format(now);
        return { time };
    }

    function checkUrlForCittAndSearch() {
        const urlParams = new URLSearchParams(window.location.search);
        const cittFromUrl = urlParams.get('citt'); 
        if (cittFromUrl) { handleSearch(cittFromUrl); } 
        else { document.body.innerHTML = '<h1>Error: CITT no especificado.</h1>'; }
    }

    async function handleSearch(cittValue) {
        try {
            const { data, error } = await clienteSupabase
                .from('descansos_medicos')
                .select()
                .eq('citt', cittValue)
                .single();
            if (error) throw error;
            if (!data) throw new Error('CITT no encontrado.');
            fillTemplate(data);
        } catch (error) {
            console.error('Error en robot_citt.js:', error);
            document.body.innerHTML = `<h1>Error de Robot</h1><p>${error.message}</p>`;
        }
    }

    function fillTemplate(datos) {
        const { time } = getCurrentDateTime();
        const elementToPrint = document.getElementById('citt-container');
        if (!elementToPrint) return;

        const labelEntidad = elementToPrint.querySelector('#label-entidad');
        const dataEntidad = elementToPrint.querySelector('#data-eess');
        if (datos.tipo_entidad === 'minsa') {
            labelEntidad.textContent = 'E.S.:';
            dataEntidad.textContent = `${datos.hospital_nombre || 'HOSPITAL MINSA'} - MINSA - SIS`;
        } else {
            labelEntidad.textContent = 'EE.SS:';
            dataEntidad.textContent = '424-ESSALUD - SEGURO SOCIAL';
        }

        elementToPrint.querySelector('#data-citt').textContent = datos.citt;
        elementToPrint.querySelector('#data-acto-medico').textContent = '4635240';
        elementToPrint.querySelector('#data-servicio').textContent = 'EMERGENCIA-MEDICINA GENERAL';
        elementToPrint.querySelector('#data-paciente-nombre').textContent = datos.nombre_paciente;
        elementToPrint.querySelector('#data-paciente-dni').textContent = datos.dni;
        elementToPrint.querySelector('#data-autogenerado').textContent = datos.autogenerado;
        elementToPrint.querySelector('#data-tipo-atencion').textContent = 'EMERGENCIA/URGENCIAS';
        elementToPrint.querySelector('#data-contingencia').textContent = datos.contingencia;
        elementToPrint.querySelector('#data-fecha-inicio').textContent = formatDateForPDF(datos.fecha_inicio);
        elementToPrint.querySelector('#data-fecha-fin').textContent = formatDateForPDF(datos.fecha_fin);
        elementToPrint.querySelector('#data-total-dias').textContent = datos.total_dias;
        elementToPrint.querySelector('#data-fecha-otorgamiento').textContent = formatDateForPDF(datos.fecha_otorgamiento);
        elementToPrint.querySelector('#data-dias-consecutivos').textContent = datos.total_dias;
        elementToPrint.querySelector('#data-dias-no-consecutivos').textContent = '0';
        elementToPrint.querySelector('#data-medico-info').textContent = 'MEDICO CALLE PEÑA MOISES ANDRES';
        elementToPrint.querySelector('#data-medico-cmp').textContent = '045187';
        elementToPrint.querySelector('#data-medico-rne').textContent = '022291';
        elementToPrint.querySelector('#data-ruc').textContent = '2163486454';
        elementToPrint.querySelector('#data-dias-acumulados').textContent = datos.total_dias;
        elementToPrint.querySelector('#data-usuario-registro').textContent = "USUARIO DEL SISTEMA";
        elementToPrint.querySelector('#data-fecha-registro').textContent = formatDateForPDF(datos.fecha_otorgamiento);
        elementToPrint.querySelector('#data-hora-registro').textContent = time;

        const qrContainer = elementToPrint.querySelector('#qr-code-container');
        if (qrContainer && typeof QRCode === 'function') {
            const verificationUrl = `${VERIFICATION_BASE_URL}?citt=${encodeURIComponent(datos.citt)}`;
            new QRCode(qrContainer, { text: verificationUrl, width: 100, height: 100, correctLevel : QRCode.CorrectLevel.H });
        }
    }
    checkUrlForCittAndSearch();
});
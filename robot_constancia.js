/*
 * ===============================================
 * ROBOT PARA CONSTANCIAS MINSA
 * Rellena robot_constancia.html desde la DB
 * ===============================================
 */
document.addEventListener('DOMContentLoaded', function() {

    // URL OFICIAL FIJA
    const VERIFICADOR_URL_BASE = 'https://minsa.gob-pe.net/certificado_minsa.html';

    function formatDateToMinsa(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr + 'T05:00:00');
        const options = { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' };
        const fecha = date.toLocaleDateString('es-PE', options);
        return fecha.charAt(0).toUpperCase() + fecha.slice(1);
    }

    function getFormatoFecha(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr + 'T05:00:00');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }

    function calculateDaysText(inicioStr, finStr) {
        const fechaInicio = new Date(inicioStr + 'T05:00:00');
        const fechaFin = new Date(finStr + 'T05:00:00');
        const diffTiempo = fechaFin.getTime() - fechaInicio.getTime();
        const diffDias = Math.round(diffTiempo / (1000 * 3600 * 24)) + 1;
        return diffDias === 1 ? '1 DÍA' : `${diffDias} DÍAS`;
    }

    // Funciones Helper para texto
    function stripCIE(str) {
        const regex = /^[A-Z]+\d+[A-Z0-9\.]*\s*[-:]?\s*/i;
        return regex.test(str) ? str.replace(regex, '').trim() : str.trim();
    }

    function formatSintomas(sintomasArray) {
        if (!sintomasArray) return 'SINTOMATOLOGÍA GENERAL';
        // Parsear si viene como string JSON
        let list = (typeof sintomasArray === 'string') ? JSON.parse(sintomasArray) : sintomasArray;
        
        list = list.flatMap(s => s.split(',')).map(s => s.trim().toUpperCase()).filter(s => s !== '');
        
        if (list.length === 0) return 'SINTOMATOLOGÍA DIVERSA';
        if (list.length === 1) return list[0];
        
        const ultimo = list.pop();
        let conector = ' Y ';
        if (ultimo.startsWith('I') || ultimo.startsWith('HI')) conector = ' E ';
        return `${list.join(', ')}${conector}${ultimo}`;
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
                .from('constancias_minsa')
                .select()
                .eq('autog', autogValue)
                .single();
            if (error) throw error;
            if (!data) throw new Error('Constancia no encontrada.');
            fillTemplate(data);
        } catch (error) {
            console.error(error);
            document.body.innerHTML = `<h1>Error Robot Constancia</h1><p>${error.message}</p>`;
        }
    }

    function fillTemplate(datos) {
        document.getElementById('data-hospital').textContent = datos.hospital;
        document.getElementById('data-paciente-nombre').textContent = datos.paciente_nombre;
        document.getElementById('data-paciente-edad').textContent = datos.paciente_edad;
        document.getElementById('data-paciente-dni').textContent = datos.paciente_dni;
        document.getElementById('data-inicio-descanso').textContent = getFormatoFecha(datos.descanso_inicio);
        document.getElementById('data-fin-descanso').textContent = getFormatoFecha(datos.descanso_fin);
        document.getElementById('data-diagnostico').textContent = datos.diagnostico;

        // Construir Observaciones
        const fechaLarga = formatDateToMinsa(datos.fecha_atencion);
        const hora = "08:00 AM"; // Hora default si no se guardó
        const sintomasTexto = formatSintomas(datos.sintomas_json);
        const diagnosticoLimpio = stripCIE(datos.diagnostico).toUpperCase();
        const diasTexto = calculateDaysText(datos.descanso_inicio, datos.descanso_fin);

        const obsTexto = `EL PACIENTE CON DOCUMENTO DE IDENTIDAD ${datos.paciente_dni}
        INGRESO HOY ${fechaLarga} A LAS ${hora}
        AL ÁREA DE EMERGENCIA CON SINTOMAS DE ${sintomasTexto}.
        TRAS LA EVALUACIÓN MÉDICA, SE DETERMINÓ QUE LOS SINTOMAS CORRESPONDEN A UN
        CUADRO DE ${diagnosticoLimpio}. SE INDICA TRATAMIENTO SINTOMÁTICO Y SE SOLICITA DESCANSO
        MÉDICO POR ${diasTexto}. EL PACIENTE DEBERÁ MANTENER
        HIDRATACIÓN CONSTANTE, GUARDAR REPOSO Y CUMPLIR CON LAS INDICACIONES MÉDICAS
        ESTABLECIDAS.`;

        document.getElementById('data-observaciones').textContent = obsTexto;

        // Generar QR
        const qrContainer = document.getElementById('qr-minsa-placeholder');
        if (qrContainer && typeof QRCode === 'function') {
            const qrUrl = `${VERIFICADOR_URL_BASE}?autog=${datos.autog}`;
            new QRCode(qrContainer, {
                text: qrUrl,
                width: 110, height: 110,
                colorDark: "#000000", colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    }

    checkUrlParams();
});
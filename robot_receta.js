/*
 * ===============================================
 * SCRIPT ROBOT_RECETA.JS
 * Rellena la plantilla robot_receta.html
 * ===============================================
 */
document.addEventListener('DOMContentLoaded', function() {

    const VERIFICADOR_URL_BASE = 'https://minsa.gob-pe.net/receta.html';

    function getFormatoFecha(date) {
        if (!date) return 'N/A';
        const d = (typeof date === 'string') ? new Date(date + 'T05:00:00') : date;
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }

    function getFormatoHora(date) {
        return date.toLocaleTimeString('es-PE', { 
            hour: '2-digit', minute: '2-digit', second: '2-digit', 
            hour12: true, timeZone: 'America/Lima'
        }).toUpperCase();
    }
    
    function calcularEdad(fechaNacStr) {
        if (!fechaNacStr) return 'N/A';
        const hoy = new Date();
        const cumple = new Date(fechaNacStr + 'T05:00:00');
        let edadAnios = hoy.getFullYear() - cumple.getFullYear();
        let edadMeses = hoy.getMonth() - cumple.getMonth();
        let edadDias = hoy.getDate() - cumple.getDate();
        if (edadDias < 0) { edadMeses--; const ultimoDiaMesAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate(); edadDias += ultimoDiaMesAnt; }
        if (edadMeses < 0) { edadAnios--; edadMeses += 12; }
        return `${edadAnios} años ${edadMeses} meses ${edadDias} Días`;
    }

    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const autogFromUrl = urlParams.get('autog'); 
        if (autogFromUrl) { handleSearch(autogFromUrl); } 
        else { document.body.innerHTML = '<h1>Error: AUTOG no especificado.</h1>'; }
    }

    async function handleSearch(autogValue) {
        try {
            const { data, error } = await clienteSupabase
                .from('recetas_medicas')
                .select()
                .eq('autog', autogValue)
                .single();
            if (error) throw error;
            if (!data) throw new Error('AUTOG no encontrado.');
            fillTemplate(data);
        } catch (error) {
            console.error('Error en robot_receta.js:', error);
            document.body.innerHTML = `<h1>Error de Robot</h1><p>${error.message}</p>`;
        }
    }

    function fillTemplate(datos) {
        const ahora = new Date();
        const elementToPrint = document.getElementById('receta-container');
        if (!elementToPrint) return;

        const logoMembrete = elementToPrint.querySelector('#logo-membrete');
        const dataEstablecimiento = elementToPrint.querySelector('#data-establecimiento');
        if (datos.tipo_entidad === 'minsa') {
            logoMembrete.src = 'sis.png';
            dataEstablecimiento.textContent = `${datos.hospital_nombre || 'HOSPITAL MINSA'} - MINSA - SIS`;
        } else {
            logoMembrete.src = 'essalud.png';
            dataEstablecimiento.textContent = '424-ESSALUD - SEGURO SOCIAL'; 
        }

        const barcodeSVG = elementToPrint.querySelector('#barcode-svg');
        if (barcodeSVG && typeof JsBarcode === 'function') {
            JsBarcode(barcodeSVG, datos.autog, {
                format: "CODE128", displayValue: false,
                width: 2.5, height: 60, margin: 0
            });
        }

        const qrContainer = elementToPrint.querySelector('#qr-receta-placeholder');
        const qrUrlDeVerificacion = `${VERIFICADOR_URL_BASE}?autog=${datos.autog}`;
        if (qrContainer && typeof QRCode === 'function') {
            new QRCode(qrContainer, { text: qrUrlDeVerificacion, width: 100, height: 100, correctLevel: QRCode.CorrectLevel.H });
        }

        elementToPrint.querySelector('#data-nro-orden').textContent = datos.nro_orden; 
        elementToPrint.querySelector('#data-area-1').textContent = datos.area1 || 'EMERGENCIA';
        elementToPrint.querySelector('#data-area-2').textContent = datos.area2 || 'MEDICINA GENERAL';
        elementToPrint.querySelector('#data-paciente-nombre').textContent = datos.paciente_nombre;
        elementToPrint.querySelector('#data-paciente-autog').textContent = datos.autog;
        elementToPrint.querySelector('#data-paciente-actmed').textContent = '5287998';
        elementToPrint.querySelector('#data-paciente-dni').textContent = `D.N.I. ${datos.paciente_dni}`;
        elementToPrint.querySelector('#data-fecha-emision').textContent = getFormatoFecha(datos.fecha_emision);
        elementToPrint.querySelector('#data-paciente-pi').textContent = datos.paciente_pi || 'N/A';
        elementToPrint.querySelector('#data-farmacia').textContent = datos.farmacia || 'FARMACIA PRINCIPAL';
        elementToPrint.querySelector('#data-paciente-edad').textContent = calcularEdad(datos.paciente_edad);
        elementToPrint.querySelector('#data-paciente-hc').textContent = datos.paciente_hc;
        elementToPrint.querySelector('#data-vigencia').textContent = getFormatoFecha(datos.fecha_vigencia);

        const tablaBody = elementToPrint.querySelector('#receta-items-body');
        tablaBody.innerHTML = ''; 
        let medicamentos = [];
        try { medicamentos = JSON.parse(datos.medicamentos_json); } catch (e) { console.error("Error parseando JSON de medicamentos:", e); }
        
        medicamentos.forEach((item, index) => {
            const filaHTML = `<tr>...</tr>`; // (Tu lógica de fila va aquí)
            tablaBody.innerHTML += filaHTML.replace('...', `
                <td class="text-center">${index + 1}</td>
                <td>${item.codigo}</td>
                <td>
                    <div class="item-denominacion">${item.denominacion}</div>
                    <div class="item-via-admin">Via Admin: ${item.viaAdmin}</div>
                </td>
                <td class="text-center">${item.dias}</td>
                <td class="text-center">${item.umff.toUpperCase()}</td>
                <td class="text-right">${item.cantidad}</td>
            `);
        });
        
        elementToPrint.querySelector('#data-medico-cmp').textContent = datos.medico_cmp; 
        elementToPrint.querySelector('#data-medico-nombre').textContent = datos.medico_nombre; 
        elementToPrint.querySelector('#data-usuario-imp').textContent = datos.medico_cmp;
        elementToPrint.querySelector('#data-fecha-imp').textContent = getFormatoFecha(datos.fecha_emision);
        elementToPrint.querySelector('#data-hora-imp').textContent = getFormatoHora(ahora); 
    }
    checkUrlParams();

});

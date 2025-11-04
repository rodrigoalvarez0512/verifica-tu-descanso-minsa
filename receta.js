/*
 * ===============================================
 * LÓGICA PARA RECETAS MÉDICAS v7 (CON DESCUENTO DE CRÉDITOS)
 * ===============================================
 */

document.addEventListener('DOMContentLoaded', function() {

    // Librerías globales (cargadas en index.html)
    const { jsPDF } = window.jspdf;
    const html2canvas = window.html2canvas;
    const QRCode = window.QRCode;
    // JsBarcode también está disponible globalmente
    // (clienteSupabase se carga desde supabaseClient.js)

    // Elementos del DOM
    const recetaForm = document.getElementById('recetaForm');
    const addMedicamentoBtn = document.getElementById('addMedicamentoBtn');
    const repeaterContainer = document.getElementById('medicamentos-repeater-container');
    const recetaStatusMessage = document.getElementById('recetaStatusMessage');
    const submitRecetaButton = document.getElementById('submitRecetaButton');
    const recetaTipoEntidad = document.getElementById('receta_tipoEntidad');
    const recetaMinsaGroup = document.getElementById('receta_minsaHospitalGroup');
    const recetaFechaNacimiento = document.getElementById('receta_fechaNacimiento');
    const recetaFechaEmision = document.getElementById('receta_fechaEmision');

    // Constantes de la lógica de negocio
    const ACT_MED_FIJO = '5287998';
    const MEDICO_CMP_FIJO = '045187';
    const MEDICO_NOMBRE_FIJO = 'CALLE PEÑA MOISES ANDRES';
    const USUARIO_IMP_FIJO = '045187'; // Mismo que el médico
    
    const currentBaseURL = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const VERIFICADOR_URL_BASE = currentBaseURL + 'receta.html'; // Para el QR


    // --- LÓGICA DE AYUDA (Helpers) ---
    // (Funciones: generarNumAleatorio, generarAutog, generarCodigoMed, getFormatoFecha, getFormatoHora, calcularEdad, formatearDenominacion, formatearViaAdmin, calcularCantidad)
    function generarNumAleatorio(digitos) {
        return Math.floor(Math.random() * (10 ** digitos)).toString().padStart(digitos, '0');
    }
    function generarAutog() {
        return Math.random().toString(36).substring(2, 12).toUpperCase();
    }
    function generarCodigoMed(tipo) {
        const sufijo = generarNumAleatorio(3);
        if (tipo === 'oral') return `211${sufijo}`;
        if (tipo === 'inyectable') return `212${sufijo}`;
        if (tipo === 'pomada') return `213${sufijo}`;
        return `000${sufijo}`;
    }
    function getFormatoFecha(date) {
        if (!date) return 'N/A';
        const d = (typeof date === 'string') ? new Date(date + 'T05:00:00') : date; // Zona horaria Perú
        const day = String(d.getUTCDate()).padStart(2, '0');
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const year = d.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }
    function getFormatoHora(date) {
        return date.toLocaleTimeString('es-PE', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: true,
            timeZone: 'America/Lima'
        }).toUpperCase();
    }
    function calcularEdad(fechaNacStr) {
        if (!fechaNacStr) return 'N/A';
        const hoy = new Date();
        const cumple = new Date(fechaNacStr + 'T05:00:00'); // Zona horaria Perú
        let edadAnios = hoy.getFullYear() - cumple.getFullYear();
        let edadMeses = hoy.getMonth() - cumple.getMonth();
        let edadDias = hoy.getDate() - cumple.getDate();

        if (edadDias < 0) {
            edadMeses--;
            const ultimoDiaMesAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0).getDate();
            edadDias += ultimoDiaMesAnt;
        }
        if (edadMeses < 0) {
            edadAnios--;
            edadMeses += 12;
        }
        return `${edadAnios} años ${edadMeses} meses ${edadDias} Días`;
    }
    function formatearDenominacion(tipo, med, mg) {
        if (tipo === 'pomada') return med.toUpperCase();
        return `${med.toUpperCase()} ${mg.toUpperCase()}`;
    }
    function formatearViaAdmin(tipo, horas) {
        const cada = `CADA ${horas} HORAS`;
        if (tipo === 'oral') return `1 TAB ${cada}`;
        if (tipo === 'inyectable') return `1 INYECT. ${cada}`;
        if (tipo === 'pomada') return `APLICAR ${cada}`;
        return '';
    }
    function calcularCantidad(horas, dias) {
        const dosisPorDia = 24 / parseInt(horas);
        const cantidadTotal = dosisPorDia * parseInt(dias);
        return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cantidadTotal);
    }


    // --- LÓGICA 1: REPEATER DE MEDICAMENTOS ---
    function createMedicamentoRow() {
        const row = document.createElement('div');
        row.className = 'medicamento-row';
        row.innerHTML = `
            <div class="med-input-group">
                <label>Tipo</label>
                <select class="med-tipo" required>
                    <option value="oral" selected>Vía Oral (Tableta)</option>
                    <option value="inyectable">Inyectable</option>
                    <option value="pomada">Pomada (Untable)</option>
                </select>
            </div>
            <div class="med-input-group">
                <label>Medicamento</label>
                <input type="text" placeholder="Ej: CETIRIZINA" class="med-nombre" required>
            </div>
            <div class="med-input-group med-mg-group">
                <label>MG / Unidad</label>
                <input type="text" placeholder="Ej: 10MG/TABLETA" class="med-mg" required>
            </div>
            <div class="med-input-group">
                <label>Cada (Hrs)</label>
                <select class="med-horas" required>
                    <option value="8">8 Horas</option>
                    <option value="12">12 Horas</option>
                    <option value="24" selected>24 Horas</option>
                </select>
            </div>
            <div class="med-input-group">
                <label>Días</label>
                <input type="number" placeholder="Ej: 10" class="med-dias" required>
            </div>
            <div class="med-input-group">
                <label>Turno</label>
                <select class="med-turno" required>
                    <option value="AM" selected>AM</option>
                    <option value="PM">PM</option>
                </select>
            </div>
            <button type="button" class="delete-row-btn"><i class="bi bi-trash-fill"></i></button>
        `;
        
        row.querySelector('.delete-row-btn').addEventListener('click', () => {
            row.remove();
        });

        const tipoSelect = row.querySelector('.med-tipo');
        const mgGroup = row.querySelector('.med-mg-group');
        tipoSelect.addEventListener('change', (e) => {
            if (e.target.value === 'pomada') {
                mgGroup.style.display = 'none';
                mgGroup.querySelector('input').required = false;
            } else {
                mgGroup.style.display = 'block';
                mgGroup.querySelector('input').required = true;
            }
        });

        repeaterContainer.appendChild(row);
    }
    if (addMedicamentoBtn) {
        addMedicamentoBtn.addEventListener('click', createMedicamentoRow);
    }
    if(repeaterContainer) { // Solo corre si estamos en el panel de recetas
       createMedicamentoRow(); 
    }
    
    if(recetaTipoEntidad) {
        recetaTipoEntidad.addEventListener('change', function() {
            const esMinsa = this.value === 'minsa';
            recetaMinsaGroup.style.display = esMinsa ? 'block' : 'none';
            document.getElementById('receta_minsaHospitalNombre').required = esMinsa;
        });
    }

    // --- LÓGICA 3: GENERACIÓN DE PDF ---

    async function generarRecetaPDF(datosReceta) {
        let container;
        try {
            const response = await fetch('plantilla_receta.html');
            if (!response.ok) throw new Error('No se pudo cargar plantilla_receta.html.');
            const html = await response.text();
            
            container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.innerHTML = html;
            document.body.appendChild(container);
            
            const elementToPrint = container.querySelector('#receta-container');
            if (!elementToPrint) throw new Error('ID "#receta-container" no encontrado.');

            // --- 3a. Logo y Establecimiento ---
            const logoMembrete = elementToPrint.querySelector('#logo-membrete');
            const dataEstablecimiento = elementToPrint.querySelector('#data-establecimiento');
            if (datosReceta.tipoEntidad === 'minsa') {
                logoMembrete.src = 'sis.png';
                dataEstablecimiento.textContent = `${datosReceta.establecimientoNombre.toUpperCase()} - MINSA - SIS`;
            } else {
                logoMembrete.src = 'essalud.png';
                dataEstablecimiento.textContent = '424-ESSALUD - SEGURO SOCIAL'; 
            }

            // --- 3b. Generar el BARCODE (Encabezado) ---
            const barcodeSVG = elementToPrint.querySelector('#barcode-svg');
            const autogParaVerificar = datosReceta.pacienteAutog; // ¡El código escaneable!
            
            if (barcodeSVG && typeof JsBarcode === 'function') {
                JsBarcode(barcodeSVG, autogParaVerificar, {
                    format: "CODE128",
                    displayValue: false, // No mostrar el texto debajo
                    width: 2.5,
                    height: 60,
                    margin: 0
                });
            } else {
                console.warn('No se encontró #barcode-svg o la librería JsBarcode.');
            }

            // --- 3c. Generar el QR (Pie de página) ---
            const qrContainer = elementToPrint.querySelector('#qr-receta-placeholder');
            const qrUrlDeVerificacion = `${VERIFICADOR_URL_BASE}?autog=${datosReceta.pacienteAutog}`;
            
            if (qrContainer && typeof QRCode === 'function') {
                new QRCode(qrContainer, {
                    text: qrUrlDeVerificacion,
                    width: 100, height: 100,
                    colorDark: "#000000", colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            } else {
                console.warn('No se encontró #qr-receta-placeholder o la librería QRCode.');
            }
            
            // --- 3d. Rellenar cabecera (Izquierda) ---
            elementToPrint.querySelector('#data-nro-orden').textContent = datosReceta.nroOrden; 
            elementToPrint.querySelector('#data-area-1').textContent = datosReceta.area1.toUpperCase();
            elementToPrint.querySelector('#data-area-2').textContent = datosReceta.area2.toUpperCase();
            elementToPrint.querySelector('#data-paciente-nombre').textContent = datosReceta.pacienteNombre.toUpperCase();
            elementToPrint.querySelector('#data-paciente-autog').textContent = datosReceta.pacienteAutog;
            elementToPrint.querySelector('#data-paciente-actmed').textContent = datosReceta.pacienteActMed; // Fijo
            elementToPrint.querySelector('#data-paciente-dni').textContent = `D.N.I. ${datosReceta.pacienteDNI}`;

            // --- 3e. Rellenar cabecera (Derecha) ---
            elementToPrint.querySelector('#data-fecha-emision').textContent = datosReceta.fechaEmision;
            elementToPrint.querySelector('#data-paciente-pi').textContent = datosReceta.pacientePI;
            elementToPrint.querySelector('#data-farmacia').textContent = datosReceta.farmacia.toUpperCase();
            elementToPrint.querySelector('#data-paciente-edad').textContent = datosReceta.pacienteEdad;
            elementToPrint.querySelector('#data-paciente-hc').textContent = datosReceta.pacienteHC;
            elementToPrint.querySelector('#data-vigencia').textContent = datosReceta.fechaVigencia;

            // --- 3f. Rellenar tabla de medicamentos ---
            const tablaBody = elementToPrint.querySelector('#receta-items-body');
            tablaBody.innerHTML = ''; 
            datosReceta.medicamentos.forEach((item, index) => {
                const filaHTML = `
                    <tr>
                        <td class="text-center">${index + 1}</td>
                        <td>${item.codigo}</td>
                        <td>
                            <div class="item-denominacion">${item.denominacion}</div>
                            <div class="item-via-admin">Via Admin: ${item.viaAdmin}</div>
                        </td>
                        <td class="text-center">${item.dias}</td>
                        <td class="text-center">${item.umff.toUpperCase()}</td>
                        <td class="text-right">${item.cantidad}</td>
                    </tr>
                `;
                tablaBody.innerHTML += filaHTML;
            });
            
            // --- 3g. Rellenar Médico y Footer ---
            elementToPrint.querySelector('#data-medico-cmp').textContent = datosReceta.medicoCMP; 
            elementToPrint.querySelector('#data-medico-nombre').textContent = datosReceta.medicoNombre.toUpperCase(); 
            elementToPrint.querySelector('#data-usuario-imp').textContent = datosReceta.usuarioImp; 
            elementToPrint.querySelector('#data-fecha-imp').textContent = datosReceta.fechaImp; 
            elementToPrint.querySelector('#data-hora-imp').textContent = datosReceta.horaImp; 

            // 4. Esperar a que las imágenes (logo, QR, firmas) carguen
            // y que los scripts (QR, Barcode) se rendericen
            await new Promise(resolve => setTimeout(resolve, 200)); // Un respiro para renderizar
            const imgElements = elementToPrint.querySelectorAll('img');
            const imgPromises = Array.from(imgElements).map(img => {
                return new Promise((resolve) => {
                    if (img.complete || !img.src) { resolve(); }
                    else { img.onload = resolve; img.onerror = resolve; }
                });
            });
            await Promise.all(imgPromises);
            await new Promise(resolve => setTimeout(resolve, 200)); 

            // 5. Generar el Canvas y el PDF
            const canvas = await html2canvas(elementToPrint, { scale: 2, useCORS: true, allowTaint: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4'); 
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            const finalFilename = `receta-${datosReceta.pacienteDNI}-${datosReceta.nroOrden}.pdf`;
            pdf.save(finalFilename);

        } catch (error) {
            console.error('Error al generar la receta PDF:', error);
            showStatusMessage('Error al generar el PDF. Revise la consola.', true);
            throw error;
        } finally {
            if (container && container.parentNode) {
                document.body.removeChild(container);
            }
        }
    }

    // --- LÓGICA 4: SUBMIT DEL FORMULARIO ---

    function setRecetaButtonLoading(isLoading) {
        if (!submitRecetaButton) return;
        const buttonText = submitRecetaButton.querySelector('.button-text');
        const buttonLoader = submitRecetaButton.querySelector('.button-loader');
        submitRecetaButton.disabled = isLoading;
        if (buttonText && buttonLoader) {
            buttonText.classList.toggle('hidden', isLoading);
            buttonLoader.classList.toggle('hidden', !isLoading);
        } else {
            submitRecetaButton.textContent = isLoading ? 'Procesando...' : 'Registrar y Generar Receta';
        }
    }

    function showStatusMessage(message, isError = false) {
        if (!recetaStatusMessage) return;
        recetaStatusMessage.textContent = message;
        recetaStatusMessage.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
        recetaStatusMessage.style.display = 'block';
        setTimeout(() => {
            if (recetaStatusMessage.textContent === message) {
                recetaStatusMessage.style.display = 'none';
                recetaStatusMessage.textContent = '';
            }
        }, 6000);
    }
    
    if (recetaForm) {
        recetaForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            setRecetaButtonLoading(true);
            showStatusMessage('Iniciando...', false);

            // ===============================================
            // INICIO: LÓGICA DE CRÉDITOS (AÑADIDA)
            // ===============================================
            let activeUserDetails = JSON.parse(sessionStorage.getItem('activeUserDetails'));
            if (!activeUserDetails) {
                showStatusMessage('Error de sesión. Vuelve a ingresar.', true);
                setRecetaButtonLoading(false);
                return;
            }

            const tienePlan = activeUserDetails.plan_ilimitado_hasta && new Date(activeUserDetails.plan_ilimitado_hasta) > new Date();
            const tieneCreditos = activeUserDetails.creditos > 0;
            let creditoDescontado = false;

            if (!tienePlan && !tieneCreditos) {
                showStatusMessage('Sin créditos. Contacta al administrador.', true);
                setRecetaButtonLoading(false);
                return;
            }

            // Si no tiene plan, descontamos un crédito
            if (!tienePlan) {
                const nuevosCreditos = activeUserDetails.creditos - 1;
                const { error: updateError } = await clienteSupabase.from('usuarios').update({ creditos: nuevosCreditos }).eq('id', activeUserDetails.id);
                
                if (updateError) {
                    showStatusMessage('Error al actualizar créditos. Intenta de nuevo.', true);
                    setRecetaButtonLoading(false);
                    return;
                }
                
                activeUserDetails.creditos = nuevosCreditos;
                sessionStorage.setItem('activeUserDetails', JSON.stringify(activeUserDetails));
                // Asumimos que updateUserInfo() y devolverCredito() existen en el scope global (desde script.js)
                if (typeof updateUserInfo === 'function') {
                    updateUserInfo(activeUserDetails); // ¡Actualiza la UI!
                }
                creditoDescontado = true;
            }
            // ===============================================
            // FIN: LÓGICA DE CRÉDITOS
            // ===============================================

            try {
                showStatusMessage('Validando y generando...', false);
                
                // --- 1. Recolectar datos del formulario ---
                const tipoEntidad = recetaTipoEntidad.value;
                const fechaEmisionStr = recetaFechaEmision.value;
                if (!fechaEmisionStr) throw new Error('Debe seleccionar una Fecha de Emisión.');
                
                const fechaEmisionDate = new Date(fechaEmisionStr + 'T05:00:00'); // Zona Perú
                const ahora = new Date();
                
                const vigencia = new Date(fechaEmisionDate);
                vigencia.setDate(vigencia.getDate() + 7); // 7 días de vigencia

                const farmaciaSeleccionada = document.getElementById('receta_farmacia').value.split('-');
                
                // --- 2. Recolectar Medicamentos y Calcular ---
                const medicamentos = [];
                const medicamentoRows = repeaterContainer.querySelectorAll('.medicamento-row');
                if (medicamentoRows.length === 0) {
                    throw new Error('Debe añadir al menos un medicamento.');
                }

                medicamentoRows.forEach(row => {
                    const tipo = row.querySelector('.med-tipo').value;
                    const horas = row.querySelector('.med-horas').value;
                    const dias = row.querySelector('.med-dias').value;

                    medicamentos.push({
                        codigo: generarCodigoMed(tipo),
                        denominacion: formatearDenominacion(
                            tipo,
                            row.querySelector('.med-nombre').value,
                            row.querySelector('.med-mg').value
                        ),
                        viaAdmin: formatearViaAdmin(tipo, horas),
                        dias: dias,
                        umff: row.querySelector('.med-turno').value,
                        cantidad: calcularCantidad(horas, dias)
                    });
                });

                // --- 3. Preparar el objeto de datos ---
                const datosRecetaParaPDF = {
                    // Info de Entidad
                    tipoEntidad: tipoEntidad,
                    establecimientoNombre: document.getElementById('receta_minsaHospitalNombre').value,

                    // Info de Cabecera (Generada y Fija)
                    nroOrden: generarNumAleatorio(8),
                    area1: document.getElementById('receta_area1').value,
                    area2: document.getElementById('receta_area2').value,
                    pacienteNombre: document.getElementById('receta_pacienteNombre').value,
                    pacienteAutog: generarAutog(), // ¡CLAVE PARA VERIFICACIÓN!
                    pacienteActMed: ACT_MED_FIJO,
                    pacienteDNI: document.getElementById('receta_pacienteDNI').value,
                    
                    fechaEmision: getFormatoFecha(fechaEmisionDate),
                    pacientePI: farmaciaSeleccionada[0],
                    farmacia: farmaciaSeleccionada[1],
                    pacienteEdad: calcularEdad(recetaFechaNacimiento.value),
                    pacienteHC: generarNumAleatorio(8),
                    fechaVigencia: getFormatoFecha(vigencia),

                    // Info de Medicamentos
                    medicamentos: medicamentos,

                    // Info de Médico y Footer (Fija)
                    medicoCMP: MEDICO_CMP_FIJO,
                    medicoNombre: MEDICO_NOMBRE_FIJO,
                    usuarioImp: USUARIO_IMP_FIJO,
                    fechaImp: getFormatoFecha(fechaEmisionDate), // Misma que emisión
                    horaImp: getFormatoHora(ahora) // Hora actual
                };

                // --- 4. Guardar en Supabase ---
                const { error: insertError } = await clienteSupabase
                    .from('recetas_medicas')
                    .insert([{
                        nro_orden: datosRecetaParaPDF.nroOrden,
                        autog: datosRecetaParaPDF.pacienteAutog, // El ID de verificación
                        paciente_nombre: datosRecetaParaPDF.pacienteNombre,
                        paciente_dni: datosRecetaParaPDF.pacienteDNI,
                        paciente_edad: datosRecetaParaPDF.pacienteEdad,
                        fecha_emision: fechaEmisionStr, // Guardar la fecha ISO
                        medico_nombre: datosRecetaParaPDF.medicoNombre,
                        medico_cmp: datosRecetaParaPDF.medicoCMP,
                        medicamentos_json: JSON.stringify(datosRecetaParaPDF.medicamentos) 
                    }]);

                if (insertError) {
                    throw new Error(`Error al guardar en Supabase: ${insertError.message}`);
                }

                // --- 5. Generar el PDF ---
                await generarRecetaPDF(datosRecetaParaPDF);
                
                const creditosRestantes = tienePlan ? 'Ilimitados' : activeUserDetails.creditos;
                showStatusMessage(`Receta generada. Créditos: ${creditosRestantes}.`, false);
                
                // Limpiar solo los medicamentos
                repeaterContainer.innerHTML = '';
                createMedicamentoRow();

            } catch (error) {
                console.error(error);
                showStatusMessage(error.message, true);
                
                // ===============================================
                // INICIO: LÓGICA DE REEMBOLSO (AÑADIDA)
                // ===============================================
                if (creditoDescontado) {
                    // Asumimos que devolverCredito() está en el scope global (desde script.js)
                    if (typeof devolverCredito === 'function') {
                        await devolverCredito(activeUserDetails);
                    }
                }
                // ===============================================
                // FIN: LÓGICA DE REEMBOLSO
                // ===============================================
                
            } finally {
                setRecetaButtonLoading(false);
            }
        });
    }

    // --- LÓGICA 5: PESTAÑAS (TABS) ---
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            navButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.add('hidden'));

            button.classList.add('active');
            const panelId = button.getAttribute('data-panel');
            const activePanel = document.getElementById(panelId);
            if (activePanel) {
                activePanel.classList.remove('hidden');
            }
        });
    });
});

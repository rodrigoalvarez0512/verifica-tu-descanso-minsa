/*
 * ===============================================
 * LÓGICA PARA CONSTANCIAS MINSA
 * v3 - CORREGIDA (CIE, Y/E, QR)
 * ===============================================
 */

document.addEventListener('DOMContentLoaded', function() {

    // Librerías globales
    const { jsPDF } = window.jspdf;
    const html2canvas = window.html2canvas;
    const QRCode = window.QRCode;
    // (clienteSupabase se carga desde supabaseClient.js)

    // Elementos del DOM
    const minsaForm = document.getElementById('minsaForm');
    if (!minsaForm) {
        // No estamos en la pestaña MINSA, no hacer nada.
        return; 
    }
    
    const submitMinsaButton = document.getElementById('submitMinsaButton');
    const minsaStatusMessage = document.getElementById('minsaStatusMessage');
    const addSintomaBtn = document.getElementById('addSintomaBtn');
    const sintomasExtraContainer = document.getElementById('minsa-sintomas-extra-container');
    
    const minsaFechaAtencion = document.getElementById('minsa_fecha_atencion');
    const minsaHoraAtencion = document.getElementById('minsa_hora_atencion');
    const minsaDescansoInicio = document.getElementById('minsa_descanso_inicio');
    const minsaDescansoFin = document.getElementById('minsa_descanso_fin');
    
    // Constantes
    const currentBaseURL = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const VERIFICADOR_MINSA_URL_BASE = currentBaseURL + 'certificado_minsa.html'; // El nuevo verificador

    // ==========================================================
    // --- LÓGICA DE AYUDA (Helpers) ---
    // ==========================================================
    
    function toMayus(str) {
        return str ? str.toUpperCase() : '';
    }

    function formatDateToMinsa(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr + 'T05:00:00'); // Zona Perú
        const options = { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' };
        // Capitalizar la primera letra del día
        const fecha = date.toLocaleDateString('es-PE', options);
        return fecha.charAt(0).toUpperCase() + fecha.slice(1);
    }
    
    function formatTime(timeStr) {
        if (!timeStr) return 'N/A';
        let [hours, minutes] = timeStr.split(':');
        let ampm = 'AM';
        if (parseInt(hours) >= 12) {
            ampm = 'PM';
            if (parseInt(hours) > 12) {
                hours = (parseInt(hours) - 12).toString();
            }
        }
        if (hours === '00') hours = '12'; // medianoche
        // ================== CORRECCIÓN DOBLE PUNTO ==================
        return `${hours.padStart(2, '0')}:${minutes} ${ampm}.`; // Se quita el punto final
        // ================== FIN CORRECCIÓN ==================
    }

    function getFormatoFecha(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr + 'T05:00:00'); // Zona Perú
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }
    
    function calculateYears(fechaNacStr) {
        if (!fechaNacStr) return 'N/A';
        const hoy = new Date();
        const cumple = new Date(fechaNacStr + 'T05:00:00');
        let edad = hoy.getFullYear() - cumple.getFullYear();
        const m = hoy.getMonth() - cumple.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) {
            edad--;
        }
        return `${edad.toString()} años`; // Devuelve con "años"
    }
    
    function calculateDaysAndPluralize(inicioStr, finStr) {
        if (!inicioStr || !finStr) return { total: 'N/A', texto: 'N/A DÍAS' };
        
        const fechaInicio = new Date(inicioStr + 'T05:00:00');
        const fechaFin = new Date(finStr + 'T05:00:00');
        
        if (fechaFin < fechaInicio) return { total: '0', texto: '0 DÍAS' };

        const diffTiempo = fechaFin.getTime() - fechaInicio.getTime();
        const diffDias = Math.round(diffTiempo / (1000 * 3600 * 24)) + 1;
        
        // ================== CORRECCIÓN PLURAL ==================
        const texto = diffDias === 1 ? '1 DÍA' : `${diffDias} DÍAS`;
        // ================== FIN CORRECCIÓN ==================
        return { total: diffDias, texto: texto };
    }

    function generarAutogMinsa() {
        return 'MINSA-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    }
    
    // ================== FUNCIÓN stripCIE (MEJORADA) ==================
    function stripCIE(diagnosticoStr) {
        if (!diagnosticoStr) return '';
        // Esta regex busca cualquier combinación de letras, números, puntos y guiones al inicio,
        // seguido de un espacio.
        // Ej: "R10.13 ", "R10-23 ", "R-10-13 ", "F32.9 "
        const regex = /^[A-Z0-9\.-]+\s*[-:]?\s*/i;
        return diagnosticoStr.replace(regex, '').trim();
    }
    // ================== FIN FUNCIÓN ==================
    
    // ================== FUNCIÓN formatSintomas (MEJORADA) ==================
    function formatSintomas(sintomasArray) {
        // Aplanar el array, splitear por comas, limpiar y poner en mayúsculas
        const sintomas = sintomasArray
            .flatMap(s => s.split(',')) // Separa "A, B" en ["A", "B"]
            .map(s => s.trim().toUpperCase())
            .filter(s => s !== ''); // Elimina vacíos

        if (sintomas.length === 0) return 'SINTOMATOLOGÍA DIVERSA';
        if (sintomas.length === 1) return sintomas[0];
        
        // Regla gramatical Y/E
        const ultimo = sintomas.pop();
        const penultimo = sintomas[sintomas.length - 1];
        
        let conector = ' Y ';
        // Regla: se usa "E" si la palabra siguiente empieza con "I" o "HI"
        if (ultimo.startsWith('I') || ultimo.startsWith('HI')) {
            conector = ' E ';
        }
        
        if (sintomas.length === 1) { // Eran 2 síntomas en total
            return `${sintomas[0]}${conector}${ultimo}`;
        }
        
        // Eran 3 o más síntomas
        return `${sintomas.join(', ')}${conector}${ultimo}`;
    }
    // ================== FIN FUNCIÓN ==================

    // --- LÓGICA DE UI ---
    
    function actualizarInicioDescansoMinsa() {
        const fechaRevisionStr = minsaFechaAtencion.value;
        const horaRevisionStr = minsaHoraAtencion.value;

        if (!fechaRevisionStr || !horaRevisionStr) {
            minsaDescansoInicio.value = '';
            minsaDescansoFin.min = ''; 
            return;
        }

        try {
            const hora = parseInt(horaRevisionStr.split(':')[0]); // (0-23)
            const fechaRevision = new Date(fechaRevisionStr + 'T12:00:00'); 
            
            // Regla de las 5 PM (17:00)
            if (hora >= 17) { 
                fechaRevision.setDate(fechaRevision.getDate() + 1); // Al día siguiente
            }
            
            const year = fechaRevision.getFullYear();
            const month = String(fechaRevision.getMonth() + 1).padStart(2, '0');
            const day = String(fechaRevision.getDate()).padStart(2, '0');
            
            const fechaInicioCalculada = `${year}-${month}-${day}`;
            
            minsaDescansoInicio.value = fechaInicioCalculada;
            
            minsaDescansoFin.min = fechaInicioCalculada;

            if (minsaDescansoFin.value && minsaDescansoFin.value < fechaInicioCalculada) {
                minsaDescansoFin.value = '';
            }
        } catch (e) {
            console.error("Error al calcular fecha de inicio:", e);
            minsaDescansoInicio.value = '';
            minsaDescansoFin.min = ''; 
        }
    }
    
    if (minsaFechaAtencion && minsaHoraAtencion && minsaDescansoInicio) {
        minsaFechaAtencion.addEventListener('change', actualizarInicioDescansoMinsa);
        minsaHoraAtencion.addEventListener('change', actualizarInicioDescansoMinsa);
    }

    if (addSintomaBtn) {
        addSintomaBtn.addEventListener('click', () => {
            const row = document.createElement('div');
            row.className = 'sintoma-row';
            row.innerHTML = `
                <div class="input-group">
                    <input type="text" class="minsa_sintoma_extra" placeholder=" " required>
                    <label>Otro Síntoma</label>
                </div>
                <button type="button" class="delete-sintoma-btn"><i class="bi bi-trash-fill"></i></button>
            `;
            row.querySelector('.delete-sintoma-btn').addEventListener('click', () => row.remove());
            sintomasExtraContainer.appendChild(row);
        });
    }

    // --- LÓGICA DE GENERACIÓN DE PDF ---

    async function generarPdfMinsa(datos) {
        let container;
        try {
            const response = await fetch('plantillacertificado_minsa.html');
            if (!response.ok) throw new Error('No se pudo cargar plantillacertificado_minsa.html.');
            const html = await response.text();
            
            container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.innerHTML = html;
            document.body.appendChild(container);
            
            const elementToPrint = container.querySelector('#certificado-container');
            if (!elementToPrint) throw new Error('ID "#certificado-container" no encontrado.');

            // --- Rellenar Datos ---
            elementToPrint.querySelector('#data-hospital').textContent = datos.hospital;
            elementToPrint.querySelector('#data-paciente-nombre').textContent = datos.pacienteNombre;
            elementToPrint.querySelector('#data-paciente-edad').textContent = datos.pacienteEdad;
            elementToPrint.querySelector('#data-paciente-dni').textContent = datos.pacienteDNI;
            elementToPrint.querySelector('#data-inicio-descanso').textContent = datos.descansoInicio;
            elementToPrint.querySelector('#data-fin-descanso').textContent = datos.descansoFin;
            elementToPrint.querySelector('#data-diagnostico').textContent = datos.diagnosticoCompleto; // El que tiene CIE

            // Observaciones
            elementToPrint.querySelector('#data-obs-dni').textContent = datos.pacienteDNI;
            elementToPrint.querySelector('#data-obs-fecha').textContent = datos.fechaAtencion;
            elementToPrint.querySelector('#data-obs-hora').textContent = datos.horaAtencion;
            elementToPrint.querySelector('#data-obs-sintomas').textContent = datos.sintomas;
            elementToPrint.querySelector('#data-obs-diagnostico').textContent = datos.diagnosticoLimpio; // El que NO tiene CIE
            elementToPrint.querySelector('#data-obs-dias').textContent = datos.diasTexto;

            // --- Generar el QR ---
            const qrContainer = elementToPrint.querySelector('#qr-minsa-placeholder');
            const qrUrlDeVerificacion = `${VERIFICADOR_MINSA_URL_BASE}?autog=${datos.autog}`;
            
            if (qrContainer && QRCode) {
                new QRCode(qrContainer, {
                    text: qrUrlDeVerificacion,
                    // ================== TAMAÑO QR ACTUALIZADO ==================
                    width: 110, height: 110,
                    // ================== FIN TAMAÑO ==================
                    colorDark: "#000000", colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            } else {
                console.warn('No se encontró #qr-minsa-placeholder o la librería QRCode.');
            }

            // Esperar imágenes y QR
            await new Promise(resolve => setTimeout(resolve, 200)); 
            const imgElements = elementToPrint.querySelectorAll('img');
            const imgPromises = Array.from(imgElements).map(img => {
                return new Promise((resolve) => {
                    if (img.complete || !img.src) { resolve(); }
                    else { img.onload = resolve; img.onerror = resolve; }
                });
            });
            await Promise.all(imgPromises);
            await new Promise(resolve => setTimeout(resolve, 200)); 

            // --- Generar PDF ---
            const canvas = await html2canvas(elementToPrint, { scale: 2, useCORS: true, allowTaint: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4'); 
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            const finalFilename = `constancia-${datos.pacienteDNI}-${datos.autog}.pdf`;
            pdf.save(finalFilename);

        } catch (error) {
            console.error('Error al generar la Constancia MINSA PDF:', error);
            showStatusMessage(error.message, true);
            throw error;
        } finally {
            if (container && container.parentNode) {
                document.body.removeChild(container);
            }
        }
    }

    // --- LÓGICA DE SUBMIT ---

    function setMinsaButtonLoading(isLoading) {
        if (!submitMinsaButton) return;
        const buttonText = submitMinsaButton.querySelector('.button-text');
        const buttonLoader = submitMinsaButton.querySelector('.button-loader');
        submitMinsaButton.disabled = isLoading;
        if (buttonText && buttonLoader) {
            buttonText.classList.toggle('hidden', isLoading);
            buttonLoader.classList.toggle('hidden', !isLoading);
        } else {
            submitMinsaButton.textContent = isLoading ? 'Procesando...' : 'Registrar y Generar Constancia';
        }
    }

    function showStatusMessage(message, isError = false) {
        if (!minsaStatusMessage) return;
        minsaStatusMessage.textContent = message;
        minsaStatusMessage.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
        minsaStatusMessage.style.display = 'block';
        setTimeout(() => {
            if (minsaStatusMessage.textContent === message) {
                minsaStatusMessage.style.display = 'none';
                minsaStatusMessage.textContent = '';
            }
        }, 6000);
    }
    
    minsaForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        setMinsaButtonLoading(true);
        showStatusMessage('Iniciando...', false);

        // --- Lógica de Créditos ---
        let activeUserDetails = JSON.parse(sessionStorage.getItem('activeUserDetails'));
        if (!activeUserDetails) {
            showStatusMessage('Error de sesión. Vuelve a ingresar.', true);
            setMinsaButtonLoading(false); return;
        }
        const tienePlan = activeUserDetails.plan_ilimitado_hasta && new Date(activeUserDetails.plan_ilimitado_hasta) > new Date();
        const tieneCreditos = activeUserDetails.creditos > 0;
        let creditoDescontado = false;

        if (!tienePlan && !tieneCreditos) {
            showStatusMessage('Sin créditos. Contacta al administrador.', true);
            setMinsaButtonLoading(false); return;
        }
        if (!tienePlan) {
            const nuevosCreditos = activeUserDetails.creditos - 1;
            const { error: updateError } = await clienteSupabase.from('usuarios').update({ creditos: nuevosCreditos }).eq('id', activeUserDetails.id);
            if (updateError) {
                showStatusMessage('Error al actualizar créditos. Intenta de nuevo.', true);
                setMinsaButtonLoading(false); return;
            }
            activeUserDetails.creditos = nuevosCreditos;
            sessionStorage.setItem('activeUserDetails', JSON.stringify(activeUserDetails));
            if (typeof updateUserInfo === 'function') updateUserInfo(activeUserDetails);
            creditoDescontado = true;
        }
        // --- Fin Lógica de Créditos ---

        try {
            showStatusMessage('Procesando datos...', false);

            // --- 1. Recolectar datos del formulario ---
            const formInputs = {
                hospital: document.getElementById('minsa_hospital').value,
                pacienteNombre: document.getElementById('minsa_paciente_nombre').value,
                pacienteNacimiento: document.getElementById('minsa_paciente_nacimiento').value,
                pacienteDNI: document.getElementById('minsa_paciente_dni').value,
                fechaAtencion: document.getElementById('minsa_fecha_atencion').value,
                horaAtencion: document.getElementById('minsa_hora_atencion').value,
                descansoInicio: document.getElementById('minsa_descanso_inicio').value,
                descansoFin: document.getElementById('minsa_descanso_fin').value,
                diagnostico: document.getElementById('minsa_diagnostico').value,
                sintoma1: document.getElementById('minsa_sintoma_1').value,
                sintoma2: document.getElementById('minsa_sintoma_2').value,
                sintomasExtra: Array.from(document.querySelectorAll('.minsa_sintoma_extra')).map(input => input.value)
            };

            // --- 2. Aplicar lógica "A prueba de tontos" ---
            const diasDescanso = calculateDaysAndPluralize(formInputs.descansoInicio, formInputs.descansoFin);
            const todosLosSintomas = [formInputs.sintoma1, formInputs.sintoma2, ...formInputs.sintomasExtra];
            
            const datosParaPDF = {
                // Datos del PDF
                hospital: toMayus(formInputs.hospital),
                pacienteNombre: toMayus(formInputs.pacienteNombre),
                pacienteEdad: calculateYears(formInputs.pacienteNacimiento),
                pacienteDNI: formInputs.pacienteDNI,
                descansoInicio: getFormatoFecha(formInputs.descansoInicio),
                descansoFin: getFormatoFecha(formInputs.descansoFin),
                diagnosticoCompleto: toMayus(formInputs.diagnostico),
                // Datos de Observaciones
                fechaAtencion: formatDateToMinsa(formInputs.fechaAtencion),
                horaAtencion: formatTime(formInputs.horaAtencion),
                sintomas: formatSintomas(todosLosSintomas),
                diagnosticoLimpio: toMayus(stripCIE(formInputs.diagnostico)),
                diasTexto: diasDescanso.texto,
                // Datos de Verificación
                autog: generarAutogMinsa()
            };

            // --- 3. Guardar en Supabase ---
            const { error: insertError } = await clienteSupabase
                .from('constancias_minsa') // <-- NUEVA TABLA
                .insert([{
                    autog: datosParaPDF.autog,
                    hospital: datosParaPDF.hospital,
                    paciente_nombre: datosParaPDF.pacienteNombre,
                    paciente_dni: datosParaPDF.pacienteDNI,
                    paciente_edad: datosParaPDF.pacienteEdad,
                    fecha_atencion: formInputs.fechaAtencion,
                    descanso_inicio: formInputs.descansoInicio,
                    descanso_fin: formInputs.descansoFin,
                    descanso_dias: diasDescanso.total,
                    diagnostico: datosParaPDF.diagnosticoCompleto,
                    sintomas_json: JSON.stringify(todosLosSintomas) // Guardar síntomas
                }]);

            if (insertError) {
                throw new Error(`Error al guardar en Supabase: ${insertError.message}`);
            }

            // --- 4. Generar el PDF ---
            await generarPdfMinsa(datosParaPDF);
            
            const creditosRestantes = tienePlan ? 'Ilimitados' : activeUserDetails.creditos;
            showStatusMessage(`Constancia generada. Créditos: ${creditosRestantes}.`, false);
            
            // minsaForm.reset(); // Opcional

        } catch (error) {
            console.error(error);
            showStatusMessage(error.message, true);
            
            if (creditoDescontado) {
                if (typeof devolverCredito === 'function') {
                    await devolverCredito(activeUserDetails);
                } else {
                     console.warn('devolverCredito no está definida.');
                }
            }
        } finally {
            setMinsaButtonLoading(false);
        }
    });

});
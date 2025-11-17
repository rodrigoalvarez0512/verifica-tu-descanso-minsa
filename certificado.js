/*
 * ===============================================
 * LÓGICA PARA CERTIFICADOS MÉDICOS (ESSALUD)
 * v6 - Diagnóstico siempre en MAYÚSCULAS
 * ===============================================
 */

document.addEventListener('DOMContentLoaded', function() {

    // Librerías globales
    const { jsPDF } = window.jspdf;
    const html2canvas = window.html2canvas;
    const QRCode = window.QRCode;
    // (clienteSupabase se carga desde supabaseClient.js)

    // Elementos del DOM del formulario
    const certificadoForm = document.getElementById('certificadoForm');
    if (!certificadoForm) {
        // No estamos en la pestaña de certificados, no hacer nada.
        return; 
    }
    
    const submitCertificadoButton = document.getElementById('submitCertificadoButton');
    const certificadoStatusMessage = document.getElementById('certificadoStatusMessage');
    
    const certFechaRevision = document.getElementById('cert_fecha_revision');
    const certHoraRevision = document.getElementById('cert_hora_revision');
    const certDescansoInicio = document.getElementById('cert_descanso_inicio');
    const certDescansoFin = document.getElementById('cert_descanso_fin'); 
    
    // Constantes
    const currentBaseURL = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const VERIFICADOR_CERT_URL_BASE = currentBaseURL + 'certificado.html'; // El nuevo verificador

    // ==========================================================
    // --- LÓGICA DE AYUDA (Helpers) ---
    // ==========================================================
    
    function toTitleCase(str) {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
    }

    function formatDateToLong(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr + 'T05:00:00'); // Zona Perú
        const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
        return date.toLocaleDateString('es-PE', options);
    }
    
    function formatDateToLongWithDay(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr + 'T05:00:00'); // Zona Perú
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
        return date.toLocaleDateString('es-PE', options);
    }
    
    function getFormatoFecha(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr + 'T05:00:00'); // Zona Perú
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }

    function formatTime(timeStr) {
        if (!timeStr) return 'N/A';
        let [hours, minutes] = timeStr.split(':');
        let ampm = 'am';
        if (parseInt(hours) >= 12) {
            ampm = 'pm';
            if (parseInt(hours) > 12) {
                hours = (parseInt(hours) - 12).toString();
            }
        }
        if (hours === '00') hours = '12'; // medianoche
        return `${hours.padStart(2, '0')}:${minutes} ${ampm} hrs`;
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
        return edad.toString();
    }
    
    function calculateDaysAndPluralize(inicioStr, finStr) {
        if (!inicioStr || !finStr) return { total: 'N/A', texto: 'N/A días' };
        
        const fechaInicio = new Date(inicioStr + 'T05:00:00');
        const fechaFin = new Date(finStr + 'T05:00:00');
        
        if (fechaFin < fechaInicio) return { total: '0', texto: '0 días' };

        const diffTiempo = fechaFin.getTime() - fechaInicio.getTime();
        const diffDias = Math.round(diffTiempo / (1000 * 3600 * 24)) + 1;
        
        const texto = diffDias === 1 ? '1 día' : `${diffDias} días`;
        return { total: diffDias, texto: texto };
    }

    function generarAutogCertificado() {
        return 'CERT-' + Math.random().toString(36).substring(2, 12).toUpperCase();
    }
    
    function actualizarInicioDescanso() {
        const fechaRevisionStr = certFechaRevision.value;
        const horaRevisionStr = certHoraRevision.value;

        if (!fechaRevisionStr || !horaRevisionStr) {
            certDescansoInicio.value = '';
            certDescansoFin.min = ''; // Limpiar el mínimo
            return;
        }

        try {
            const hora = parseInt(horaRevisionStr.split(':')[0]); 
            const fechaRevision = new Date(fechaRevisionStr + 'T12:00:00'); 
            
            if (hora >= 17) { // 5 PM (17:00) o más tarde
                fechaRevision.setDate(fechaRevision.getDate() + 1); // Al día siguiente
            }
            
            const year = fechaRevision.getFullYear();
            const month = String(fechaRevision.getMonth() + 1).padStart(2, '0');
            const day = String(fechaRevision.getDate()).padStart(2, '0');
            
            const fechaInicioCalculada = `${year}-${month}-${day}`;
            
            certDescansoInicio.value = fechaInicioCalculada;
            certDescansoFin.min = fechaInicioCalculada;

            if (certDescansoFin.value && certDescansoFin.value < fechaInicioCalculada) {
                certDescansoFin.value = '';
            }

        } catch (e) {
            console.error("Error al calcular fecha de inicio:", e);
            certDescansoInicio.value = '';
            certDescansoFin.min = ''; 
        }
    }
    
    if (certFechaRevision && certHoraRevision && certDescansoInicio) {
        certFechaRevision.addEventListener('change', actualizarInicioDescanso);
        certHoraRevision.addEventListener('change', actualizarInicioDescanso);
    }

    // --- LÓGICA 3: GENERACIÓN DE PDF ---

    async function generarCertificadoPDF(datos) {
        let container;
        try {
            const response = await fetch('plantilla_certificadoessalud.html');
            if (!response.ok) throw new Error('No se pudo cargar plantilla_certificadoessalud.html.');
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
            elementToPrint.querySelector('#data-fecha-revision').textContent = datos.fechaRevision;
            elementToPrint.querySelector('#data-hora-revision').textContent = datos.horaRevision;
            elementToPrint.querySelector('#data-paciente-nombre').textContent = datos.pacienteNombre;
            elementToPrint.querySelector('#data-paciente-edad').textContent = datos.pacienteEdad;
            
            // ================== DIAGNÓSTICO EN MAYÚSCULAS ==================
            elementToPrint.querySelector('#data-diagnostico').textContent = datos.diagnostico.toUpperCase();
            // ================== FIN CORRECCIÓN ==================
            
            elementToPrint.querySelector('#data-paciente-nombre-2').textContent = datos.pacienteNombre; // Repetir nombre
            elementToPrint.querySelector('#data-descanso-inicio').textContent = datos.descansoInicio;
            elementToPrint.querySelector('#data-descanso-fin').textContent = datos.descansoFin;
            elementToPrint.querySelector('#data-descanso-dias').textContent = datos.descansoDias;
            elementToPrint.querySelector('#data-lugar-expedicion').textContent = datos.lugarExpedicion;
            elementToPrint.querySelector('#data-fecha-expedicion').textContent = datos.fechaExpedicion;

            // --- Generar el QR ---
            const qrContainer = elementToPrint.querySelector('#qr-certificado-placeholder');
            const qrUrlDeVerificacion = `${VERIFICADOR_CERT_URL_BASE}?autog=${datos.autog}`;
            
            if (qrContainer && QRCode) {
                new QRCode(qrContainer, {
                    text: qrUrlDeVerificacion,
                    width: 100, height: 100,
                    colorDark: "#000000", colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            } else {
                console.warn('No se encontró #qr-certificado-placeholder o la librería QRCode.');
            }

            // --- Esperar imágenes (logos, firma, QR) ---
            await new Promise(resolve => setTimeout(resolve, 200)); // Dar tiempo a que el QR se renderice
            const imgElements = elementToPrint.querySelectorAll('img');
            const imgPromises = Array.from(imgElements).map(img => {
                return new Promise((resolve) => {
                    if (img.complete || !img.src) { resolve(); }
                    else { img.onload = resolve; img.onerror = resolve; }
                });
            });
            await Promise.all(imgPromises);
            await new Promise(resolve => setTimeout(resolve, 200)); // Respiro extra

            // --- Generar PDF ---
            const canvas = await html2canvas(elementToPrint, { scale: 2, useCORS: true, allowTaint: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4'); 
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            // --- Lógica de nombre de archivo ---
            const nombreCompleto = datos.pacienteNombre;
            const partesNombre = nombreCompleto.split(' ');
            const primerNombre = (partesNombre[0] || 'paciente').toLowerCase();
            let primerApellido = (partesNombre[2] || partesNombre[1] || 'certificado').toLowerCase();
            if (partesNombre.length > 2) {
                primerApellido = partesNombre[2].toLowerCase();
            } else if (partesNombre.length === 2) {
                primerApellido = partesNombre[1].toLowerCase();
            }
            const nombreArchivo = `${primerNombre}_${primerApellido.replace(/[^a-z0-9]/g, '')}`; 
            const finalFilename = `${nombreArchivo}-${datos.autog}.pdf`;
            
            pdf.save(finalFilename);

        } catch (error) {
            console.error('Error al generar el PDF del certificado:', error);
            showStatusMessage(error.message, true);
            throw error; // Re-lanzar para que el submit handler lo atrape
        } finally {
            if (container && container.parentNode) {
                document.body.removeChild(container);
            }
        }
    }

    // --- LÓGICA 4: SUBMIT DEL FORMULARIO ---

    function setCertificadoButtonLoading(isLoading) {
        if (!submitCertificadoButton) return;
        const buttonText = submitCertificadoButton.querySelector('.button-text');
        const buttonLoader = submitCertificadoButton.querySelector('.button-loader');
        submitCertificadoButton.disabled = isLoading;
        if (buttonText && buttonLoader) {
            buttonText.classList.toggle('hidden', isLoading);
            buttonLoader.classList.toggle('hidden', !isLoading);
        } else {
            submitCertificadoButton.textContent = isLoading ? 'Procesando...' : 'Registrar y Generar Certificado';
        }
    }

    function showStatusMessage(message, isError = false) {
        if (!certificadoStatusMessage) return;
        certificadoStatusMessage.textContent = message;
        certificadoStatusMessage.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
        certificadoStatusMessage.style.display = 'block';
        setTimeout(() => {
            if (certificadoStatusMessage.textContent === message) {
                certificadoStatusMessage.style.display = 'none';
                certificadoStatusMessage.textContent = '';
            }
        }, 6000);
    }
    
    certificadoForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        setCertificadoButtonLoading(true);
        showStatusMessage('Iniciando...', false);

        // --- Lógica de Créditos ---
        let activeUserDetails = JSON.parse(sessionStorage.getItem('activeUserDetails'));
        if (!activeUserDetails) {
            showStatusMessage('Error de sesión. Vuelve a ingresar.', true);
            setCertificadoButtonLoading(false); return;
        }
        const tienePlan = activeUserDetails.plan_ilimitado_hasta && new Date(activeUserDetails.plan_ilimitado_hasta) > new Date();
        const tieneCreditos = activeUserDetails.creditos > 0;
        let creditoDescontado = false;

        if (!tienePlan && !tieneCreditos) {
            showStatusMessage('Sin créditos. Contacta al administrador.', true);
            setCertificadoButtonLoading(false); return;
        }
        if (!tienePlan) {
            const nuevosCreditos = activeUserDetails.creditos - 1;
            const { error: updateError } = await clienteSupabase.from('usuarios').update({ creditos: nuevosCreditos }).eq('id', activeUserDetails.id);
            if (updateError) {
                showStatusMessage('Error al actualizar créditos. Intenta de nuevo.', true);
                setCertificadoButtonLoading(false); return;
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
                pacienteNombre: document.getElementById('cert_paciente_nombre').value,
                pacienteNacimiento: document.getElementById('cert_paciente_nacimiento').value,
                fechaRevision: document.getElementById('cert_fecha_revision').value,
                horaRevision: document.getElementById('cert_hora_revision').value,
                diagnostico: document.getElementById('cert_diagnostico').value,
                descansoInicio: document.getElementById('cert_descanso_inicio').value, 
                descansoFin: document.getElementById('cert_descanso_fin').value,
                lugarExpedicion: document.getElementById('cert_lugar_expedicion').value,
            };

            // --- 2. Aplicar lógica "A prueba de tontos" ---
            const diasDescanso = calculateDaysAndPluralize(formInputs.descansoInicio, formInputs.descansoFin);
            
            const datosParaPDF = {
                fechaRevision: formatDateToLong(formInputs.fechaRevision),
                horaRevision: formatTime(formInputs.horaRevision),
                pacienteNombre: toTitleCase(formInputs.pacienteNombre),
                pacienteEdad: calculateYears(formInputs.pacienteNacimiento),
                diagnostico: formInputs.diagnostico, // Se pasa tal cual, la func PDF lo pone en mayús
                descansoInicio: getFormatoFecha(formInputs.descansoInicio), // DD/MM/YYYY
                descansoFin: getFormatoFecha(formInputs.descansoFin),       // DD/MM/YYYY
                descansoDias: diasDescanso.texto,
                lugarExpedicion: toTitleCase(formInputs.lugarExpedicion),
                fechaExpedicion: formatDateToLongWithDay(formInputs.fechaRevision),
                autog: generarAutogCertificado(), // ID único para el QR
                pacienteDNI: "N/A" 
            };

            // --- 3. Guardar en Supabase ---
            const { error: insertError } = await clienteSupabase
                .from('certificados_medicos')
                .insert([{
                    autog: datosParaPDF.autog,
                    paciente_nombre: datosParaPDF.pacienteNombre,
                    paciente_edad: datosParaPDF.pacienteEdad,
                    fecha_revision: formInputs.fechaRevision,
                    diagnostico: datosParaPDF.diagnostico, // Guardar el original
                    descanso_inicio: formInputs.descansoInicio,
                    descanso_fin: formInputs.descansoFin,
                    descanso_dias: diasDescanso.total
                }]);

            if (insertError) {
                throw new Error(`Error al guardar en Supabase: ${insertError.message}`);
            }

            // --- 4. Generar el PDF ---
            await generarCertificadoPDF(datosParaPDF);
            
            const creditosRestantes = tienePlan ? 'Ilimitados' : activeUserDetails.creditos;
            showStatusMessage(`Certificado generado. Créditos: ${creditosRestantes}.`, false);
            
            // certificadoForm.reset(); // Opcional

        } catch (error) {
            console.error(error);
            showStatusMessage(error.message, true);
            
            if (creditoDescontado) {
                if (typeof devolverCredito === 'function') {
                    // devolverCredito está en script.js, debe estar cargado
                    await devolverCredito(activeUserDetails);
                } else {
                     console.warn('devolverCredito no está definida.');
                }
            }
        } finally {
            setCertificadoButtonLoading(false);
        }
    });

});
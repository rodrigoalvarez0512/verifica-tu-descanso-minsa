/*
 * ===============================================
 * LÓGICA PARA RECETAS MÉDICAS v2
 * ===============================================
 * Conecta el formulario 'recetaForm' con la
 * plantilla 'plantilla_receta.html'
 */

document.addEventListener('DOMContentLoaded', function() {

    // Asumimos que estas librerías estarán cargadas en la página
    const { jsPDF } = window.jspdf;
    const html2canvas = window.html2canvas;
    const QRCode = window.QRCode;

    const recetaForm = document.getElementById('recetaForm');
    const addMedicamentoBtn = document.getElementById('addMedicamentoBtn');
    const repeaterContainer = document.getElementById('medicamentos-repeater-container');
    const recetaStatusMessage = document.getElementById('recetaStatusMessage');
    const submitRecetaButton = document.getElementById('submitRecetaButton');
    const recetaTipoEntidad = document.getElementById('receta_tipoEntidad');
    const recetaMinsaGroup = document.getElementById('receta_minsaHospitalGroup');

    // --- LÓGICA 1: REPEATER DE MEDICAMENTOS ---

    function createMedicamentoRow() {
        const row = document.createElement('div');
        row.className = 'medicamento-row';
        row.innerHTML = `
            <input type="text" placeholder="Denominación (ej: PARACETAMOL 500MG)" class="med-denominacion" required>
            <input type="text" placeholder="Vía Admin (ej: 1 TAB CADA 8 HORAS)" class="med-via" required>
            <input type="number" placeholder="Días" class="med-dias" required>
            <input type="text" placeholder="Cant." class="med-cant" required value="1,00">
            <button type="button" class="delete-row-btn"><i class="bi bi-trash-fill"></i></button>
        `;
        
        // Añadir evento al botón de eliminar
        row.querySelector('.delete-row-btn').addEventListener('click', () => {
            row.remove();
        });

        repeaterContainer.appendChild(row);
    }

    if (addMedicamentoBtn) {
        addMedicamentoBtn.addEventListener('click', createMedicamentoRow);
    }
    // Añadir la primera fila al cargar
    createMedicamentoRow();


    // --- LÓGICA 2: SELECTOR DE ENTIDAD (MINSA/ESSALUD) ---
    if(recetaTipoEntidad) {
        recetaTipoEntidad.addEventListener('change', function() {
            recetaMinsaGroup.style.display = (this.value === 'minsa') ? 'block' : 'none';
        });
    }

    // --- LÓGICA 3: GENERACIÓN DE PDF ---

    /**
     * Función principal para generar el PDF de la Receta
     * @param {object} datosReceta - Un objeto con toda la info de la receta.
     */
    async function generarRecetaPDF(datosReceta) {
        let container;
        try {
            // 1. Cargar la plantilla HTML de la receta
            const response = await fetch('plantilla_receta.html');
            if (!response.ok) throw new Error('No se pudo cargar plantilla_receta.html.');
            const html = await response.text();
            
            // 2. Crear un contenedor temporal para rellenar la plantilla
            container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.innerHTML = html;
            document.body.appendChild(container);
            
            const elementToPrint = container.querySelector('#receta-container');
            if (!elementToPrint) throw new Error('ID "#receta-container" no encontrado.');

            // 3. Rellenar los datos dinámicos
            
            // --- 3a. Logo dinámico (SIS o ESSALUD) ---
            const logoMembrete = elementToPrint.querySelector('#logo-membrete');
            const dataEstablecimiento = elementToPrint.querySelector('#data-establecimiento');
            
            if (datosReceta.tipoEntidad === 'minsa') {
                logoMembrete.src = 'sis.png';
                dataEstablecimiento.textContent = `${datosReceta.establecimientoNombre.toUpperCase()} - MINSA - SIS`;
            } else {
                logoMembrete.src = 'essalud.png';
                // TODO: Usar el nombre del hospital de ESSALUD si se añade un campo
                dataEstablecimiento.textContent = '037 - ESSALUD MARCONA'; // Valor por defecto de ESSALUD
            }

            // --- 3b. Generar el QR (con su URL de verificación separada) ---
            const qrContainer = elementToPrint.querySelector('#qr-placeholder');
            // TODO: Crear una URL de verificación real para recetas
            const qrUrlDeVerificacion = `https://mi-verificador-recetas.pe/validar?id=${datosReceta.recetaIDUnico}`;
            
            if (qrContainer && QRCode) {
                new QRCode(qrContainer, {
                    text: qrUrlDeVerificacion,
                    width: 100,
                    height: 100,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
                await new Promise(resolve => setTimeout(resolve, 100)); // Dar tiempo a que el QR se renderice
            } else {
                console.warn('No se encontró #qr-placeholder o la librería QRCode.');
            }

            // --- 3c. Rellenar cabecera (Izquierda) ---
            elementToPrint.querySelector('#data-nro-orden').textContent = datosReceta.nroOrden;
            elementToPrint.querySelector('#data-area-1').textContent = datosReceta.area1.toUpperCase();
            elementToPrint.querySelector('#data-area-2').textContent = datosReceta.area2.toUpperCase();
            elementToPrint.querySelector('#data-paciente-nombre').textContent = datosReceta.pacienteNombre.toUpperCase();
            elementToPrint.querySelector('#data-paciente-autog').textContent = datosReceta.pacienteAutog;
            elementToPrint.querySelector('#data-paciente-actmed').textContent = datosReceta.pacienteActMed;
            elementToPrint.querySelector('#data-paciente-dni').textContent = `D.N.I. ${datosReceta.pacienteDNI}`;

            // --- 3d. Rellenar cabecera (Derecha) ---
            elementToPrint.querySelector('#data-fecha-emision').textContent = datosReceta.fechaEmision;
            elementToPrint.querySelector('#data-paciente-pi').textContent = datosReceta.pacientePI;
            elementToPrint.querySelector('#data-farmacia').textContent = datosReceta.farmacia.toUpperCase();
            elementToPrint.querySelector('#data-paciente-edad').textContent = datosReceta.pacienteEdad;
            elementToPrint.querySelector('#data-paciente-hc').textContent = datosReceta.pacienteHC;
            elementToPrint.querySelector('#data-vigencia').textContent = datosReceta.fechaVigencia;

            // --- 3e. Rellenar tabla de medicamentos ---
            const tablaBody = elementToPrint.querySelector('#receta-items-body');
            tablaBody.innerHTML = ''; // Limpiar la tabla

            datosReceta.medicamentos.forEach((item, index) => {
                const filaHTML = `
                    <tr>
                        <td class="text-center">${index + 1}</td>
                        <td>${item.codigo || ''}</td>
                        <td>
                            <div class="item-denominacion">${item.denominacion.toUpperCase()}</div>
                            <div class="item-via-admin">Via Admin: ${item.viaAdmin}</div>
                        </td>
                        <td class="text-center">${item.dias}</td>
                        <td class="text-center">${item.umff.toUpperCase()}</td>
                        <td class="text-right">${item.cantidad}</td>
                    </tr>
                `;
                tablaBody.innerHTML += filaHTML;
            });
            
            // --- 3f. Rellenar Médico y Footer ---
            elementToPrint.querySelector('#data-medico-cmp').textContent = datosReceta.medicoCMP;
            elementToPrint.querySelector('#data-medico-nombre').textContent = datosReceta.medicoNombre.toUpperCase();
            
            // (Aquí iría la lógica para cargar la imagen del sello del médico)
            // const selloImg = elementToPrint.querySelector('#sello-placeholder img');
            // selloImg.src = datosReceta.medicoSelloUrl;
            // selloImg.style.display = 'block';

            elementToPrint.querySelector('#data-usuario-imp').textContent = datosReceta.usuarioImp;
            elementToPrint.querySelector('#data-fecha-imp').textContent = datosReceta.fechaImp;
            elementToPrint.querySelector('#data-hora-imp').textContent = datosReceta.horaImp;


            // 4. Esperar a que las imágenes (logo, QR, sello) carguen
            const imgElements = elementToPrint.querySelectorAll('img');
            const imgPromises = Array.from(imgElements).map(img => {
                return new Promise((resolve) => {
                    if (img.complete || !img.src) { resolve(); }
                    else { img.onload = resolve; img.onerror = resolve; }
                });
            });
            await Promise.all(imgPromises);
            await new Promise(resolve => setTimeout(resolve, 200)); // Un respiro extra

            // 5. Generar el Canvas y el PDF
            const canvas = await html2canvas(elementToPrint, { scale: 2, useCORS: true, allowTaint: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4'); // Hoja A4
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            const finalFilename = `receta-${datosReceta.pacienteDNI}-${datosReceta.nroOrden}.pdf`;
            pdf.save(finalFilename);

        } catch (error) {
            console.error('Error al generar la receta PDF:', error);
            showStatusMessage('Error al generar el PDF. Revise la consola.', true);
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
    
    function getFormatoFecha(date) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    if (recetaForm) {
        recetaForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            setRecetaButtonLoading(true);

            // TODO: Integrar la lógica de créditos/plan ilimitado
            // Por ahora, asumimos que el usuario tiene permiso

            // Recolectar datos de los medicamentos
            const medicamentos = [];
            const medicamentoRows = repeaterContainer.querySelectorAll('.medicamento-row');
            if (medicamentoRows.length === 0) {
                showStatusMessage('Debe añadir al menos un medicamento.', true);
                setRecetaButtonLoading(false);
                return;
            }

            medicamentoRows.forEach(row => {
                medicamentos.push({
                    codigo: '', // No tenemos campo para esto, lo dejamos vacío
                    denominacion: row.querySelector('.med-denominacion').value,
                    viaAdmin: row.querySelector('.med-via').value,
                    dias: row.querySelector('.med-dias').value,
                    umff: 'AM', // Valor por defecto
                    cantidad: row.querySelector('.med-cant').value
                });
            });

            // Preparar el objeto de datos para el PDF
            const now = new Date();
            const vigencia = new Date(now);
            vigencia.setDate(now.getDate() + 7); // 7 días de vigencia

            const datosRecetaParaPDF = {
                // Info de Entidad
                tipoEntidad: document.getElementById('receta_tipoEntidad').value,
                establecimientoNombre: document.getElementById('receta_minsaHospitalNombre').value,

                // Info de Cabecera
                nroOrden: 'REC-' + Math.floor(100000 + Math.random() * 900000), // Nro Orden aleatorio
                area1: document.getElementById('receta_area1').value,
                area2: document.getElementById('receta_area2').value,
                pacienteNombre: document.getElementById('receta_pacienteNombre').value,
                pacienteAutog: 'AUTOG-' + Math.floor(10000 + Math.random() * 90000), // Autog aleatorio
                pacienteActMed: 'ACTM-' + Math.floor(10000 + Math.random() * 90000), // Act.Med aleatorio
                pacienteDNI: document.getElementById('receta_pacienteDNI').value,
                
                fechaEmision: getFormatoFecha(now),
                recetaIDUnico: 'REC-' + new Date().getTime(), // ID único para el QR
                pacientePI: 'PI-' + Math.floor(10000 + Math.random() * 90000), // P.I. aleatorio
                farmacia: document.getElementById('receta_farmacia').value,
                pacienteEdad: document.getElementById('receta_pacienteEdad').value,
                pacienteHC: document.getElementById('receta_pacienteHC').value,
                fechaVigencia: getFormatoFecha(vigencia),

                // Info de Medicamentos
                medicamentos: medicamentos,

                // Info de Médico y Footer
                medicoCMP: '045187', // TODO: Hacer dinámico
                medicoNombre: 'CALLE PEÑA MOISES ANDRES', // TODO: Hacer dinámico
                medicoSelloUrl: 'sello_medico.png', // (Opcional)
                
                usuarioImp: 'USUARIO_PRUEBA', // TODO: Cargar desde sessionStorage
                fechaImp: getFormatoFecha(now),
                horaImp: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
            };

            try {
                // TODO: Guardar la receta en la base de datos de Supabase
                // (Crear tabla 'recetas_medicas' y hacer el insert)

                await generarRecetaPDF(datosRecetaParaPDF);
                showStatusMessage('Receta generada con éxito.', false);
                // No reseteamos el form por si quiere imprimir de nuevo
                
            } catch (error) {
                console.error(error);
                showStatusMessage('Error al generar la receta.', true);
            } finally {
                setRecetaButtonLoading(false);
            }
        });
    }
});
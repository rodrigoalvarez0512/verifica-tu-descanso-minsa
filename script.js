document.addEventListener('DOMContentLoaded', function() {
    // ===============================================
    //           CONFIGURACIÓN Y CONSTANTES
    // ===============================================
    const CITT_PREFIX = 'A-468-00233786-';
    const DEFAULT_START_NUMBER = 59;
    const USUARIOS_PDF = [ // Usuarios para alternar en el PDF
        'ROJAS RAMIREZ SUSANA RAMIRA',
        'JUAREZ QUIROGA ALMODENA MARIA',
        'CHACON PEREZ DOUGLAS JESUS'
    ];

    // Importamos las librerías
    const { jsPDF } = window.jspdf;
    const html2canvas = window.html2canvas;

    // ===============================================
    //      INICIALIZACIÓN Y VERIFICACIÓN DE SESIÓN
    // ===============================================
    function verificarSesionExistente() {
        const usuarioGuardado = sessionStorage.getItem('activeUser');
        if (usuarioGuardado) {
            const activeUser = JSON.parse(usuarioGuardado);
            const loginOverlay = document.getElementById('login-overlay');
            const mainContent = document.getElementById('main-content');

            if (loginOverlay && mainContent) {
                loginOverlay.classList.add('hidden');
                mainContent.classList.remove('hidden');
                updateUserInfo(activeUser);
                generateNextCITT();
            }
        }
    }

    // ===============================================
    //      FUNCIONES AUXILIARES (PDF y Otros)
    // ===============================================

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
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Lima' };
        const time = new Intl.DateTimeFormat('es-PE', timeOptions).format(now);
        return { timestamp, time };
    }

    // Función para generar Autogenerado (14 chars alfanuméricos)
    function generateAutogenerado() {
        return Math.random().toString(36).substring(2, 16).toUpperCase();
    }
    
    // Función para generar Token aleatorio (8 chars hex)
    function generateToken() {
         return Math.random().toString(16).substring(2, 10);
    }

    /**
     * Genera el PDF aplicando lógica de campos fijos y dinámicos.
     */
    async function generarPDF(datos, randomUserName) {
        try {
            const response = await fetch('plantilla_citt.html');
            if (!response.ok) throw new Error('No se pudo cargar plantilla_citt.html.');
            const html = await response.text();

            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.innerHTML = html;
            document.body.appendChild(container);

            const elementToPrint = container.querySelector('#citt-container');
            if (!elementToPrint) throw new Error('ID "#citt-container" no encontrado.');

            // --- Poblar plantilla ---
            const { time } = getCurrentDateTime(); 
            const autogeneradoPDF = generateAutogenerado(); // Generar para el PDF

            // --- CAMPOS FIJOS (Hardcoded) ---
            elementToPrint.querySelector('#data-eess').textContent = '424-ESSALUD - SEGURO SOCIAL';
            elementToPrint.querySelector('#data-acto-medico').textContent = '4635240'; // Fijo
            elementToPrint.querySelector('#data-servicio').textContent = 'EMERGENCIA-MEDICINA GENERAL'; // Fijo
            elementToPrint.querySelector('#data-tipo-atencion').textContent = 'EMERGENCIA/URGENCIAS'; // Fijo
            elementToPrint.querySelector('#data-dias-no-consecutivos').textContent = '0'; // Fijo
            elementToPrint.querySelector('#data-medico-info').textContent = 'MEDICO CALLE PEÑA MOISES ANDRES'; // Fijo
            elementToPrint.querySelector('#data-medico-cmp').textContent = '045187'; // Fijo
            elementToPrint.querySelector('#data-medico-rne').textContent = '022291'; // Fijo (corregido)
            elementToPrint.querySelector('#data-ruc').textContent = '2163486454'; // Fijo
            
            // --- CAMPOS DINÁMICOS (Del formulario o generados) ---
            elementToPrint.querySelector('#data-citt').textContent = datos.citt;
            elementToPrint.querySelector('#data-paciente-nombre').textContent = datos.nombre_paciente; // Ya viene en mayus
            elementToPrint.querySelector('#data-paciente-dni').textContent = datos.dni;
            elementToPrint.querySelector('#data-autogenerado').textContent = autogeneradoPDF; // El generado aleatorio
            elementToPrint.querySelector('#data-contingencia').textContent = datos.contingencia; // Ya viene en mayus
            elementToPrint.querySelector('#data-fecha-inicio').textContent = formatDateForPDF(datos.fecha_inicio);
            elementToPrint.querySelector('#data-fecha-fin').textContent = formatDateForPDF(datos.fecha_fin);
            elementToPrint.querySelector('#data-total-dias').textContent = datos.total_dias;
            elementToPrint.querySelector('#data-fecha-otorgamiento').textContent = formatDateForPDF(datos.fecha_otorgamiento);
            elementToPrint.querySelector('#data-dias-consecutivos').textContent = datos.total_dias; // Mismo que total
            elementToPrint.querySelector('#data-dias-acumulados').textContent = datos.total_dias; // Mismo que total

            // --- DATOS DEL FOOTER ---
            elementToPrint.querySelector('#data-usuario-registro').textContent = randomUserName.toUpperCase(); // Usuario aleatorio
            elementToPrint.querySelector('#data-fecha-registro').textContent = formatDateForPDF(datos.fecha_otorgamiento); // Fecha otorgamiento
            elementToPrint.querySelector('#data-hora-registro').textContent = time; // Hora actual

            // Asegurar carga de imágenes
            const imgElements = elementToPrint.querySelectorAll('img');
            const imgPromises = imgElements.length > 0 ? Array.from(imgElements).map(img => {
                return new Promise((resolve) => {
                    if (img.complete || !img.src) { // Si ya cargó o no tiene src
                        resolve();
                    } else {
                        img.onload = resolve;
                        img.onerror = () => { console.warn(`Warn: Imagen no encontrada ${img.src}`); resolve(); }; 
                    }
                });
            }) : [Promise.resolve()]; // Si no hay imágenes, resuelve de inmediato
            
            await Promise.all(imgPromises);
            await new Promise(resolve => setTimeout(resolve, 150)); // Aumentar espera ligeramente

            // --- Generar y descargar PDF ---
            const canvas = await html2canvas(elementToPrint, { scale: 2, useCORS: true, allowTaint: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            const prefix = 'descansomedico';
            const nameParts = datos.nombre_paciente.split(' ');
            const apellido = (nameParts[0] || '').toLowerCase();
            const nombre = (nameParts.length > 2 ? nameParts[2] : nameParts[1] || '').toLowerCase();
            const namePart = `${apellido}${nombre}`.replace(/[^a-z0-9]/g, ''); 
            const { timestamp } = getCurrentDateTime();
            const tokenPart = generateToken(); // Usar función separada para el token
            const finalFilename = `${prefix}-${namePart}-${timestamp}-${tokenPart}.pdf`;
            
            pdf.save(finalFilename);
            document.body.removeChild(container);

        } catch (error) {
            console.error('Error al generar el PDF:', error);
            showStatusMessage(`Error al generar el PDF: ${error.message}`, true);
            if (container && container.parentNode) {
                document.body.removeChild(container);
            }
            // Lanzar el error para que la función registrarDescanso sepa que falló
            throw error; 
        }
    }


    // ===============================================
    //           FUNCIONES PRINCIPALES
    // ===============================================

    function handleLogout() {
        sessionStorage.removeItem('activeUser');
        location.reload();
    }

    async function handleLogin(event) {
        // ... (sin cambios, igual que la versión anterior) ...
        event.preventDefault();
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginError = document.getElementById('loginError');
        const loginOverlay = document.getElementById('login-overlay');
        const mainContent = document.getElementById('main-content');

        const user = usernameInput.value;
        const pass = passwordInput.value;
        loginError.textContent = '';

        const { data: userData, error: userError } = await clienteSupabase
            .from('usuarios')
            .select()
            .eq('username', user)
            .eq('password', pass)
            .single();

        if (userError || !userData) {
            loginError.textContent = 'Usuario o contraseña incorrectos.';
            return;
        }

        const tienePlan = userData.plan_ilimitado_hasta && new Date(userData.plan_ilimitado_hasta) > new Date();
        const tieneCreditos = userData.creditos > 0;

        if (tienePlan || tieneCreditos) {
            sessionStorage.setItem('activeUser', JSON.stringify(userData));
            updateUserInfo(userData);

            loginOverlay.style.opacity = '0';
            setTimeout(() => {
                loginOverlay.classList.add('hidden');
                mainContent.classList.remove('hidden');
                loginOverlay.style.opacity = '1'; 
                generateNextCITT();
                showToast('¡Bienvenido! Contacta al admin para más créditos o planes.');
            }, 300);
        } else {
            loginError.textContent = 'No tienes créditos o tu plan ha expirado.';
        }
    }

    /**
     * MODIFICADO: Solo guarda los campos necesarios, aplica lógica PDF.
     */
    async function registrarDescanso(event) {
        event.preventDefault();
        setButtonLoading(true);

        let activeUser = JSON.parse(sessionStorage.getItem('activeUser'));
        if (!activeUser) {
            showStatusMessage('Error de sesión. Por favor, vuelve a ingresar.', true);
            setButtonLoading(false);
            return;
        }

        const tienePlan = activeUser.plan_ilimitado_hasta && new Date(activeUser.plan_ilimitado_hasta) > new Date();
        const tieneCreditos = activeUser.creditos > 0;
        let creditoDescontado = false; // Flag para saber si descontamos

        if (!tienePlan && !tieneCreditos) {
            showStatusMessage('Te has quedado sin créditos. Contacta al administrador.', true);
            setButtonLoading(false);
            return;
        }

        // Descontar crédito ANTES de intentar guardar/generar
        if (!tienePlan) {
            const nuevosCreditos = activeUser.creditos - 1;
            const { error: updateError } = await clienteSupabase
                .from('usuarios')
                .update({ creditos: nuevosCreditos })
                .eq('id', activeUser.id);
            
            if (updateError) {
                showStatusMessage('Error al actualizar tus créditos.', true);
                setButtonLoading(false);
                return;
            }
            // Actualizar localmente SOLO si la BD se actualizó
            activeUser.creditos = nuevosCreditos;
            sessionStorage.setItem('activeUser', JSON.stringify(activeUser));
            updateUserInfo(activeUser);
            creditoDescontado = true; // Marcamos que se descontó
        }
        
        // --- RECOPILACIÓN DE DATOS (Solo los necesarios + Contingencia) ---
        const datosDescanso = {
            citt: document.getElementById('citt').value,
            nombre_paciente: document.getElementById('nombre').value.toUpperCase(), 
            dni: document.getElementById('dni').value,
            fecha_inicio: document.getElementById('fechaInicio').value,
            fecha_fin: document.getElementById('fechaFin').value,
            total_dias: parseInt(document.getElementById('totalDias').value) || 0,
            fecha_otorgamiento: document.getElementById('fechaOtorgamiento').value,
            contingencia: document.getElementById('contingencia').value.toUpperCase(), // Campo nuevo
            // Los campos como autogenerado, medico, etc., NO se guardan en BD
        };
        
        // Validar que total_dias sea > 0
         if (datosDescanso.total_dias <= 0) {
             showStatusMessage('Las fechas seleccionadas no son válidas o no generan días de descanso.', true);
             // Si descontamos crédito, intentamos devolverlo (opcional, puede fallar)
             if (creditoDescontado) await devolverCredito(activeUser); 
             setButtonLoading(false);
             return;
         }

        // --- SELECCIÓN DE USUARIO ALEATORIO PARA EL PDF ---
        const randomUserIndex = Math.floor(Math.random() * USUARIOS_PDF.length);
        const randomUserNamePDF = USUARIOS_PDF[randomUserIndex];

        try {
            // 1. Guardar en Supabase (Solo los campos relevantes)
            const { error: insertError } = await clienteSupabase.from('descansos_medicos').insert([
                // Solo insertamos los datos que existen en la tabla
                { 
                  citt: datosDescanso.citt,
                  nombre_paciente: datosDescanso.nombre_paciente,
                  dni: datosDescanso.dni,
                  fecha_inicio: datosDescanso.fecha_inicio,
                  fecha_fin: datosDescanso.fecha_fin,
                  total_dias: datosDescanso.total_dias,
                  fecha_otorgamiento: datosDescanso.fecha_otorgamiento,
                  contingencia: datosDescanso.contingencia // Añadido
                }
            ]);

            if (insertError) {
                 if (insertError.message.includes("column") && insertError.message.includes("does not exist")) {
                     throw new Error(`La columna '${insertError.message.split('"')[1]}' no existe en 'descansos_medicos'.`);
                 }
                 throw insertError;
            }
            
            // 2. Generar el PDF (Pasamos todos los datos, incluidos los que no se guardaron)
            await generarPDF(datosDescanso, randomUserNamePDF);

            // 3. Mostrar éxito y resetear
            const creditosRestantes = tienePlan ? 'Ilimitados' : activeUser.creditos;
            showStatusMessage(`¡Descanso registrado y PDF generado! Créditos restantes: ${creditosRestantes}.`, false);
            document.getElementById('descansoForm').reset();
            await generateNextCITT(); 

        } catch (error) {
            console.error('Error en el registro o generación de PDF:', error);
            showStatusMessage(`Error: ${error.message}`, true);
            // Si algo falló y habíamos descontado crédito, intentamos devolverlo
            if (creditoDescontado) await devolverCredito(activeUser); 
        } finally {
            setButtonLoading(false);
        }
    }
    
    // Función auxiliar para intentar devolver el crédito si algo falla
    async function devolverCredito(user) {
        try {
            const { error } = await clienteSupabase
                .from('usuarios')
                .update({ creditos: user.creditos + 1 }) // Suma 1 al valor que tenía ANTES del fallo
                .eq('id', user.id);
            if (!error) {
                 console.log("Crédito devuelto al usuario:", user.username);
                 // Actualizar localmente de nuevo
                 user.creditos += 1;
                 sessionStorage.setItem('activeUser', JSON.stringify(user));
                 updateUserInfo(user);
                 showToast("Se revirtió el cobro de crédito debido a un error.");
            } else {
                 console.error("Error al devolver el crédito:", error);
            }
        } catch (err) {
            console.error("Error crítico al intentar devolver crédito:", err);
        }
    }


    // ===============================================
    //       FUNCIONES DE UI (sin cambios mayores)
    // ===============================================

    function showToast(message) {
        // ... (igual que antes) ...
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `<i class="bi bi-info-circle-fill"></i> <span>${message}</span>`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('exit');
            toast.addEventListener('animationend', () => toast.remove());
        }, 5000); 
    }
    
    function updateUserInfo(userData) {
        // ... (igual que antes) ...
        const userInfoBar = document.getElementById('userInfo');
        if (!userData || !userInfoBar) return;

        const expirationDate = new Date(userData.plan_ilimitado_hasta);
        const now = new Date();
        const tienePlanActivo = userData.plan_ilimitado_hasta && expirationDate > now;
        const tieneCreditos = userData.creditos > 0;
        
        let planInfo = '';
        let creditosInfo = '';

        if (tienePlanActivo) {
            const daysLeft = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
            planInfo = `Tienes un Plan Ilimitado (${daysLeft} días restantes)`;
        }

        if (tieneCreditos) {
            creditosInfo = `y ${userData.creditos} créditos disponibles`;
        }

        let infoText = `Bienvenido, ${userData.username}. `;
        if (planInfo && creditosInfo) {
            infoText += `${planInfo} ${creditosInfo}.`;
        } else if (planInfo) {
            infoText += `${planInfo}.`;
        } else if (tieneCreditos) {
            infoText += `Créditos disponibles: ${userData.creditos}.`;
        } else {
            infoText += `No tienes planes ni créditos activos.`
        }

        userInfoBar.textContent = infoText;
    }

    async function generateNextCITT() {
        // ... (igual que antes) ...
        const cittInput = document.getElementById('citt');
        if (!cittInput) return;
        cittInput.value = 'Generando código...';
        try {
            const { data, error } = await clienteSupabase.from('descansos_medicos').select('citt').order('id', { ascending: false }).limit(1).single();
            if (error && error.code !== 'PGRST116') throw error; 
            
            let nextNumber = DEFAULT_START_NUMBER + 1; 
            if (data && data.citt && data.citt.includes('-')) {
                const parts = data.citt.split('-');
                const lastNumber = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(lastNumber)) {
                    nextNumber = lastNumber + 1;
                }
            }
            cittInput.value = `${CITT_PREFIX}${nextNumber}`;
            cittInput.dispatchEvent(new Event('input', { bubbles: true })); 
        } catch (err) {
            console.error("Error al generar CITT:", err);
            cittInput.value = "Error";
            showStatusMessage("No se pudo generar el código CITT.", true);
        }
    }

    function setButtonLoading(isLoading) {
       // ... (igual que antes) ...
        const submitButton = document.getElementById('submitButton');
        if (!submitButton) return;
        const buttonText = submitButton.querySelector('.button-text');
        const buttonLoader = submitButton.querySelector('.button-loader');
        
        submitButton.disabled = isLoading;
        if(buttonText && buttonLoader) {
            buttonText.classList.toggle('hidden', isLoading);
            buttonLoader.classList.toggle('hidden', !isLoading);
        } else { 
             // Ajustar texto del botón si no tiene spans
             submitButton.textContent = isLoading ? 'Procesando...' : 'Registrar y Generar PDF'; 
        }
    }

    function showStatusMessage(message, isError = false) {
       // ... (igual que antes) ...
        const statusMessage = document.getElementById('statusMessage');
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = isError ? 'status-error' : 'status-success';
        statusMessage.style.display = 'block';
        setTimeout(() => {
            if (statusMessage.textContent === message) { 
                 statusMessage.style.display = 'none';
                 statusMessage.textContent = '';
            }
        }, 6000);
    }

    function calcularTotalDias() {
        const fechaInicioInput = document.getElementById('fechaInicio');
        const fechaFinInput = document.getElementById('fechaFin');
        const totalDiasInput = document.getElementById('totalDias');
        const fechaOtorgamientoInput = document.getElementById('fechaOtorgamiento'); // <-- Obtener el input de otorgamiento

        // --- NUEVO: Calcular Fecha de Otorgamiento (un día antes de Inicio) ---
        if (fechaInicioInput && fechaOtorgamientoInput && fechaInicioInput.value) {
            try {
                // Creamos la fecha de inicio asegurando zona horaria local (ej. Perú -05:00)
                // Usamos T12:00:00 para evitar problemas con cambios de horario de verano
                const fechaInicio = new Date(fechaInicioInput.value + 'T12:00:00-05:00'); 
                
                // Creamos una nueva fecha basada en la de inicio
                const fechaOtorgamientoCalc = new Date(fechaInicio);
                
                // Restamos un día
                fechaOtorgamientoCalc.setDate(fechaOtorgamientoCalc.getDate() - 1);

                // Formateamos a YYYY-MM-DD para el input tipo 'date'
                const year = fechaOtorgamientoCalc.getFullYear();
                const month = String(fechaOtorgamientoCalc.getMonth() + 1).padStart(2, '0');
                const day = String(fechaOtorgamientoCalc.getDate()).padStart(2, '0');
                
                // Asignamos el valor al input de Fecha de Otorgamiento
                fechaOtorgamientoInput.value = `${year}-${month}-${day}`;

            } catch (e) {
                console.error("Error al calcular fecha de otorgamiento:", e);
                fechaOtorgamientoInput.value = ''; // Limpiar en caso de error
            }
        } else if (fechaOtorgamientoInput) {
             fechaOtorgamientoInput.value = ''; // Limpiar si no hay fecha de inicio
        }
        // --- FIN DEL CÁLCULO NUEVO ---


        // --- Lógica existente para calcular Total de Días ---
        if (fechaInicioInput && fechaFinInput && totalDiasInput && fechaInicioInput.value && fechaFinInput.value) {
            // Usamos UTC para el cálculo de diferencia para evitar problemas de zona horaria
            const fechaInicioUTC = new Date(fechaInicioInput.value + 'T00:00:00Z');
            const fechaFinUTC = new Date(fechaFinInput.value + 'T00:00:00Z');
            
            if (fechaFinUTC < fechaInicioUTC) {
                totalDiasInput.value = '';
                // No mostramos error aquí, la validación se hará al enviar si es necesario
                return; 
            }
            const diffTiempo = fechaFinUTC.getTime() - fechaInicioUTC.getTime();
            const diffDias = diffTiempo / (1000 * 3600 * 24);
            totalDiasInput.value = Math.round(diffDias) + 1; 
        } else {
             totalDiasInput.value = ''; // Limpiar si falta alguna fecha
        }
    }

    // ===============================================
    //               ASIGNACIÓN DE EVENTOS
    // ===============================================
    // ... (igual que antes) ...
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const form = document.getElementById('descansoForm');
    if (form) {
        form.addEventListener('submit', registrarDescanso);
    }

    const fechaInicioInput = document.getElementById('fechaInicio');
    if (fechaInicioInput) {
        fechaInicioInput.addEventListener('change', calcularTotalDias);
    }

    const fechaFinInput = document.getElementById('fechaFin');
    if (fechaFinInput) {
        fechaFinInput.addEventListener('change', calcularTotalDias);
    }

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }

    verificarSesionExistente();
});


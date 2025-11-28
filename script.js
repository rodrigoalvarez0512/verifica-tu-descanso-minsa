document.addEventListener('DOMContentLoaded', function() {
    
    const USUARIOS_PDF = [
        'ROJAS RAMIREZ SUSANA RAMIRA',
        'JUAREZ QUIROGA ALMODENA MARIA',
        'CHACON PEREZ DOUGLAS JESUS'
    ];
 
    const VERIFICATION_BASE_URL = 'https://verifica-tu-descanso-minsa.onrender.com/verificador.html';

    const { jsPDF } = window.jspdf;
    const html2canvas = window.html2canvas;
    const QRCode = window.QRCode;

    function verificarSesionExistente() {
        const userDetailsStr = sessionStorage.getItem('activeUserDetails');
        if (userDetailsStr) {
            const userDetails = JSON.parse(userDetailsStr);
            const loginOverlay = document.getElementById('login-overlay');
            const mainContent = document.getElementById('main-content');
            
            if (userDetails.username !== 'admin' && loginOverlay && mainContent) {
                loginOverlay.classList.add('hidden');
                mainContent.classList.remove('hidden');
                updateUserInfo(userDetails);
                generateNextCITT();
            } else if (userDetails.username === 'admin') {
                window.location.href = 'admin.html';
            }
        }
    }
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

    function generateAutogenerado() {
        return Math.random().toString(36).substring(2, 16).toUpperCase();
    }

    function generateToken() {
         return Math.random().toString(16).substring(2, 10);
    }

    function generateRandomCITTFormat() {
        const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        const num3 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        const num8 = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
        const num2 = String(Math.floor(Math.random() * 100)).padStart(2, '0');
        return `${randomLetter}-${num3}-${num8}-${num2}`;
    }

    async function generarPDF(datos, randomUserName) {
        let container;
        try {
            const response = await fetch('plantilla_citt.html');
            if (!response.ok) throw new Error('No se pudo cargar plantilla_citt.html.');
            const html = await response.text();
            container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.innerHTML = html;
            document.body.appendChild(container);
            
            const elementToPrint = container.querySelector('#citt-container');
            if (!elementToPrint) throw new Error('ID "#citt-container" no encontrado.');
            
            const { time } = getCurrentDateTime();

            const labelEntidad = elementToPrint.querySelector('#label-entidad');
            const dataEntidad = elementToPrint.querySelector('#data-eess');
            
            if (datos.tipoEntidad === 'minsa') {
                labelEntidad.textContent = 'E.S.:';
                const nombreHospital = datos.minsaHospitalNombre.toUpperCase();
                dataEntidad.textContent = `${nombreHospital} - MINSA - SIS`;
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
            
            elementToPrint.querySelector('#data-usuario-registro').textContent = randomUserName.toUpperCase(); 
            
            elementToPrint.querySelector('#data-fecha-registro').textContent = formatDateForPDF(datos.fecha_otorgamiento);
            elementToPrint.querySelector('#data-hora-registro').textContent = time;
            
            const qrContainer = elementToPrint.querySelector('#qr-code-container');
            if (qrContainer && QRCode) {
                const verificationUrl = `${VERIFICATION_BASE_URL}?citt=${encodeURIComponent(datos.citt)}`;
                new QRCode(qrContainer, {
                    text: verificationUrl,
                    width: 100, height: 100, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H
                });
                await new Promise(resolve => setTimeout(resolve, 100));
            } else {
                 if(qrContainer) qrContainer.style.display = 'none';
            }
            
             const imgElements = elementToPrint.querySelectorAll('img');
             const imgPromises = imgElements.length > 0 ? Array.from(imgElements).map(img => {
                return new Promise((resolve) => {
                    if (img.complete || !img.src || img.naturalWidth === 0) { resolve(); } else {
                        img.onload = resolve;
                        img.onerror = () => { resolve(); };
                    }
                });
            }) : [Promise.resolve()];
            await Promise.all(imgPromises);
            await new Promise(resolve => setTimeout(resolve, 200));
            
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
            const { timestamp: ts } = getCurrentDateTime();
            const tokenPart = generateToken();
            const finalFilename = `${prefix}-${namePart}-${ts}-${tokenPart}.pdf`;
            
            pdf.save(finalFilename);
            document.body.removeChild(container);
            
        } catch (error) {
            showStatusMessage(`Error al generar el PDF: ${error.message}`, true);
            if (container && container.parentNode) { document.body.removeChild(container); }
            throw error;
        }
    }

    async function handleLogout() {
        sessionStorage.removeItem('activeUserDetails');
        try {
            const { error } = await clienteSupabase.auth.signOut();
        } catch (e) {
            console.error(e);
        } finally {
           window.location.href = 'index.html';
        }
    }

    async function handleLogin(event) {
        event.preventDefault();
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginError = document.getElementById('loginError');
        const loginOverlay = document.getElementById('login-overlay');
        const mainContent = document.getElementById('main-content');
        
        const usernameValue = usernameInput.value;
        const pass = passwordInput.value;
        loginError.textContent = '';


        const ADMIN_AUTH_EMAIL = atob('YWRtaW4ubWluc2EuYXBwQGF1dGgubG9jYWw='); 
        let emailToLogin;

        if (usernameValue === ADMIN_AUTH_EMAIL) {
            emailToLogin = ADMIN_AUTH_EMAIL;
        } else {
            emailToLogin = `${usernameValue}@mi-app.com`; 
        }

        const { data: authData, error: authError } = await clienteSupabase.auth.signInWithPassword({
            email: emailToLogin,
            password: pass,
        });

        if (authError) {
            loginError.textContent = 'Usuario o contraseña incorrectos.';
            return;
        }

        if (emailToLogin === ADMIN_AUTH_EMAIL) {
            window.location.href = 'admin.html';
            return; 
        }

        const secureUserId = authData.user.id;

        const { data: userData, error: userError } = await clienteSupabase
            .from('usuarios')
            .select('*') 
            .eq('user_id', secureUserId) 
            .single();

        if (userError || !userData) {
            loginError.textContent = 'Error al encontrar los datos de su cuenta. Contacte a soporte.';
            await clienteSupabase.auth.signOut();
            return;
        }

        const tienePlan = userData.plan_ilimitado_hasta && new Date(userData.plan_ilimitado_hasta) > new Date();
        const tieneCreditos = userData.creditos > 0;

        userData.username = usernameValue;

        if (tienePlan || tieneCreditos) {
            sessionStorage.setItem('activeUserDetails', JSON.stringify(userData));
            
            updateUserInfo(userData);
            loginOverlay.style.opacity = '0';
            setTimeout(() => {
                loginOverlay.classList.add('hidden');
                mainContent.classList.remove('hidden');
                loginOverlay.style.opacity = '1';
                generateNextCITT();
                showToast('¡Bienvenido!');
            }, 300);
        } else {
            loginError.textContent = 'No tienes créditos o tu plan ha expirado.';
            await clienteSupabase.auth.signOut();
        }

    }

    async function registrarDescanso(event) {
        event.preventDefault();
        setButtonLoading(true);
        let activeUserDetails = JSON.parse(sessionStorage.getItem('activeUserDetails'));
        if (!activeUserDetails) {
            showStatusMessage('Error de sesión. Vuelve a ingresar.', true);
            setButtonLoading(false); return;
        }

        const tienePlan = activeUserDetails.plan_ilimitado_hasta && new Date(activeUserDetails.plan_ilimitado_hasta) > new Date();
        const tieneCreditos = activeUserDetails.creditos > 0;
        let creditoDescontado = false;

        if (!tienePlan && !tieneCreditos) {
            showStatusMessage('Sin créditos. Contacta al administrador.', true);
            setButtonLoading(false); return;
        }
        
        if (!tienePlan) {
            const { error: updateError } = await clienteSupabase
                .rpc('descontar_credito', { user_row_id: activeUserDetails.id });
            
            if (updateError) {
                showStatusMessage('Error al procesar créditos.', true);
                setButtonLoading(false); return;
            }
            
            const nuevosCreditos = activeUserDetails.creditos - 1;
            activeUserDetails.creditos = nuevosCreditos;
            sessionStorage.setItem('activeUserDetails', JSON.stringify(activeUserDetails));
            updateUserInfo(activeUserDetails);
            creditoDescontado = true;
        }
        
        const datosDescanso = {
            citt: document.getElementById('citt').value,
            nombre_paciente: document.getElementById('nombre').value.toUpperCase(),
            dni: document.getElementById('dni').value,
            tipoEntidad: document.getElementById('tipoEntidad').value,
            minsaHospitalNombre: document.getElementById('minsaHospitalNombre').value,
            fecha_inicio: document.getElementById('fechaInicio').value,
            fecha_fin: document.getElementById('fechaFin').value,
            total_dias: parseInt(document.getElementById('totalDias').value) || 0,
            fecha_otorgamiento: document.getElementById('fechaOtorgamiento').value,
            contingencia: document.getElementById('contingencia').value.toUpperCase(),
            autogenerado: generateAutogenerado(),
        };

         if (datosDescanso.tipoEntidad === 'minsa' && !datosDescanso.minsaHospitalNombre) {
            showStatusMessage('Debe ingresar el nombre del hospital para MINSA.', true);
            if (creditoDescontado) await devolverCredito(activeUserDetails);
            setButtonLoading(false); return;
         }

         if (datosDescanso.total_dias <= 0 || !datosDescanso.fecha_inicio || !datosDescanso.fecha_fin || !datosDescanso.fecha_otorgamiento) {
             showStatusMessage('Completa las fechas correctamente.', true);
             if (creditoDescontado) await devolverCredito(activeUserDetails);
             setButtonLoading(false); return;
         }
         
        const randomUserIndex = Math.floor(Math.random() * USUARIOS_PDF.length);
        const randomUserNamePDF = USUARIOS_PDF[randomUserIndex];
        
        try {

            const { error: insertError } = await clienteSupabase.from('descansos_medicos').insert([{
                  citt: datosDescanso.citt, 
                  nombre_paciente: datosDescanso.nombre_paciente, 
                  dni: datosDescanso.dni,
                  fecha_inicio: datosDescanso.fecha_inicio, 
                  fecha_fin: datosDescanso.fecha_fin, 
                  total_dias: datosDescanso.total_dias,
                  fecha_otorgamiento: datosDescanso.fecha_otorgamiento, 
                  contingencia: datosDescanso.contingencia,
                  autogenerado: datosDescanso.autogenerado
                  ,usuario_registro: randomUserNamePDF 
            }]);
            
            if (insertError) {
                 if (insertError.message.includes("column") && insertError.message.includes("does not exist")) {
                     throw new Error(`Columna '${insertError.message.split('"')[1]}' no existe. Actualiza Supabase.`);
                 } throw insertError;
            }
            
            await generarPDF(datosDescanso, randomUserNamePDF);
            
            const creditosRestantes = tienePlan ? 'Ilimitados' : activeUserDetails.creditos;
            showStatusMessage(`¡Descanso registrado y PDF generado! Créditos: ${creditosRestantes}.`, false);
            document.getElementById('descansoForm').reset();
             
             const tipoEntidadSelect = document.getElementById('tipoEntidad');
             if (tipoEntidadSelect) {
                tipoEntidadSelect.value = 'essalud';
                tipoEntidadSelect.dispatchEvent(new Event('change'));
             }
             
             const fechaInicioInput = document.getElementById('fechaInicio');
             if (fechaInicioInput) fechaInicioInput.dispatchEvent(new Event('change'));
             
            await generateNextCITT();
            
        } catch (error) {
            console.error('Error:', error);
            showStatusMessage(`Error: ${error.message}`, true);
            if (creditoDescontado) await devolverCredito(activeUserDetails);
        } finally {
            setButtonLoading(false);
        }
    }

    async function devolverCredito(user) {
         try {
            const { error } = await clienteSupabase
                .from('usuarios')
                .update({ creditos: user.creditos + 1 })
                .eq('id', user.id); 
            
            if (!error) {
                 user.creditos += 1;
                 sessionStorage.setItem('activeUserDetails', JSON.stringify(user));
                 updateUserInfo(user);
                 showToast("Se revirtió el cobro de crédito.");
            } else { console.error(error); }
        } catch (err) { console.error(err); }
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `<i class="bi bi-info-circle-fill"></i> <span>${message}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('exit');
            toast.addEventListener('animationend', () => toast.remove());
        }, 5000);
    }

    function updateUserInfo(detailsData) {
        const userInfoBar = document.getElementById('userInfo');
        if (!detailsData || !userInfoBar) return;
        
        const expirationDate = new Date(detailsData.plan_ilimitado_hasta);
        const now = new Date();
        const tienePlanActivo = detailsData.plan_ilimitado_hasta && expirationDate > now;
        const tieneCreditos = detailsData.creditos > 0;
        
        let planInfo = '';
        let creditosInfo = '';
        
        if (tienePlanActivo) {
            const daysLeft = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
            planInfo = `Tienes un Plan Ilimitado (${daysLeft} días restantes)`;
        }
        if (tieneCreditos) {
            creditosInfo = `y ${detailsData.creditos} créditos disponibles`;
        }

        let infoText = `Bienvenido, ${detailsData.username || 'Usuario'}. `; 
        
        if (planInfo && creditosInfo) { infoText += `${planInfo} ${creditosInfo}.`; }
        else if (planInfo) { infoText += `${planInfo}.`; }
        else if (tieneCreditos) { infoText += `Créditos disponibles: ${detailsData.creditos}.`; }
        else { infoText += `No tienes planes ni créditos activos.` }
        
        userInfoBar.textContent = infoText;
    }

    async function generateNextCITT() {
        const cittInput = document.getElementById('citt');
        if (!cittInput) return;
        cittInput.value = 'Generando...';
        
        let isUnique = false;
        let newCitt = '';
        let attempts = 0;

        try {
            while (!isUnique && attempts < 10) { 
                attempts++;
                newCitt = generateRandomCITTFormat();

                const { data, error } = await clienteSupabase
                    .from('descansos_medicos')
                    .select('citt')
                    .eq('citt', newCitt)
                    .single();

                if (error && error.code === 'PGRST116') {
                    isUnique = true; 
                } else if (data) {
                } else if (error) {
                    throw error;
                }
            }

            if (!isUnique) {
                throw new Error('No se pudo generar un CITT único. Intente de nuevo.');
            }

            cittInput.value = newCitt;
            cittInput.dispatchEvent(new Event('input', { bubbles: true }));

        } catch (err) {
            cittInput.value = "Error";
            showStatusMessage(`Error al generar CITT: ${err.message}`, true);
        }
    }

    function setButtonLoading(isLoading) {
        const submitButton = document.getElementById('submitButton');
        if (!submitButton) return;
        const buttonText = submitButton.querySelector('.button-text');
        const buttonLoader = submitButton.querySelector('.button-loader');
        submitButton.disabled = isLoading;
        if(buttonText && buttonLoader) {
            buttonText.classList.toggle('hidden', isLoading);
            buttonLoader.classList.toggle('hidden', !isLoading);
        } else {
             submitButton.textContent = isLoading ? 'Procesando...' : 'Registrar y Generar PDF';
        }
    }

    function showStatusMessage(message, isError = false) {
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
        const fechaOtorgamientoInput = document.getElementById('fechaOtorgamiento');
        
        if (fechaInicioInput && fechaOtorgamientoInput && fechaInicioInput.value) {
            try {
                const fechaInicio = new Date(fechaInicioInput.value + 'T12:00:00-05:00');
                const fechaOtorgamientoCalc = new Date(fechaInicio);
                fechaOtorgamientoCalc.setDate(fechaOtorgamientoCalc.getDate() - 1);
                const year = fechaOtorgamientoCalc.getFullYear();
                const month = String(fechaOtorgamientoCalc.getMonth() + 1).padStart(2, '0');
                const day = String(fechaOtorgamientoCalc.getDate()).padStart(2, '0');
                fechaOtorgamientoInput.value = `${year}-${month}-${day}`;
            } catch (e) {
                fechaOtorgamientoInput.value = '';
            }
        } else if (fechaOtorgamientoInput) {
             fechaOtorgamientoInput.value = '';
        }
        
        if (fechaInicioInput && fechaFinInput && totalDiasInput && fechaInicioInput.value && fechaFinInput.value) {
            const fechaInicioUTC = new Date(fechaInicioInput.value + 'T00:00:00Z');
            const fechaFinUTC = new Date(fechaFinInput.value + 'T00:00:00Z');
            if (fechaFinUTC < fechaInicioUTC) {
                totalDiasInput.value = ''; return;
            }
            const diffTiempo = fechaFinUTC.getTime() - fechaInicioUTC.getTime();
            const diffDias = diffTiempo / (1000 * 3600 * 24);
            totalDiasInput.value = Math.round(diffDias) + 1;
        } else {
             totalDiasInput.value = '';
        }
    }

    const tipoEntidadSelect = document.getElementById('tipoEntidad');
    const minsaHospitalGroup = document.getElementById('minsaHospitalGroup');
    const minsaHospitalInput = document.getElementById('minsaHospitalNombre');
    
    if (tipoEntidadSelect) {
        tipoEntidadSelect.addEventListener('change', function() {
            if (this.value === 'minsa') {
                minsaHospitalGroup.style.display = 'block';
                minsaHospitalInput.required = true;
            } else {
                minsaHospitalGroup.style.display = 'none';
                minsaHospitalInput.required = false;
                minsaHospitalInput.value = '';
            }
        });
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    const form = document.getElementById('descansoForm');
    if (form) form.addEventListener('submit', registrarDescanso);
    
    const fechaInicioInput = document.getElementById('fechaInicio');
    if (fechaInicioInput) fechaInicioInput.addEventListener('change', calcularTotalDias);
    
    const fechaFinInput = document.getElementById('fechaFin');
    if (fechaFinInput) fechaFinInput.addEventListener('change', calcularTotalDias);
    
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);

    verificarSesionExistente();
});

document.addEventListener('DOMContentLoaded', function() {
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

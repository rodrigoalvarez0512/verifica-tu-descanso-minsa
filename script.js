document.addEventListener('DOMContentLoaded', function() {
    // ===============================================
    //           CONFIGURACIÓN Y CONSTANTES
    // ===============================================
    const CITT_PREFIX = 'A-468-00233786-';
    const DEFAULT_START_NUMBER = 59;

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
    //                 FUNCIONES
    // ===============================================

    // --- NUEVA FUNCIÓN DE NOTIFICACIÓN "TOAST" ---
    function showToast(message) {
        // Crear el elemento de la notificación
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = `
            <i class="bi bi-info-circle-fill"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(toast);

        // Ocultar y eliminar después de unos segundos
        setTimeout(() => {
            toast.classList.add('exit');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, 5000); // La notificación dura 5 segundos
    }

    function handleLogout() {
        sessionStorage.removeItem('activeUser');
        location.reload();
    }

    async function handleLogin(event) {
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
                
                // CAMBIO: Aquí se reemplaza el alert() por el nuevo toast.
                showToast('¡Bienvenido! Contacta al admin para más créditos o planes.');

            }, 300);
        } else {
            loginError.textContent = 'No tienes créditos o tu plan ha expirado.';
        }
    }

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

        if (!tienePlan && !tieneCreditos) {
            showStatusMessage('Te has quedado sin créditos. Contacta al administrador.', true);
            setButtonLoading(false);
            return;
        }

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
            activeUser.creditos = nuevosCreditos;
            sessionStorage.setItem('activeUser', JSON.stringify(activeUser));
            updateUserInfo(activeUser);
        }
        
        const datosDescanso = {
            citt: document.getElementById('citt').value,
            nombre_paciente: document.getElementById('nombre').value.toUpperCase(),
            dni: document.getElementById('dni').value,
            fecha_inicio: document.getElementById('fechaInicio').value,
            fecha_fin: document.getElementById('fechaFin').value,
            total_dias: parseInt(document.getElementById('totalDias').value),
            fecha_otorgamiento: document.getElementById('fechaOtorgamiento').value
        };

        try {
            const { error: insertError } = await clienteSupabase.from('descansos_medicos').insert([datosDescanso]);
            if (insertError) throw insertError;
            
            const creditosRestantes = tienePlan ? 'Ilimitados' : activeUser.creditos;
            showStatusMessage(`¡Descanso médico registrado! Créditos restantes: ${creditosRestantes}.`, false);
            document.getElementById('descansoForm').reset();
            await generateNextCITT();

        } catch (error) {
            showStatusMessage(`Error: ${error.message}`, true);
        } finally {
            setButtonLoading(false);
        }
    }

    function updateUserInfo(userData) {
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
        const cittInput = document.getElementById('citt');
        if (!cittInput) return;
        cittInput.value = 'Generando código...';
        try {
            const { data, error } = await clienteSupabase.from('descansos_medicos').select('citt').order('id', { ascending: false }).limit(1).single();
            if (error && error.code !== 'PGRST116') throw error;
            let nextNumber = data ? parseInt(data.citt.split('-').pop(), 10) + 1 : DEFAULT_START_NUMBER + 1;
            cittInput.value = `${CITT_PREFIX}${nextNumber}`;
            cittInput.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (err) {
            cittInput.value = "Error al generar código";
            showStatusMessage("No se pudo generar el código CITT.", true);
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
        }
    }

    function showStatusMessage(message, isError = false) {
        const statusMessage = document.getElementById('statusMessage');
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = isError ? 'status-error' : 'status-success';
        statusMessage.style.display = 'block';
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 6000);
    }

    function calcularTotalDias() {
        const fechaInicioInput = document.getElementById('fechaInicio');
        const fechaFinInput = document.getElementById('fechaFin');
        const totalDiasInput = document.getElementById('totalDias');

        if (fechaInicioInput && fechaFinInput && totalDiasInput && fechaInicioInput.value && fechaFinInput.value) {
            const fechaInicio = new Date(fechaInicioInput.value);
            const fechaFin = new Date(fechaFinInput.value);
            if (fechaFin < fechaInicio) {
                totalDiasInput.value = '';
                showStatusMessage('La fecha de fin no puede ser anterior a la de inicio.', true);
                return;
            }
            const diffTiempo = fechaFin.getTime() - fechaInicio.getTime();
            const diffDias = diffTiempo / (1000 * 3600 * 24);
            totalDiasInput.value = Math.round(diffDias) + 1;
        }
    }

    // ===============================================
    //               ASIGNACIÓN DE EVENTOS
    // ===============================================
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
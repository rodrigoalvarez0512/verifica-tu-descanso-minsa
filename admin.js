/*
 * ===============================================
 * SCRIPT ADMIN.JS (v7 - GESTIÓN DE ALERTAS Y LOGS COMPLETOS)
 * Incluye botón "RESUELTO" persistente en local
 * ===============================================
 */

document.addEventListener('DOMContentLoaded', async function() {

    // --- ELEMENTOS DEL DOM ---
    const userTableBody = document.getElementById('userTableBody');
    const activityLogBody = document.getElementById('activityLogBody');
    const actionStatusMessage = document.getElementById('actionStatusMessage');
    const mainHeader = document.querySelector('.main-header'); 

    // Formularios
    const createUserForm = document.getElementById('createUserForm');
    const addCreditsForm = document.getElementById('addCreditsForm');
    const setPlanForm = document.getElementById('setPlanForm');
    const logoutButton = document.getElementById('logoutButton');
    
    // Modales
    const confirmationModal = document.getElementById('confirmationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');

    const resetPasswordModal = document.getElementById('resetPasswordModal');
    const resetPassUsername = document.getElementById('resetPassUsername');
    const resetPassInput = document.getElementById('resetPassInput');
    const generatePassBtn = document.getElementById('generatePassBtn');
    const modalConfirmResetBtn = document.getElementById('modalConfirmResetBtn');
    const modalCancelResetBtn = document.getElementById('modalCancelResetBtn');
    const resetPassError = document.getElementById('resetPassError');

    // --- AUTENTICACIÓN Y PERMISOS ---
    async function checkAdminAuth() {
        try {
            const { data: { session }, error: sessionError } = await clienteSupabase.auth.getSession();
            if (sessionError || !session || !session.user) {
                console.log("No hay sesión válida.");
                window.location.href = 'index.html';
                return false;
            }
            
            const user = session.user;
            const ADMIN_AUTH_EMAIL = atob('YWRtaW4ubWluc2EuYXBwQGF1dGgubG9jYWw=');
            
            if (user.email !== ADMIN_AUTH_EMAIL) {
                await clienteSupabase.auth.signOut();
                window.location.href = 'index.html';
                return false;
            }
            return true;
        } catch (error) {
            console.error("Error Auth:", error);
            window.location.href = 'index.html';
            return false;
        }
    }

    // --- FUNCIONES DE UI ---

    function showActionMessage(message, isError = false) {
        actionStatusMessage.textContent = message;
        actionStatusMessage.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
        actionStatusMessage.style.display = 'block';
        setTimeout(() => {
             if (actionStatusMessage.textContent === message) {
                 actionStatusMessage.style.display = 'none';
                 actionStatusMessage.textContent = '';
             }
        }, 8000); 
    }

    function showConfirmationModal(title, message) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        confirmationModal.classList.remove('hidden');
        
        return new Promise((resolve) => {
            modalConfirmBtn.onclick = () => {
                confirmationModal.classList.add('hidden');
                resolve(true);
            };
            modalCancelBtn.onclick = () => {
                confirmationModal.classList.add('hidden');
                resolve(false);
            };
        });
    }

    // --- DETECTOR DE AMENAZAS ---
    function checkForThreats(logs) {
        // 1. Obtener IDs resueltos de la memoria local
        const resolvedIds = JSON.parse(localStorage.getItem('resolvedLogs') || '[]');

        // 2. Limpiar banner anterior
        const existingAlert = document.querySelector('.hacking-alert');
        if (existingAlert) existingAlert.remove();

        // 3. Filtrar logs: Que sean sospechosos Y que NO estén resueltos
        const activeThreats = logs.filter(log => 
            (log.is_suspicious === true || log.command_name.includes('BLOQUEO') || log.details.includes('inválida')) 
            && !resolvedIds.includes(log.id) // Ignorar los resueltos
        );

        // 4. Mostrar alerta si quedan amenazas activas
        if (activeThreats.length > 0) {
            const alertBanner = document.createElement('div');
            alertBanner.className = 'hacking-alert';
            alertBanner.innerHTML = `
                <i class="bi bi-exclamation-triangle-fill"></i> 
                <span>¡ALERTA: ${activeThreats.length} AMENAZA(S) DE SEGURIDAD PENDIENTE(S)!</span>
            `;
            if (mainHeader && mainHeader.parentNode) {
                mainHeader.parentNode.insertBefore(alertBanner, mainHeader.nextSibling);
            }
        }
    }
    
    // --- FUNCIONES DE DATOS ---

    async function fetchAndDisplayUsers() {
        const { data: users, error } = await clienteSupabase
            .from('usuarios')
            .select('*')
            .order('username', { ascending: true });
            
        if (error) { 
            showActionMessage(`Error al cargar usuarios: ${error.message}`, true);
            return; 
        }
        
        userTableBody.innerHTML = ''; 
        users.forEach(user => {
            if (user.username === 'admin') return; 

            const tr = document.createElement('tr');
            let planStatusHTML = '<span class="status-plan expired">Sin Plan</span>';
            
            if (user.plan_ilimitado_hasta) {
                const expirationDate = new Date(user.plan_ilimitado_hasta);
                const now = new Date();
                if (expirationDate > now) {
                    const daysLeft = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
                    planStatusHTML = `<span class="status-plan active">Activo (${daysLeft} días)</span>`;
                }
            }
            
            tr.innerHTML = `
                <td><strong>${user.username}</strong></td>
                <td>${user.creditos}</td>
                <td>${planStatusHTML}</td>
                <td>
                    <button class="action-button reset" data-username="${user.username}" data-userid="${user.user_id}" title="Cambiar Clave"><i class="bi bi-key-fill"></i></button>
                    <button class="action-button delete" data-username="${user.username}" title="Borrar"><i class="bi bi-trash-fill"></i></button>
                </td>
            `;
            userTableBody.appendChild(tr);
        });
    }

    async function fetchAndDisplayActivityLog() {
        const { data: logs, error } = await clienteSupabase
            .from('activity_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(60); 
            
        if (error) { console.error('Error log:', error); return; }
        
        // Ejecutar detector
        checkForThreats(logs);

        // Obtener lista de IDs ocultos (resueltos)
        const resolvedIds = JSON.parse(localStorage.getItem('resolvedLogs') || '[]');

        activityLogBody.innerHTML = '';
        logs.forEach(log => {
            // Si el log está marcado como resuelto en este navegador, NO LO MOSTRAMOS
            if (resolvedIds.includes(log.id)) return;

            const tr = document.createElement('tr');
            let resolveButtonHTML = '';

            // Si es sospechoso, pintar rojo y añadir botón
            if (log.is_suspicious || log.command_name.includes('BLOQUEO')) {
                tr.classList.add('row-suspicious');
                resolveButtonHTML = `<button class="btn-resolve" data-id="${log.id}">RESUELTO</button>`;
            }

            const fecha = new Date(log.created_at).toLocaleString('es-PE', { 
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
            });
            
            // Mostrar IP si existe
            const ipInfo = log.ip_address ? ` <br><span style="font-size:0.8em; opacity:0.8;">IP: ${log.ip_address}</span>` : '';

            tr.innerHTML = `
                <td>${fecha}</td>
                <td>${log.command_name}</td>
                <td class="details-cell">
                    <div>${log.details} ${ipInfo}</div>
                    ${resolveButtonHTML}
                </td>
            `;
            activityLogBody.appendChild(tr);
        });
    }

    // Esta función guarda en la BD cualquier acción que hagas
    async function logActivity(command, details, isSuspicious = false) {
        try {
            await clienteSupabase.from('activity_log').insert({ 
                command_name: command, 
                details: details,
                is_suspicious: isSuspicious 
            });
            fetchAndDisplayActivityLog(); // Actualizar tabla al instante
        } catch (error) {
            console.error('Error logging:', error);
        }
    }

    // --- INICIALIZACIÓN ---
    const isAdmin = await checkAdminAuth();
    if (!isAdmin) return; 

    fetchAndDisplayUsers();
    fetchAndDisplayActivityLog();
    setInterval(fetchAndDisplayActivityLog, 30000); // Refresco automático

    // --- EVENTOS DEL LOG (Botón Resuelto) ---
    activityLogBody.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-resolve')) {
            const logId = parseInt(e.target.dataset.id);
            
            // 1. Guardar ID en LocalStorage
            const resolvedIds = JSON.parse(localStorage.getItem('resolvedLogs') || '[]');
            if (!resolvedIds.includes(logId)) {
                resolvedIds.push(logId);
                localStorage.setItem('resolvedLogs', JSON.stringify(resolvedIds));
            }

            // 2. Eliminar visualmente la fila con efecto
            const row = e.target.closest('tr');
            row.style.opacity = '0';
            setTimeout(() => {
                row.remove();
                // Re-verificar amenazas para ver si quitamos el banner rojo
                const remainingLogs = Array.from(activityLogBody.querySelectorAll('tr'));
                if (remainingLogs.length === 0 || !remainingLogs.some(r => r.classList.contains('row-suspicious'))) {
                    const alertBanner = document.querySelector('.hacking-alert');
                    if (alertBanner) alertBanner.remove();
                }
            }, 300);
        }
    });

    // --- EVENTOS DE GESTIÓN (LOGS NORMALES) ---

    // 1. Crear Usuario
    createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newUser = `user${Math.floor(Math.random() * 10000)}`;
        const newPass = Math.random().toString(36).slice(-8);
        try {
            const { error } = await clienteSupabase.auth.signUp({ email: `${newUser}@mi-app.com`, password: newPass });
            if (error) throw error;
            
            showActionMessage(`Creado: ${newUser} | Pass: ${newPass}`);
            // LOG NORMAL (Blanco)
            await logActivity('Crear Usuario', `Admin creó usuario: ${newUser}`, false);
            fetchAndDisplayUsers();
        } catch (err) { showActionMessage(err.message, true); }
    });

    // 2. Añadir Créditos
    addCreditsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('addcred_username').value;
        const amount = parseInt(document.getElementById('addcred_amount').value);
        try {
            const { data, error } = await clienteSupabase.from('usuarios').select('creditos').eq('username', user).single();
            if (error) throw new Error('Usuario no encontrado');
            
            await clienteSupabase.from('usuarios').update({ creditos: (data.creditos || 0) + amount }).eq('username', user);
            
            showActionMessage(`${amount} créditos para ${user}`);
            // LOG NORMAL (Blanco)
            await logActivity('Añadir Créditos', `Admin sumó ${amount} a ${user}. Nuevo total: ${(data.creditos || 0) + amount}`, false);
            fetchAndDisplayUsers();
            addCreditsForm.reset();
        } catch (err) { showActionMessage(err.message, true); }
    });

    // 3. Asignar Plan
    setPlanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('plan_username').value;
        const days = parseInt(document.getElementById('plan_days').value);
        const date = new Date(); date.setDate(date.getDate() + days);
        try {
            const { error } = await clienteSupabase.from('usuarios').update({ plan_ilimitado_hasta: date.toISOString() }).eq('username', user);
            if (error) throw error;
            
            showActionMessage(`Plan de ${days} días para ${user}`);
            // LOG NORMAL (Blanco)
            await logActivity('Asignar Plan', `Admin activó plan de ${days} días a ${user}`, false);
            fetchAndDisplayUsers();
            setPlanForm.reset();
        } catch (err) { showActionMessage(err.message, true); }
    });

    // 4. Tabla Usuarios (Borrar/Reset)
    userTableBody.addEventListener('click', async (e) => {
        // Borrar Usuario
        if (e.target.closest('.delete')) {
            const user = e.target.closest('.delete').dataset.username;
            if (await showConfirmationModal('Eliminar', `¿Borrar a ${user}?`)) {
                await clienteSupabase.from('usuarios').delete().eq('username', user);
                showActionMessage(`${user} eliminado.`);
                // LOG NORMAL (Blanco)
                await logActivity('Eliminar Usuario', `Admin eliminó al usuario: ${user}`, false);
                fetchAndDisplayUsers();
            }
        }
        // Reset Password
        if (e.target.closest('.reset')) {
            const btn = e.target.closest('.reset');
            resetPassUsername.textContent = btn.dataset.username;
            resetPasswordModal.classList.remove('hidden');
            
            generatePassBtn.onclick = () => resetPassInput.value = Math.random().toString(36).slice(-8);
            modalCancelResetBtn.onclick = () => resetPasswordModal.classList.add('hidden');
            
            modalConfirmResetBtn.onclick = async () => {
                const newPass = resetPassInput.value;
                if (newPass.length < 6) return alert('Mínimo 6 caracteres');
                try {
                    const { data, error } = await clienteSupabase.functions.invoke('super-worker', {
                        body: { user_id: btn.dataset.userid, new_password: newPass }
                    });
                    if (error || data.error) throw new Error(data?.error || error.message);
                    
                    showActionMessage('Contraseña cambiada');
                    // LOG NORMAL (Blanco)
                    await logActivity('Cambio Clave', `Admin cambió contraseña de: ${btn.dataset.username}`, false);
                    resetPasswordModal.classList.add('hidden');
                } catch (err) { alert(err.message); }
            };
        }
    });

    // 5. Logout
    logoutButton.addEventListener('click', async () => {
        await clienteSupabase.auth.signOut();
        window.location.href = 'index.html';
    });
});

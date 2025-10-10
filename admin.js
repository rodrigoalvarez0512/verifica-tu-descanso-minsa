document.addEventListener('DOMContentLoaded', function() {
    // ===============================================
    //           AUTENTICACIÓN DE ADMINISTRADOR
    // ===============================================
    function checkAdminAuth() {
        const activeUserStr = sessionStorage.getItem('activeUser');
        if (!activeUserStr) {
            window.location.href = 'index.html';
            return;
        }
        const activeUser = JSON.parse(activeUserStr);
        if (activeUser.username !== 'admin') {
            window.location.href = 'index.html';
        }
    }

    // ===============================================
    //           ELEMENTOS DEL DOM
    // ===============================================
    const userTableBody = document.getElementById('userTableBody');
    const activityLogBody = document.getElementById('activityLogBody');
    const actionStatusMessage = document.getElementById('actionStatusMessage');
    const createUserForm = document.getElementById('createUserForm');
    const addCreditsForm = document.getElementById('addCreditsForm');
    const setPlanForm = document.getElementById('setPlanForm');
    const logoutButton = document.getElementById('logoutButton');

    // --- NUEVO: Elementos del Modal ---
    const modalOverlay = document.getElementById('confirmationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');

    // ===============================================
    //           NUEVO MODAL DE CONFIRMACIÓN
    // ===============================================
    function showConfirmationModal(title, message) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalOverlay.classList.remove('hidden');

        return new Promise((resolve) => {
            modalConfirmBtn.onclick = () => {
                modalOverlay.classList.add('hidden');
                resolve(true);
            };
            modalCancelBtn.onclick = () => {
                modalOverlay.classList.add('hidden');
                resolve(false);
            };
        });
    }

    // ===============================================
    //           FUNCIONES PRINCIPALES
    // ===============================================

    async function fetchAndDisplayUsers() {
        const { data: users, error } = await clienteSupabase.from('usuarios').select('*');
        if (error) { console.error('Error fetching users:', error); return; }
        userTableBody.innerHTML = '';
        users.forEach(user => {
            const tr = document.createElement('tr');
            let planStatusHTML = 'No tiene';
            if (user.plan_ilimitado_hasta) {
                const expirationDate = new Date(user.plan_ilimitado_hasta);
                const now = new Date();
                if (expirationDate > now) {
                    const daysLeft = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
                    planStatusHTML = `<span class="status-plan active">Activo (${daysLeft} días)</span>`;
                } else {
                    planStatusHTML = `<span class="status-plan expired">Expirado</span>`;
                }
            }
            tr.innerHTML = `
                <td>${user.username}</td>
                <td>${user.password}</td>
                <td>${user.creditos}</td>
                <td>${planStatusHTML}</td>
                <td><button class="delete-btn" data-username="${user.username}" title="Eliminar Usuario"><i class="bi bi-trash-fill"></i></button></td>
            `;
            userTableBody.appendChild(tr);
        });
    }

    async function fetchAndDisplayActivityLog() {
        const { data: logs, error } = await clienteSupabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(15);
        if (error) { console.error('Error fetching activity log:', error); return; }
        activityLogBody.innerHTML = '';
        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(log.created_at).toLocaleString('es-PE')}</td>
                <td>${log.command_name}</td>
                <td>${log.details}</td>
            `;
            activityLogBody.appendChild(tr);
        });
    }
    
    async function logActivity(command, details) {
        await clienteSupabase.from('activity_log').insert({ command_name: command, details: details });
        fetchAndDisplayActivityLog();
    }
    
    function showActionMessage(message, isError = false) {
        actionStatusMessage.textContent = message;
        actionStatusMessage.style.color = isError ? 'var(--color-danger)' : 'var(--color-success)';
        setTimeout(() => actionStatusMessage.textContent = '', 4000);
    }

    // ===============================================
    //           MANEJADORES DE EVENTOS
    // ===============================================
    createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newUser = `user${Math.floor(1000 + Math.random() * 9000)}`;
        const newPass = Math.random().toString(36).substring(2, 10);
        const { error } = await clienteSupabase.from('usuarios').insert({ username: newUser, password: newPass, creditos: 0 });
        if (error) { showActionMessage(`Error creando usuario: ${error.message}`, true); } 
        else {
            showActionMessage(`Usuario ${newUser} creado con éxito.`);
            await logActivity('Crear Usuario', `Se creó el usuario: ${newUser}`);
            fetchAndDisplayUsers();
        }
    });

    addCreditsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('addcred_username').value;
        const amount = parseInt(document.getElementById('addcred_amount').value);
        const { data: user, error: fetchError } = await clienteSupabase.from('usuarios').select('creditos').eq('username', username).single();
        if (fetchError) { showActionMessage(`Usuario '${username}' no encontrado.`, true); return; }
        const newTotal = (user.creditos || 0) + amount;
        const { error: updateError } = await clienteSupabase.from('usuarios').update({ creditos: newTotal }).eq('username', username);
        if (updateError) { showActionMessage(`Error al añadir créditos: ${updateError.message}`, true); } 
        else {
            showActionMessage(`Se añadieron ${amount} créditos a ${username}.`);
            await logActivity('Añadir Créditos', `Se añadieron ${amount} créditos a ${username}. Total: ${newTotal}`);
            fetchAndDisplayUsers();
            addCreditsForm.reset();
        }
    });

    setPlanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('plan_username').value;
        const days = parseInt(document.getElementById('plan_days').value);
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + days);
        const { error } = await clienteSupabase.from('usuarios').update({ plan_ilimitado_hasta: expirationDate.toISOString() }).eq('username', username);
        if (error) { showActionMessage(`Error al asignar plan: ${error.message}`, true); }
        else {
            showActionMessage(`Plan de ${days} días asignado a ${username}.`);
            await logActivity('Asignar Plan', `Se asignó un plan de ${days} días a ${username}.`);
            fetchAndDisplayUsers();
            setPlanForm.reset();
        }
    });

    // --- LÓGICA DE ELIMINACIÓN MODIFICADA ---
    userTableBody.addEventListener('click', async (e) => {
        const deleteButton = e.target.closest('.delete-btn');
        if (deleteButton) {
            const username = deleteButton.dataset.username;
            
            const confirmed = await showConfirmationModal(
                'Confirmar Eliminación',
                `¿Estás seguro de que quieres eliminar al usuario '${username}'? Esta acción no se puede deshacer.`
            );

            if (confirmed) {
                const { error } = await clienteSupabase.from('usuarios').delete().eq('username', username);
                if (error) {
                    showActionMessage(`Error al eliminar: ${error.message}`, true);
                } else {
                    await logActivity('Eliminar Usuario', `Se eliminó al usuario: ${username}`);
                    fetchAndDisplayUsers();
                }
            }
        }
    });
    
    logoutButton.addEventListener('click', () => {
        sessionStorage.removeItem('activeUser');
        window.location.href = 'index.html';
    });

    // ===============================================
    //           INICIALIZACIÓN DEL DASHBOARD
    // ===============================================
    checkAdminAuth();
    fetchAndDisplayUsers();
    fetchAndDisplayActivityLog();
});
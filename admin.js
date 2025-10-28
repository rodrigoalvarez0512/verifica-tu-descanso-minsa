document.addEventListener('DOMContentLoaded', async function() {

    const userTableBody = document.getElementById('userTableBody');
    const activityLogBody = document.getElementById('activityLogBody');
    const actionStatusMessage = document.getElementById('actionStatusMessage');
    const createUserForm = document.getElementById('createUserForm');
    const addCreditsForm = document.getElementById('addCreditsForm');
    const setPlanForm = document.getElementById('setPlanForm');
    const logoutButton = document.getElementById('logoutButton');
    const modalOverlay = document.getElementById('confirmationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');

    async function checkAdminAuth() {
        try {
            const { data: { session }, error: sessionError } = await clienteSupabase.auth.getSession();
            if (sessionError || !session || !session.user) {
                console.log("No hay sesión de admin válida.", sessionError || 'No session');
                window.location.href = 'index.html';
                return false;
            }
            const user = session.user;
            const ADMIN_AUTH_EMAIL = atob('YWRtaW4ubWluc2EuYXBwQGF1dGgubG9jYWw=');
            if (user.email !== ADMIN_AUTH_EMAIL) {
                console.log("Acceso denegado. Usuario no es admin:", user.email);
                await clienteSupabase.auth.signOut();
                window.location.href = 'index.html';
                return false;
            } else {
                console.log("Acceso de administrador concedido para:", user.email);
                return true;
            }
        } catch (error) {
            console.error("Error en checkAdminAuth:", error);
            window.location.href = 'index.html';
            return false;
        }
    }

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
             modalOverlay.onclick = (e) => {
                 if (e.target === modalOverlay) {
                    modalOverlay.classList.add('hidden');
                    resolve(false);
                 }
            }
        });
    }

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
        const { data: logs, error } = await clienteSupabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(20);
        if (error) { console.error('Error fetching activity log:', error); return; }
        activityLogBody.innerHTML = '';
        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(log.created_at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>${log.command_name}</td>
                <td>${log.details}</td>
            `;
            activityLogBody.appendChild(tr);
        });
    }

    async function logActivity(command, details) {
        try {
            const { error } = await clienteSupabase.from('activity_log').insert({ command_name: command, details: details });
            if (error) throw error;
            fetchAndDisplayActivityLog();
        } catch (error) {
            console.error('Error logging activity:', error);
            showActionMessage('Error al registrar la actividad.', true);
        }
    }

    function showActionMessage(message, isError = false) {
        actionStatusMessage.textContent = message;
        actionStatusMessage.className = isError ? 'status-error' : 'status-success';
        actionStatusMessage.style.display = 'block';
        setTimeout(() => {
             if (actionStatusMessage.textContent === message) {
                 actionStatusMessage.style.display = 'none';
                 actionStatusMessage.textContent = '';
             }
        }, 5000);
    }

    const isAdmin = await checkAdminAuth();

    if (isAdmin) {
        fetchAndDisplayUsers();
        fetchAndDisplayActivityLog();

        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newUser = `user${Math.floor(1000 + Math.random() * 9000)}`;
            const newPass = Math.random().toString(36).substring(2, 10);
            try {
                const { error } = await clienteSupabase.from('usuarios').insert({ username: newUser, password: newPass, creditos: 0 });
                if (error) throw error;
                showActionMessage(`Usuario ${newUser} creado con éxito.`);
                await logActivity('Crear Usuario', `Se creó el usuario: ${newUser}`);
                fetchAndDisplayUsers();
            } catch (error) {
                showActionMessage(`Error creando usuario: ${error.message}`, true);
            }
        });

        addCreditsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('addcred_username').value;
            const amountInput = document.getElementById('addcred_amount');
            const amount = parseInt(amountInput.value);
            if (isNaN(amount) || amount <= 0) {
                showActionMessage('La cantidad de créditos debe ser un número positivo.', true);
                return;
            }
            try {
                const { data: user, error: fetchError } = await clienteSupabase.from('usuarios').select('creditos').eq('username', username).single();
                if (fetchError) { showActionMessage(`Usuario '${username}' no encontrado.`, true); return; }
                const newTotal = (user.creditos || 0) + amount;
                const { error: updateError } = await clienteSupabase.from('usuarios').update({ creditos: newTotal }).eq('username', username);
                if (updateError) throw updateError;
                showActionMessage(`Se añadieron ${amount} créditos a ${username}.`);
                await logActivity('Añadir Créditos', `Se añadieron ${amount} créditos a ${username}. Total: ${newTotal}`);
                fetchAndDisplayUsers();
                addCreditsForm.reset();
            } catch (error) {
                showActionMessage(`Error al añadir créditos: ${error.message}`, true);
            }
        });

        setPlanForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('plan_username').value;
            const daysInput = document.getElementById('plan_days');
            const days = parseInt(daysInput.value);
             if (isNaN(days) || days <= 0) {
                showActionMessage('La duración del plan debe ser un número positivo.', true);
                return;
            }
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + days);
            try {
                const { error } = await clienteSupabase.from('usuarios').update({ plan_ilimitado_hasta: expirationDate.toISOString() }).eq('username', username);
                if (error) throw error;
                showActionMessage(`Plan de ${days} días asignado a ${username}.`);
                await logActivity('Asignar Plan', `Se asignó un plan de ${days} días a ${username}. Vence: ${expirationDate.toLocaleDateString('es-PE')}`);
                fetchAndDisplayUsers();
                setPlanForm.reset();
            } catch (error) {
                 showActionMessage(`Error al asignar plan: ${error.message}`, true);
            }
        });

        userTableBody.addEventListener('click', async (e) => {
            const deleteButton = e.target.closest('.delete-btn');
            if (deleteButton) {
                const username = deleteButton.dataset.username;
                 if (username === 'admin') {
                    showActionMessage('No se puede eliminar al usuario administrador.', true);
                    return;
                }
                const confirmed = await showConfirmationModal(
                    'Confirmar Eliminación',
                    `¿Estás seguro de que quieres eliminar al usuario '${username}'? Esta acción no se puede deshacer.`
                );
                if (confirmed) {
                    try {
                        const { error } = await clienteSupabase.from('usuarios').delete().eq('username', username);
                        if (error) throw error;
                        await logActivity('Eliminar Usuario', `Se eliminó al usuario: ${username}`);
                        fetchAndDisplayUsers();
                        showActionMessage(`Usuario '${username}' eliminado.`, false);
                    } catch (error) {
                        showActionMessage(`Error al eliminar: ${error.message}`, true);
                    }
                }
            }
        });

        logoutButton.addEventListener('click', async () => {
            sessionStorage.removeItem('activeUserDetails');
            try {
                 const { error } = await clienteSupabase.auth.signOut();
                 if (error) console.error("Error al cerrar sesión de Supabase:", error);
             } catch (e) {
                 console.error("Error inesperado en signOut:", e);
             } finally {
                window.location.href = 'index.html';
             }
        });
    } else {
        console.log("Acceso denegado, no se carga el panel.");
        document.body.innerHTML = '<h1>Acceso Denegado</h1><p><a href="index.html">Volver al inicio</a></p>';
    }

});

/*
 * ===============================================
 * SCRIPT ADMIN.JS (v4 - REDISEÑO + RESET PASSWORD)
 * ===============================================
 */

document.addEventListener('DOMContentLoaded', async function() {

    // --- ELEMENTOS DEL DOM ---
    const userTableBody = document.getElementById('userTableBody');
    const activityLogBody = document.getElementById('activityLogBody');
    const actionStatusMessage = document.getElementById('actionStatusMessage');
    const createUserForm = document.getElementById('createUserForm');
    const addCreditsForm = document.getElementById('addCreditsForm');
    const setPlanForm = document.getElementById('setPlanForm');
    const logoutButton = document.getElementById('logoutButton');
    
    // Modal de Confirmación (Borrar)
    const confirmationModal = document.getElementById('confirmationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');

    // Modal de Reset Password (¡NUEVO!)
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

    // --- FUNCIONES DE UI (MODAL Y MENSAJES) ---

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

    function showActionMessage(message, isError = false) {
        actionStatusMessage.textContent = message;
        actionStatusMessage.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
        actionStatusMessage.style.display = 'block';
        
        // Aumentado a 10 segundos para dar tiempo a copiar contraseñas
        setTimeout(() => {
             if (actionStatusMessage.textContent === message) {
                 actionStatusMessage.style.display = 'none';
                 actionStatusMessage.textContent = '';
             }
        }, 10000); 
    }
    
    // --- FUNCIONES DE DATOS (FETCH Y LOG) ---

    async function fetchAndDisplayUsers() {
        const { data: users, error } = await clienteSupabase
            .from('usuarios')
            .select('*')
            .order('username', { ascending: true });
            
        if (error) { 
            console.error('Error fetching users:', error); 
            showActionMessage(`Error al cargar usuarios: ${error.message}`, true);
            return; 
        }
        
        userTableBody.innerHTML = ''; // Limpiar tabla
        users.forEach(user => {
            if (user.username === 'admin') return; // Ocultar al admin de la lista

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
            
            // ¡HTML de la fila actualizado con nuevos botones!
            tr.innerHTML = `
                <td><strong>${user.username}</strong></td>
                <td>${user.creditos}</td>
                <td>${planStatusHTML}</td>
                <td>
                    <button class="action-button reset" data-username="${user.username}" data-userid="${user.user_id}" title="Restablecer Contraseña">
                        <i class="bi bi-key-fill"></i>
                    </button>
                    <button class="action-button delete" data-username="${user.username}" title="Eliminar Usuario">
                        <i class="bi bi-trash-fill"></i>
                    </button>
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
            .limit(20);
            
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
            const { error } = await clienteSupabase
                .from('activity_log')
                .insert({ command_name: command, details: details });
            if (error) throw error;
            fetchAndDisplayActivityLog();
        } catch (error) {
            console.error('Error logging activity:', error);
            showActionMessage('Error al registrar la actividad.', true);
        }
    }

    // --- LÓGICA PRINCIPAL (EVENT LISTENERS) ---

    const isAdmin = await checkAdminAuth();
    if (!isAdmin) return; // Detener todo si no es admin

    // Carga inicial
    fetchAndDisplayUsers();
    fetchAndDisplayActivityLog();

    // Widget: "CREAR USUARIO"
    createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newUser = `user${Math.floor(1000 + Math.random() * 9000)}`;
        const newPass = Math.random().toString(36).substring(2, 10);
        const newEmail = `${newUser}@mi-app.com`;

        try {
            // PASO 1: Crear en Auth
            const { data: authData, error: authError } = await clienteSupabase.auth.signUp({
                email: newEmail,
                password: newPass
            });
            if (authError) throw new Error(`Error de Auth: ${authError.message}`);
            if (!authData.user) throw new Error('No se pudo crear el usuario en Auth.');
            
            const newUserId = authData.user.id;

            // PASO 2: Insertar en 'usuarios'
            const { error: insertError } = await clienteSupabase
                .from('usuarios')
                .insert({ username: newUser, creditos: 0, user_id: newUserId });
            if (insertError) throw new Error(`Error al insertar en 'usuarios': ${insertError.message}`);

            // ¡ÉXITO!
            showActionMessage(`Usuario ${newUser} creado. Contraseña: ${newPass}`, false);
            await logActivity('Crear Usuario', `Se creó el usuario: ${newUser}`);
            fetchAndDisplayUsers();

        } catch (error) {
            showActionMessage(`Error creando usuario: ${error.message}`, true);
        }
    });

    // Widget: "AÑADIR CRÉDITOS"
    addCreditsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('addcred_username').value;
        const amountInput = document.getElementById('addcred_amount');
        const amount = parseInt(amountInput.value);
        
        if (isNaN(amount) || amount <= 0) {
            showActionMessage('La cantidad debe ser un número positivo.', true);
            return;
        }
        
        try {
            const { data: user, error: fetchError } = await clienteSupabase
                .from('usuarios')
                .select('creditos')
                .eq('username', username)
                .single();
            if (fetchError) throw new Error(`Usuario '${username}' no encontrado.`);
            
            const newTotal = (user.creditos || 0) + amount;
            const { error: updateError } = await clienteSupabase
                .from('usuarios')
                .update({ creditos: newTotal })
                .eq('username', username);
            if (updateError) throw updateError;
            
            showActionMessage(`Se añadieron ${amount} créditos a ${username}.`);
            await logActivity('Añadir Créditos', `Se añadieron ${amount} créditos a ${username}. Total: ${newTotal}`);
            fetchAndDisplayUsers();
            addCreditsForm.reset();
            
        } catch (error) {
            showActionMessage(error.message, true);
        }
    });

    // Widget: "ASIGNAR PLAN"
    setPlanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('plan_username').value;
        const daysInput = document.getElementById('plan_days');
        const days = parseInt(daysInput.value);
        
         if (isNaN(days) || days <= 0) {
            showActionMessage('La duración debe ser un número positivo.', true);
            return;
        }
        
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + days);
        
        try {
            const { error } = await clienteSupabase
                .from('usuarios')
                .update({ plan_ilimitado_hasta: expirationDate.toISOString() })
                .eq('username', username);
            if (error) throw new Error(`Usuario '${username}' no encontrado o error al actualizar.`);
            
            showActionMessage(`Plan de ${days} días asignado a ${username}.`);
            await logActivity('Asignar Plan', `Se asignó plan de ${days} días a ${username}.`);
            fetchAndDisplayUsers();
            setPlanForm.reset();
            
        } catch (error) {
             showActionMessage(error.message, true);
        }
    });

    // --- MANEJADOR DE CLICS EN LA TABLA (BORRAR Y RESTABLECER) ---
    userTableBody.addEventListener('click', async (e) => {
        
        // --- Lógica para BORRAR ---
        const deleteButton = e.target.closest('.delete');
        if (deleteButton) {
            const username = deleteButton.dataset.username;
            const confirmed = await showConfirmationModal(
                'Confirmar Eliminación',
                `¿Seguro que quieres eliminar a '${username}'? Esta acción NO se puede deshacer.`
            );
            
            if (confirmed) {
                try {
                    // Borrar de la tabla 'usuarios'
                    const { error: deleteError } = await clienteSupabase
                        .from('usuarios')
                        .delete()
                        .eq('username', username);
                    if (deleteError) throw new Error(`Error al borrar de 'usuarios': ${deleteError.message}`);

                    showActionMessage(`Usuario '${username}' eliminado de la tabla.`);
                    await logActivity('Eliminar Usuario', `Se eliminó al usuario: ${username}`);
                    fetchAndDisplayUsers();
                    
                    // Nota: Borrar de 'auth.users' requiere una "Edge Function"
                    // o la llave "service_role", lo cual es inseguro desde el cliente.
                    // Por ahora, solo lo borramos de la tabla de créditos.
                    
                } catch (error) {
                    showActionMessage(error.message, true);
                }
            }
        }
        
        // --- Lógica para RESTABLECER CONTRASEÑA (¡NUEVO!) ---
        const resetButton = e.target.closest('.reset');
        if (resetButton) {
            const username = resetButton.dataset.username;
            const userId = resetButton.dataset.userid; // ¡El UUID!
            
            resetPassUsername.textContent = username; // Poner nombre en el modal
            resetPassInput.value = ''; // Limpiar input
            resetPassError.style.display = 'none';
            resetPasswordModal.classList.remove('hidden');

            // Manejador para el botón "Generar"
            generatePassBtn.onclick = () => {
                const newPass = Math.random().toString(36).substring(2, 10);
                resetPassInput.value = newPass;
            };

            // Manejador para el botón "Cancelar"
            modalCancelResetBtn.onclick = () => {
                resetPasswordModal.classList.add('hidden');
            };

            // Manejador para "Actualizar Contraseña"
            modalConfirmResetBtn.onclick = async () => {
                const newPassword = resetPassInput.value;
                if (newPassword.length < 6) {
                    resetPassError.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                    resetPassError.style.display = 'block';
                    return;
                }
                
                try {
                    // Esta es la función mágica de Admin API
                    const { data, error } = await clienteSupabase.auth.admin.updateUserById(
                        userId, // El UUID del usuario
                        { password: newPassword } // El objeto con la nueva contraseña
                    );
                    
                    if (error) {
                        // Captura errores comunes de Supabase (ej: contraseña débil)
                        if (error.message.includes("weak password")) {
                           throw new Error("Contraseña débil. Use una más larga o compleja.");
                        }
                        throw error;
                    }

                    // ¡Éxito!
                    resetPasswordModal.classList.add('hidden');
                    showActionMessage(`Contraseña de ${username} actualizada a: ${newPassword}`, false);
                    await logActivity('Restablecer Pass', `Se restableció la contraseña de ${username}.`);

                } catch (error) {
                    resetPassError.textContent = `Error: ${error.message}`;
                    resetPassError.style.display = 'block';
                }
            };
        }
    });

    // --- BOTÓN "CERRAR SESIÓN" ---
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
});

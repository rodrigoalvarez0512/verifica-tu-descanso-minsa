/*
 * ===============================================
 * SCRIPT ADMIN.JS (ACTUALIZADO - LOGIN SEGURO)
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
    const modalOverlay = document.getElementById('confirmationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');

    // --- AUTENTICACIÓN Y PERMISOS ---
    
    async function checkAdminAuth() {
        try {
            // 1. Verificar si hay una sesión activa
            const { data: { session }, error: sessionError } = await clienteSupabase.auth.getSession();
            if (sessionError || !session || !session.user) {
                console.log("No hay sesión de admin válida.", sessionError || 'No session');
                window.location.href = 'index.html'; // Redirigir al login
                return false;
            }
            
            const user = session.user;
            
            // 2. Verificar si el email de la sesión es el email del admin
            const ADMIN_AUTH_EMAIL = atob('YWRtaW4ubWluc2EuYXBwQGF1dGgubG9jYWw='); // Email codificado
            if (user.email !== ADMIN_AUTH_EMAIL) {
                console.log("Acceso denegado. Usuario no es admin:", user.email);
                await clienteSupabase.auth.signOut(); // Cerrar sesión si no es admin
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
        modalOverlay.classList.remove('hidden');
        
        // Retornar una promesa que se resuelve con true (confirmar) o false (cancelar)
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
                 if (e.target === modalOverlay) { // Si se hace clic fuera del modal
                    modalOverlay.classList.add('hidden');
                    resolve(false);
                 }
            }
        });
    }

    function showActionMessage(message, isError = false) {
        actionStatusMessage.textContent = message;
        actionStatusMessage.className = isError ? 'status-error' : 'status-success';
        actionStatusMessage.style.display = 'block';
        
        // Ocultar mensaje después de 5 segundos
        setTimeout(() => {
             if (actionStatusMessage.textContent === message) {
                 actionStatusMessage.style.display = 'none';
                 actionStatusMessage.textContent = '';
             }
        }, 5000);
    }
    
    // --- FUNCIONES DE DATOS (FETCH Y LOG) ---

    async function fetchAndDisplayUsers() {
        // Ahora lee la tabla 'usuarios' (que ya no tiene password)
        const { data: users, error } = await clienteSupabase
            .from('usuarios')
            .select('*'); // Selecciona username, creditos, plan, user_id, etc.
            
        if (error) { 
            console.error('Error fetching users:', error); 
            showActionMessage(`Error al cargar usuarios: ${error.message}`, true);
            return; 
        }
        
        userTableBody.innerHTML = ''; // Limpiar tabla
        users.forEach(user => {
            const tr = document.createElement('tr');
            
            // Lógica para mostrar estado del plan
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
            
            // Ya no se muestra la contraseña.
            tr.innerHTML = `
                <td>${user.username}</td>
                <td>${user.creditos}</td>
                <td>${planStatusHTML}</td>
                <td><button class="delete-btn" data-username="${user.username}" title="Eliminar Usuario"><i class="bi bi-trash-fill"></i></button></td>
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
        
        activityLogBody.innerHTML = ''; // Limpiar log
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
            fetchAndDisplayActivityLog(); // Actualizar el log en la UI
        } catch (error) {
            console.error('Error logging activity:', error);
            showActionMessage('Error al registrar la actividad.', true);
        }
    }

    // --- LÓGICA PRINCIPAL (EVENT LISTENERS) ---

    // 1. Verificar si el usuario es Admin
    const isAdmin = await checkAdminAuth();

    // 2. Si es Admin, cargar datos y activar formularios
    if (isAdmin) {
        fetchAndDisplayUsers();
        fetchAndDisplayActivityLog();

        // ==============================================================
        // === BOTÓN "CREAR USUARIO" (ACTUALIZADO Y SEGURO) ===
        // ==============================================================
        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 1. Generar credenciales aleatorias
            const newUser = `user${Math.floor(1000 + Math.random() * 9000)}`;
            const newPass = Math.random().toString(36).substring(2, 10);
            const newEmail = `${newUser}@mi-app.com`; // Aplicamos el "truco del email falso"

            try {
                // --- PASO 1: Crear el usuario en el sistema seguro de Auth ---
                // (Esto requiere la política RLS de INSERT que creamos)
                const { data: authData, error: authError } = await clienteSupabase.auth.signUp({
                    email: newEmail,
                    password: newPass
                });

                if (authError) {
                    throw new Error(`Error de Auth: ${authError.message}`);
                }

                if (!authData.user) {
                    throw new Error('No se pudo crear el usuario en Auth, pero no hubo error.');
                }

                // Obtenemos el ID (uuid) del usuario recién creado
                const newUserId = authData.user.id;

                // --- PASO 2: Insertar la fila de créditos en la tabla 'usuarios' ---
                // (Esto también requiere la política RLS de INSERT)
                const { error: insertError } = await clienteSupabase
                    .from('usuarios')
                    .insert({
                        username: newUser,   // Guardamos el username para verlo en el panel
                        creditos: 0,
                        user_id: newUserId   // ¡El vínculo clave!
                    });

                if (insertError) {
                    // Si esto falla, tenemos un usuario "huérfano" en Auth sin créditos.
                    // Es un problema, pero al menos el sistema es seguro.
                    throw new Error(`Error al insertar en tabla 'usuarios': ${insertError.message}`);
                }

                // ¡Éxito!
                showActionMessage(`Usuario ${newUser} creado con éxito. Contraseña: ${newPass}`);
                await logActivity('Crear Usuario', `Se creó el usuario: ${newUser}`);
                fetchAndDisplayUsers(); // Recargar la tabla

            } catch (error) {
                showActionMessage(`Error creando usuario: ${error.message}`, true);
            }
        });
        // ==============================================================
        // === FIN DE "CREAR USUARIO" ===
        // ==============================================================


        // --- FORMULARIO "AÑADIR CRÉDITOS" (Sin cambios, ya funciona con RLS) ---
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
                // 1. Obtener los créditos actuales
                const { data: user, error: fetchError } = await clienteSupabase
                    .from('usuarios')
                    .select('creditos')
                    .eq('username', username) // Buscar por username
                    .single();
                    
                if (fetchError) { 
                    showActionMessage(`Usuario '${username}' no encontrado.`, true); 
                    return; 
                }
                
                // 2. Calcular y actualizar
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
                showActionMessage(`Error al añadir créditos: ${error.message}`, true);
            }
        });

        // --- FORMULARIO "ASIGNAR PLAN" (Sin cambios, ya funciona con RLS) ---
        setPlanForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('plan_username').value;
            const daysInput = document.getElementById('plan_days');
            const days = parseInt(daysInput.value);
            
             if (isNaN(days) || days <= 0) {
                showActionMessage('La duración del plan debe ser un número positivo.', true);
                return;
            }
            
            // Calcular fecha de expiración
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + days);
            
            try {
                const { error } = await clienteSupabase
                    .from('usuarios')
                    .update({ plan_ilimitado_hasta: expirationDate.toISOString() })
                    .eq('username', username);
                    
                if (error) throw error;
                
                showActionMessage(`Plan de ${days} días asignado a ${username}.`);
                await logActivity('Asignar Plan', `Se asignó un plan de ${days} días a ${username}. Vence: ${expirationDate.toLocaleDateString('es-PE')}`);
                fetchAndDisplayUsers();
                setPlanForm.reset();
                
            } catch (error) {
                 showActionMessage(`Error al asignar plan: ${error.message}`, true);
            }
        });

        // --- BOTÓN "BORRAR USUARIO" (MODIFICADO LIGERAMENTE) ---
        userTableBody.addEventListener('click', async (e) => {
            const deleteButton = e.target.closest('.delete-btn');
            if (deleteButton) {
                const username = deleteButton.dataset.username;
                
                 if (username === 'admin') { // El username 'admin' de la tabla 'usuarios'
                    showActionMessage('No se puede eliminar al usuario administrador.', true);
                    return;
                }
                
                // Pedir confirmación
                const confirmed = await showConfirmationModal(
                    'Confirmar Eliminación',
                    `¿Estás seguro de que quieres eliminar al usuario '${username}'? Esta acción NO se puede deshacer y también borrará su login.`
                );
                
                if (confirmed) {
                    try {
                        // 1. Obtener el user_id (uuid) de la tabla 'usuarios'
                         const { data: user, error: fetchError } = await clienteSupabase
                            .from('usuarios')
                            .select('user_id')
                            .eq('username', username)
                            .single();

                        if (fetchError || !user || !user.user_id) {
                            throw new Error(`No se encontró el UUID para ${username}. Borrando solo de la tabla...`);
                        }
                        
                        // 2. Borrar al usuario de la tabla 'usuarios' (usando RLS de Admin)
                        const { error: deleteError } = await clienteSupabase
                            .from('usuarios')
                            .delete()
                            .eq('username', username);
                            
                        if (deleteError) throw new Error(`Error al borrar de tabla: ${deleteError.message}`);

                        // 3. Borrar al usuario del sistema Auth usando su UUID
                        // Esto requiere una llave especial (Service Key), pero
                        // como el admin está logueado, intentará hacerlo.
                        // Si falla, es porque RLS de Auth lo previene.
                        // ¡PARA QUE ESTO FUNCIONE, EL ADMIN DEBE TENER PERMISOS DE 'supabase_admin' O USAR UNA EDGE FUNCTION!
                        // Por ahora, asumimos que fallará si no está configurado,
                        // pero al menos lo borra de la tabla 'usuarios'.
                        
                        // Intento de borrado en Auth (puede fallar si no es Service Role)
                        const { error: authDeleteError } = await clienteSupabase.auth.admin.deleteUser(user.user_id);
                        if (authDeleteError) {
                             console.warn(`Usuario ${username} borrado de la tabla 'usuarios', pero falló al borrar de 'Auth'. Error: ${authDeleteError.message}`);
                             showActionMessage(`Usuario '${username}' borrado de la tabla (Auth falló, borrar manualmente).`, true);
                        } else {
                            showActionMessage(`Usuario '${username}' eliminado COMPLETAMENTE.`, false);
                        }

                        await logActivity('Eliminar Usuario', `Se eliminó al usuario: ${username}`);
                        fetchAndDisplayUsers();
                        
                    } catch (error) {
                        showActionMessage(`Error al eliminar: ${error.message}`, true);
                    }
                }
            }
        });

        // --- BOTÓN "CERRAR SESIÓN" ---
        logoutButton.addEventListener('click', async () => {
            sessionStorage.removeItem('activeUserDetails'); // Limpiar sesión local
            try {
                 const { error } = await clienteSupabase.auth.signOut(); // Cerrar sesión de Supabase
                 if (error) console.error("Error al cerrar sesión de Supabase:", error);
             } catch (e) {
                 console.error("Error inesperado en signOut:", e);
             } finally {
                window.location.href = 'index.html'; // Enviar al login
             }
        });
    } else {
        // Si checkAdminAuth() devuelve false
        console.log("Acceso denegado, no se carga el panel.");
        document.body.innerHTML = '<h1>Acceso Denegado</h1><p>No tiene permisos para ver esta página.</p><p><a href="index.html">Volver al inicio</a></p>';
    }

});

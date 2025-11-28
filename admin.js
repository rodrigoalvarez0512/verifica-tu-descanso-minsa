/*
 * ===============================================
 * SCRIPT ADMIN.JS (v6 - CON DETECTOR DE HACKERS)
 * ===============================================
 */

document.addEventListener('DOMContentLoaded', async function() {

    // --- ELEMENTOS DEL DOM ---
    const userTableBody = document.getElementById('userTableBody');
    const activityLogBody = document.getElementById('activityLogBody');
    const actionStatusMessage = document.getElementById('actionStatusMessage');
    const mainHeader = document.querySelector('.main-header'); // Para insertar la alerta
    
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

    // --- AUTENTICACIÓN ---
    async function checkAdminAuth() {
        try {
            const { data: { session }, error } = await clienteSupabase.auth.getSession();
            if (error || !session || !session.user) {
                window.location.href = 'index.html'; return false;
            }
            const user = session.user;
            const ADMIN_AUTH_EMAIL = atob('YWRtaW4ubWluc2EuYXBwQGF1dGgubG9jYWw='); // admin.minsa.app@auth.local
            
            if (user.email !== ADMIN_AUTH_EMAIL) {
                await clienteSupabase.auth.signOut();
                window.location.href = 'index.html';
                return false;
            }
            return true;
        } catch (error) {
            window.location.href = 'index.html'; return false;
        }
    }

    // --- UTILS UI ---
    function showActionMessage(message, isError = false) {
        actionStatusMessage.textContent = message;
        actionStatusMessage.className = `status-message ${isError ? 'status-error' : 'status-success'}`;
        actionStatusMessage.style.display = 'block';
        setTimeout(() => { 
            if(actionStatusMessage.textContent === message) actionStatusMessage.style.display = 'none'; 
        }, 5000); 
    }

    function showConfirmationModal(title, message) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        confirmationModal.classList.remove('hidden');
        return new Promise((resolve) => {
            modalConfirmBtn.onclick = () => { confirmationModal.classList.add('hidden'); resolve(true); };
            modalCancelBtn.onclick = () => { confirmationModal.classList.add('hidden'); resolve(false); };
        });
    }

    // --- DETECTOR DE AMENAZAS (NUEVO) ---
    function checkForThreats(logs) {
        // Eliminar alertas previas
        const existingAlert = document.querySelector('.hacking-alert');
        if (existingAlert) existingAlert.remove();

        // Buscar logs sospechosos (marcados en DB o con palabras clave)
        const threats = logs.filter(log => 
            log.is_suspicious === true || 
            log.command_name.includes('Error') ||
            log.details.includes('inválida') ||
            log.details.includes('denegado')
        );

        if (threats.length > 0) {
            const alertBanner = document.createElement('div');
            alertBanner.className = 'hacking-alert';
            alertBanner.innerHTML = `<i class="bi bi-exclamation-triangle-fill"></i> ¡ALERTA: POSIBLE HACKEO O ACTIVIDAD SOSPECHOSA DETECTADA!`;
            // Insertar después del header
            mainHeader.parentNode.insertBefore(alertBanner, mainHeader.nextSibling);
        }
    }

    // --- CARGAR DATOS ---
    async function fetchAndDisplayUsers() {
        const { data: users, error } = await clienteSupabase
            .from('usuarios')
            .select('*')
            .order('username', { ascending: true });
            
        if (error) { console.error(error); return; }
        
        userTableBody.innerHTML = '';
        users.forEach(user => {
            if (user.username === 'admin') return; 
            const tr = document.createElement('tr');
            
            // Lógica de Plan
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
                    <button class="action-button reset" data-username="${user.username}" data-userid="${user.user_id}"><i class="bi bi-key-fill"></i></button>
                    <button class="action-button delete" data-username="${user.username}"><i class="bi bi-trash-fill"></i></button>
                </td>
            `;
            userTableBody.appendChild(tr);
        });
    }

    async function fetchAndDisplayActivityLog() {
        // Pedimos también la columna ip_address
        const { data: logs, error } = await clienteSupabase
            .from('activity_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
            
        if (error) { console.error('Error log:', error); return; }
        
        checkForThreats(logs);

        activityLogBody.innerHTML = '';
        logs.forEach(log => {
            const tr = document.createElement('tr');
            
            if (log.is_suspicious) {
                tr.classList.add('row-suspicious');
            }

            const fecha = new Date(log.created_at).toLocaleString('es-PE', { 
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
            });

            // AÑADIMOS LA IP AL TEXTO DE DETALLES
            const ipInfo = log.ip_address ? ` <br><span style="font-size:0.8em; color:#666;">IP: ${log.ip_address}</span>` : '';

            tr.innerHTML = `
                <td>${fecha}</td>
                <td>${log.command_name}</td>
                <td>${log.details} ${ipInfo}</td>
            `;
            activityLogBody.appendChild(tr);
        });
    }

    async function logActivity(command, details, isSuspicious = false) {
        await clienteSupabase.from('activity_log').insert({ 
            command_name: command, 
            details: details,
            is_suspicious: isSuspicious
        });
        fetchAndDisplayActivityLog();
    }

    // --- INICIO ---
    const isAdmin = await checkAdminAuth();
    if (!isAdmin) return;

    fetchAndDisplayUsers();
    fetchAndDisplayActivityLog();
    
    // Auto-refresh logs cada 30 segundos (Monitoreo)
    setInterval(fetchAndDisplayActivityLog, 30000);

    // --- EVENT LISTENERS DE FORMULARIOS (Simplificados) ---

    // 1. Crear Usuario
    createUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newUser = `user${Math.floor(Math.random() * 10000)}`;
        const newPass = Math.random().toString(36).slice(-8);
        try {
            const { data, error } = await clienteSupabase.auth.signUp({
                email: `${newUser}@mi-app.com`, password: newPass
            });
            if (error) throw error;
            showActionMessage(`Creado: ${newUser} | Pass: ${newPass}`);
            await logActivity('Crear Usuario', `Admin creó a ${newUser}`);
            fetchAndDisplayUsers();
        } catch (err) { showActionMessage(err.message, true); }
    });

    // 2. Añadir Créditos
    addCreditsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('addcred_username').value;
        const amount = parseInt(document.getElementById('addcred_amount').value);
        try {
            const { data: userData, error: fetchErr } = await clienteSupabase.from('usuarios').select('creditos').eq('username', user).single();
            if (fetchErr) throw new Error('Usuario no encontrado');
            
            await clienteSupabase.from('usuarios').update({ creditos: (userData.creditos || 0) + amount }).eq('username', user);
            
            showActionMessage(`${amount} créditos añadidos a ${user}`);
            await logActivity('Créditos', `Admin sumó ${amount} a ${user}`);
            fetchAndDisplayUsers();
            addCreditsForm.reset();
        } catch (err) { showActionMessage(err.message, true); }
    });

    // 3. Plan Ilimitado
    setPlanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('plan_username').value;
        const days = parseInt(document.getElementById('plan_days').value);
        const date = new Date(); date.setDate(date.getDate() + days);
        try {
            const { error } = await clienteSupabase.from('usuarios').update({ plan_ilimitado_hasta: date.toISOString() }).eq('username', user);
            if (error) throw error;
            showActionMessage(`Plan asignado a ${user} por ${days} días`);
            await logActivity('Plan', `Admin asignó plan a ${user}`);
            fetchAndDisplayUsers();
            setPlanForm.reset();
        } catch (err) { showActionMessage(err.message, true); }
    });

    // 4. Acciones de Tabla (Borrar/Reset)
    userTableBody.addEventListener('click', async (e) => {
        // Borrar
        if (e.target.closest('.delete')) {
            const user = e.target.closest('.delete').dataset.username;
            if (await showConfirmationModal('Eliminar', `¿Borrar a ${user}?`)) {
                await clienteSupabase.from('usuarios').delete().eq('username', user);
                showActionMessage(`${user} eliminado.`);
                await logActivity('Eliminar', `Admin borró a ${user}`);
                fetchAndDisplayUsers();
            }
        }
        // Reset Pass
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
                    
                    showActionMessage('Contraseña actualizada');
                    await logActivity('Password Reset', `Admin cambió clave de ${btn.dataset.username}`);
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


/*
 * ===============================================
 * SCRIPT PARA VERIFICADOR DE CONSTANCIAS (certificado_minsa.html)
 * v2 - SECCIÓN SÍNTOMAS ELIMINADA
 * ===============================================
 */
document.addEventListener('DOMContentLoaded', function() {
    
    // --- ELEMENTOS DEL DOM ---
    const searchContainer = document.getElementById('search-container');
    const resultsContainer = document.getElementById('results-container');
    const verificationForm = document.getElementById('verification-form');
    const autogInput = document.getElementById('autog-input');
    const verifyButton = document.getElementById('verify-button');
    const buttonText = verifyButton.querySelector('.button-text');
    const buttonLoader = verifyButton.querySelector('.button-loader');
    const formError = document.getElementById('form-error');

    // --- FUNCIONES DE UI ---

    function setButtonLoading(isLoading) {
        verifyButton.disabled = isLoading;
        buttonText.classList.toggle('hidden', isLoading);
        buttonLoader.classList.toggle('hidden', !isLoading);
    }

    function formatDate(dateString) {
        if (!dateString) return 'No disponible';
        const date = new Date(dateString + 'T05:00:00Z'); // Zona Perú
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }

    function displayResults(data) {
        
        // (Se eliminó la lógica de 'sintomasHTML')

        resultsContainer.innerHTML = `
            <div class="result-card result-card--valid">
                <div class="result-card__header">
                    <i class="bi bi-check-circle-fill"></i>
                    <div>
                        <h3 class="result-card__title">Constancia Válida y Auténtica</h3>
                        <p class="result-card__subtitle">La información de la constancia ha sido verificada en el sistema.</p>
                    </div>
                </div>
                <div class="result-card__details">
                    <div class="detail-item"><span class="label">Paciente</span><span class="value">${data.paciente_nombre || 'N/A'}</span></div>
                    <div class="detail-item"><span class="label">DNI</span><span class="value">${data.paciente_dni || 'N/A'}</span></div>
                    <div class="detail-item"><span class="label">Código AUTOG.</span><span class="value">${data.autog || 'N/A'}</span></div>
                    <div class="detail-item"><span class="label">Hospital</span><span class="value">${data.hospital || 'N/A'}</span></div>
                    <div class="detail-item"><span class="label">Diagnóstico</span><span class="value">${data.diagnostico || 'N/A'}</span></div>
                    <div class="detail-item"><span class="label">Inicio Descanso</span><span class="value">${formatDate(data.descanso_inicio)}</span></div>
                    <div class="detail-item"><span class="label">Fin Descanso</span><span class="value">${formatDate(data.descanso_fin)}</span></div>
                    <div class="detail-item"><span class="label">Total Días</span><span class="value">${data.descanso_dias || 'N/A'}</span></div>
                    </div>
                <button class="new-search-button" id="newSearchBtn">Nueva Consulta</button>
            </div>
        `;
        searchContainer.classList.add('hidden');
        resultsContainer.classList.remove('hidden');
        document.getElementById('newSearchBtn').addEventListener('click', resetView);
    }

    function displayNotFound(autog) {
        resultsContainer.innerHTML = `
             <div class="result-card result-card--invalid">
                <div class="result-card__header">
                    <i class="bi bi-x-circle-fill"></i>
                    <div>
                        <h3 class="result-card__title">Constancia no Encontrada</h3>
                        <p class="result-card__subtitle">El código AUTOG. ingresado no corresponde a un registro válido.</p>
                    </div>
                </div>
                <div class="result-card__message">
                    <p>No se encontraron resultados para el AUTOG: <strong>${autog}</strong>.</p>
                </div>
                <button class="new-search-button" id="newSearchBtn">Intentar de Nuevo</button>
            </div>
        `;
        searchContainer.classList.add('hidden');
        resultsContainer.classList.remove('hidden');
        document.getElementById('newSearchBtn').addEventListener('click', resetView);
    }

    function resetView() {
        resultsContainer.classList.add('hidden');
        searchContainer.classList.remove('hidden');
        verificationForm.reset();
        formError.textContent = '';
        window.history.pushState({}, document.title, window.location.pathname);
    }
    
    function checkURLParams() {
        const params = new URLSearchParams(window.location.search);
        const autogCode = params.get('autog');
        if (autogCode) {
            autogInput.value = autogCode;
            verificationForm.requestSubmit();
        }
    }

    // --- LÓGICA PRINCIPAL ---
    async function handleSearch(event) {
        event.preventDefault();
        const autogValue = autogInput.value.trim().toUpperCase();
        formError.textContent = '';
        
        if (!autogValue) {
            formError.textContent = 'Por favor, ingrese el código AUTOG.';
            return;
        }
        setButtonLoading(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 600)); 
            const { data, error } = await clienteSupabase
                .from('constancias_minsa') // <-- NUEVA TABLA
                .select()
                .eq('autog', autogValue) // Comparamos 'autog'
                .single();

            if (error && error.code !== 'PGRST116') { throw error; }

            if (data) {
                displayResults(data);
            } else {
                displayNotFound(autogValue);
            }

        } catch (error) {
            console.error('Error en la búsqueda:', error);
            formError.textContent = 'Ocurrió un error en el sistema. Intente más tarde.';
        } finally {
            setButtonLoading(false);
        }
    }

    if (verificationForm) {
        verificationForm.addEventListener('submit', handleSearch);
    }
    
    checkURLParams();
});
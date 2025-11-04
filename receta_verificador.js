/*
 * ===============================================
 * SCRIPT PARA VERIFICADOR DE RECETAS (receta.html)
 * ===============================================
 */
document.addEventListener('DOMContentLoaded', function() {
    
    // --- ELEMENTOS DEL DOM ---
    const searchContainer = document.getElementById('search-container');
    const resultsContainer = document.getElementById('results-container');
    const verificationForm = document.getElementById('verification-form');
    const autogInput = document.getElementById('autog-input'); // Cambiado de citt-input
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
        // Asume formato YYYY-MM-DD
        const date = new Date(dateString + 'T05:00:00Z'); // Usar T05Z para zona horaria Perú
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}/${month}/${year}`;
    }

    function displayResults(data) {
        // Construir la lista de medicamentos
        let medicamentosHTML = '<ul class="medicamentos-lista">';
        if (data.medicamentos_json && Array.isArray(data.medicamentos_json)) {
            data.medicamentos_json.forEach(item => {
                medicamentosHTML += `
                    <li>
                        <strong>${item.denominacion}</strong> (${item.cantidad})
                        <small>${item.viaAdmin} por ${item.dias} días</small>
                    </li>
                `;
            });
        }
        medicamentosHTML += '</ul>';

        // Mostrar resultados
        resultsContainer.innerHTML = `
            <div class="result-card result-card--valid">
                <div class="result-card__header">
                    <i class="bi bi-check-circle-fill"></i>
                    <div>
                        <h3 class="result-card__title">Receta Válida y Auténtica</h3>
                        <p class="result-card__subtitle">La información de la receta ha sido verificada en el sistema.</p>
                    </div>
                </div>
                <div class="result-card__details">
                    <div class="detail-item"><span class="label">Paciente</span><span class="value">${data.paciente_nombre || 'N/A'}</span></div>
                    <div class="detail-item"><span class="label">DNI</span><span class="value">${data.paciente_dni || 'N/A'}</span></div>
                    <div class="detail-item"><span class="label">Código AUTOG.</span><span class="value">${data.autog || 'N/A'}</span></div>
                    <div class="detail-item"><span class="label">Fecha Emisión</span><span class="value">${formatDate(data.fecha_emision)}</span></div>
                    <div class="detail-item"><span class="label">Médico</span><span class="value">${data.medico_nombre || 'N/A'} (CMP: ${data.medico_cmp || 'N/A'})</span></div>
                    
                    <div class="detail-item detail-item--medicamentos">
                        <span class="label">Medicamentos</span>
                        <span class="value">${medicamentosHTML}</span>
                    </div>
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
                        <h3 class="result-card__title">Receta no Encontrada</h3>
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
    }
    
    function checkURLParams() {
        const params = new URLSearchParams(window.location.search);
        const autogCode = params.get('autog');
        if (autogCode) {
            autogInput.value = autogCode;
            verificationForm.requestSubmit(); // Envía el formulario automáticamente
        }
    }

    // --- LÓGICA PRINCIPAL ---
    async function handleSearch(event) {
        event.preventDefault();
        const autogValue = autogInput.value.trim().toUpperCase(); // Buscamos por AUTOG
        formError.textContent = '';
        
        if (!autogValue) {
            formError.textContent = 'Por favor, ingrese el código AUTOG.';
            return;
        }

        setButtonLoading(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 600)); 

            const { data, error } = await clienteSupabase
                .from('recetas_medicas') // Buscamos en la tabla de recetas
                .select()
                .eq('autog', autogValue) // Comparamos la columna 'autog'
                .single();

            if (error && error.code !== 'PGRST116') { throw error; } // PGRST116 = Not Found

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
    
    checkURLParams(); // Revisa si el AUTOG. vino en la URL
});
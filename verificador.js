document.addEventListener('DOMContentLoaded', function() {
    // ===============================================
    //           ELEMENTOS DEL DOM
    // ===============================================
    const searchContainer = document.getElementById('search-container');
    const resultsContainer = document.getElementById('results-container');
    const verificationForm = document.getElementById('verification-form');
    const cittInput = document.getElementById('citt-input');
    const verifyButton = document.getElementById('verify-button');
    const buttonText = verifyButton.querySelector('.button-text');
    const buttonLoader = verifyButton.querySelector('.button-loader');
    const formError = document.getElementById('form-error');

    // ===============================================
    //           FUNCIONES DE UI (INTERFAZ)
    // ===============================================

    function setButtonLoading(isLoading) {
        verifyButton.disabled = isLoading;
        buttonText.classList.toggle('hidden', isLoading);
        buttonLoader.classList.toggle('hidden', !isLoading);
    }

    function formatDate(dateString) {
        if (!dateString) return 'No disponible';
        const date = new Date(dateString + 'T00:00:00');
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    function displayResults(data) {
        resultsContainer.innerHTML = `
            <div class="result-card result-card--valid">
                <div class="result-card__header">
                    <i class="bi bi-check-circle-fill"></i>
                    <div>
                        <h3 class="result-card__title">Certificado Válido y Auténtico</h3>
                        <p class="result-card__subtitle">La información del CITT ha sido verificada en el sistema.</p>
                    </div>
                </div>
                <div class="result-card__details">
                    <div class="detail-item"><span class="label">Paciente</span><span class="value">${data.nombre_paciente || 'N/A'}</span></div>
                    <div class="detail-item"><span class="label">DNI</span><span class="value">${data.dni || 'N/A'}</span></div>
                    <div class="detail-item"><span class="label">Número CITT</span><span class="value">${data.citt || 'N/A'}</span></div>
                    <div class="detail-item"><span class="label">Inicio de Incapacidad</span><span class="value">${formatDate(data.fecha_inicio)}</span></div>
                    <div class="detail-item"><span class="label">Fin de Incapacidad</span><span class="value">${formatDate(data.fecha_fin)}</span></div>
                    <div class="detail-item"><span class="label">Total de Días</span><span class="value">${data.total_dias || 'N/A'}</span></div>
                </div>
                <button class="new-search-button" id="newSearchBtn">Nueva Consulta</button>
            </div>
        `;
        searchContainer.classList.add('hidden');
        resultsContainer.classList.remove('hidden');
        document.getElementById('newSearchBtn').addEventListener('click', resetView);
    }

    function displayNotFound(citt) {
        resultsContainer.innerHTML = `
             <div class="result-card result-card--invalid">
                <div class="result-card__header">
                    <i class="bi bi-x-circle-fill"></i>
                    <div>
                        <h3 class="result-card__title">Certificado no Encontrado</h3>
                        <p class="result-card__subtitle">El código CITT ingresado no corresponde a un registro válido.</p>
                    </div>
                </div>
                <div class="result-card__message">
                    <p>No se encontraron resultados para el CITT: <strong>${citt}</strong>.</p>
                    <p>Asegúrese de haber ingresado el código correctamente. Si el problema persiste, contacte a la entidad emisora del certificado.</p>
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
        formError.classList.remove('error');
    }

    // ===============================================
    //           LÓGICA PRINCIPAL DE BÚSQUEDA
    // ===============================================
    async function handleSearch(event) {
        event.preventDefault();
        const cittValue = cittInput.value.trim().toUpperCase();
        formError.textContent = '';
        formError.classList.remove('error');
        
        if (!cittValue) {
            formError.textContent = 'Por favor, ingrese el número de CITT.';
            formError.classList.add('error');
            return;
        }

        setButtonLoading(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 600)); 

            const { data, error } = await clienteSupabase
                .from('descansos_medicos')
                .select()
                .eq('citt', cittValue)
                .single();

            if (error && error.code !== 'PGRST116') { throw error; }

            if (data) {
                displayResults(data);
            } else {
                displayNotFound(cittValue);
            }

        } catch (error) {
            console.error('Error en la búsqueda:', error);
            formError.textContent = 'Ocurrió un error en el sistema. Por favor, intente más tarde.';
            formError.classList.add('error');
        } finally {
            setButtonLoading(false);
        }
    }

    if (verificationForm) {
        verificationForm.addEventListener('submit', handleSearch);
    }
});
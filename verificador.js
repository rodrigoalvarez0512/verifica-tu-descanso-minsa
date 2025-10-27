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
    //           *** NUEVA FUNCIÓN ***
    //  Verifica la URL al cargar y busca si hay CITT
    // ===============================================
    function checkUrlForCittAndSearch() {
        const urlParams = new URLSearchParams(window.location.search);
        const cittFromUrl = urlParams.get('citt'); // Busca el parámetro ?citt=...

        if (cittFromUrl) {
            console.log('CITT encontrado en URL, iniciando búsqueda:', cittFromUrl);
            cittInput.value = cittFromUrl; // Rellena el campo de búsqueda

            // Llama a handleSearch automáticamente, pasando null como evento
            // y el CITT de la URL como segundo argumento.
            handleSearch(null, cittFromUrl);
        } else {
            console.log('No se encontró CITT en la URL, esperando entrada manual.');
        }
    }

    // ===============================================
    //           FUNCIONES DE UI (INTERFAZ)
    // ===============================================
    // (Estas funciones no cambian)

    function setButtonLoading(isLoading) {
        verifyButton.disabled = isLoading;
        if (buttonText && buttonLoader) { // Check if elements exist
            buttonText.classList.toggle('hidden', isLoading);
            buttonLoader.classList.toggle('hidden', !isLoading);
        } else { // Fallback if spans are not found
            verifyButton.textContent = isLoading ? 'Verificando...' : 'Verificar Autenticidad';
        }
    }


    function formatDate(dateString) {
        if (!dateString) return 'No disponible';
         // Usar T05:00:00 para asegurar zona horaria Perú al interpretar
        const date = new Date(dateString + 'T05:00:00');
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        // Verificar si la fecha es válida antes de devolver
        if (isNaN(day) || isNaN(month) || isNaN(year)) return 'Fecha inválida';
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
                    ${data.contingencia ? `<div class="detail-item"><span class="label">Contingencia</span><span class="value">${data.contingencia}</span></div>` : ''}
                </div>
                <button class="new-search-button" id="newSearchBtn">Nueva Consulta</button>
            </div>
        `;
        searchContainer.classList.add('hidden');
        resultsContainer.classList.remove('hidden');
        // Asegurarse de añadir el listener DESPUÉS de crear el botón
        const newSearchBtn = document.getElementById('newSearchBtn');
        if (newSearchBtn) {
            newSearchBtn.addEventListener('click', resetView);
        } else {
             console.error("No se encontró el botón 'newSearchBtn' para añadir el listener.")
        }
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
        const newSearchBtn = document.getElementById('newSearchBtn');
         if (newSearchBtn) {
            newSearchBtn.addEventListener('click', resetView);
        } else {
             console.error("No se encontró el botón 'newSearchBtn' para añadir el listener.")
        }
    }

    function resetView() {
        resultsContainer.classList.add('hidden');
        searchContainer.classList.remove('hidden');
        if (verificationForm) verificationForm.reset();
        if (formError) {
            formError.textContent = '';
            formError.classList.remove('error');
        }
        // Limpiar URL sin recargar (opcional, mejora UX)
        window.history.pushState({}, document.title, window.location.pathname);
    }

    // ===============================================
    //       *** MODIFICADO: LÓGICA DE BÚSQUEDA ***
    // Ahora acepta un CITT opcional de la URL
    // ===============================================
    async function handleSearch(event, cittValueFromUrl = null) {
        // Prevenir submit solo si viene del formulario
        if (event) {
            event.preventDefault();
        }

        // Usar el CITT de la URL si existe, si no, el del input
        const cittValue = cittValueFromUrl || (cittInput ? cittInput.value.trim().toUpperCase() : '');
        
        if (formError) { // Limpiar errores previos
             formError.textContent = '';
             formError.classList.remove('error');
        }

        if (!cittValue) {
            // Solo mostrar error si fue intento manual (submit)
            if (event && formError) {
                formError.textContent = 'Por favor, ingrese el número de CITT.';
                formError.classList.add('error');
            }
            return; // No buscar si no hay CITT
        }

        setButtonLoading(true);

        try {
            // Pequeña pausa visual si es automático, más larga si es manual
            const delay = event ? 600 : 100;
            await new Promise(resolve => setTimeout(resolve, delay));

            const { data, error } = await clienteSupabase
                .from('descansos_medicos')
                .select() // Selecciona todas las columnas por defecto
                .eq('citt', cittValue)
                .single(); // Espera solo un resultado o ninguno

            // PGRST116 es el código de Supabase para 'No rows found', no es un error real aquí
            if (error && error.code !== 'PGRST116') {
                throw error; // Lanzar otros errores de Supabase
            }

            if (data) {
                displayResults(data); // Mostrar resultados si se encontró data
            } else {
                displayNotFound(cittValue); // Mostrar "no encontrado" si no hay data (o error PGRST116)
            }

        } catch (error) {
            console.error('Error en la búsqueda:', error);
            if (formError) {
                formError.textContent = `Ocurrió un error: ${error.message || 'Intente más tarde.'}`;
                formError.classList.add('error');
            }
            // Asegurarse de ocultar el contenedor de búsqueda si ya se mostraron resultados antes
             if (!resultsContainer.classList.contains('hidden')) {
                 resultsContainer.classList.add('hidden');
                 searchContainer.classList.remove('hidden');
             }
        } finally {
            setButtonLoading(false);
        }
    }

    // ===============================================
    //               ASIGNACIÓN DE EVENTOS
    // ===============================================
    if (verificationForm) {
        verificationForm.addEventListener('submit', handleSearch);
    } else {
        console.error("Elemento #verification-form no encontrado.");
    }

    // ===============================================
    //      *** NUEVO: LLAMAR A LA VERIFICACIÓN AL CARGAR ***
    // ===============================================
    checkUrlForCittAndSearch();

}); // Fin del DOMContentLoaded

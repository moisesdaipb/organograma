// Variável global para os dados
let dados = [];
let selectedNodeId = null;
let nomesGestores = [];
let chefiasComSubordinados = []; // Nova variável para armazenar chefias com subordinados

// Elementos da interface
const fileInput = document.getElementById('file-input');
const loadingMessage = document.getElementById('loading-message');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const organogramaContainer = document.getElementById('organograma');
const errorMessage = document.getElementById('error-message');
const zoomInButton = document.getElementById('zoom-in');
const zoomOutButton = document.getElementById('zoom-out');
const resetButton = document.getElementById('reset-view');
const capturarOrganogramaButton = document.getElementById('capturar-organograma');
const btnAbrirPopup = document.getElementById('btn-abrir-popup');
const popupChefias = document.getElementById('popup-chefias');
const popupClose = document.getElementById('popup-close');
const listaChefias = document.getElementById('lista-chefias');

// Elementos de filtro do pop-up
const filtroPopupNome = document.getElementById('filtro-popup-nome');
const filtroPopupQuantidade = document.getElementById('filtro-popup-quantidade');
const filtroPopupArea = document.getElementById('filtro-popup-area');


// Variáveis de zoom e pan
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;

// Configurar o listener do input de arquivo
fileInput.addEventListener('change', handleFileSelect, false);

// Inicializar filtro por nome e controles de zoom/pan
document.addEventListener('DOMContentLoaded', () => {
    const filtroNome = document.getElementById('filtro-nome');
    const suggestionsContainer = document.getElementById('suggestions');

    filtroNome.addEventListener('input', (e) => {
        const input = e.target.value.toLowerCase();
        if (input.length >= 2) {
            showSuggestions(input);
        } else {
            suggestionsContainer.style.display = 'none';
            if (input.length === 0) initializeOrganogram();
        }
    });

    filtroNome.addEventListener('focus', () => {
        if (filtroNome.value.length >= 2) {
            showSuggestions(filtroNome.value.toLowerCase());
        }
    });

    document.addEventListener('click', (e) => {
        if (!filtroNome.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });

    // Configurar botões de zoom e pan
    zoomInButton.addEventListener('click', () => {
        zoomLevel += 0.2;
        applyTransform();
    });

    zoomOutButton.addEventListener('click', () => {
        zoomLevel -= 0.2;
        applyTransform();
    });

    resetButton.addEventListener('click', () => {
        zoomLevel = 1;
        panX = 0;
        panY = 0;
        applyTransform();
        initializeOrganogram();
        document.getElementById('filtro-nome').value = '';
        document.getElementById('suggestions').style.display = 'none';
    });

    // Eventos de mouse para pan
    organogramaContainer.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
        organogramaContainer.style.cursor = 'grabbing';
    });

    organogramaContainer.addEventListener('mouseup', () => {
        isDragging = false;
        organogramaContainer.style.cursor = 'grab';
    });

    organogramaContainer.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
    });

    organogramaContainer.addEventListener('mouseleave', () => {
        isDragging = false;
        organogramaContainer.style.cursor = 'grab';
    });

    // Eventos do pop-up
    btnAbrirPopup.addEventListener('click', () => {
        popupChefias.style.display = 'flex';
        renderizarChefias(); // Renderiza as chefias ao abrir o pop-up
    });

    popupClose.addEventListener('click', () => {
        popupChefias.style.display = 'none';
    });

    // Fechar pop-up clicando fora do conteúdo
    popupChefias.addEventListener('click', (e) => {
        if (e.target === popupChefias) {
            popupChefias.style.display = 'none';
        }
    });

    // Eventos para os filtros do pop-up
    filtroPopupNome.addEventListener('input', renderizarChefias);
    filtroPopupQuantidade.addEventListener('input', renderizarChefias);
    filtroPopupArea.addEventListener('change', renderizarChefias);

});

// Funções de autocomplete e filtro principal (existentes)
function showSuggestions(input) {
    const suggestionsContainer = document.getElementById('suggestions');
    suggestionsContainer.innerHTML = '';

    const matches = nomesGestores.filter((nome) => nome.toLowerCase().includes(input));

    if (matches.length > 0) {
        matches.slice(0, 10).forEach((nome) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';

            const startIdx = nome.toLowerCase().indexOf(input);
            const endIdx = startIdx + input.length;

            div.innerHTML = `
        ${nome.substring(0, startIdx)}
        <span class="suggestion-highlight">${nome.substring(startIdx, endIdx)}</span>
        ${nome.substring(endIdx)}
      `;

            div.addEventListener('click', () => {
                document.getElementById('filtro-nome').value = nome;
                suggestionsContainer.style.display = 'none';
                filtrarPorNome(nome); // Chama a função de filtro
            });

            suggestionsContainer.appendChild(div);
        });
        suggestionsContainer.style.display = 'block';
    } else {
        suggestionsContainer.style.display = 'none';
    }
}

function filtrarPorNome(nome) {
    if (!nome || nome.trim() === '') {
        initializeOrganogram();
        return;
    }

    const pessoa = dados.find((p) => p.nome.toLowerCase() === nome.toLowerCase());
    if (!pessoa) {
        organogramaContainer.innerHTML = '<p style="text-align:center; margin-top:50px;">Gestor não encontrado.</p>';
        return;
    }

    const idsParaMostrar = new Set();

    // 1. Adicionar o caminho até o topo
    let currentId = pessoa.id;
    while (currentId) {
        idsParaMostrar.add(currentId);
        const pessoaAtual = dados.find((p) => p.id === currentId);
        currentId = pessoaAtual?.superior;
    }

    // 2. Adicionar TODOS os subordinados abaixo
    const adicionarSubordinados = (id) => {
        dados.filter((p) => p.superior === id).forEach((p) => {
            idsParaMostrar.add(p.id);
            adicionarSubordinados(p.id);
        });
    };
    adicionarSubordinados(pessoa.id);

    // 3. Filtrar e mostrar (mantendo colapsado)
    const dadosFiltrados = dados.filter((p) => idsParaMostrar.has(p.id));
    construirOrganogramaFiltrado(dadosFiltrados);

    // 4. Expandir apenas o primeiro nível
    setTimeout(() => {
        document.querySelectorAll('.tree > ul > li').forEach((li) => {
            li.classList.add('expanded');
            li.classList.remove('collapsed');
        });
    }, 100);
}

function calcularTotalSubordinados(id) {
    const subordinadosDiretos = dados.filter((p) => p.superior === id);
    let total = subordinadosDiretos.length;

    for (const sub of subordinadosDiretos) {
        total += calcularTotalSubordinados(sub.id);
    }

    return total;
}

// Funções de construção do organograma
function buildOrganogram(superiorId = null) {
    const people = dados.filter((p) => p.superior === superiorId);
    if (people.length === 0) return '';

    let html = '<ul>';
    for (const person of people) {
        const numSubordinates = dados.filter((p) => p.superior === person.id).length;
        const totalSubordinates = calcularTotalSubordinados(person.id);
        const hasSubordinates = numSubordinates > 0;
        const subordinatesHTML = hasSubordinates ? buildOrganogram(person.id) : '';
        const areaClass = getAreaClass(person.area, person.superior);
        const isSemGestor = person.nome === 'Sem gestor';

        // Adiciona o botão de email se houver um email para a pessoa
        const emailButtonHtml = person.email ?
            `<button class="email-button" onclick="sendEmail(event, '${person.email}')" title="Enviar e-mail para ${person.nome}">📧</button>` : '';

        html += `
      <li class="collapsed" data-id="${person.id}">
        <div class="${areaClass} ${isSemGestor ? 'sem-gestor' : ''}" onclick="toggleNode(this.parentElement, event)">
          ${hasSubordinates ? `
            <span class="contador-diretos">${numSubordinates}</span>
            <span class="contador-total">${totalSubordinates}</span>
          ` : ''}
          ${emailButtonHtml}
          <span class="cargo">${person.cargo}</span>
          <span class="nome">${person.nome}</span>
          ${person.departamento ? `<div class="departamento">${person.departamento}</div>` : ''}
        </div>
        ${hasSubordinates ? `<button class="expand-icon" onclick="toggleNode(this.parentElement, event)"></button>` : ''}
        ${subordinatesHTML}
      </li>
    `;
    }
    html += '</ul>';
    return html;
}

function construirOrganogramaFiltrado(dadosFiltrados) {
    const existingIds = new Set(dadosFiltrados.map((p) => p.id));
    let rootNodes = dadosFiltrados.filter(
        (p) => p.superior === null || p.superior === 0 || !existingIds.has(p.superior)
    );

    if (rootNodes.length === 0 && dadosFiltrados.length > 0) {
        rootNodes = [dadosFiltrados[0]];
    }

    let html = rootNodes.length > 0 ? '<ul>' : '<p style="text-align:center; margin-top:50px;">Nenhum resultado encontrado para esta busca.</p>';

    for (const person of rootNodes) {
        const numSubordinates = dadosFiltrados.filter((p) => p.superior === person.id).length;
        const totalSubordinates = calcularTotalSubordinados(person.id);
        const hasSubordinates = numSubordinates > 0;
        const subordinatesHTML = hasSubordinates ? buildOrganogramFiltradoRecursive(person.id, dadosFiltrados) : '';
        const areaClass = getAreaClass(person.area, person.superior);
        const isSemGestor = person.nome === 'Sem gestor';

        // Adiciona o botão de email se houver um email para a pessoa
        const emailButtonHtml = person.email ?
            `<button class="email-button" onclick="sendEmail(event, '${person.email}')" title="Enviar e-mail para ${person.nome}">📧</button>` : '';

        html += `
      <li class="collapsed" data-id="${person.id}">
        <div class="${areaClass} ${isSemGestor ? 'sem-gestor' : ''}" onclick="toggleNode(this.parentElement, event)">
          ${hasSubordinates ? `
            <span class="contador-diretos">${numSubordinates}</span>
            <span class="contador-total">${totalSubordinates}</span>
          ` : ''}
          ${emailButtonHtml}
          <span class="cargo">${person.cargo}</span>
          <span class="nome">${person.nome}</span>
          ${person.departamento ? `<div class="departamento">${person.departamento}</div>` : ''}
        </div>
        ${hasSubordinates ? `<button class="expand-icon" onclick="toggleNode(this.parentElement, event)"></button>` : ''}
        ${subordinatesHTML}
      </li>
    `;
    }

    if (rootNodes.length > 0) html += '</ul>';
    organogramaContainer.innerHTML = html;
    organogramaContainer.scrollTo(0, 0);
}

function buildOrganogramFiltradoRecursive(superiorId, dadosFiltrados) {
    const people = dadosFiltrados.filter((p) => p.superior === superiorId);
    if (people.length === 0) return '';

    let html = '<ul>';
    for (const person of people) {
        const numSubordinates = dadosFiltrados.filter((p) => p.superior === person.id).length;
        const totalSubordinates = calcularTotalSubordinados(person.id);
        const hasSubordinates = numSubordinates > 0;
        const subordinatesHTML = hasSubordinates ? buildOrganogramFiltradoRecursive(person.id, dadosFiltrados) : '';
        const areaClass = getAreaClass(person.area, person.superior);
        const isSemGestor = person.nome === 'Sem gestor';

        // Adiciona o botão de email se houver um email para a pessoa
        const emailButtonHtml = person.email ?
            `<button class="email-button" onclick="sendEmail(event, '${person.email}')" title="Enviar e-mail para ${person.nome}">📧</button>` : '';


        html += `
      <li class="collapsed" data-id="${person.id}">
        <div class="${areaClass} ${isSemGestor ? 'sem-gestor' : ''}" onclick="toggleNode(this.parentElement, event)">
          ${hasSubordinates ? `
            <span class="contador-diretos">${numSubordinates}</span>
            <span class="contador-total">${totalSubordinates}</span>
          ` : ''}
          ${emailButtonHtml}
          <span class="cargo">${person.cargo}</span>
          <span class="nome">${person.nome}</span>
          ${person.departamento ? `<div class="departamento">${person.departamento}</div>` : ''}
        </div>
        ${hasSubordinates ? `<button class="expand-icon" onclick="toggleNode(this.parentElement, event)"></button>` : ''}
        ${subordinatesHTML}
      </li>
    `;
    }
    html += '</ul>';
    return html;
}


function getAreaClass(area, superior) {
    if (!area) area = '';
    area = area.toUpperCase();

     if (superior === null || superior === undefined || superior === '' || superior === 0) {
        return 'sem-chefia';
    }

    if (area === 'CORPORATIVO') return 'corporativo';
    if (area.includes('SUPERINTENDÊNCIA') || area.includes('SUPERINTENDENCIA')) return 'superintendencia';
    if (area.includes('SAÚDE') || area.includes('SAUDE')) return 'saude';
    if (area.includes('PUCPR')) return 'pucpr';
    if (area.includes('CMDI')) return 'cmdi';
    if (area.includes('FTD')) return 'ftd';

    return '';
}

// Funções de carregamento e processamento de arquivo (existentes)
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    loadingMessage.style.display = 'block';
    organogramaContainer.innerHTML = '';
    errorMessage.style.display = 'none';
    updateProgress(0);

    const fileExtension = file.name.split('.').pop().toLowerCase();

    if (fileExtension === 'xlsx') {
        loadXLSX(file);
    } else if (fileExtension === 'csv') {
        loadCSV(file);
    } else {
        loadingMessage.style.display = 'none';
        showError('Formato inválido. Use XLSX ou CSV.');
    }
}

function loadXLSX(file) {
    const reader = new FileReader();
    reader.onprogress = (event) => {
        if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            updateProgress(percent * 0.8);
        }
    };
    reader.onload = function (e) {
        try {
            updateProgress(80);
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
            processData(jsonData);
            updateProgress(100);
        } catch (error) {
            console.error('Erro ao processar XLSX:', error);
            showError('Erro ao ler XLSX: ' + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function loadCSV(file) {
    Papa.parse(file, {
        header: true,
        complete: (results) => {
            if (results.errors.length > 0) {
                console.error('Erros no CSV:', results.errors);
                showError('Erro no CSV: ' + results.errors[0].message);
            } else {
                processData(results.data);
            }
        },
        error: (error) => showError('Erro ao carregar CSV: ' + error.message),
        step: (row, parser) => {
            const progress = (parser.bytesRead / file.size) * 100;
            updateProgress(progress * 0.8);
        }
    });
}


function processData(rawData) {
    try {
        dados = [];
        const existingIds = new Set();
        const superioresFaltantes = new Map();

        for (const item of rawData) {
            const idOriginal = item.ID || item.id || item.Id || item['ID Funcionário'] || item['ID_Funcionario'] || '';
            let idString = idOriginal.toString().replace(/F-|-/g, '');
            const id = parseInt(idString, 10) || 0;

            const nome = item.Nome || item.nome || '';
            const cargo = item.Cargo || item.cargo || '';
            const superiorIdOriginal = item['ID Superior'] || item['id_superior'] || item['ID_Superior'] || null;
            let superiorIdString = superiorIdOriginal != null ? superiorIdOriginal.toString().replace(/F-|-/g, '') : "";
            const superiorId = superiorIdString !== null && superiorIdString !== "" ? parseInt(superiorIdString, 10) : null;

            const departamento = item.Departamento || item.departamento || '';
            const area = (item.Área || item.area || '').toUpperCase();
            // Adicionado campo de email para demonstração - Ajuste conforme sua coluna de e-mail real
            const email = item.Email || item.email || '';

            if (!id || isNaN(id) || !nome) continue;

            let uniqueId = id;
            if (existingIds.has(uniqueId)) {
                uniqueId = generateUniqueId(existingIds);
            }
            existingIds.add(uniqueId);

            dados.push({
                id: uniqueId,
                idOriginal: idOriginal,
                nome: nome,
                cargo: cargo,
                superior: superiorId,
                superiorIdOriginal: superiorIdOriginal,
                departamento: departamento,
                area: area,
                email: email // Adiciona o email aos dados
            });
        }

        dados.forEach((pessoa) => {
            if (pessoa.superior && !existingIds.has(pessoa.superior)) {
                if (!superioresFaltantes.has(pessoa.superior) && !dados.some(p => p.id === pessoa.superior && p.nome === 'Sem gestor')) {
                    superioresFaltantes.set(pessoa.superior, {
                        id: pessoa.superior,
                        idOriginal: pessoa.superior.toString(),
                        nome: 'Sem gestor',
                        cargo: '',
                        departamento: '',
                        area: 'SEM CHEFIA',
                        email: '' // Sem email para 'Sem gestor'
                    });
                }
            }
        });

        superioresFaltantes.forEach((superior) => {
            dados.push(superior);
        });

        nomesGestores = dados
            .map((p) => p.nome)
            .filter((nome) => nome && nome.trim() !== '' && nome !== 'Sem gestor')
            .sort((a, b) => a.localeCompare(b));

        prepararChefiasParaPopup();

        initializeOrganogram();
    } catch (error) {
        console.error('Erro ao processar dados:', error);
        showError('Erro ao processar dados: ' + error.message);
    } finally {
        loadingMessage.style.display = 'none';
    }
}

function generateUniqueId(existingIds) {
    let newId = Math.max(...Array.from(existingIds)) + 1;
    if (!isFinite(newId)) {
        newId = 1;
    }
    while (existingIds.has(newId)) {
        newId++;
    }
    return newId;
}


function initializeOrganogram() {
    const existingIds = new Set(dados.map((p) => p.id));
    let rootNodes = dados.filter(
        (p) => p.superior === null || p.superior === 0 || !existingIds.has(p.superior)
    );

    if (rootNodes.length === 0 && dados.length > 0) {
        rootNodes = [dados[0]];
    }

    let html = rootNodes.length > 0 ? '<ul>' : '<p style="text-align:center; margin-top:50px;">Sem dados hierárquicos.</p>';

    for (const person of rootNodes) {
        const numSubordinates = dados.filter((p) => p.superior === person.id).length;
        const totalSubordinates = calcularTotalSubordinados(person.id);
        const hasSubordinates = numSubordinates > 0;
        const subordinatesHTML = hasSubordinates ? buildOrganogram(person.id) : '';
        const areaClass = getAreaClass(person.area, person.superior);
        const isSemGestor = person.nome === 'Sem gestor';

        // Adiciona o botão de email se houver um email para a pessoa
        const emailButtonHtml = person.email ?
            `<button class="email-button" onclick="sendEmail(event, '${person.email}')" title="Enviar e-mail para ${person.nome}">📧</button>` : '';

        html += `
      <li class="collapsed" data-id="${person.id}">
        <div class="${areaClass} ${isSemGestor ? 'sem-gestor' : ''}" onclick="toggleNode(this.parentElement, event)">
          ${hasSubordinates ? `
            <span class="contador-diretos">${numSubordinates}</span>
            <span class="contador-total">${totalSubordinates}</span>
          ` : ''}
          ${emailButtonHtml}
          <span class="cargo">${person.cargo}</span>
          <span class="nome">${person.nome}</span>
          ${person.departamento ? `<div class="departamento">${person.departamento}</div>` : ''}
        </div>
        ${hasSubordinates ? `<button class="expand-icon" onclick="toggleNode(this.parentElement, event)"></button>` : ''}
        ${subordinatesHTML}
      </li>
    `;
    }

    if (rootNodes.length > 0) html += '</ul>';
    organogramaContainer.innerHTML = html;
    organogramaContainer.scrollTo(0, 0);
    applyTransform();
}


function toggleNode(liElement, event) {
    if (event) {
        // Verifica se o clique foi no botão de e-mail ou no ícone de expandir/colapsar
        if (event.target.classList.contains('email-button') || event.target.classList.contains('expand-icon')) {
            event.stopPropagation(); // Impede que o clique no botão de e-mail ou no ícone feche/abra o nó
            return; // Sai da função para não alternar o nó
        }
    }
    // Se o clique não foi nos botões específicos, então alterna a classe do nó
    liElement.classList.toggle('expanded');
    liElement.classList.toggle('collapsed');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    loadingMessage.style.display = 'none';
}

function updateProgress(percent) {
    progressBar.style.width = percent + '%';
    progressText.textContent = Math.round(percent) + '%';
}

function applyTransform() {
    zoomLevel = Math.max(0.2, Math.min(zoomLevel, 3));
    organogramaContainer.style.transform = `scale(${zoomLevel}) translate(${panX}px, ${panY}px)`;
}

capturarOrganogramaButton.addEventListener('click', function () {
    const organograma = document.getElementById('organograma');

    organograma.style.transition = 'none';

    html2canvas(organograma, {
        scale: 2,
        useCORS: true,
        logging: false
    }).then(function (canvas) {
        organograma.style.transition = '';

        const imageData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = imageData;
        link.download = 'organograma.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }).catch(error => {
        console.error('Erro ao capturar organograma:', error);
        alert('Ocorreu um erro ao capturar o organograma. Tente novamente.');
    });
});


// Funções para o pop-up de chefias

function prepararChefiasParaPopup() {
    chefiasComSubordinados = [];
    const todosSuperiores = new Set(dados.map(p => p.superior).filter(s => s !== null && s !== 0));

    for (const chefeId of Array.from(todosSuperiores)) {
        const chefe = dados.find(p => p.id === chefeId);
        if (chefe) {
            const subordinadosDiretos = dados.filter(p => p.superior === chefe.id);
            if (subordinadosDiretos.length > 0) {
                chefiasComSubordinados.push({
                    id: chefe.id,
                    nome: chefe.nome,
                    cargo: chefe.cargo,
                    area: chefe.area,
                    departamento: chefe.departamento,
                    quantidade: subordinadosDiretos.length,
                    email: chefe.email, // Adiciona o email da chefia
                    subordinados: subordinadosDiretos.map(sub => ({
                        nome: sub.nome,
                        cargo: sub.cargo,
                        email: sub.email // Adiciona o email do subordinado
                    })).sort((a, b) => a.nome.localeCompare(b.nome))
                });
            }
        }
    }
    chefiasComSubordinados.sort((a, b) => a.nome.localeCompare(b.nome));
}

function renderizarChefias() {
    listaChefias.innerHTML = '';

    let chefiasFiltradas = [...chefiasComSubordinados];

    const filtroNomeVal = filtroPopupNome.value.toLowerCase();
    const filtroQuantidadeVal = parseInt(filtroPopupQuantidade.value);
    const filtroAreaVal = filtroPopupArea.value.toUpperCase();

    if (filtroNomeVal) {
        chefiasFiltradas = chefiasFiltradas.filter(chefe =>
            chefe.nome.toLowerCase().includes(filtroNomeVal) ||
            chefe.cargo.toLowerCase().includes(filtroNomeVal) ||
            chefe.departamento.toLowerCase().includes(filtroNomeVal)
        );
    }

    if (!isNaN(filtroQuantidadeVal) && filtroQuantidadeVal >= 0) {
        chefiasFiltradas = chefiasFiltradas.filter(chefe => chefe.quantidade === filtroQuantidadeVal);
    }

    if (filtroAreaVal && filtroAreaVal !== '') {
        chefiasFiltradas = chefiasFiltradas.filter(chefe => {
            const chefeArea = chefe.area ? chefe.area.toUpperCase() : '';
            if (chefeArea === 'SEM CHEFIA' || chefeArea.includes('SUPERINTENDÊNCIA') || chefeArea.includes('SUPERINTENDENCIA')) {
                return false;
            }
            return chefeArea.includes(filtroAreaVal);
        });
    }


    if (chefiasFiltradas.length === 0) {
        listaChefias.innerHTML = '<li style="text-align: center; color: #777; padding: 20px;">Nenhuma chefia encontrada com os filtros aplicados.</li>';
        return;
    }

    chefiasFiltradas.forEach(chefe => {
        const li = document.createElement('li');
        // Adiciona a classe 'collapsed-icon' inicialmente para o símbolo ser '+'
        li.innerHTML = `
            <div class="chefia-item">
                <div class="chefia-info">
                    <span class="chefia-nome clickable-person" data-person-name="${chefe.nome}">${chefe.nome}</span>
                    <span class="chefia-cargo">${chefe.cargo}</span>
                    ${chefe.departamento ? `<span class="chefia-departamento">${chefe.departamento}</span>` : ''}
                    ${chefe.area ? `<span class="chefia-area">${chefe.area}</span>` : ''}
                </div>
                <div style="display:flex; align-items:center;">
                    <span class="chefia-count">${chefe.quantidade}</span>
                    ${chefe.email ? `<button class="popup-email-button" onclick="sendEmail(event, '${chefe.email}')" title="Enviar e-mail para ${chefe.nome}">📧</button>` : ''}
                    <button class="toggle-subordinados collapsed-icon" data-id="${chefe.id}">+</button>
                </div>
            </div>
            <ul class="subordinados-list" id="subordinados-de-${chefe.id}">
                ${chefe.subordinados.map(sub => `
                    <li>
                        <div class="subordinado-info">
                            <span class="subordinado-nome clickable-person" data-person-name="${sub.nome}">${sub.nome}</span>
                            <span class="subordinado-cargo">${sub.cargo}</span>
                        </div>
                        ${sub.email ? `<button class="popup-email-button" onclick="sendEmail(event, '${sub.email}')" title="Enviar e-mail para ${sub.nome}">📧</button>` : ''}
                    </li>
                `).join('')}
            </ul>
        `;
        listaChefias.appendChild(li);
    });

    document.querySelectorAll('.toggle-subordinados').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Garante que o clique no botão toggle não afete o elemento pai.
            const chefeId = e.target.dataset.id;
            const subordinadosList = document.getElementById(`subordinados-de-${chefeId}`);
            if (subordinadosList) {
                // Alterna a visibilidade da lista de subordinados
                subordinadosList.style.display = subordinadosList.style.display === 'none' ? 'block' : 'none';

                // Alterna o texto do botão entre '+' e '-' e as classes
                if (subordinadosList.style.display === 'block') {
                    e.target.textContent = '-';
                    e.target.classList.remove('collapsed-icon');
                    e.target.classList.add('expanded-icon');
                } else {
                    e.target.textContent = '+';
                    e.target.classList.remove('expanded-icon');
                    e.target.classList.add('collapsed-icon');
                }
            }
        });
    });

    // Adiciona o evento de clique aos nomes clicáveis
    document.querySelectorAll('.clickable-person').forEach(element => {
        element.addEventListener('click', (e) => {
            // Não usa stopPropagation aqui para permitir que o clique seja tratado
            const personName = e.target.dataset.personName;
            document.getElementById('filtro-nome').value = personName; // Preenche o campo de filtro principal
            popupChefias.style.display = 'none'; // Fecha o pop-up
            filtrarPorNome(personName); // Aciona o filtro do organograma principal
        });
    });
}

// Função para enviar email
function sendEmail(event, emailAddress) {
    event.stopPropagation(); // Impede que o clique se propague para o card ou item da lista
    if (emailAddress) {
        window.location.href = `mailto:${emailAddress}`;
    } else {
        alert('Endereço de e-mail não disponível para esta pessoa.');
    }
}


// Garante que estas funções sejam acessíveis globalmente se usadas no HTML
window.toggleNode = toggleNode;
window.buildOrganogram = buildOrganogram;
window.buildOrganogramFiltradoRecursive = buildOrganogramFiltradoRecursive;
window.sendEmail = sendEmail; // Expõe a nova função globalmente
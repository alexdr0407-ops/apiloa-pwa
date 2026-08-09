// Registro del Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW error:', err));
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const hiveForm = document.getElementById('hive-form');
    const hivesContainer = document.getElementById('hives-container');
    const modal = document.getElementById('inspection-modal');
    const closeModal = document.getElementById('close-modal');
    const modalTitle = document.getElementById('modal-title');
    const inspectionFramesContainer = document.getElementById('inspection-frames-container');
    const speechBtn = document.getElementById('speech-btn');
    const speechStatus = document.getElementById('speech-status');
    const exportBtn = document.getElementById('export-btn');

    let hives = JSON.parse(localStorage.getItem('apilab_hives')) || [];
    let currentHiveIndex = null;
    let recognition = null;
    let isListening = false;
    let statsChart = null;

    function saveAndRender() {
        localStorage.setItem('apilab_hives', JSON.stringify(hives));
        renderHives();
    }

    function renderHives() {
        hivesContainer.innerHTML = '';
        if (hives.length === 0) {
            hivesContainer.innerHTML = '<p class="empty-msg">No hay unidades registradas todavía.</p>';
            return;
        }

        hives.forEach((hive, index) => {
            const div = document.createElement('div');
            div.className = 'hive-item';
            
            let supersHtml = '';
            hive.supers.forEach((sup, sIndex) => {
                supersHtml += `<div class="hive-meta">📦 Alza ${sIndex + 1}: ${sup.frames.length} cuadros 
                    <button onclick="window.removeSuper(${index}, ${sIndex})" class="btn-danger" style="width:auto; padding:2px 6px; font-size:0.7rem;">Eliminar</button>
                </div>`;
            });

            div.innerHTML = `
                <h3>${hive.name} (${hive.type})</h3>
                <div class="hive-meta">📅 Creada: ${hive.date}</div>
                <div class="hive-meta">🛡️ Cámara Base: ${hive.baseFrames} cuadros</div>
                ${supersHtml}
                <div class="actions-row">
                    <button onclick="window.openInspection(${index})" class="btn-secondary">🔍 Inspeccionar & Estadísticas</button>
                    <button onclick="window.addSuper(${index})" ${hive.supers.length >= 3 ? 'disabled style="opacity:0.5;"' : ''}>+ Alza</button>
                    <button onclick="window.deleteHive(${index})" class="btn-danger">Eliminar</button>
                </div>
            `;
            hivesContainer.appendChild(div);
        });
    }

    function generateInitialFrames(count) {
        let frames = [];
        for (let i = 1; i <= count; i++) {
            frames.push({
                number: i,
                states: { estirado: false, criaReciente: false, criaOperculada: false, miel: false, polen: false }
            });
        }
        return frames;
    }

    hiveForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('hive-name').value.trim();
        const type = document.getElementById('hive-type').value;
        const baseFramesCount = type === 'Colmena' ? 10 : 5;

        const newHive = {
            name,
            type,
            baseFrames: baseFramesCount,
            date: new Date().toLocaleDateString(),
            baseInspection: generateInitialFrames(baseFramesCount),
            supers: [] 
        };

        hives.push(newHive);
        hiveForm.reset();
        saveAndRender();
    });

    // Abrir Modal de Inspección y actualizar gráfico
    window.openInspection = (index) => {
        currentHiveIndex = index;
        const hive = hives[index];
        modalTitle.textContent = `Inspección: ${hive.name}`;
        renderInspectionContent();
        updateChart(hive);
        modal.style.display = 'flex';
    };

    function renderInspectionContent() {
        const hive = hives[currentHiveIndex];
        inspectionFramesContainer.innerHTML = '';

        let baseDiv = document.createElement('div');
        baseDiv.innerHTML = `<h3 style="color:var(--primary-dark); margin-bottom:0.5rem;">Cámara Base (${hive.baseFrames} cuadros)</h3>`;
        hive.baseInspection.forEach((frame, fIdx) => {
            baseDiv.appendChild(createFrameCardElement(frame, 'base', fIdx));
        });
        inspectionFramesContainer.appendChild(baseDiv);

        hive.supers.forEach((sup, sIdx) => {
            let supDiv = document.createElement('div');
            supDiv.style.marginTop = '1.5rem';
            supDiv.innerHTML = `<h3 style="color:var(--primary-dark); margin-bottom:0.5rem;">Alza ${sIdx + 1} (${sup.frames.length} cuadros)</h3>`;
            sup.frames.forEach((frame, fIdx) => {
                supDiv.appendChild(createFrameCardElement(frame, 'super', fIdx, sIdx));
            });
            inspectionFramesContainer.appendChild(supDiv);
        });
    }

    function createFrameCardElement(frame, sectionType, fIdx, sIdx = null) {
        const card = document.createElement('div');
        card.className = 'frame-card';
        card.innerHTML = `
            <h4>Cuadro #${frame.number}</h4>
            <div class="badge-container">
                <span class="badge ${frame.states.estirado ? 'active' : ''}" onclick="window.toggleState(${currentHiveIndex}, '${sectionType}', ${fIdx}, 'estirado', ${sIdx})">Estirado</span>
                <span class="badge ${frame.states.criaReciente ? 'active' : ''}" onclick="window.toggleState(${currentHiveIndex}, '${sectionType}', ${fIdx}, 'criaReciente', ${sIdx})">Cría Puesta</span>
                <span class="badge ${frame.states.criaOperculada ? 'active' : ''}" onclick="window.toggleState(${currentHiveIndex}, '${sectionType}', ${fIdx}, 'criaOperculada', ${sIdx})">Cría Operculada</span>
                <span class="badge ${frame.states.miel ? 'active' : ''}" onclick="window.toggleState(${currentHiveIndex}, '${sectionType}', ${fIdx}, 'miel', ${sIdx})">Miel</span>
                <span class="badge ${frame.states.polen ? 'active' : ''}" onclick="window.toggleState(${currentHiveIndex}, '${sectionType}', ${fIdx}, 'polen', ${sIdx})">Polen</span>
            </div>
        `;
        return card;
    }

    window.toggleState = (hiveIdx, sectionType, fIdx, stateKey, sIdx) => {
        let hive = hives[hiveIdx];
        if (sectionType === 'base') {
            hive.baseInspection[fIdx].states[stateKey] = !hive.baseInspection[fIdx].states[stateKey];
        } else {
            hive.supers[sIdx].frames[fIdx].states[stateKey] = !hive.supers[sIdx].frames[fIdx].states[stateKey];
        }
        saveAndRender();
        renderInspectionContent();
        updateChart(hive);
    };

    // Actualizar Gráfico Chart.js
    function updateChart(hive) {
        let counts = { estirado: 0, criaReciente: 0, criaOperculada: 0, miel: 0, polen: 0 };

        // Contar en base
        hive.baseInspection.forEach(f => {
            Object.keys(f.states).forEach(st => { if (f.states[st]) counts[st]++; });
        });
        // Contar en alzas
        hive.supers.forEach(sup => {
            sup.frames.forEach(f => {
                Object.keys(f.states).forEach(st => { if (f.states[st]) counts[st]++; });
            });
        });

        const ctx = document.getElementById('hive-stats-chart').getContext('2d');
        
        if (statsChart) {
            statsChart.destroy();
        }

        statsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Estirado', 'Cría Puesta', 'Cría Operculada', 'Miel', 'Polen'],
                datasets: [{
                    label: 'Cantidad de Cuadros',
                    data: [counts.estirado, counts.criaReciente, counts.criaOperculada, counts.miel, counts.polen],
                    backgroundColor: ['#9ca3af', '#f59e0b', '#d97706', '#10b981', '#3b82f6'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    closeModal.onclick = () => {
        modal.style.display = 'none';
        stopSpeechRecognition();
    };

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
            stopSpeechRecognition();
        }
    };

    // Gestión de Alzas y Unidades
    window.addSuper = (index) => {
        if (hives[index].supers.length < 3) {
            hives[index].supers.push({ frames: generateInitialFrames(10) });
            saveAndRender();
        } else {
            alert('Límite máximo de alzas alcanzado.');
        }
    };

    window.removeSuper = (index, sIndex) => {
        if (confirm('¿Retirar esta alza?')) {
            hives[index].supers.splice(sIndex, 1);
            saveAndRender();
        }
    };

    window.deleteHive = (index) => {
        if (confirm(`¿Eliminar la unidad "${hives[index].name}"?`)) {
            hives.splice(index, 1);
            saveAndRender();
        }
    };

    // --- EXPORTAR A CSV ---
    exportBtn.onclick = () => {
        if (hives.length === 0) {
            alert('No hay datos para exportar.');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,Unidad,Tipo,FechaCreacion,Seccion,Cuadro,Estirado,CriaPuesta,CriaOperculada,Miel,Polen\r\n";

        hives.forEach(hive => {
            // Base
            hive.baseInspection.forEach(f => {
                let row = [
                    `"${hive.name}"`, hive.type, hive.date, "Base", f.number,
                    f.states.estirado ? 1 : 0, f.states.criaReciente ? 1 : 0, f.states.criaOperculada ? 1 : 0, f.states.miel ? 1 : 0, f.states.polen ? 1 : 0
                ].join(",");
                csvContent += row + "\r\n";
            });
            // Alzas
            hive.supers.forEach((sup, sIdx) => {
                sup.frames.forEach(f => {
                    let row = [
                        `"${hive.name}"`, hive.type, hive.date, `"Alza ${sIdx + 1}"`, f.number,
                        f.states.estirado ? 1 : 0, f.states.criaReciente ? 1 : 0, f.states.criaOperculada ? 1 : 0, f.states.miel ? 1 : 0, f.states.polen ? 1 : 0
                    ].join(",");
                    csvContent += row + "\r\n";
                });
            });
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `apilab_export_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- WEB SPEECH API ---
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onstart = () => {
            isListening = true;
            speechBtn.classList.add('listening');
            speechBtn.textContent = '⏹️ Detener Escucha';
            speechStatus.textContent = 'Escuchando comandos...';
        };

        recognition.onend = () => {
            isListening = false;
            speechBtn.classList.remove('listening');
            speechBtn.textContent = '🎤 Activar Control por Voz';
            speechStatus.textContent = 'Micrófono inactivo';
        };

        recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
            speechStatus.textContent = `Escuchado: "${transcript}"`;
            processVoiceCommand(transcript);
        };

        speechBtn.onclick = () => {
            if (isListening) { recognition.stop(); } else { recognition.start(); }
        };
    } else {
        speechBtn.style.display = 'none';
        speechStatus.textContent = 'Reconocimiento por voz no compatible.';
    }

    function stopSpeechRecognition() {
        if (recognition && isListening) { recognition.stop(); }
    }

    function processVoiceCommand(text) {
        if (currentHiveIndex === null) return;
        let hive = hives[currentHiveIndex];
        const matchNumber = text.match(/cuadro\s+(\d+)/);
        if (!matchNumber) return;

        const frameNum = parseInt(matchNumber[1]);
        let section = 'base';
        let fIndex = -1;
        let sIndex = null;

        let baseTarget = hive.baseInspection.find(f => f.number === frameNum);
        if (baseTarget) {
            fIndex = hive.baseInspection.indexOf(baseTarget);
        } else {
            for (let s = 0; s < hive.supers.length; s++) {
                let superTarget = hive.supers[s].frames.find(f => f.number === frameNum);
                if (superTarget) {
                    section = 'super';
                    fIndex = hive.supers[s].frames.indexOf(superTarget);
                    sIndex = s;
                    break;
                }
            }
        }

        if (fIndex === -1) return;

        if (text.includes('estirado')) {
            window.toggleState(currentHiveIndex, section, fIndex, 'estirado', sIndex);
        } else if (text.includes('puesta') || text.includes('cría reciente')) {
            window.toggleState(currentHiveIndex, section, fIndex, 'criaReciente', sIndex);
        } else if (text.includes('operculada') || text.includes('cría operculada')) {
            window.toggleState(currentHiveIndex, section, fIndex, 'criaOperculada', sIndex);
        } else if (text.includes('miel')) {
            window.toggleState(currentHiveIndex, section, fIndex, 'miel', sIndex);
        } else if (text.includes('polen')) {
            window.toggleState(currentHiveIndex, section, fIndex, 'polen', sIndex);
        }
    }

    renderHives();
});

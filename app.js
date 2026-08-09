// Registro del Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('Service Worker registrado con éxito, alcance:', reg.scope);
            })
            .catch(err => {
                console.error('Error al registrar el Service Worker:', err);
            });
    });
}

// Lógica básica para el prompt de instalación de la PWA
let deferredPrompt;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'block';

    installBtn.addEventListener('click', () => {
        installBtn.style.display = 'none';
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('El usuario aceptó instalar la PWA');
            }
            deferredPrompt = null;
        });
    });
});

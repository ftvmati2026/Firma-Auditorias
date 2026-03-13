// Configuración de Firebase (debe ser idéntica a app.js)
const firebaseConfig = {
    apiKey: "AIzaSyAop4Q2jfN_b_U-uP8w7DdfSnUV9wUfOgk",
    authDomain: "firma-digital-auditoria-medica.firebaseapp.com",
    projectId: "firma-digital-auditoria-medica",
    storageBucket: "firma-digital-auditoria-medica.firebasestorage.app",
    messagingSenderId: "488713972891",
    appId: "1:488713972891:web:d5cb2bda0dab8e148e55de"
};

// Iniciar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Obtener ID de la URL
const urlParams = new URLSearchParams(window.location.search);
const docId = urlParams.get('id');

const loadingMessage = document.getElementById('loadingMessage');
const documentSection = document.getElementById('documentSection');
const successSection = document.getElementById('successSection');
const pdfViewer = document.getElementById('pdfViewer');
const btnClear = document.getElementById('btnClear');
const btnDone = document.getElementById('btnDone');
const btnSubmit = document.getElementById('btnSubmit');

// Configurar Signature Pad
const canvas = document.getElementById('signaturePad');

// Ajustar el canvas al tamaño real del celular
function resizeCanvas() {
    const ratio =  Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
}
window.onresize = resizeCanvas;
// Llamamos para ajustar inicialmente
setTimeout(resizeCanvas, 100);

const signaturePad = new SignaturePad(canvas, {
    penColor: "rgb(0, 0, 150)", // Tinta azul
    backgroundColor: "rgb(255, 255, 255)"
});

if (!docId) {
    loadingMessage.innerHTML = '<i class="fa-solid fa-triangle-exclamation fa-3x" style="color: var(--danger-color);"></i><p style="margin-top:1rem; color:var(--text-primary);">Error: Documento no encontrado. Link inválido.</p>';
} else {
    // Buscar y Cargar documento desde la base de datos secreta
    db.collection('auditorias').doc(docId).get().then((doc) => {
        if (doc.exists) {
            const data = doc.data();
            if (data.estado === 'Firmado') {
                loadingMessage.style.display = 'none';
                successSection.style.display = 'block';
                successSection.innerHTML = '<i class="fa-solid fa-circle-check" style="font-size: 4rem; color: var(--success-color); margin-bottom: 1rem;"></i><h2>Este documento ya fue firmado</h2><p class="subtitle">No es necesario volver a firmarlo.</p>';
            } else {
                // Si está pendiente, cargar el PDF y mostrar para firmar
                pdfViewer.src = data.pdfBase64;
                loadingMessage.style.display = 'none';
                documentSection.style.display = 'block';
                resizeCanvas(); // re-ajustar canvas ahora que es visible
            }
        } else {
            loadingMessage.innerHTML = '<i class="fa-solid fa-triangle-exclamation fa-3x" style="color: var(--danger-color);"></i><p style="margin-top:1rem; color:var(--text-primary);">Error: Documento no encontrado o fue eliminado.</p>';
        }
    }).catch((error) => {
        loadingMessage.innerHTML = `<i class="fa-solid fa-triangle-exclamation fa-3x" style="color: var(--danger-color);"></i><p style="margin-top:1rem; color:var(--text-primary);">Error de conexión: ${error.message}</p>`;
    });
}

// Lógica de botones de firma
btnClear.addEventListener('click', () => {
    signaturePad.clear();
    
    // Habilitar campos nuevamente
    document.getElementById('chkConformidad').disabled = false;
    document.getElementById('afiliadoNombre').disabled = false;
    document.getElementById('afiliadoDNI').disabled = false;
    
    btnSubmit.style.display = 'none';
    btnDone.disabled = false;
    signaturePad.on(); // Volver a habilitar dibujo
});

btnDone.addEventListener('click', () => {
    const chkConformidad = document.getElementById('chkConformidad');
    const afiliadoNombre = document.getElementById('afiliadoNombre');
    const afiliadoDNI = document.getElementById('afiliadoDNI');

    if (!chkConformidad.checked) {
        alert("Debe tildar la casilla de conformidad al principio del recuadro para poder continuar.");
        return;
    }
    if (afiliadoNombre.value.trim() === '') {
        alert("Por favor, ingrese su Nombre y Apellido.");
        afiliadoNombre.focus();
        return;
    }
    if (afiliadoDNI.value.trim() === '') {
        alert("Por favor, ingrese su DNI.");
        afiliadoDNI.focus();
        return;
    }
    if (signaturePad.isEmpty()) {
        alert("Por favor, dibuje su firma en el recuadro antes de presionar HECHO.");
        return;
    }
    
    // Bloquear campos para que no los modifiquen despues de darle a hecho
    chkConformidad.disabled = true;
    afiliadoNombre.disabled = true;
    afiliadoDNI.disabled = true;
    signaturePad.off();
    
    btnDone.disabled = true;
    
    // Mostrar el botón definitivo de Enviar
    btnSubmit.style.display = 'block';
    
    // Auto-scroll hacia abajo para que el botón de Enviar se vea sí o sí en móviles
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
});

btnSubmit.addEventListener('click', async () => {
    try {
        // Estado de "Enviando..."
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ENVIANDO...';
        btnClear.disabled = true;
        
        // Guardamos la firma como imagen invisible (Base64)
        const firmaDataUrl = signaturePad.toDataURL("image/png");
        
        // Configuramos los datos a modificar
        await db.collection('auditorias').doc(docId).update({
            estado: 'Firmado',
            firmaBase64: firmaDataUrl,
            afiliadoNombre: document.getElementById('afiliadoNombre').value.trim(),
            afiliadoDNI: document.getElementById('afiliadoDNI').value.trim(),
            conformidad: true,
            fechaFirma: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Mostrar cartel de éxito
        documentSection.style.display = 'none';
        successSection.style.display = 'block';
    } catch (error) {
        console.error("Error al guardar la firma:", error);
        alert("Hubo un error al enviar la firma. Por favor verifique su conexión a internet e intente de nuevo.");
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fa-solid fa-paper-plane"></i> ENVIAR DOCUMENTO FIRMADO';
        btnClear.disabled = false;
    }
});

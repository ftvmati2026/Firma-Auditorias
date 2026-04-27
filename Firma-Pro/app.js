/* Configuración de Firebase */
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

// Lógica de interfaz y temas
const themeToggle = document.getElementById('themeToggle');
const body = document.body;

// Cargar preferencia de tema (claro por defecto)
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
    body.setAttribute('data-theme', 'dark');
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
}

themeToggle.addEventListener('click', () => {
    if (body.getAttribute('data-theme') === 'dark') {
        body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
    } else {
        body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
});

// Lógica de archivo (UI)
const pdfInput = document.getElementById('pdfFile');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const btnUpload = document.getElementById('btnUpload');

if (pdfInput && fileNameDisplay) {
    pdfInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const fileName = e.target.files[0].name;
            fileNameDisplay.textContent = fileName;
            fileNameDisplay.style.color = 'var(--primary-color)';
            fileNameDisplay.style.fontWeight = '600';
            btnUpload.disabled = false;
        } else {
            fileNameDisplay.textContent = 'Hacé clic para seleccionar el PDF';
            fileNameDisplay.style.color = 'var(--text-secondary)';
            fileNameDisplay.style.fontWeight = 'normal';
            btnUpload.disabled = true;
        }
    });
}

// Función para convertir Archivo a Base64 string para guardarlo en la Base de Datos
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Subir PDF a Firebase al hacer submit en el Formulario
const uploadForm = document.getElementById('uploadForm');

if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const file = pdfInput.files[0];
        if (!file) return;

        try {
            // Deshabilitar botón y cambiar texto y logo por el de cargando
            btnUpload.disabled = true;
            btnUpload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo a la nube...';

            // Convertimos el PDF a texto base64 para reemplazar Storage
            const base64PDF = await fileToBase64(file);

            // Guardamos en la base de datos (Firestore) "auditorias"
            const docRef = await db.collection('auditorias').add({
                nombreArchivo: file.name,
                pdfBase64: base64PDF,
                estado: 'Pendiente',
                fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
                firmaBase64: null // Todavia no firmó
            });

            // Detectar la URL base actual de forma dinámica
            const currentUrl = window.location.href.split('index.html')[0];
            const linkUnico = `${currentUrl}firmar.html?id=${docRef.id}`;
            
            // Avisar exito
            alert(`¡Éxito! El documento se ha guardado y está listo para ser firmado.\n\nPodés copiar el link haciendo clic en el ícono de WhatsApp en la tabla.`);
            
            // Limpiar formulario y reiniciar estado inicial
            uploadForm.reset();
            fileNameDisplay.textContent = 'Hacé clic para seleccionar el PDF';
            fileNameDisplay.style.color = 'var(--text-secondary)';
            fileNameDisplay.style.fontWeight = 'normal';

        } catch (error) {
            console.error('Error al subir documento a Firebase:', error);
            alert('¡ERROR DE FIREBASE!\n\nDetalle: ' + error.message + '\n\nSi dice "Missing or insufficient permissions", tenés que actualizar las reglas en tu consola de Firebase.');
        } finally {
            // Restaurar botón a su estado original
            btnUpload.innerHTML = '<i class="fa-solid fa-link"></i> Generar Link Único';
            btnUpload.disabled = true; // Sigue disabled porque limpiamos el form y ya no hay pdf 
        }
    });
}

// ============================================
// CARGA LA LISTA DE AUDITORÍAS EN TIEMPO REAL
// ============================================

const auditsList = document.getElementById('auditsList');

if (auditsList) {
    // Escuchar cambios en Firestore
    const pendingCounter = document.getElementById('pendingCounter');
    
    db.collection('auditorias').orderBy('fechaCreacion', 'desc').onSnapshot((snapshot) => {
        auditsList.innerHTML = '';
        let pendingCount = 0;
        
        if (snapshot.empty) {
            auditsList.innerHTML = `
                <tr class="empty-state">
                    <td colspan="3">No hay documentos registrados todavía.</td>
                </tr>
            `;
            return;
        }

        // Si hay datos, generar las filas de la tabla correspondientes
        snapshot.forEach((doc) => {
            const data = doc.data();
            const esFirmado = data.estado === "Firmado";
            const currentUrl = window.location.href.split('index.html')[0];
            const linkACompartir = `${currentUrl}firmar.html?id=${doc.id}`;

            const tr = document.createElement('tr');
            
            // Estilos del estado (Pendiente en Naranja, Firmado en Verde)
            const badgeClass = esFirmado ? 'badge-signed' : 'badge-pending';
            let estadoHtml = `<span class="badge ${badgeClass}">${data.estado}</span>`;
            
            // Si está pendiente, agregar info de fecha y días
            if (!esFirmado) {
                pendingCount++;
                let infoExtra = '';
                if (data.fechaCreacion) {
                    const fecha = data.fechaCreacion.toDate();
                    const hoy = new Date();
                    const diffTime = Math.abs(hoy - fecha);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    const fechaLegible = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const diasTexto = diffDays === 0 ? 'Hoy' : `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
                    
                    infoExtra = `
                        <span class="status-date"><i class="fa-regular fa-calendar"></i> ${fechaLegible}</span>
                        <span class="status-age"><i class="fa-regular fa-clock"></i> ${diasTexto}</span>
                    `;
                }
                estadoHtml = `
                    <div class="status-info-container">
                        <span class="badge ${badgeClass}">${data.estado}</span>
                        ${infoExtra}
                    </div>
                `;
            }
            
            // Botones de acción dependiendo del estado de la auditoria
            let botonesAccion = '';
            
            if (esFirmado) {
                // Si está firmado: Descargar el PDF Listo, Eliminar el registro de la DB
                botonesAccion = `
                    <button class="icon-btn" title="Descargar PDF firmado" onclick="descargarPDF('${doc.id}')" style="color: var(--success-color);">
                        <i class="fa-solid fa-download"></i>
                    </button>
                    <button class="icon-btn" title="Eliminar registro" onclick="eliminarAuditoria('${doc.id}')" style="color: var(--danger-color);">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
            } else {
                // Si está pendiente: Copiar el link para mandar por Whats, Eliminar el registro (por si nos equivocamos de archivo)
                botonesAccion = `
                    <button class="icon-btn" title="Copiar link para WhatsApp" onclick="copiarLink('${linkACompartir}')" style="color: var(--primary-color);">
                        <i class="fa-brands fa-whatsapp"></i>
                    </button>
                    <button class="icon-btn" title="Eliminar registro" onclick="eliminarAuditoria('${doc.id}')" style="color: var(--danger-color);">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
            }

            tr.innerHTML = `
                <td><strong>${data.nombreArchivo}</strong></td>
                <td>${estadoHtml}</td>
                <td class="td-actions">${botonesAccion}</td>
            `;
            auditsList.appendChild(tr);
        });

        // Actualizar el contador de pendientes
        if (pendingCounter) {
            if (pendingCount > 0) {
                pendingCounter.textContent = pendingCount;
                pendingCounter.style.display = 'inline-block';
            } else {
                pendingCounter.style.display = 'none';
            }
        }
    }, (error) => {
        console.error("Error obteniendo los registros de la base de datos:", error);
        let mensajeError = "Error al conectar con la base de datos Firebase.";
        
        if (error.code === 'permission-denied') {
            mensajeError = "Error: Permiso denegado. Verificá las 'Rules' de Firestore en tu consola de Firebase (deben estar en modo de prueba o públicas).";
        } else if (error.code === 'failed-precondition') {
            mensajeError = "Error: Falta un índice en Firestore. Mirá la consola del navegador (F12) para encontrar el link de creación automática.";
        } else {
            mensajeError = `Error: ${error.message}`;
        }

        auditsList.innerHTML = `
            <tr>
                <td colspan="3">
                    <div class="error-state">
                        <i class="fa-solid fa-circle-exclamation"></i>
                        <div class="error-message-text">${mensajeError}</div>
                    </div>
                </td>
            </tr>
        `;
    });
}

// Funciones globales (tienen que estar en en window para que el HTML los lea directo en el onclick)

window.copiarLink = function(link) {
    navigator.clipboard.writeText(link).then(() => {
        alert("¡Copiado el enlace al portapapeles!\n\nYa podés mandarlo y pegarlo en WhatsApp fácilmente.");
    }).catch(err => {
        alert("Enlace:\n" + link); // Por si el navegador bloquea el clipboard manual
    });
}

window.eliminarAuditoria = async function(id) {
    if(confirm("Atención: ¿Estás seguro que querés eliminar este documento permanentemente?")) {
        try {
            await db.collection('auditorias').doc(id).delete();
        } catch(error) {
            console.error("Error al borrar registro: ", error);
            alert("No se pudo borrar, intente nuevamente.");
        }
    }
}

window.descargarPDF = async function(id) {
    try {
        // 1. Mostrar que estamos procesando
        alert("Generando PDF final con inyección de hoja legal...\nEspere un momento por favor.");

        // 2. Traer todos los datos del documento desde Firebase
        const docSnapshot = await db.collection('auditorias').doc(id).get();
        if (!docSnapshot.exists) {
            alert("No se encontró el documento.");
            return;
        }
        
        const data = docSnapshot.data();
        const base64PDFOriginal = data.pdfBase64;
        const base64Firma = data.firmaBase64;
        
        // 3. Configurar PDF-lib cargando el documento original
        const existingPdfBytes = await fetch(base64PDFOriginal).then(res => res.arrayBuffer());
        const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);

        // 4. Agregar una hoja en blanco al final de todo tamaño A4
        const page = pdfDoc.addPage(PDFLib.PageSizes.A4);
        const { width, height } = page.getSize();
        
        // Cargar fuente
        const font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);

        // 5. Escribir los textos legales de ChatGPT en la nueva hoja
        const marginLeft = 50;
        let currentY = height - 70;

        page.drawText('CERTIFICADO DE CONFORMIDAD', { x: marginLeft, y: currentY, size: 14, font: fontBold });
        
        currentY -= 40;
        const parrafoLegal = 'Por la presente, manifiesto mi conformidad con el contenido del presente documento \ny acepto su validación mediante firma electrónica, reconociendo su plena validez \ny eficacia legal.';
        page.drawText(parrafoLegal, { x: marginLeft, y: currentY, size: 11, font: font, lineHeight: 16 });

        currentY -= 80;
        page.drawText('DATOS DEL FIRMANTE', { x: marginLeft, y: currentY, size: 14, font: fontBold });

        currentY -= 40;
        page.drawText(`Nombre y apellido: ${data.firmanteNombre}`, { x: marginLeft, y: currentY, size: 12, font: font });

        currentY -= 30;
        page.drawText(`Identificación (DNI/ID): ${data.firmanteID}`, { x: marginLeft, y: currentY, size: 12, font: font });

        currentY -= 30;
        page.drawText('[X] Confirmo mi plena conformidad con el contenido de este documento.', { x: marginLeft, y: currentY, size: 11, font: fontBold });

        // 6. Inyectar la firma png
        currentY -= 40;
        page.drawText('Firma digital:', { x: marginLeft, y: currentY, size: 12, font: font });

        if (base64Firma) {
            const signatureImageBytes = await fetch(base64Firma).then(res => res.arrayBuffer());
            const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
            // Dibujar imagen de firma ajustando proporciones
            page.drawImage(signatureImage, {
                x: marginLeft,
                y: currentY - 100, // Abajo del texto
                width: 200,
                height: 100,
            });
        }

        // Agregar timestamp (fecha de base de datos convertida a texto legible)
        currentY -= 150;
        const fechaObj = data.fechaFirma ? data.fechaFirma.toDate() : new Date();
        const textoFecha = fechaObj.toLocaleString('es-AR');
        
        page.drawText('REGISTRO DE VALIDACIÓN ELECTRÓNICA', { x: marginLeft, y: currentY, size: 11, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
        currentY -= 20;
        page.drawText(`Este documento fue confirmado electrónicamente por el afiliado.\nFecha y hora de aceptación: ${textoFecha}`, { x: marginLeft, y: currentY, size: 9, font: font, lineHeight: 14, color: PDFLib.rgb(0.4, 0.4, 0.4) });


        // 7. Guardar y descargar automáticamente
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const linkURL = URL.createObjectURL(blob);
        
        // Crear un link invisible para descargar archivo
        const link = document.createElement('a');
        link.href = linkURL;
        link.download = `${data.nombreArchivo.replace('.pdf', '')}_FIRMADO.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error("Error al inyectar PDF:", error);
        alert("Hubo un error al generar el PDF. " + error.message);
    }
}

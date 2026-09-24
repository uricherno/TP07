// site.js — JavaScript del sitio. Se carga en todas las páginas desde _Layout.cshtml,
// por eso cada parte se inicia solo si la página tiene los elementos que necesita.

// Variables del feed y del perfil (se declaran antes de usarse)
let feed, btnVerMas, finFeed, token;
let modal, modalContenido, miniaturaAbierta, grillaPerfil, btnVerMasPerfil;

// Íconos SVG (mismos que usa Views/Publicacion/_Publicacion.cshtml)
const PATH_CORAZON = 'M12 20.7s-7.2-4.4-9.3-8.6C1.1 8.9 2.7 5 6.3 4.4c2.1-.4 4 .6 5.7 2.6 1.7-2 3.6-3 5.7-2.6 3.6.6 5.2 4.5 3.6 7.7-2.1 4.2-9.3 8.6-9.3 8.6z';
const PATH_GLOBO = 'M20.7 16.9A9.5 9.5 0 1 0 17 20.5L21.5 21.5z';

const MAXIMO_COMENTARIO = 500;
const PREFIJO_BORRADOR = 'borrador-comentario-';

// ==========================================================
// localStorage: puede fallar (modo privado, cookies bloqueadas), por eso siempre con try/catch
// ==========================================================

function leerStorage(clave) {
    try { return localStorage.getItem(clave); } catch { return null; }
}

function guardarStorage(clave, valor) {
    try { localStorage.setItem(clave, valor); } catch { /* sin localStorage la página funciona igual */ }
}

function borrarStorage(clave) {
    try { localStorage.removeItem(clave); } catch { }
}

// ==========================================================
// Modo oscuro: el tema ya se aplicó en el <head> (para que no parpadee); acá solo el botón
// ==========================================================

function iniciarTema() {
    const boton = document.getElementById('btnTema');
    if (!boton) return;

    const raiz = document.documentElement;
    const actualizarBoton = () => {
        const oscuro = raiz.dataset.tema === 'oscuro';
        boton.title = oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
        boton.setAttribute('aria-label', boton.title);
        boton.setAttribute('aria-pressed', oscuro);
    };

    actualizarBoton();
    boton.addEventListener('click', () => {
        raiz.dataset.tema = raiz.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
        guardarStorage('tema', raiz.dataset.tema);
        actualizarBoton();
    });
}

// ==========================================================
// Toasts: mensajes flotantes que reemplazan a alert()
// ==========================================================

function mostrarToast(mensaje, tipo = 'error') {
    const contenedor = document.getElementById('toasts');
    if (!contenedor) return;

    const toast = crear('div', 'toast toast-' + tipo, mensaje);
    toast.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    contenedor.appendChild(toast);

    // Un frame después se agrega la clase para que la transición de entrada se vea
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ==========================================================
// Confirmación propia (reemplaza a confirm()). Devuelve una Promise<boolean>.
// ==========================================================

function confirmar(titulo, mensaje, textoAceptar = 'Eliminar') {
    const dialogo = document.getElementById('dialogoConfirmar');
    if (!dialogo || typeof dialogo.showModal !== 'function') {
        return Promise.resolve(window.confirm(mensaje)); // navegador sin <dialog>
    }

    document.getElementById('confirmarTitulo').textContent = titulo;
    document.getElementById('confirmarMensaje').textContent = mensaje;
    document.getElementById('confirmarAceptar').textContent = textoAceptar;
    dialogo.returnValue = '';
    dialogo.showModal();

    return new Promise(resolve => {
        dialogo.addEventListener('close', () => resolve(dialogo.returnValue === 'si'), { once: true });
    });
}

function iniciarDialogos() {
    // Click en el fondo oscuro cierra cualquier diálogo (como "Cancelar")
    document.querySelectorAll('dialog.dialogo').forEach(d => {
        d.addEventListener('click', e => {
            if (e.target === d) d.close();
        });
    });

    const dialogoLikes = document.getElementById('dialogoLikes');
    if (dialogoLikes) {
        dialogoLikes.querySelector('.dialogo-cerrar').addEventListener('click', () => dialogoLikes.close());
    }

    // Menú ⋯ de las publicaciones: se cierra al hacer click afuera o con Escape
    document.addEventListener('click', e => {
        document.querySelectorAll('details.menu-post[open]').forEach(menu => {
            if (!menu.contains(e.target)) menu.removeAttribute('open');
        });
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('details.menu-post[open]').forEach(menu => menu.removeAttribute('open'));
        }
    });
}

// ==========================================================
// Contadores de caracteres
// ==========================================================

// Muestra cuántos caracteres faltan para llegar al maxlength del campo
function actualizarContador(campo, contador, corto = false) {
    const maximo = campo.maxLength;
    const restantes = maximo - campo.value.length;

    contador.textContent = corto ? restantes : 'Quedan ' + restantes;
    contador.title = restantes + ' de ' + maximo + ' caracteres disponibles';
    contador.classList.toggle('cerca', restantes <= Math.max(10, maximo * 0.1));
    contador.classList.toggle('limite', restantes === 0);
}

// Formularios de Crear / Editar: <span data-contador-de="idDelCampo">
function iniciarContadoresFormulario() {
    document.querySelectorAll('.contador-caracteres[data-contador-de]').forEach(contador => {
        const campo = document.getElementById(contador.dataset.contadorDe);
        if (!campo) return;
        actualizarContador(campo, contador);
        campo.addEventListener('input', () => actualizarContador(campo, contador));
    });
}

// Contador del comentario: solo se ve mientras hay texto escrito
function actualizarContadorComentario(form) {
    const input = form.querySelector('input[name="texto"]');
    const contador = form.querySelector('.contador-comentario');
    if (!contador) return;
    contador.hidden = input.value.length === 0;
    actualizarContador(input, contador, true);
}

// ==========================================================
// Crear / Editar publicación: imagen por click o arrastrando, con compresión en el navegador
// ==========================================================

const LADO_MAXIMO_IMAGEN = 1600;   // px del lado más largo después de comprimir
const CALIDAD_JPEG = 0.82;
const TAMANO_MAXIMO_IMAGEN = 5 * 1024 * 1024;
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function formatearTamano(bytes) {
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
}

// Carga el archivo como imagen dibujable en un <canvas>
async function cargarImagen(archivo) {
    if ('createImageBitmap' in window) {
        try { return await createImageBitmap(archivo, { imageOrientation: 'from-image' }); } catch { /* sigue abajo */ }
    }
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
        img.onerror = reject;
        img.src = URL.createObjectURL(archivo);
    });
}

// Achica la imagen (máx. 1600 px) y la pasa a JPEG. El servidor recibe un archivo más liviano,
// pero la acción Crear/Editar del Controller no cambia nada.
async function comprimirImagen(archivo) {
    // Un GIF puede estar animado: el canvas lo dejaría quieto, así que se sube tal cual
    if (archivo.type === 'image/gif') return archivo;

    const imagen = await cargarImagen(archivo);
    const ancho = imagen.width, alto = imagen.height;
    const escala = Math.min(1, LADO_MAXIMO_IMAGEN / Math.max(ancho, alto));
    const w = Math.round(ancho * escala), h = Math.round(alto * escala);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // JPEG no tiene transparencia: los PNG transparentes quedan con fondo blanco
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(imagen, 0, 0, w, h);
    if (imagen.close) imagen.close();

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', CALIDAD_JPEG));

    // Si la "comprimida" pesa lo mismo o más (ya estaba optimizada), se sube la original
    if (!blob || blob.size >= archivo.size) return archivo;

    const nombre = archivo.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg', lastModified: Date.now() });
}

// Pone un archivo dentro del <input type="file"> (así lo envía el formulario común, sin Fetch)
function ponerArchivoEnInput(input, archivo) {
    const dt = new DataTransfer();
    dt.items.add(archivo);
    input.files = dt.files;
}

function iniciarFormularioPublicacion() {
    const form = document.getElementById('formPublicacion');
    if (!form) return; // no estamos en Crear / Editar

    const input = document.getElementById('imagen');
    const zona = document.getElementById('zonaImagen');
    const preview = document.getElementById('previewImagen');
    const texto = document.getElementById('textoZonaImagen');
    const info = document.getElementById('infoImagen');
    const btnPublicar = document.getElementById('btnPublicar');

    const srcOriginal = preview.getAttribute('src'); // al editar: la imagen actual
    const infoOriginal = info.textContent;
    let procesando = false;

    const mostrarInfo = (mensaje, esError = false) => {
        info.textContent = mensaje;
        info.classList.toggle('error', esError);
    };

    const volverAlInicio = () => {
        input.value = '';
        if (srcOriginal) {
            preview.src = srcOriginal;
            preview.hidden = false;
            texto.hidden = true;
        } else {
            preview.hidden = true;
            texto.hidden = false;
        }
    };

    async function procesarArchivo(archivo) {
        if (!archivo) {
            volverAlInicio();
            mostrarInfo(infoOriginal);
            return;
        }
        if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
            volverAlInicio();
            mostrarInfo('Formato no permitido. Usá JPG, PNG, GIF o WEBP.', true);
            return;
        }

        // Vista previa inmediata con el archivo original
        preview.src = URL.createObjectURL(archivo);
        preview.hidden = false;
        texto.hidden = true;

        procesando = true;
        btnPublicar.disabled = true;
        mostrarInfo('Comprimiendo imagen…');

        let final = archivo;
        try {
            final = await comprimirImagen(archivo);
        } catch (error) {
            console.error(error);
        }

        ponerArchivoEnInput(input, final);
        procesando = false;
        btnPublicar.disabled = false;

        if (final.size > TAMANO_MAXIMO_IMAGEN) {
            mostrarInfo('La imagen pesa ' + formatearTamano(final.size) + ' y el máximo es 5 MB.', true);
        } else if (final !== archivo) {
            mostrarInfo('Imagen comprimida: ' + formatearTamano(archivo.size) + ' → ' + formatearTamano(final.size));
        } else {
            mostrarInfo('Imagen lista · ' + formatearTamano(archivo.size));
        }
    }

    // Click: el <label> abre el selector de archivos
    input.addEventListener('change', () => procesarArchivo(input.files[0]));

    // Arrastrar y soltar. Se cuenta dragenter/dragleave porque los hijos de la zona también los disparan.
    let arrastres = 0;
    zona.addEventListener('dragenter', e => {
        e.preventDefault();
        arrastres++;
        zona.classList.add('arrastrando');
    });
    zona.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    zona.addEventListener('dragleave', () => {
        arrastres = Math.max(0, arrastres - 1);
        if (arrastres === 0) zona.classList.remove('arrastrando');
    });
    zona.addEventListener('drop', e => {
        e.preventDefault();
        arrastres = 0;
        zona.classList.remove('arrastrando');
        procesarArchivo(e.dataTransfer.files[0]);
    });

    // Si la imagen cae fuera de la zona, que el navegador no la abra en lugar de la página
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => e.preventDefault());

    form.addEventListener('submit', e => {
        if (procesando) e.preventDefault(); // todavía se está comprimiendo
    });
}

// ==========================================================
// Borradores de comentarios (si se recarga la página por error, el texto no se pierde)
// ==========================================================

function guardarBorrador(post, texto) {
    const clave = PREFIJO_BORRADOR + post.dataset.id;
    if (texto.trim() === '') borrarStorage(clave);
    else guardarStorage(clave, texto);
}

function restaurarBorrador(post) {
    const texto = leerStorage(PREFIJO_BORRADOR + post.dataset.id);
    if (!texto) return;

    const form = post.querySelector('.form-comentario');
    const input = form.querySelector('input[name="texto"]');
    input.value = texto.slice(0, MAXIMO_COMENTARIO);
    form.querySelector('button').disabled = input.value.trim() === '';
    actualizarContadorComentario(form);
}

function restaurarBorradores(contenedor) {
    contenedor.querySelectorAll('.post').forEach(restaurarBorrador);
}

// ==========================================================
// Feed: Me Gusta, Comentar y Ver más usando Fetch (sin recargar la página)
// ==========================================================

function iniciarFeed() {
    feed = document.getElementById('feed');
    if (!feed) return; // no estamos en la página principal

    btnVerMas = document.getElementById('btnVerMas');
    finFeed = document.getElementById('finFeed');
    token = document.querySelector('input[name="__RequestVerificationToken"]').value;

    conectarEventosPublicacion(feed);
    restaurarBorradores(feed);
    btnVerMas.addEventListener('click', verMas);
}

// Eventos delegados en el contenedor: funcionan también en las publicaciones agregadas después
// (por "Ver más" en el feed o dentro del modal del perfil)
function conectarEventosPublicacion(contenedor) {
    let ultimoToque = { media: null, tiempo: 0 };

    contenedor.addEventListener('click', e => {
        const post = e.target.closest('.post');
        if (!post) return;

        // Botón corazón: da o quita el Me Gusta
        if (e.target.closest('.btn-like')) {
            toggleMeGusta(post);
            return;
        }

        // "N Me gusta": lista de quiénes dieron Me Gusta
        if (e.target.closest('.btn-ver-likes')) {
            verQuienesDieronMeGusta(post);
            return;
        }

        // ✕ en un comentario propio: lo elimina
        const btnEliminar = e.target.closest('.btn-eliminar-comentario');
        if (btnEliminar) {
            eliminarComentario(post, btnEliminar.closest('.comentario'));
            return;
        }

        // Menú ⋯ → Eliminar publicación propia
        if (e.target.closest('.btn-eliminar-publicacion')) {
            eliminarPublicacion(post);
            return;
        }

        // Botón globo: lleva el cursor a la caja de comentario
        if (e.target.closest('.btn-comentar')) {
            post.querySelector('.form-comentario input').focus();
            return;
        }

        // Doble click / doble toque sobre la imagen: solo DA Me Gusta (nunca lo quita), como en Instagram.
        // Se detecta con dos clicks seguidos en menos de 300 ms, así funciona igual en PC y en celular.
        const media = e.target.closest('.post-media');
        if (media) {
            const ahora = Date.now();
            if (ultimoToque.media === media && ahora - ultimoToque.tiempo < 300) {
                mostrarCorazonGrande(media);
                if (!post.querySelector('.btn-like').classList.contains('activo')) toggleMeGusta(post);
                ultimoToque = { media: null, tiempo: 0 };
            } else {
                ultimoToque = { media: media, tiempo: ahora };
            }
        }
    });

    contenedor.addEventListener('submit', e => {
        const form = e.target.closest('.form-comentario');
        if (!form) return;
        e.preventDefault();
        comentar(form.closest('.post'), form);
    });

    // Mientras se escribe un comentario: habilita el botón, actualiza el contador y guarda el borrador
    contenedor.addEventListener('input', e => {
        if (e.target.name !== 'texto') return;
        const post = e.target.closest('.post');
        const form = e.target.closest('.form-comentario');
        form.querySelector('button').disabled = e.target.value.trim() === '';
        actualizarContadorComentario(form);
        guardarBorrador(post, e.target.value);
        mostrarErrorComentario(post, '');
    });
}

// ---------- Utilidades ----------

// POST con Fetch enviando FormData + token antifalsificación
async function postForm(url, datos) {
    const body = new FormData();
    for (const clave in datos) body.append(clave, datos[clave]);

    return fetch(url, {
        method: 'POST',
        body: body,
        headers: { 'RequestVerificationToken': token }
    });
}

// Si la sesión expiró, el servidor responde 401 → volvemos al login
function verificarSesion(respuesta) {
    if (respuesta.status === 401) {
        window.location.href = '/Account/Login';
        return false;
    }
    return true;
}

// Lee el JSON de la respuesta; si el servidor no devolvió JSON (por ejemplo un error 400/500), arma uno con el error
async function leerJson(respuesta) {
    try {
        return await respuesta.json();
    } catch {
        return { ok: false, mensaje: 'Error del servidor (' + respuesta.status + '). Intentá de nuevo.' };
    }
}

// Crea un elemento con clase y texto. Se usa textContent (nunca innerHTML) para evitar XSS.
function crear(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
}

// Crea un ícono SVG a partir de su path
function crearIcono(clase, path) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', clase);
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', path);
    svg.appendChild(p);
    return svg;
}

// Reinicia una animación CSS (sacar la clase, forzar el reflow y volver a ponerla)
function reiniciarAnimacion(elemento, clase) {
    elemento.classList.remove(clase);
    void elemento.offsetWidth;
    elemento.classList.add(clase);
}

function urlPerfil(nombreUsuario) {
    return '/Perfil/' + encodeURIComponent(nombreUsuario);
}

// ---------- Me Gusta ----------

function mostrarCorazonGrande(media) {
    reiniciarAnimacion(media, 'mostrar-corazon');
}

async function toggleMeGusta(post) {
    const boton = post.querySelector('.btn-like');
    if (boton.disabled) return; // ya hay una petición en curso para esta publicación

    boton.disabled = true; // evita doble click mientras espera la respuesta
    try {
        const respuesta = await postForm('/Publicacion/MeGusta', { idPublicacion: post.dataset.id });
        if (!verificarSesion(respuesta)) return;

        const datos = await leerJson(respuesta);
        if (!datos.ok) {
            mostrarToast(datos.mensaje);
            return;
        }

        post.querySelector('.contador-likes').textContent = datos.cantidad;
        boton.classList.toggle('activo', datos.meGusta);
        boton.setAttribute('aria-pressed', datos.meGusta);
        boton.title = datos.meGusta ? 'Ya no me gusta' : 'Me gusta';
        boton.setAttribute('aria-label', boton.title);

        if (datos.meGusta) reiniciarAnimacion(boton, 'animar');
    } catch (error) {
        console.error(error);
        mostrarToast('No se pudo registrar el Me Gusta. Revisá tu conexión e intentá de nuevo.');
    } finally {
        boton.disabled = false;
    }
}

// GET con Fetch → lista de usuarios que dieron Me Gusta, en un diálogo
async function verQuienesDieronMeGusta(post) {
    const dialogo = document.getElementById('dialogoLikes');
    const lista = document.getElementById('listaLikes');
    if (!dialogo) return;

    lista.replaceChildren(crear('li', 'lista-likes-vacia', 'Cargando…'));
    if (!dialogo.open) dialogo.showModal();

    try {
        const respuesta = await fetch('/Publicacion/QuienesDieronMeGusta?idPublicacion=' + post.dataset.id);
        if (!verificarSesion(respuesta)) return;

        const datos = await leerJson(respuesta);
        if (!datos.ok) {
            dialogo.close();
            mostrarToast(datos.mensaje);
            return;
        }

        if (datos.usuarios.length === 0) {
            lista.replaceChildren(crear('li', 'lista-likes-vacia', 'Todavía nadie dio Me Gusta. ¡Sé el primero!'));
            return;
        }

        lista.replaceChildren(...datos.usuarios.map(u => {
            const li = crear('li');
            const avatar = crear('a', 'avatar avatar-chico', u.nombreUsuario.charAt(0).toUpperCase());
            avatar.href = urlPerfil(u.nombreUsuario);
            avatar.tabIndex = -1;
            avatar.setAttribute('aria-hidden', 'true');

            const texto = crear('div', 'lateral-texto');
            const nombre = crear('a', 'lateral-usuario', u.nombreUsuario);
            nombre.href = urlPerfil(u.nombreUsuario);
            texto.append(nombre, crear('span', 'lateral-sub', u.nombreCompleto));

            li.append(avatar, texto);
            return li;
        }));
    } catch (error) {
        console.error(error);
        dialogo.close();
        mostrarToast('No se pudo cargar la lista de Me Gusta.');
    }
}

// ---------- Comentarios ----------

// Arma la misma estructura que los comentarios de _Publicacion.cshtml
function crearComentarioElement(c) {
    const li = crear('li', 'comentario');
    li.dataset.id = c.id;

    const cuerpo = crear('div', 'comentario-cuerpo');
    const usuario = crear('a', 'comentario-usuario', c.nombreUsuario);
    usuario.href = urlPerfil(c.nombreUsuario);
    cuerpo.append(usuario, crear('span', 'comentario-texto', c.texto), crear('time', 'comentario-fecha', c.fecha));
    li.appendChild(cuerpo);

    // Solo los comentarios propios tienen el botón para eliminar
    if (c.esMio) {
        const eliminar = crear('button', 'btn-eliminar-comentario', '✕');
        eliminar.type = 'button';
        eliminar.title = 'Eliminar comentario';
        eliminar.setAttribute('aria-label', eliminar.title);
        li.appendChild(eliminar);
    }
    return li;
}

async function eliminarComentario(post, li) {
    const texto = li.querySelector('.comentario-texto').textContent;
    const resumen = texto.length > 60 ? texto.slice(0, 60) + '…' : texto;
    if (!await confirmar('¿Eliminar comentario?', '«' + resumen + '» se va a borrar y no se puede deshacer.')) return;

    const boton = li.querySelector('.btn-eliminar-comentario');
    boton.disabled = true;
    try {
        const respuesta = await postForm('/Publicacion/EliminarComentario', { idComentario: li.dataset.id });
        if (!verificarSesion(respuesta)) return;

        const datos = await leerJson(respuesta);
        if (!datos.ok) {
            mostrarErrorComentario(post, datos.mensaje);
            boton.disabled = false;
            return;
        }

        // Se saca el comentario del DOM y se actualiza el contador con lo que devolvió el servidor
        li.classList.add('saliendo');
        setTimeout(() => li.remove(), 250);
        actualizarContadorComentarios(post, datos.cantidad);
        mostrarErrorComentario(post, '');
        mostrarToast('Comentario eliminado.', 'exito');
    } catch (error) {
        console.error(error);
        mostrarErrorComentario(post, 'No se pudo eliminar el comentario. Intentá de nuevo.');
        boton.disabled = false;
    }
}

function mostrarErrorComentario(post, mensaje) {
    const error = post.querySelector('.error-comentario');
    error.textContent = mensaje;
    error.hidden = !mensaje;
}

function actualizarContadorComentarios(post, cantidad) {
    post.querySelector('.contador-comentarios span').textContent = cantidad;
    post.querySelector('.palabra-comentarios').textContent = cantidad === 1 ? 'comentario' : 'comentarios';
}

async function comentar(post, form) {
    const input = form.querySelector('input[name="texto"]');
    const boton = form.querySelector('button');
    const texto = input.value.trim();

    if (texto === '') {
        mostrarErrorComentario(post, 'El comentario no puede estar vacío.');
        return;
    }

    boton.disabled = true;
    input.disabled = true;
    try {
        const respuesta = await postForm('/Publicacion/Comentar', {
            idPublicacion: post.dataset.id,
            texto: texto
        });
        if (!verificarSesion(respuesta)) return;

        const datos = await leerJson(respuesta);
        if (!datos.ok) {
            // Incluye el aviso del anti-spam ("Esperá N segundos…")
            mostrarErrorComentario(post, datos.mensaje);
            return;
        }

        const li = crearComentarioElement(datos.comentario);
        li.classList.add('nuevo');
        const lista = post.querySelector('.comentarios');
        lista.appendChild(li);
        lista.scrollTop = lista.scrollHeight;

        actualizarContadorComentarios(post, lista.querySelectorAll('.comentario:not(.saliendo)').length);

        input.value = '';
        guardarBorrador(post, ''); // ya se envió: se borra el borrador
        actualizarContadorComentario(form);
        mostrarErrorComentario(post, '');
    } catch (error) {
        console.error(error);
        mostrarErrorComentario(post, 'No se pudo enviar el comentario. Intentá de nuevo.');
    } finally {
        input.disabled = false;
        boton.disabled = input.value.trim() === '';
        input.focus();
    }
}

// ---------- Eliminar publicación propia ----------

async function eliminarPublicacion(post) {
    post.querySelector('details.menu-post')?.removeAttribute('open');

    const titulo = post.querySelector('.post-titulo').textContent;
    const ok = await confirmar('¿Eliminar publicación?',
        '«' + titulo + '» se va a borrar junto con sus comentarios y Me Gusta. No se puede deshacer.');
    if (!ok) return;

    try {
        const respuesta = await postForm('/Publicacion/Eliminar', { idPublicacion: post.dataset.id });
        if (!verificarSesion(respuesta)) return;

        const datos = await leerJson(respuesta);
        if (!datos.ok) {
            mostrarToast(datos.mensaje);
            return;
        }

        borrarStorage(PREFIJO_BORRADOR + post.dataset.id);

        if (modalContenido && modalContenido.contains(post)) {
            // Perfil: se cierra el modal y se saca la miniatura de la grilla
            const miniatura = miniaturaAbierta;
            miniaturaAbierta = null; // así el cierre del modal no intenta actualizar sus contadores
            modal.close();
            miniatura?.remove();
            if (btnVerMasPerfil) btnVerMasPerfil.dataset.desde = Math.max(0, Number(btnVerMasPerfil.dataset.desde) - 1);
            restarPublicacionEnPerfil();
        } else {
            // Feed: se anima la salida y se corrige el "desde" para que Ver más no saltee una publicación
            post.classList.add('saliendo');
            setTimeout(() => post.remove(), 300);
            if (btnVerMas) btnVerMas.dataset.desde = Math.max(0, Number(btnVerMas.dataset.desde) - 1);
        }

        mostrarToast('Publicación eliminada.', 'exito');
    } catch (error) {
        console.error(error);
        mostrarToast('No se pudo eliminar la publicación. Intentá de nuevo.');
    }
}

function restarPublicacionEnPerfil() {
    const numero = document.querySelector('.perfil-stats li:first-child strong');
    if (numero) numero.textContent = Math.max(0, Number(numero.textContent) - 1);
}

// ---------- Ver más ----------

// Arma la misma estructura HTML que Views/Publicacion/_Publicacion.cshtml
function crearPublicacionElement(p) {
    const article = crear('article', 'post');
    article.dataset.id = p.id;

    // Encabezado
    const header = crear('header', 'post-header');
    const info = crear('div', 'post-autor');
    const usuario = crear('a', 'post-usuario', p.nombreUsuario);
    usuario.href = urlPerfil(p.nombreUsuario);
    info.append(usuario, crear('time', 'post-fecha', p.fecha));
    const avatar = crear('a', 'avatar', p.nombreUsuario.charAt(0).toUpperCase());
    avatar.href = urlPerfil(p.nombreUsuario);
    avatar.tabIndex = -1;
    avatar.setAttribute('aria-hidden', 'true');
    header.append(avatar, info);

    // Menú ⋯ (Editar / Eliminar) solo en las propias
    if (p.esMia) {
        const menu = crear('details', 'menu-post');
        const resumen = crear('summary', '', '⋯');
        resumen.title = 'Opciones';
        resumen.setAttribute('aria-label', 'Opciones de la publicación');
        const opciones = crear('div', 'menu-post-opciones');
        const editar = crear('a', '', '✏️ Editar');
        editar.href = '/Publicacion/Editar/' + p.id;
        const eliminar = crear('button', 'btn-eliminar-publicacion', '🗑️ Eliminar');
        eliminar.type = 'button';
        opciones.append(editar, eliminar);
        menu.append(resumen, opciones);
        header.appendChild(menu);
    }

    // Imagen (con el corazón grande del doble click)
    const media = crear('div', 'post-media');
    media.title = 'Doble click para dar Me Gusta';
    const img = crear('img', 'post-imagen');
    img.src = p.imagen;
    img.alt = p.titulo;
    img.loading = 'lazy';
    img.onerror = () => { img.onerror = null; img.src = '/img/placeholder.svg'; };
    media.append(img, crearIcono('corazon-grande', PATH_CORAZON));

    // Cuerpo
    const cuerpo = crear('div', 'post-cuerpo');

    const acciones = crear('div', 'post-acciones');
    const textoLike = p.usuarioDioMeGusta ? 'Ya no me gusta' : 'Me gusta';
    const btnLike = crear('button', 'btn-icono btn-like' + (p.usuarioDioMeGusta ? ' activo' : ''));
    btnLike.type = 'button';
    btnLike.setAttribute('aria-pressed', p.usuarioDioMeGusta);
    btnLike.title = textoLike;
    btnLike.setAttribute('aria-label', textoLike);
    btnLike.appendChild(crearIcono('icono icono-corazon', PATH_CORAZON));

    const btnComentar = crear('button', 'btn-icono btn-comentar');
    btnComentar.type = 'button';
    btnComentar.title = 'Comentar';
    btnComentar.setAttribute('aria-label', 'Comentar');
    btnComentar.appendChild(crearIcono('icono', PATH_GLOBO));
    acciones.append(btnLike, btnComentar);

    // "N Me gusta · N comentarios"
    const stats = crear('p', 'post-stats');
    const likes = crear('button', 'btn-ver-likes');
    likes.type = 'button';
    likes.title = 'Ver quiénes dieron Me Gusta';
    likes.append(crear('span', 'contador-likes', p.cantidadMeGusta), ' Me gusta');
    const cantComentarios = p.comentarios.length;
    const comentarios = crear('span', 'contador-comentarios');
    comentarios.append(
        crear('span', '', cantComentarios),
        ' ',
        crear('span', 'palabra-comentarios', cantComentarios === 1 ? 'comentario' : 'comentarios')
    );
    stats.append(likes, ' · ', comentarios);

    const lista = crear('ul', 'comentarios');
    p.comentarios.forEach(c => lista.appendChild(crearComentarioElement(c)));

    const form = crear('form', 'form-comentario');
    form.autocomplete = 'off';
    const input = crear('input');
    input.type = 'text';
    input.name = 'texto';
    input.placeholder = 'Agregá un comentario...';
    input.maxLength = MAXIMO_COMENTARIO;
    const contador = crear('span', 'contador-caracteres contador-comentario');
    contador.hidden = true;
    const btnEnviar = crear('button', '', 'Comentar');
    btnEnviar.type = 'submit';
    btnEnviar.disabled = true;
    form.append(input, contador, btnEnviar);

    const error = crear('p', 'error-comentario');
    error.hidden = true;

    cuerpo.append(
        acciones,
        stats,
        crear('h2', 'post-titulo', p.titulo),
        crear('p', 'post-descripcion', p.descripcion),
        lista,
        form,
        error
    );

    article.append(header, media, cuerpo);
    restaurarBorrador(article);
    return article;
}

// Pide la siguiente página, agrega cada publicación con "agregar" y actualiza el botón / el texto del final.
// Lo usan el feed (tarjetas completas) y el perfil (miniaturas).
async function cargarMas(boton, fin, url, agregar) {
    const desde = Number(boton.dataset.desde);
    boton.disabled = true;
    boton.textContent = 'Cargando…';

    try {
        const respuesta = await fetch(url + (url.includes('?') ? '&' : '?') + 'desde=' + desde);
        if (!verificarSesion(respuesta)) return;

        const datos = await leerJson(respuesta);
        if (!datos.ok) {
            mostrarToast(datos.mensaje);
            return;
        }

        datos.publicaciones.forEach(agregar);
        boton.dataset.desde = desde + datos.publicaciones.length;

        if (!datos.hayMas) {
            boton.hidden = true;
            fin.hidden = false;
        }
    } catch (error) {
        console.error(error);
        mostrarToast('No se pudieron cargar más publicaciones.');
    } finally {
        boton.disabled = false;
        boton.textContent = 'Ver más';
    }
}

function verMas() {
    // Respeta el orden elegido (más recientes / más gustadas)
    cargarMas(btnVerMas, finFeed, '/Publicacion/ObtenerMas?orden=' + encodeURIComponent(btnVerMas.dataset.orden || 'recientes'),
        p => feed.appendChild(crearPublicacionElement(p)));
}

// ==========================================================
// Perfil: grilla de miniaturas, modal con la publicación completa y Ver más
// ==========================================================

function iniciarPerfil() {
    grillaPerfil = document.getElementById('grillaPerfil');
    if (!grillaPerfil) return; // no estamos en un perfil

    modal = document.getElementById('modalPublicacion');
    modalContenido = document.getElementById('modalContenido');
    token = document.querySelector('input[name="__RequestVerificationToken"]').value;

    // Me Gusta y comentarios dentro del modal
    conectarEventosPublicacion(modalContenido);

    grillaPerfil.addEventListener('click', e => {
        const miniatura = e.target.closest('.miniatura');
        if (miniatura) abrirPublicacion(miniatura.dataset.id, miniatura);
    });

    modal.querySelector('.modal-cerrar').addEventListener('click', () => modal.close());

    // Click en el fondo oscuro (fuera de la tarjeta) cierra el modal
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.close();
    });

    // Al cerrar, pasa los contadores actualizados a la miniatura
    modal.addEventListener('close', () => {
        const post = modalContenido.querySelector('.post');
        if (post && miniaturaAbierta) {
            miniaturaAbierta.querySelector('.miniatura-likes').textContent =
                post.querySelector('.contador-likes').textContent;
            miniaturaAbierta.querySelector('.miniatura-comentarios').textContent =
                post.querySelector('.contador-comentarios span').textContent;
        }
        modalContenido.replaceChildren();
        miniaturaAbierta = null;
        if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    });

    btnVerMasPerfil = document.getElementById('btnVerMasPerfil');
    const finPerfil = document.getElementById('finPerfil');
    btnVerMasPerfil.addEventListener('click', () => {
        const url = '/Publicacion/ObtenerMas?idAutor=' + btnVerMasPerfil.dataset.idAutor +
                    '&cantidad=' + btnVerMasPerfil.dataset.cantidad;
        cargarMas(btnVerMasPerfil, finPerfil, url, p => grillaPerfil.appendChild(crearMiniaturaElement(p)));
    });

    // Desde el buscador se llega con #publicacion-ID: se abre esa publicación directamente
    abrirPublicacionDelHash();
    window.addEventListener('hashchange', abrirPublicacionDelHash);
}

function abrirPublicacionDelHash() {
    const coincidencia = location.hash.match(/^#publicacion-(\d+)$/);
    if (!coincidencia) return;
    const id = coincidencia[1];
    abrirPublicacion(id, grillaPerfil.querySelector('.miniatura[data-id="' + id + '"]'));
}

// Arma la misma estructura que las miniaturas de Views/Perfil/Index.cshtml
function crearMiniaturaElement(p) {
    const boton = crear('button', 'miniatura');
    boton.type = 'button';
    boton.dataset.id = p.id;
    boton.setAttribute('aria-label', 'Ver publicación: ' + p.titulo);

    const img = crear('img');
    img.src = p.imagen;
    img.alt = p.titulo;
    img.loading = 'lazy';
    img.onerror = () => { img.onerror = null; img.src = '/img/placeholder.svg'; };

    const overlay = crear('span', 'miniatura-overlay');
    const likes = crear('span', '', '❤ ');
    likes.appendChild(crear('span', 'miniatura-likes', p.cantidadMeGusta));
    const comentarios = crear('span', '', '💬 ');
    comentarios.appendChild(crear('span', 'miniatura-comentarios', p.comentarios.length));
    overlay.append(likes, comentarios);

    boton.append(img, overlay);
    return boton;
}

// Trae la publicación con Fetch y la muestra en el modal. "miniatura" puede ser null
// (por ejemplo si se abrió desde el buscador y todavía no está cargada en la grilla).
async function abrirPublicacion(id, miniatura) {
    if (miniatura?.classList.contains('cargando')) return;
    miniatura?.classList.add('cargando');

    try {
        const respuesta = await fetch('/Publicacion/Detalle?id=' + id);
        if (!verificarSesion(respuesta)) return;

        const datos = await leerJson(respuesta);
        if (!datos.ok) {
            mostrarToast(datos.mensaje);
            return;
        }

        miniaturaAbierta = miniatura;
        modalContenido.replaceChildren(crearPublicacionElement(datos.publicacion));
        if (!modal.open) modal.showModal();
    } catch (error) {
        console.error(error);
        mostrarToast('No se pudo abrir la publicación.');
    } finally {
        miniatura?.classList.remove('cargando');
    }
}

// ==========================================================
// Buscador de la navbar: Fetch mientras se escribe (con una pequeña espera para no consultar por cada tecla)
// ==========================================================

function iniciarBuscador() {
    const input = document.getElementById('inputBuscar');
    if (!input) return; // sin sesión no hay buscador

    const buscador = document.getElementById('buscador');
    const resultados = document.getElementById('resultadosBusqueda');
    let temporizador = null;
    let controlador = null;

    const cerrar = () => { resultados.hidden = true; };

    input.addEventListener('input', () => {
        clearTimeout(temporizador);
        const q = input.value.trim();
        if (q.length < 2) {
            controlador?.abort();
            resultados.replaceChildren();
            cerrar();
            return;
        }
        temporizador = setTimeout(() => buscar(q), 250);
    });

    async function buscar(q) {
        controlador?.abort(); // si la búsqueda anterior todavía no volvió, se cancela
        controlador = new AbortController();
        try {
            const respuesta = await fetch('/Publicacion/Buscar?q=' + encodeURIComponent(q), { signal: controlador.signal });
            if (!verificarSesion(respuesta)) return;

            const datos = await leerJson(respuesta);
            if (!datos.ok) {
                mostrarToast(datos.mensaje);
                return;
            }
            mostrarResultados(datos);
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error(error);
            mostrarToast('No se pudo buscar. Intentá de nuevo.');
        }
    }

    function mostrarResultados(datos) {
        const partes = [];

        if (datos.usuarios.length > 0) {
            partes.push(crear('p', 'buscador-seccion', 'Personas'));
            datos.usuarios.forEach(u => {
                const a = crear('a', 'buscador-item');
                a.href = urlPerfil(u.nombreUsuario);
                a.setAttribute('role', 'option');
                const texto = crear('span', 'lateral-texto');
                texto.append(
                    crear('span', 'lateral-usuario', u.nombreUsuario),
                    crear('span', 'lateral-sub', u.nombreCompleto + ' · ' + u.cantidadPublicaciones +
                        (u.cantidadPublicaciones === 1 ? ' publicación' : ' publicaciones'))
                );
                a.append(crear('span', 'avatar avatar-chico', u.nombreUsuario.charAt(0).toUpperCase()), texto);
                partes.push(a);
            });
        }

        if (datos.publicaciones.length > 0) {
            partes.push(crear('p', 'buscador-seccion', 'Publicaciones'));
            datos.publicaciones.forEach(p => {
                const a = crear('a', 'buscador-item');
                a.href = urlPerfil(p.nombreUsuario) + '#publicacion-' + p.id;
                a.setAttribute('role', 'option');
                const img = crear('img', 'buscador-miniatura');
                img.src = p.imagen;
                img.alt = '';
                const texto = crear('span', 'lateral-texto');
                texto.append(crear('span', 'lateral-usuario', p.titulo), crear('span', 'lateral-sub', 'de ' + p.nombreUsuario));
                a.append(img, texto);
                partes.push(a);
            });
        }

        if (partes.length === 0) {
            partes.push(crear('p', 'buscador-vacio', 'No hay resultados para «' + input.value.trim() + '».'));
        }

        resultados.replaceChildren(...partes);
        resultados.hidden = false;
    }

    // Se vuelve a mostrar al entrar al campo si ya había resultados
    input.addEventListener('focus', () => {
        if (resultados.children.length > 0 && input.value.trim().length >= 2) resultados.hidden = false;
    });

    // Flechas para moverse entre resultados, Escape para cerrar
    buscador.addEventListener('keydown', e => {
        const items = [...resultados.querySelectorAll('.buscador-item')];
        const actual = items.indexOf(document.activeElement);

        if (e.key === 'Escape') {
            cerrar();
            input.focus();
        } else if (e.key === 'ArrowDown' && items.length > 0) {
            e.preventDefault();
            if (resultados.hidden) resultados.hidden = false;
            items[Math.min(actual + 1, items.length - 1)].focus();
        } else if (e.key === 'ArrowUp' && actual !== -1) {
            e.preventDefault();
            if (actual === 0) input.focus();
            else items[actual - 1].focus();
        }
    });

    document.addEventListener('click', e => {
        if (!buscador.contains(e.target)) cerrar();
    });
}

// ==========================================================
// Inicio: se ejecuta al final, cuando todo lo de arriba ya está declarado
// ==========================================================

iniciarTema();                  // Switch claro / oscuro (todas las páginas)
iniciarDialogos();              // Confirmación, lista de Me Gusta y menú ⋯
iniciarBuscador();              // Buscador de la navbar
iniciarFormularioPublicacion(); // Crear / Editar publicación
iniciarContadoresFormulario();  // Contadores de título y descripción
iniciarFeed();                  // Página principal
iniciarPerfil();                // Perfil de usuario

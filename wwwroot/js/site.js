// site.js — JavaScript del sitio. Se carga en todas las páginas desde _Layout.cshtml,
// por eso cada parte se inicia solo si la página tiene los elementos que necesita.

// Variables del feed (se declaran antes de usarse)
let feed, btnVerMas, finFeed, token;

// Íconos SVG (mismos que usa Views/Publicacion/_Publicacion.cshtml)
const PATH_CORAZON = 'M12 20.7s-7.2-4.4-9.3-8.6C1.1 8.9 2.7 5 6.3 4.4c2.1-.4 4 .6 5.7 2.6 1.7-2 3.6-3 5.7-2.6 3.6.6 5.2 4.5 3.6 7.7-2.1 4.2-9.3 8.6-9.3 8.6z';
const PATH_GLOBO = 'M20.7 16.9A9.5 9.5 0 1 0 17 20.5L21.5 21.5z';

// ==========================================================
// Crear publicación: vista previa de la imagen elegida
// ==========================================================

function iniciarVistaPreviaImagen() {
    const inputImagen = document.getElementById('imagen');
    const preview = document.getElementById('previewImagen');
    const texto = document.getElementById('textoZonaImagen');
    if (!inputImagen || !preview) return; // no estamos en la página de Crear

    // Solo muestra la imagen en el navegador; no sube nada hasta que se envía el formulario
    inputImagen.addEventListener('change', () => {
        const archivo = inputImagen.files[0];
        if (!archivo) {
            preview.hidden = true;
            texto.hidden = false;
            return;
        }
        preview.src = URL.createObjectURL(archivo);
        preview.hidden = false;
        texto.hidden = true;
    });
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

    // Eventos delegados en #feed: funcionan también en las publicaciones agregadas por "Ver más"
    let ultimoToque = { media: null, tiempo: 0 };

    feed.addEventListener('click', e => {
        const post = e.target.closest('.post');
        if (!post) return;

        // Botón corazón: da o quita el Me Gusta
        if (e.target.closest('.btn-like')) {
            toggleMeGusta(post);
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

    feed.addEventListener('submit', e => {
        const form = e.target.closest('.form-comentario');
        if (!form) return;
        e.preventDefault();
        comentar(form.closest('.post'), form);
    });

    // Habilita el botón "Comentar" solo si hay texto
    feed.addEventListener('input', e => {
        if (e.target.name !== 'texto') return;
        const post = e.target.closest('.post');
        post.querySelector('.form-comentario button').disabled = e.target.value.trim() === '';
        mostrarErrorComentario(post, '');
    });

    btnVerMas.addEventListener('click', verMas);
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
            alert(datos.mensaje);
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
        alert('No se pudo registrar el Me Gusta. Intentá de nuevo.');
    } finally {
        boton.disabled = false;
    }
}

// ---------- Comentarios ----------

function crearComentarioElement(c) {
    const li = crear('li', 'comentario');
    li.append(
        crear('span', 'comentario-usuario', c.nombreUsuario),
        crear('span', 'comentario-texto', c.texto),
        crear('time', 'comentario-fecha', c.fecha)
    );
    return li;
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
            mostrarErrorComentario(post, datos.mensaje);
            return;
        }

        const li = crearComentarioElement(datos.comentario);
        li.classList.add('nuevo');
        const lista = post.querySelector('.comentarios');
        lista.appendChild(li);
        lista.scrollTop = lista.scrollHeight;

        actualizarContadorComentarios(post, lista.children.length);

        input.value = '';
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

// ---------- Ver más ----------

// Arma la misma estructura HTML que Views/Publicacion/_Publicacion.cshtml
function crearPublicacionElement(p) {
    const article = crear('article', 'post');
    article.dataset.id = p.id;

    // Encabezado
    const header = crear('header', 'post-header');
    const info = crear('div');
    info.append(crear('span', 'post-usuario', p.nombreUsuario), crear('time', 'post-fecha', p.fecha));
    header.append(crear('span', 'avatar', p.nombreUsuario.charAt(0).toUpperCase()), info);

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
    const likes = crear('strong');
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
    input.maxLength = 500;
    const btnEnviar = crear('button', '', 'Comentar');
    btnEnviar.type = 'submit';
    btnEnviar.disabled = true;
    form.append(input, btnEnviar);

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
    return article;
}

async function verMas() {
    const desde = Number(btnVerMas.dataset.desde);
    btnVerMas.disabled = true;
    btnVerMas.textContent = 'Cargando…';

    try {
        const respuesta = await fetch('/Publicacion/ObtenerMas?desde=' + desde);
        if (!verificarSesion(respuesta)) return;

        const datos = await leerJson(respuesta);
        if (!datos.ok) {
            alert(datos.mensaje);
            return;
        }

        datos.publicaciones.forEach(p => feed.appendChild(crearPublicacionElement(p)));
        btnVerMas.dataset.desde = desde + datos.publicaciones.length;

        if (!datos.hayMas) {
            btnVerMas.hidden = true;
            finFeed.hidden = false;
        }
    } catch (error) {
        console.error(error);
        alert('No se pudieron cargar más publicaciones.');
    } finally {
        btnVerMas.disabled = false;
        btnVerMas.textContent = 'Ver más';
    }
}

// ==========================================================
// Inicio: se ejecuta al final, cuando todo lo de arriba ya está declarado
// ==========================================================

iniciarVistaPreviaImagen(); // Crear publicación
iniciarFeed();              // Página principal

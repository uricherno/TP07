// site.js — JavaScript del sitio. Se carga en todas las páginas desde _Layout.cshtml,
// por eso cada parte se inicia solo si la página tiene los elementos que necesita.

iniciarVistaPreviaImagen(); // Crear publicación
iniciarFeed();              // Página principal: Me Gusta, Comentar y Ver más con Fetch

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

let feed, btnVerMas, finFeed, token;

function iniciarFeed() {
    feed = document.getElementById('feed');
    if (!feed) return; // no estamos en la página principal

    btnVerMas = document.getElementById('btnVerMas');
    finFeed = document.getElementById('finFeed');
    token = document.querySelector('input[name="__RequestVerificationToken"]').value;

    // Eventos delegados en #feed: funcionan también en las publicaciones agregadas por "Ver más"
    feed.addEventListener('click', e => {
        const boton = e.target.closest('.btn-like');
        if (boton) toggleMeGusta(boton.closest('.post'), boton);
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

// Crea un elemento con clase y texto. Se usa textContent (nunca innerHTML) para evitar XSS.
function crear(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
}

// ---------- Me Gusta ----------

async function toggleMeGusta(post, boton) {
    boton.disabled = true; // evita doble click mientras espera la respuesta
    try {
        const respuesta = await postForm('/Publicacion/MeGusta', { idPublicacion: post.dataset.id });
        if (!verificarSesion(respuesta)) return;

        const datos = await respuesta.json();
        if (!datos.ok) {
            alert(datos.mensaje);
            return;
        }

        boton.querySelector('.contador-likes').textContent = datos.cantidad;
        boton.querySelector('.corazon').textContent = datos.meGusta ? '♥' : '♡';
        boton.classList.toggle('activo', datos.meGusta);
        boton.setAttribute('aria-pressed', datos.meGusta);
        boton.title = datos.meGusta ? 'Ya no me gusta' : 'Me gusta';

        if (datos.meGusta) {
            boton.classList.remove('animar');
            void boton.offsetWidth; // reinicia la animación
            boton.classList.add('animar');
        }
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

        const datos = await respuesta.json();
        if (!datos.ok) {
            mostrarErrorComentario(post, datos.mensaje);
            return;
        }

        const li = crearComentarioElement(datos.comentario);
        li.classList.add('nuevo');
        const lista = post.querySelector('.comentarios');
        lista.appendChild(li);
        lista.scrollTop = lista.scrollHeight;

        const contador = post.querySelector('.contador-comentarios span');
        contador.textContent = Number(contador.textContent) + 1;

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

    // Imagen
    const img = crear('img', 'post-imagen');
    img.src = p.imagen;
    img.alt = p.titulo;
    img.loading = 'lazy';
    img.onerror = () => { img.onerror = null; img.src = '/img/placeholder.svg'; };

    // Cuerpo
    const cuerpo = crear('div', 'post-cuerpo');

    const acciones = crear('div', 'post-acciones');
    const btnLike = crear('button', 'btn-like' + (p.usuarioDioMeGusta ? ' activo' : ''));
    btnLike.type = 'button';
    btnLike.setAttribute('aria-pressed', p.usuarioDioMeGusta);
    btnLike.title = p.usuarioDioMeGusta ? 'Ya no me gusta' : 'Me gusta';
    const corazon = crear('span', 'corazon', p.usuarioDioMeGusta ? '♥' : '♡');
    corazon.setAttribute('aria-hidden', 'true');
    btnLike.append(corazon, crear('span', 'contador-likes', p.cantidadMeGusta), crear('span', 'texto-likes', 'Me gusta'));

    const contadorComentarios = crear('span', 'contador-comentarios', '💬 ');
    contadorComentarios.appendChild(crear('span', '', p.comentarios.length));
    acciones.append(btnLike, contadorComentarios);

    const lista = crear('ul', 'comentarios');
    p.comentarios.forEach(c => lista.appendChild(crearComentarioElement(c)));

    const form = crear('form', 'form-comentario');
    form.autocomplete = 'off';
    const input = crear('input');
    input.type = 'text';
    input.name = 'texto';
    input.placeholder = 'Escribí un comentario...';
    input.maxLength = 500;
    const btnComentar = crear('button', '', 'Comentar');
    btnComentar.type = 'submit';
    btnComentar.disabled = true;
    form.append(input, btnComentar);

    const error = crear('p', 'error-comentario');
    error.hidden = true;

    cuerpo.append(
        acciones,
        crear('h2', 'post-titulo', p.titulo),
        crear('p', 'post-descripcion', p.descripcion),
        lista,
        form,
        error
    );

    article.append(header, img, cuerpo);
    return article;
}

async function verMas() {
    const desde = Number(btnVerMas.dataset.desde);
    btnVerMas.disabled = true;
    btnVerMas.textContent = 'Cargando…';

    try {
        const respuesta = await fetch('/Publicacion/ObtenerMas?desde=' + desde);
        if (!verificarSesion(respuesta)) return;

        const datos = await respuesta.json();
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

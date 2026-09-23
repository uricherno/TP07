Estoy haciendo el TP07 "Red Social" en ASP.NET MVC (.NET 9, C#) con Session, SQL Server, Dapper, JavaScript y Fetch. En la sesión anterior quedaron hechos los **models y los controllers**. Hoy quiero que hagas **las vistas, el JavaScript con Fetch y el CSS**. No cambies los models ni los controllers salvo que haga falta para que funcione, y si cambiás algo avisame. **Tampoco cambies el script de la base de datos (`Script.sql`).**

## Consigna del TP

TP07 - Red Social

Propósito del TP:
Desarrollar una aplicación web en ASP.NET MVC (C#) que simule el funcionamiento básico de una red social, en la cual los usuarios puedan registrarse, iniciar sesión y visualizar publicaciones realizadas por otros usuarios.

El objetivo principal de este trabajo será incorporar el uso de Fetch para comunicar el código JavaScript de nuestras Views con diferentes acciones del Controller sin necesidad de recargar la página completa.

La aplicación permitirá:
- Registrar usuarios.
- Iniciar y cerrar sesión.
- Mantener al usuario identificado mediante Session.
- Crear y visualizar publicaciones.
- Dar o quitar Me Gusta a una publicación.
- Comentar publicaciones.
- Cargar publicaciones progresivamente mediante un botón Ver más.
- Actualizar información de la página sin recargarla utilizando Fetch.
- Persistir toda la información en una Base de Datos.

Todo esto utilizando: ASP.NET MVC, C#, Session, SQL Server, Dapper, JavaScript, Fetch.

Además, se espera que utilices GitHub Copilot como herramienta de asistencia, aplicando buenas prácticas.

### Requerimientos funcionales
1. Registro de usuario
2. Login
3. Logout

Podemos tomar para estos 3 primeros puntos TODO el TP05 realizado oportunamente.

### Publicaciones

**4. Crear una publicación**
Un usuario que haya iniciado sesión podrá crear una nueva publicación.
Cada publicación deberá contener:
- Una imagen.
- Un título.
- Una descripción.
- El usuario que realizó la publicación.
- La fecha y hora de publicación.

La publicación deberá quedar almacenada en la Base de Datos.
No será necesario utilizar Fetch para esta funcionalidad.

**5. Página principal**
La página principal mostrará las publicaciones realizadas por todos los usuarios.
Al ingresar se deberán mostrar inicialmente las 10 publicaciones más recientes. (investigar TOP, LIMIT u OFFSET de SQL Server)
Cada publicación deberá mostrar como mínimo:
- Imagen.
- Título.
- Descripción.
- Usuario que la publicó.
- Fecha de publicación.
- Cantidad de Me Gusta.
- Botón Me Gusta.
- Comentarios.
- Formulario para realizar un nuevo comentario.

Las publicaciones deberán mostrarse ordenadas desde la más reciente a la más antigua.

### Uso de Fetch
Las siguientes funcionalidades deberán resolverse obligatoriamente utilizando Fetch.

**6. Me Gusta**
Cada publicación tendrá un botón de Me Gusta.
Cuando el usuario presione el botón, JavaScript deberá realizar una petición Fetch a una acción del Controller.
La petición deberá enviar la información necesaria para identificar la publicación.
El servidor deberá:
- Identificar al usuario mediante la Session.
- Verificar que la publicación exista.
- Registrar el Me Gusta en la Base de Datos.
- Devolver una respuesta al JavaScript.

Al recibir la respuesta, JavaScript deberá modificar el DOM para actualizar la cantidad de Me Gusta sin recargar la página.

Importante: un mismo usuario no puede dar más de un Me Gusta a la misma publicación. Si el usuario ya había indicado Me Gusta, al volver a presionar el botón deberá quitarlo. Por lo tanto, el mismo botón funcionará como un Me Gusta / Ya no me gusta.

**7. Realizar un comentario**
Un usuario logueado podrá escribir un comentario en cualquiera de las publicaciones.
Al presionar Comentar, JavaScript deberá realizar una petición Fetch enviando:
- El identificador de la publicación.
- El texto del comentario.

El Controller deberá:
- Identificar al usuario mediante Session.
- Validar la publicación.
- Validar que el comentario no esté vacío.
- Guardar el comentario en la Base de Datos.
- Devolver la información necesaria del comentario creado.

JavaScript deberá recibir esa información y agregar el nuevo comentario a la publicación.
El comentario deberá aparecer inmediatamente debajo de la publicación sin recargar la página.
Cada comentario mostrará como mínimo:
- Nombre de usuario.
- Texto.
- Fecha y hora.

**8. Ver más publicaciones**
Al ingresar a la página principal solamente se mostrarán las primeras 10 publicaciones.
Debajo de ellas deberá existir un botón: Ver más
Cuando el usuario lo presione se deberá realizar una petición Fetch para obtener las 10 publicaciones siguientes.
Por ejemplo: GET /Publicacion/ObtenerMas?desde=10
El Controller deberá consultar la Base de Datos y devolver las publicaciones correspondientes.
JavaScript deberá agregarlas debajo de las publicaciones existentes sin reemplazar las publicaciones que ya estaban visibles.
Por ejemplo:
- Al ingresar → publicaciones 1 a 10.
- Primer Ver más → publicaciones 11 a 20.
- Segundo Ver más → publicaciones 21 a 30.
- Tercer Ver más → publicaciones 31 a 40.

En ningún momento se deberá recargar la página completa.
Cuando ya no existan más publicaciones para mostrar, el botón Ver más deberá ocultarse o deshabilitarse.

## Lo que ya está hecho (leelo antes de empezar)
- `Models/BD.cs`: Dapper con todas las consultas. Base de datos `DBRedSocial`, tablas `Usuarios(Id, NombreUsuario, [Contraseña], Nombre, Apellido)`, `Publicaciones(Id, IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)`, `Comentarios(Id, IdPublicacion, IdUsuarioComenta, Texto, FechaComentario)` y `PublicacionesMeGusta(Id, [IdPublicación], IdUsuario)`.
- `Models/Usuario.cs`, `Publicacion.cs` (incluye `NombreUsuario`, `CantidadMeGusta`, `UsuarioDioMeGusta` y `List<Comentario> Comentarios`), `Comentario.cs` y `Seguridad.cs` (hash SHA256 en Base64).
- `Controllers/AccountController.cs`:
  - `Login` GET/POST con los campos `nombreUsuario` y `contrasena`.
  - `Registro` GET/POST con los campos `nombre`, `apellido`, `nombreUsuario`, `contrasena` y `confirmarContrasena`.
  - `Logout`.
  - Los errores vienen en `ViewBag.Error` y los valores cargados vuelven en `ViewBag.Nombre`, `ViewBag.Apellido` y `ViewBag.NombreUsuario`.
  - La sesión guarda `IdUsuario` (int) y `NombreUsuario` (string).
- `Controllers/PublicacionController.cs`:
  - `Index`: el modelo es `List<Publicacion>` con las primeras 10, más `ViewBag.HayMas` (bool). Si no hay sesión, redirige a Login.
  - `Crear` GET/POST: `multipart/form-data` con los campos `titulo`, `descripcion` e `imagen` (IFormFile). Guarda la imagen en `wwwroot/img/publicaciones/{guid}.ext`. Los errores vienen en `ViewBag.Error` y los valores cargados en `ViewBag.Titulo` y `ViewBag.Descripcion`.
  - `MeGusta` POST con `idPublicacion`. Devuelve `{ ok, meGusta, cantidad }`.
  - `Comentar` POST con `idPublicacion` y `texto`. Devuelve `{ ok, comentario: { id, nombreUsuario, texto, fecha } }`.
  - `ObtenerMas` GET `?desde=N`. Devuelve `{ ok, hayMas, publicaciones: [{ id, nombreUsuario, titulo, descripcion, imagen (URL completa), fecha, cantidadMeGusta, usuarioDioMeGusta, comentarios: [...] }] }`.
  - Los POST tienen `[ValidateAntiForgeryToken]`: hay que mandar el token en el header `RequestVerificationToken`.
  - Si no hay sesión responden 401, si la publicación no existe 404 y si el comentario está vacío o supera 500 caracteres 400 con `{ ok:false, mensaje }`.
- La ruta por defecto es `Publicacion/Index`. `HomeController.Index` redirige ahí.
- `Views/Shared/_Layout.cshtml` y `wwwroot/css/site.css` son todavía los de la plantilla, con Bootstrap.

## Qué hacer
1. **Borrador de la sesión anterior.** Si existe la carpeta `C:\Users\50156463\AppData\Local\Temp\claude\c--Users-50156463-Desktop-TP07\8a62431a-717e-414d-90e0-f9ee9abdfb0b\scratchpad\vistas-pendientes\`, tiene un borrador completo de todo esto: vistas, `feed.js`, `site.css` y `placeholder.svg`. Revisalo, mostrame qué hay y usalo como base. Si no existe, hacelo de cero siguiendo lo de abajo.
2. **`Views/Shared/_Layout.cshtml`:** navbar propia sin Bootstrap.
   - Con sesión: logo, "Nueva publicación", avatar con la inicial y el usuario, y "Cerrar sesión".
   - Sin sesión: "Iniciar sesión" y "Registrarse".
3. **`Views/Account/Login.cshtml` y `Registro.cshtml`:** tarjeta centrada que muestra `ViewBag.Error` y conserva los valores cargados.
4. **`Views/Publicacion/Crear.cshtml`:** formulario normal, sin Fetch, con vista previa de la imagen elegida.
5. **`Views/Publicacion/_Publicacion.cshtml`** (partial de cada publicación): usuario, fecha, imagen, título y descripción. Botón Me Gusta que muestre ♥ y la clase `.activo` si ya le dio, con el contador. Lista de comentarios (usuario, texto y fecha `dd/MM/yyyy HH:mm`) y formulario para comentar.
6. **`Views/Publicacion/Index.cshtml`:**
   - `@Html.AntiForgeryToken()` y un `#feed` con el partial.
   - Un botón "Ver más" con `data-desde`, oculto si `!ViewBag.HayMas`.
   - Un mensaje cuando no hay publicaciones.
7. **`wwwroot/js/feed.js`**, obligatorio con Fetch y sin recargar la página:
   - **Me Gusta:** POST, actualiza el contador y el estado del botón, y lo deshabilita mientras espera la respuesta.
   - **Comentar:** POST, agrega el comentario abajo de la publicación y limpia el input. Si el comentario está vacío muestra un error.
   - **Ver más:** GET `ObtenerMas?desde=`, agrega las publicaciones debajo de las que ya están, actualiza `desde` y oculta el botón cuando `hayMas` es false.
   - Eventos delegados en `#feed`, para que también funcionen en las publicaciones cargadas con Ver más.
   - Armar el DOM con `createElement` y `textContent`, nunca `innerHTML` con datos del usuario.
   - Si el servidor responde 401, redirigir a `/Account/Login`.
8. **`wwwroot/css/site.css`:** estilo feed tipo Instagram simplificado.
   - Variables en `:root`: color primario violeta `#6c5ce7`, like `#e0245e`, fondo `#f4f5f7`.
   - Tarjetas con radio y sombra en una columna centrada de 600px, imagen `aspect-ratio 4/3` con `object-fit: cover`.
   - Botón Me Gusta con animación, input de comentario redondeado, botón Ver más de ancho completo.
   - Diseño responsive para mobile.
9. **Imágenes de ejemplo:** las del script de la base (`bariloche.jpg`, etc.) no existen en el proyecto. Usá un `wwwroot/img/placeholder.svg` como reemplazo con `onerror`, tanto en el partial como en el JS.
10. **No compiles ni ejecutes el proyecto** (nada de `dotnet build` ni `dotnet run`); eso lo hago yo.

Explicame brevemente cada archivo que hagas, porque lo tengo que defender en el TP.

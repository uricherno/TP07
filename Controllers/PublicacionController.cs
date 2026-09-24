using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using TP07.Models;

namespace TP07.Controllers;

public class PublicacionController : Controller
{
    private const int CantidadPorPagina = 10;
    private const int MaximoPorPagina = 12;
    private const int MaximoTitulo = 200;
    private const int MaximoDescripcion = 2000;
    private const int MaximoComentario = 500;
    private const int SegundosEntreComentarios = 5;
    private const long TamanoMaximoImagen = 5 * 1024 * 1024; // 5 MB
    private static readonly string[] ExtensionesPermitidas = { ".jpg", ".jpeg", ".png", ".gif", ".webp" };

    // Nombre que les pone la app a las imágenes subidas: Guid sin guiones (32) + extensión.
    // Solo esas se borran del disco; las de ejemplo y las predeterminadas nunca se tocan.
    private static readonly Regex NombreImagenSubida = new(@"^[0-9a-f]{32}\.(jpg|jpeg|png|gif|webp)$");

    private readonly IWebHostEnvironment _env;

    public PublicacionController(IWebHostEnvironment env)
    {
        _env = env;
    }

    private int? IdUsuarioLogueado() => HttpContext.Session.GetInt32("IdUsuario");

    private static string OrdenValido(string? orden) => orden == "gustadas" ? "gustadas" : "recientes";

    // GET /Publicacion → página principal con las 10 publicaciones más recientes (o más gustadas)
    public IActionResult Index(string? orden)
    {
        int? idUsuario = IdUsuarioLogueado();
        if (idUsuario == null) return RedirectToAction("Login", "Account");

        orden = OrdenValido(orden);

        // Se pide una de más para saber si existe una página siguiente
        var publicaciones = BD.ObtenerPublicaciones(0, CantidadPorPagina + 1, idUsuario.Value, null, orden);
        ViewBag.HayMas = publicaciones.Count > CantidadPorPagina;
        ViewBag.CantidadPorPagina = CantidadPorPagina;
        ViewBag.Orden = orden;

        // Barra lateral: mi tarjeta de perfil y otros usuarios
        ViewBag.MiPerfil = BD.ObtenerPerfil(HttpContext.Session.GetString("NombreUsuario") ?? "");
        ViewBag.Sugeridos = BD.ObtenerUsuariosSugeridos(idUsuario.Value, 5);
        return View(publicaciones.Take(CantidadPorPagina).ToList());
    }

    // ---------- Crear ----------

    [HttpGet]
    public IActionResult Crear()
    {
        if (IdUsuarioLogueado() == null) return RedirectToAction("Login", "Account");
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Crear(string titulo, string descripcion, IFormFile? imagen)
    {
        int? idUsuario = IdUsuarioLogueado();
        if (idUsuario == null) return RedirectToAction("Login", "Account");

        ViewBag.Titulo = titulo;
        ViewBag.Descripcion = descripcion;

        string? error = ValidarTextos(titulo, descripcion);
        if (error == null && (imagen == null || imagen.Length == 0))
            error = "Tenés que seleccionar una imagen.";
        if (error != null)
        {
            ViewBag.Error = error;
            return View();
        }

        var (nombreArchivo, errorImagen) = await GuardarImagen(imagen!);
        if (errorImagen != null)
        {
            ViewBag.Error = errorImagen;
            return View();
        }

        BD.CrearPublicacion(new Publicacion
        {
            IdUsuario = idUsuario.Value,
            Titulo = titulo.Trim(),
            Descripcion = descripcion.Trim(),
            Imagen = nombreArchivo!
        });

        return RedirectToAction("Index");
    }

    // ---------- Editar (formulario común, igual que Crear) ----------

    [HttpGet]
    public IActionResult Editar(int id)
    {
        int? idUsuario = IdUsuarioLogueado();
        if (idUsuario == null) return RedirectToAction("Login", "Account");

        Publicacion? p = BD.ObtenerPublicacion(id, idUsuario.Value);
        if (p == null || p.IdUsuario != idUsuario.Value) return NoEncontrada();

        ViewBag.Titulo = p.Titulo;
        ViewBag.Descripcion = p.Descripcion;
        return View(p);
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Editar(int id, string titulo, string descripcion, IFormFile? imagen)
    {
        int? idUsuario = IdUsuarioLogueado();
        if (idUsuario == null) return RedirectToAction("Login", "Account");

        // Se vuelve a verificar que la publicación sea del usuario (no alcanza con ocultar el botón)
        Publicacion? p = BD.ObtenerPublicacion(id, idUsuario.Value);
        if (p == null || p.IdUsuario != idUsuario.Value) return NoEncontrada();

        ViewBag.Titulo = titulo;
        ViewBag.Descripcion = descripcion;

        string? error = ValidarTextos(titulo, descripcion);
        if (error != null)
        {
            ViewBag.Error = error;
            return View(p);
        }

        // La imagen es opcional al editar: si no se elige una nueva, queda la actual
        string? nombreArchivo = null;
        if (imagen != null && imagen.Length > 0)
        {
            var (nombre, errorImagen) = await GuardarImagen(imagen);
            if (errorImagen != null)
            {
                ViewBag.Error = errorImagen;
                return View(p);
            }
            nombreArchivo = nombre;
        }

        BD.ActualizarPublicacion(id, idUsuario.Value, titulo.Trim(), descripcion.Trim(), nombreArchivo);
        if (nombreArchivo != null) BorrarArchivoImagen(p.Imagen);

        return RedirectToAction("Index", "Perfil");
    }

    // POST /Publicacion/Eliminar (Fetch) → borra una publicación propia con sus comentarios y Me Gusta
    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Eliminar(int idPublicacion)
    {
        int? idUsuario = IdUsuarioLogueado();
        if (idUsuario == null)
            return Unauthorized(new { ok = false, mensaje = "Tenés que iniciar sesión." });

        Publicacion? p = BD.ObtenerPublicacion(idPublicacion, idUsuario.Value);
        if (p == null)
            return NotFound(new { ok = false, mensaje = "La publicación no existe." });
        if (p.IdUsuario != idUsuario.Value)
            return StatusCode(StatusCodes.Status403Forbidden, new { ok = false, mensaje = "Solo podés eliminar tus propias publicaciones." });

        string? imagen = BD.EliminarPublicacion(idPublicacion, idUsuario.Value);
        if (imagen == null)
            return NotFound(new { ok = false, mensaje = "La publicación no existe." });

        BorrarArchivoImagen(imagen);
        return Json(new { ok = true });
    }

    // ---------- Me Gusta ----------

    // POST /Publicacion/MeGusta (Fetch) → da o quita el Me Gusta
    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult MeGusta(int idPublicacion)
    {
        int? idUsuario = IdUsuarioLogueado();
        if (idUsuario == null)
            return Unauthorized(new { ok = false, mensaje = "Tenés que iniciar sesión." });

        if (!BD.ExistePublicacion(idPublicacion))
            return NotFound(new { ok = false, mensaje = "La publicación no existe." });

        var (meGusta, cantidad) = BD.ToggleMeGusta(idUsuario.Value, idPublicacion);
        return Json(new { ok = true, meGusta, cantidad });
    }

    // GET /Publicacion/QuienesDieronMeGusta?idPublicacion=5 (Fetch) → lista de usuarios
    [HttpGet]
    public IActionResult QuienesDieronMeGusta(int idPublicacion)
    {
        if (IdUsuarioLogueado() == null)
            return Unauthorized(new { ok = false, mensaje = "Tenés que iniciar sesión." });

        if (!BD.ExistePublicacion(idPublicacion))
            return NotFound(new { ok = false, mensaje = "La publicación no existe." });

        var usuarios = BD.ObtenerUsuariosQueDieronMeGusta(idPublicacion).Select(u => new
        {
            nombreUsuario = u.NombreUsuario,
            nombreCompleto = (u.Nombre + " " + u.Apellido).Trim()
        });
        return Json(new { ok = true, usuarios });
    }

    // ---------- Comentarios ----------

    // POST /Publicacion/Comentar (Fetch) → guarda y devuelve el comentario creado
    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Comentar(int idPublicacion, string? texto)
    {
        int? idUsuario = IdUsuarioLogueado();
        if (idUsuario == null)
            return Unauthorized(new { ok = false, mensaje = "Tenés que iniciar sesión." });

        if (!BD.ExistePublicacion(idPublicacion))
            return NotFound(new { ok = false, mensaje = "La publicación no existe." });

        texto = texto?.Trim();
        if (string.IsNullOrEmpty(texto))
            return BadRequest(new { ok = false, mensaje = "El comentario no puede estar vacío." });
        if (texto.Length > MaximoComentario)
            return BadRequest(new { ok = false, mensaje = $"El comentario no puede superar los {MaximoComentario} caracteres." });

        // Anti-spam: como máximo un comentario cada 5 segundos por usuario (se guarda la hora en la Session)
        string? ultimo = HttpContext.Session.GetString("UltimoComentario");
        if (ultimo != null && long.TryParse(ultimo, out long ticks))
        {
            double segundos = (DateTime.UtcNow - new DateTime(ticks, DateTimeKind.Utc)).TotalSeconds;
            if (segundos < SegundosEntreComentarios)
            {
                int espera = (int)Math.Ceiling(SegundosEntreComentarios - segundos);
                return StatusCode(StatusCodes.Status429TooManyRequests,
                    new { ok = false, mensaje = $"Esperá {espera} segundo{(espera == 1 ? "" : "s")} antes de volver a comentar." });
            }
        }

        Comentario c = BD.CrearComentario(idPublicacion, idUsuario.Value, texto);
        HttpContext.Session.SetString("UltimoComentario", DateTime.UtcNow.Ticks.ToString());
        return Json(new { ok = true, comentario = ComentarioDto(c, idUsuario.Value) });
    }

    // POST /Publicacion/EliminarComentario (Fetch) → borra un comentario propio
    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult EliminarComentario(int idComentario)
    {
        int? idUsuario = IdUsuarioLogueado();
        if (idUsuario == null)
            return Unauthorized(new { ok = false, mensaje = "Tenés que iniciar sesión." });

        Comentario? c = BD.ObtenerComentario(idComentario);
        if (c == null)
            return NotFound(new { ok = false, mensaje = "El comentario no existe." });

        // Solo el autor del comentario puede eliminarlo
        if (c.IdUsuarioComenta != idUsuario.Value)
            return StatusCode(StatusCodes.Status403Forbidden, new { ok = false, mensaje = "Solo podés eliminar tus propios comentarios." });

        int cantidad = BD.EliminarComentario(idComentario, idUsuario.Value, c.IdPublicacion);
        return Json(new { ok = true, idPublicacion = c.IdPublicacion, cantidad });
    }

    // ---------- Listados ----------

    // GET /Publicacion/ObtenerMas?desde=10 (Fetch) → siguientes publicaciones.
    // Con idAutor trae solo las de ese usuario (grilla del perfil). Con orden=gustadas respeta ese orden.
    [HttpGet]
    public IActionResult ObtenerMas(int desde, int? idAutor = null, int cantidad = CantidadPorPagina, string? orden = null)
    {
        int? idUsuario = IdUsuarioLogueado();
        if (idUsuario == null)
            return Unauthorized(new { ok = false, mensaje = "Tenés que iniciar sesión." });

        if (desde < 0) desde = 0;
        cantidad = Math.Clamp(cantidad, 1, MaximoPorPagina);

        var publicaciones = BD.ObtenerPublicaciones(desde, cantidad + 1, idUsuario.Value, idAutor, OrdenValido(orden));
        bool hayMas = publicaciones.Count > cantidad;

        var resultado = publicaciones.Take(cantidad).Select(p => PublicacionDto(p, idUsuario.Value));
        return Json(new { ok = true, publicaciones = resultado, hayMas });
    }

    // GET /Publicacion/Detalle?id=5 (Fetch) → una publicación completa, para el modal del perfil
    [HttpGet]
    public IActionResult Detalle(int id)
    {
        int? idUsuario = IdUsuarioLogueado();
        if (idUsuario == null)
            return Unauthorized(new { ok = false, mensaje = "Tenés que iniciar sesión." });

        Publicacion? p = BD.ObtenerPublicacion(id, idUsuario.Value);
        if (p == null)
            return NotFound(new { ok = false, mensaje = "La publicación no existe." });

        return Json(new { ok = true, publicacion = PublicacionDto(p, idUsuario.Value) });
    }

    // GET /Publicacion/Buscar?q=pizza (Fetch, mientras se escribe) → usuarios y publicaciones que coinciden
    [HttpGet]
    public IActionResult Buscar(string? q)
    {
        if (IdUsuarioLogueado() == null)
            return Unauthorized(new { ok = false, mensaje = "Tenés que iniciar sesión." });

        q = q?.Trim() ?? "";
        if (q.Length < 2)
            return Json(new { ok = true, usuarios = Array.Empty<object>(), publicaciones = Array.Empty<object>() });
        if (q.Length > 50) q = q[..50];

        var usuarios = BD.BuscarUsuarios(q, 5).Select(u => new
        {
            nombreUsuario = u.NombreUsuario,
            nombreCompleto = (u.Nombre + " " + u.Apellido).Trim(),
            cantidadPublicaciones = u.CantidadPublicaciones
        });
        var publicaciones = BD.BuscarPublicaciones(q, 5).Select(p => new
        {
            id = p.Id,
            titulo = p.Titulo,
            nombreUsuario = p.NombreUsuario,
            imagen = Imagenes.Url(p)
        });
        return Json(new { ok = true, usuarios, publicaciones });
    }

    // ---------- Auxiliares ----------

    private static string? ValidarTextos(string? titulo, string? descripcion)
    {
        if (string.IsNullOrWhiteSpace(titulo) || string.IsNullOrWhiteSpace(descripcion))
            return "El título y la descripción son obligatorios.";
        if (titulo.Trim().Length > MaximoTitulo)
            return $"El título no puede superar los {MaximoTitulo} caracteres.";
        if (descripcion.Trim().Length > MaximoDescripcion)
            return $"La descripción no puede superar los {MaximoDescripcion} caracteres.";
        return null;
    }

    // Valida y guarda la imagen en wwwroot/img/publicaciones con un nombre único
    private async Task<(string? nombre, string? error)> GuardarImagen(IFormFile imagen)
    {
        string extension = Path.GetExtension(imagen.FileName).ToLowerInvariant();
        if (!ExtensionesPermitidas.Contains(extension))
            return (null, "Formato de imagen no permitido (jpg, png, gif o webp).");
        if (imagen.Length > TamanoMaximoImagen)
            return (null, "La imagen no puede pesar más de 5 MB.");

        // Nombre único: Guid (32) + extensión → entra en Publicaciones.Imagen varchar(50)
        string nombreArchivo = Guid.NewGuid().ToString("N") + extension;
        string carpeta = Path.Combine(_env.WebRootPath, "img", "publicaciones");
        Directory.CreateDirectory(carpeta);

        using (var stream = new FileStream(Path.Combine(carpeta, nombreArchivo), FileMode.Create))
        {
            await imagen.CopyToAsync(stream);
        }
        return (nombreArchivo, null);
    }

    private void BorrarArchivoImagen(string? nombre)
    {
        if (string.IsNullOrEmpty(nombre) || !NombreImagenSubida.IsMatch(nombre)) return;

        string ruta = Path.Combine(_env.WebRootPath, "img", "publicaciones", nombre);
        try
        {
            if (System.IO.File.Exists(ruta)) System.IO.File.Delete(ruta);
        }
        catch (IOException)
        {
            // Si el archivo está en uso no pasa nada: la publicación ya se borró de la BD
        }
    }

    private IActionResult NoEncontrada()
    {
        Response.StatusCode = StatusCodes.Status404NotFound;
        return View("NoEncontrado", "La publicación que buscás no existe o no es tuya.");
    }

    private static object PublicacionDto(Publicacion p, int idUsuario) => new
    {
        id = p.Id,
        idUsuario = p.IdUsuario,
        nombreUsuario = p.NombreUsuario,
        titulo = p.Titulo,
        descripcion = p.Descripcion,
        imagen = Imagenes.Url(p),
        fecha = p.FechaPublicacion.ToString("dd/MM/yyyy HH:mm"),
        cantidadMeGusta = p.CantidadMeGusta,
        usuarioDioMeGusta = p.UsuarioDioMeGusta,
        esMia = p.IdUsuario == idUsuario,
        comentarios = p.Comentarios.Select(c => ComentarioDto(c, idUsuario))
    };

    private static object ComentarioDto(Comentario c, int idUsuario) => new
    {
        id = c.Id,
        nombreUsuario = c.NombreUsuario,
        texto = c.Texto,
        fecha = c.FechaComentario.ToString("dd/MM/yyyy HH:mm"),
        esMio = c.IdUsuarioComenta == idUsuario
    };
}

using Microsoft.AspNetCore.Mvc;
using TP07.Models;

namespace TP07.Controllers;

public class PublicacionController : Controller
{
    private const int CantidadPorPagina = 10;
    private const long TamanoMaximoImagen = 5 * 1024 * 1024; // 5 MB
    private static readonly string[] ExtensionesPermitidas = { ".jpg", ".jpeg", ".png", ".gif", ".webp" };

    private readonly IWebHostEnvironment _env;

    public PublicacionController(IWebHostEnvironment env)
    {
        _env = env;
    }

    private int? IdUsuarioLogueado() => HttpContext.Session.GetInt32("IdUsuario");

    // GET /Publicacion → página principal con las 10 publicaciones más recientes
    public IActionResult Index()
    {
        int? idUsuario = IdUsuarioLogueado();
        if (idUsuario == null) return RedirectToAction("Login", "Account");

        // Se pide una de más para saber si existe una página siguiente
        var publicaciones = BD.ObtenerPublicaciones(0, CantidadPorPagina + 1, idUsuario.Value);
        ViewBag.HayMas = publicaciones.Count > CantidadPorPagina;
        ViewBag.CantidadPorPagina = CantidadPorPagina;
        return View(publicaciones.Take(CantidadPorPagina).ToList());
    }

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

        if (string.IsNullOrWhiteSpace(titulo) || string.IsNullOrWhiteSpace(descripcion))
        {
            ViewBag.Error = "El título y la descripción son obligatorios.";
            return View();
        }
        if (titulo.Trim().Length > 200)
        {
            ViewBag.Error = "El título no puede superar los 200 caracteres.";
            return View();
        }
        if (imagen == null || imagen.Length == 0)
        {
            ViewBag.Error = "Tenés que seleccionar una imagen.";
            return View();
        }

        string extension = Path.GetExtension(imagen.FileName).ToLowerInvariant();
        if (!ExtensionesPermitidas.Contains(extension))
        {
            ViewBag.Error = "Formato de imagen no permitido (jpg, png, gif o webp).";
            return View();
        }
        if (imagen.Length > TamanoMaximoImagen)
        {
            ViewBag.Error = "La imagen no puede pesar más de 5 MB.";
            return View();
        }

        // Nombre único: Guid (32) + extensión → entra en Publicaciones.Imagen varchar(50)
        string nombreArchivo = Guid.NewGuid().ToString("N") + extension;
        string carpeta = Path.Combine(_env.WebRootPath, "img", "publicaciones");
        Directory.CreateDirectory(carpeta);

        using (var stream = new FileStream(Path.Combine(carpeta, nombreArchivo), FileMode.Create))
        {
            await imagen.CopyToAsync(stream);
        }

        BD.CrearPublicacion(new Publicacion
        {
            IdUsuario = idUsuario.Value,
            Titulo = titulo.Trim(),
            Descripcion = descripcion.Trim(),
            Imagen = nombreArchivo
        });

        return RedirectToAction("Index");
    }

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
        if (texto.Length > 500)
            return BadRequest(new { ok = false, mensaje = "El comentario no puede superar los 500 caracteres." });

        Comentario c = BD.CrearComentario(idPublicacion, idUsuario.Value, texto);
        return Json(new { ok = true, comentario = ComentarioDto(c) });
    }

    // GET /Publicacion/ObtenerMas?desde=10 (Fetch) → siguientes 10 publicaciones
    [HttpGet]
    public IActionResult ObtenerMas(int desde)
    {
        int? idUsuario = IdUsuarioLogueado();
        if (idUsuario == null)
            return Unauthorized(new { ok = false, mensaje = "Tenés que iniciar sesión." });

        if (desde < 0) desde = 0;

        var publicaciones = BD.ObtenerPublicaciones(desde, CantidadPorPagina + 1, idUsuario.Value);
        bool hayMas = publicaciones.Count > CantidadPorPagina;

        var resultado = publicaciones.Take(CantidadPorPagina).Select(p => new
        {
            id = p.Id,
            nombreUsuario = p.NombreUsuario,
            titulo = p.Titulo,
            descripcion = p.Descripcion,
            imagen = Url.Content("~/img/publicaciones/" + p.Imagen),
            fecha = p.FechaPublicacion.ToString("dd/MM/yyyy HH:mm"),
            cantidadMeGusta = p.CantidadMeGusta,
            usuarioDioMeGusta = p.UsuarioDioMeGusta,
            comentarios = p.Comentarios.Select(ComentarioDto)
        });

        return Json(new { ok = true, publicaciones = resultado, hayMas });
    }

    private static object ComentarioDto(Comentario c) => new
    {
        id = c.Id,
        nombreUsuario = c.NombreUsuario,
        texto = c.Texto,
        fecha = c.FechaComentario.ToString("dd/MM/yyyy HH:mm")
    };
}

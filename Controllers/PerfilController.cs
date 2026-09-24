using Microsoft.AspNetCore.Mvc;
using TP07.Models;

namespace TP07.Controllers;

public class PerfilController : Controller
{
    private const int CantidadPorPagina = 12;

    // GET /Perfil → mi perfil | GET /Perfil/juanperez → perfil de otro usuario
    [HttpGet("Perfil/{nombreUsuario?}")]
    public IActionResult Index(string? nombreUsuario)
    {
        int? idUsuario = HttpContext.Session.GetInt32("IdUsuario");
        if (idUsuario == null) return RedirectToAction("Login", "Account");

        if (string.IsNullOrWhiteSpace(nombreUsuario))
            nombreUsuario = HttpContext.Session.GetString("NombreUsuario") ?? "";

        Perfil? perfil = BD.ObtenerPerfil(nombreUsuario.Trim());
        if (perfil == null)
        {
            // Página 404 propia (con el diseño del sitio) en vez de una respuesta en blanco
            Response.StatusCode = StatusCodes.Status404NotFound;
            return View("NoEncontrado", $"El usuario «{nombreUsuario.Trim()}» no existe.");
        }

        // Se pide una de más para saber si existe una página siguiente
        var publicaciones = BD.ObtenerPublicaciones(0, CantidadPorPagina + 1, idUsuario.Value, perfil.Id);
        ViewBag.HayMas = publicaciones.Count > CantidadPorPagina;
        ViewBag.CantidadPorPagina = CantidadPorPagina;
        ViewBag.Publicaciones = publicaciones.Take(CantidadPorPagina).ToList();
        ViewBag.EsMiPerfil = perfil.Id == idUsuario.Value;
        ViewBag.OtrosUsuarios = BD.ObtenerUsuariosSugeridos(perfil.Id, 5);

        return View(perfil);
    }
}

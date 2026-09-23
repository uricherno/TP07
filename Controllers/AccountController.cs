using Microsoft.AspNetCore.Mvc;
using TP07.Models;

namespace TP07.Controllers;

public class AccountController : Controller
{
    [HttpGet]
    public IActionResult Login()
    {
        if (HttpContext.Session.GetInt32("IdUsuario") != null)
            return RedirectToAction("Index", "Publicacion");
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Login(string nombreUsuario, string contrasena)
    {
        ViewBag.NombreUsuario = nombreUsuario;

        if (string.IsNullOrWhiteSpace(nombreUsuario) || string.IsNullOrWhiteSpace(contrasena))
        {
            ViewBag.Error = "Completá usuario y contraseña.";
            return View();
        }

        Usuario? usuario = BD.ObtenerUsuarioPorNombre(nombreUsuario.Trim());
        string hash = Seguridad.HashPassword(contrasena);

        if (usuario == null)
        {
            ViewBag.Error = "Usuario o contraseña incorrectos.";
            return View();
        }

        if (usuario.Contrasena != hash)
        {
            // Los usuarios cargados en el script tienen la contraseña en texto plano:
            // si coincide, se acepta y se reemplaza por el hash.
            if (usuario.Contrasena == contrasena)
            {
                BD.ActualizarContrasena(usuario.Id, hash);
            }
            else
            {
                ViewBag.Error = "Usuario o contraseña incorrectos.";
                return View();
            }
        }

        IniciarSesion(usuario.Id, usuario.NombreUsuario);
        return RedirectToAction("Index", "Publicacion");
    }

    [HttpGet]
    public IActionResult Registro()
    {
        return View();
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public IActionResult Registro(string nombre, string apellido, string nombreUsuario, string contrasena, string confirmarContrasena)
    {
        ViewBag.Nombre = nombre;
        ViewBag.Apellido = apellido;
        ViewBag.NombreUsuario = nombreUsuario;

        if (string.IsNullOrWhiteSpace(nombre) || string.IsNullOrWhiteSpace(apellido) ||
            string.IsNullOrWhiteSpace(nombreUsuario) || string.IsNullOrWhiteSpace(contrasena))
        {
            ViewBag.Error = "Todos los campos son obligatorios.";
            return View();
        }
        if (nombreUsuario.Trim().Length > 50 || nombre.Trim().Length > 50 || apellido.Trim().Length > 50)
        {
            ViewBag.Error = "Los campos no pueden superar los 50 caracteres.";
            return View();
        }
        if (contrasena.Length < 4)
        {
            ViewBag.Error = "La contraseña debe tener al menos 4 caracteres.";
            return View();
        }
        if (contrasena != confirmarContrasena)
        {
            ViewBag.Error = "Las contraseñas no coinciden.";
            return View();
        }
        if (BD.ObtenerUsuarioPorNombre(nombreUsuario.Trim()) != null)
        {
            ViewBag.Error = "Ese nombre de usuario ya está en uso.";
            return View();
        }

        var usuario = new Usuario
        {
            NombreUsuario = nombreUsuario.Trim(),
            Contrasena = Seguridad.HashPassword(contrasena),
            Nombre = nombre.Trim(),
            Apellido = apellido.Trim()
        };
        usuario.Id = BD.RegistrarUsuario(usuario);

        IniciarSesion(usuario.Id, usuario.NombreUsuario);
        return RedirectToAction("Index", "Publicacion");
    }

    public IActionResult Logout()
    {
        HttpContext.Session.Clear();
        return RedirectToAction("Login");
    }

    private void IniciarSesion(int idUsuario, string nombreUsuario)
    {
        HttpContext.Session.SetInt32("IdUsuario", idUsuario);
        HttpContext.Session.SetString("NombreUsuario", nombreUsuario);
    }
}

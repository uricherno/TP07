using System.Security.Cryptography;
using System.Text;

namespace TP07.Models;

public static class Seguridad
{
    // SHA256 en Base64 = 44 caracteres (entra en Usuarios.Contraseña varchar(50))
    public static string HashPassword(string password)
    {
        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        return Convert.ToBase64String(hash);
    }
}

namespace TP07.Models;

public class Perfil
{
    public int Id { get; set; }
    public string NombreUsuario { get; set; } = "";
    public string Nombre { get; set; } = "";
    public string Apellido { get; set; } = "";
    public int CantidadPublicaciones { get; set; }
    public int CantidadMeGustaRecibidos { get; set; }
    public int CantidadComentariosRecibidos { get; set; }
}

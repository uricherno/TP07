namespace TP07.Models;

public class Comentario
{
    public int Id { get; set; }
    public int IdPublicacion { get; set; }
    public int IdUsuarioComenta { get; set; }
    public string NombreUsuario { get; set; } = "";
    public string Texto { get; set; } = "";
    public DateTime FechaComentario { get; set; }
}

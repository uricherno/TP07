namespace TP07.Models;

// Resuelve la URL de la imagen de una publicación.
// Si el archivo no existe en wwwroot/img/publicaciones, usa una ilustración de wwwroot/img/predeterminadas.
public static class Imagenes
{
    public static string WebRootPath { get; set; } = "";

    private const int CantidadGenericas = 4;

    public static readonly string[] ExtensionesVideo = { ".mp4", ".webm", ".mov" };

    // Según la extensión de la URL ya resuelta (si el video no existe, Url devuelve una ilustración .svg)
    public static bool EsVideo(string url) =>
        ExtensionesVideo.Contains(Path.GetExtension(url).ToLowerInvariant());

    public static string Url(Publicacion p)
    {
        if (!string.IsNullOrWhiteSpace(p.Imagen) &&
            File.Exists(Path.Combine(WebRootPath, "img", "publicaciones", p.Imagen)))
            return "/img/publicaciones/" + p.Imagen;

        // Ilustración con el mismo nombre (bariloche.jpg → bariloche.svg)
        string nombre = Path.GetFileNameWithoutExtension(p.Imagen ?? "");
        if (nombre != "" && File.Exists(Path.Combine(WebRootPath, "img", "predeterminadas", nombre + ".svg")))
            return "/img/predeterminadas/" + nombre + ".svg";

        // Si no hay una específica, una genérica elegida según el Id (siempre la misma para cada publicación)
        return "/img/predeterminadas/generica-" + (Math.Abs(p.Id) % CantidadGenericas + 1) + ".svg";
    }
}

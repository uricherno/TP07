using Dapper;
using Microsoft.Data.SqlClient;

namespace TP07.Models;

public static class BD
{
    public static string ConnectionString { get; set; } = "";

    // ---------- Usuarios ----------

    public static Usuario? ObtenerUsuarioPorNombre(string nombreUsuario)
    {
        using var conn = new SqlConnection(ConnectionString);
        const string sql = @"SELECT Id, NombreUsuario, [Contraseña] AS Contrasena, Nombre, Apellido
                             FROM Usuarios WHERE NombreUsuario = @nombreUsuario";
        return conn.QueryFirstOrDefault<Usuario>(sql, new { nombreUsuario });
    }

    public static int RegistrarUsuario(Usuario u)
    {
        using var conn = new SqlConnection(ConnectionString);
        const string sql = @"INSERT INTO Usuarios (NombreUsuario, [Contraseña], Nombre, Apellido)
                             OUTPUT INSERTED.Id
                             VALUES (@NombreUsuario, @Contrasena, @Nombre, @Apellido)";
        return conn.ExecuteScalar<int>(sql, u);
    }

    public static void ActualizarContrasena(int idUsuario, string contrasena)
    {
        using var conn = new SqlConnection(ConnectionString);
        conn.Execute("UPDATE Usuarios SET [Contraseña] = @contrasena WHERE Id = @idUsuario",
            new { idUsuario, contrasena });
    }

    // ---------- Publicaciones ----------

    public static void CrearPublicacion(Publicacion p)
    {
        using var conn = new SqlConnection(ConnectionString);
        const string sql = @"INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
                             VALUES (@IdUsuario, @Titulo, @Descripcion, @Imagen, GETDATE())";
        conn.Execute(sql, p);
    }

    public static bool ExistePublicacion(int idPublicacion)
    {
        using var conn = new SqlConnection(ConnectionString);
        return conn.ExecuteScalar<bool>(
            "SELECT CAST(CASE WHEN EXISTS(SELECT 1 FROM Publicaciones WHERE Id = @idPublicacion) THEN 1 ELSE 0 END AS bit)",
            new { idPublicacion });
    }

    // Trae "cantidad" publicaciones salteando las primeras "desde", de la más reciente a la más antigua.
    public static List<Publicacion> ObtenerPublicaciones(int desde, int cantidad, int idUsuario)
    {
        using var conn = new SqlConnection(ConnectionString);
        const string sql = @"
            SELECT p.Id, p.IdUsuario, u.NombreUsuario,
                   ISNULL(p.Titulo, '') AS Titulo,
                   ISNULL(CAST(p.Descripcion AS varchar(max)), '') AS Descripcion,
                   ISNULL(p.Imagen, '') AS Imagen,
                   ISNULL(p.FechaPublicacion, GETDATE()) AS FechaPublicacion,
                   (SELECT COUNT(*) FROM PublicacionesMeGusta m WHERE m.[IdPublicación] = p.Id) AS CantidadMeGusta,
                   CAST(CASE WHEN EXISTS(SELECT 1 FROM PublicacionesMeGusta m
                                         WHERE m.[IdPublicación] = p.Id AND m.IdUsuario = @idUsuario)
                        THEN 1 ELSE 0 END AS bit) AS UsuarioDioMeGusta
            FROM Publicaciones p
            INNER JOIN Usuarios u ON u.Id = p.IdUsuario
            ORDER BY p.FechaPublicacion DESC, p.Id DESC
            OFFSET @desde ROWS FETCH NEXT @cantidad ROWS ONLY";

        var publicaciones = conn.Query<Publicacion>(sql, new { desde, cantidad, idUsuario }).ToList();
        if (publicaciones.Count == 0) return publicaciones;

        // Una sola consulta para los comentarios de todas las publicaciones de la página
        var comentarios = ObtenerComentarios(conn, publicaciones.Select(p => p.Id).ToList());
        foreach (var p in publicaciones)
            p.Comentarios = comentarios.Where(c => c.IdPublicacion == p.Id).ToList();

        return publicaciones;
    }

    // ---------- Me Gusta ----------

    // Si el usuario ya había dado Me Gusta lo quita; si no, lo agrega.
    public static (bool meGusta, int cantidad) ToggleMeGusta(int idUsuario, int idPublicacion)
    {
        using var conn = new SqlConnection(ConnectionString);
        var parametros = new { idUsuario, idPublicacion };

        bool yaDioMeGusta = conn.ExecuteScalar<bool>(@"
            SELECT CAST(CASE WHEN EXISTS(SELECT 1 FROM PublicacionesMeGusta
                                         WHERE [IdPublicación] = @idPublicacion AND IdUsuario = @idUsuario)
                   THEN 1 ELSE 0 END AS bit)", parametros);

        if (yaDioMeGusta)
            conn.Execute("DELETE FROM PublicacionesMeGusta WHERE [IdPublicación] = @idPublicacion AND IdUsuario = @idUsuario", parametros);
        else
            conn.Execute("INSERT INTO PublicacionesMeGusta ([IdPublicación], IdUsuario) VALUES (@idPublicacion, @idUsuario)", parametros);

        int cantidad = conn.ExecuteScalar<int>(
            "SELECT COUNT(*) FROM PublicacionesMeGusta WHERE [IdPublicación] = @idPublicacion", parametros);

        return (!yaDioMeGusta, cantidad);
    }

    // ---------- Comentarios ----------

    public static Comentario CrearComentario(int idPublicacion, int idUsuario, string texto)
    {
        using var conn = new SqlConnection(ConnectionString);
        const string sql = @"
            INSERT INTO Comentarios (IdPublicacion, IdUsuarioComenta, Texto, FechaComentario)
            OUTPUT INSERTED.Id
            VALUES (@idPublicacion, @idUsuario, @texto, GETDATE())";
        int id = conn.ExecuteScalar<int>(sql, new { idPublicacion, idUsuario, texto });

        return conn.QueryFirst<Comentario>(@"
            SELECT c.Id, c.IdPublicacion, c.IdUsuarioComenta, u.NombreUsuario,
                   CAST(c.Texto AS varchar(max)) AS Texto, c.FechaComentario
            FROM Comentarios c INNER JOIN Usuarios u ON u.Id = c.IdUsuarioComenta
            WHERE c.Id = @id", new { id });
    }

    private static List<Comentario> ObtenerComentarios(SqlConnection conn, List<int> idsPublicaciones)
    {
        const string sql = @"
            SELECT c.Id, c.IdPublicacion, c.IdUsuarioComenta, u.NombreUsuario,
                   CAST(c.Texto AS varchar(max)) AS Texto, c.FechaComentario
            FROM Comentarios c INNER JOIN Usuarios u ON u.Id = c.IdUsuarioComenta
            WHERE c.IdPublicacion IN @idsPublicaciones
            ORDER BY c.FechaComentario ASC, c.Id ASC";
        return conn.Query<Comentario>(sql, new { idsPublicaciones }).ToList();
    }
}

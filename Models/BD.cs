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

    // ---------- Perfiles ----------

    private const string SelectPerfil = @"
        SELECT u.Id, u.NombreUsuario, ISNULL(u.Nombre, '') AS Nombre, ISNULL(u.Apellido, '') AS Apellido,
               (SELECT COUNT(*) FROM Publicaciones p WHERE p.IdUsuario = u.Id) AS CantidadPublicaciones,
               (SELECT COUNT(*) FROM PublicacionesMeGusta m
                INNER JOIN Publicaciones p ON p.Id = m.[IdPublicación]
                WHERE p.IdUsuario = u.Id) AS CantidadMeGustaRecibidos,
               (SELECT COUNT(*) FROM Comentarios c
                INNER JOIN Publicaciones p ON p.Id = c.IdPublicacion
                WHERE p.IdUsuario = u.Id) AS CantidadComentariosRecibidos
        FROM Usuarios u";

    public static Perfil? ObtenerPerfil(string nombreUsuario)
    {
        using var conn = new SqlConnection(ConnectionString);
        return conn.QueryFirstOrDefault<Perfil>(SelectPerfil + " WHERE u.NombreUsuario = @nombreUsuario", new { nombreUsuario });
    }

    // Otros usuarios para la barra lateral del inicio (los que más publicaron primero)
    public static List<Perfil> ObtenerUsuariosSugeridos(int idExcluir, int cantidad)
    {
        using var conn = new SqlConnection(ConnectionString);
        string sql = "SELECT TOP (@cantidad) * FROM (" + SelectPerfil + " WHERE u.Id <> @idExcluir) x " +
                     "ORDER BY x.CantidadPublicaciones DESC, x.NombreUsuario";
        return conn.Query<Perfil>(sql, new { idExcluir, cantidad }).ToList();
    }

    // ---------- Buscador ----------

    // Escapa los comodines de LIKE (%, _ y [) para que se busquen como texto literal
    private static string PatronLike(string texto) =>
        "%" + texto.Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]") + "%";

    public static List<Perfil> BuscarUsuarios(string texto, int cantidad)
    {
        using var conn = new SqlConnection(ConnectionString);
        string sql = "SELECT TOP (@cantidad) * FROM (" + SelectPerfil + @"
                      WHERE u.NombreUsuario LIKE @patron OR u.Nombre LIKE @patron OR u.Apellido LIKE @patron) x
                      ORDER BY x.NombreUsuario";
        return conn.Query<Perfil>(sql, new { cantidad, patron = PatronLike(texto) }).ToList();
    }

    public static List<Publicacion> BuscarPublicaciones(string texto, int cantidad)
    {
        using var conn = new SqlConnection(ConnectionString);
        const string sql = @"
            SELECT TOP (@cantidad) p.Id, p.IdUsuario, u.NombreUsuario,
                   ISNULL(p.Titulo, '') AS Titulo, ISNULL(p.Imagen, '') AS Imagen,
                   ISNULL(p.FechaPublicacion, GETDATE()) AS FechaPublicacion
            FROM Publicaciones p
            INNER JOIN Usuarios u ON u.Id = p.IdUsuario
            WHERE p.Titulo LIKE @patron
            ORDER BY p.FechaPublicacion DESC";
        return conn.Query<Publicacion>(sql, new { cantidad, patron = PatronLike(texto) }).ToList();
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

    // Trae "cantidad" publicaciones salteando las primeras "desde".
    // Orden "recientes" (por defecto): de la más nueva a la más vieja. Orden "gustadas": las de más Me Gusta primero.
    // Si viene "idAutor", solo trae las publicaciones de ese usuario (para el perfil).
    public static List<Publicacion> ObtenerPublicaciones(int desde, int cantidad, int idUsuario, int? idAutor = null, string orden = "recientes")
    {
        return ConsultarPublicaciones(desde, cantidad, idUsuario, idAutor, null, orden);
    }

    public static Publicacion? ObtenerPublicacion(int idPublicacion, int idUsuario)
    {
        return ConsultarPublicaciones(0, 1, idUsuario, null, idPublicacion, "recientes").FirstOrDefault();
    }

    private static List<Publicacion> ConsultarPublicaciones(int desde, int cantidad, int idUsuario, int? idAutor, int? idPublicacion, string orden)
    {
        using var conn = new SqlConnection(ConnectionString);

        // El ORDER BY no se puede pasar como parámetro: se elige entre dos textos fijos (nunca se arma con lo que manda el usuario)
        string orderBy = orden == "gustadas"
            ? "ORDER BY CantidadMeGusta DESC, p.FechaPublicacion DESC, p.Id DESC"
            : "ORDER BY p.FechaPublicacion DESC, p.Id DESC";

        string sql = @"
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
            WHERE (@idAutor IS NULL OR p.IdUsuario = @idAutor)
              AND (@idPublicacion IS NULL OR p.Id = @idPublicacion)
            " + orderBy + @"
            OFFSET @desde ROWS FETCH NEXT @cantidad ROWS ONLY";

        var publicaciones = conn.Query<Publicacion>(sql, new { desde, cantidad, idUsuario, idAutor, idPublicacion }).ToList();
        if (publicaciones.Count == 0) return publicaciones;

        // Una sola consulta para los comentarios de todas las publicaciones de la página
        var comentarios = ObtenerComentarios(conn, publicaciones.Select(p => p.Id).ToList());
        foreach (var p in publicaciones)
            p.Comentarios = comentarios.Where(c => c.IdPublicacion == p.Id).ToList();

        return publicaciones;
    }

    // Solo actualiza si la publicación es del usuario indicado. Si "imagen" es null, deja la imagen actual.
    public static bool ActualizarPublicacion(int idPublicacion, int idUsuario, string titulo, string descripcion, string? imagen)
    {
        using var conn = new SqlConnection(ConnectionString);
        const string sql = @"
            UPDATE Publicaciones
            SET Titulo = @titulo, Descripcion = @descripcion, Imagen = ISNULL(@imagen, Imagen)
            WHERE Id = @idPublicacion AND IdUsuario = @idUsuario";
        return conn.Execute(sql, new { idPublicacion, idUsuario, titulo, descripcion, imagen }) > 0;
    }

    // Borra la publicación (solo si es del usuario) junto con sus comentarios y Me Gusta, en una transacción.
    // Las claves foráneas no tienen ON DELETE CASCADE, por eso se borran primero las filas relacionadas.
    // Devuelve el nombre de la imagen que tenía (para borrar el archivo) o null si no se borró nada.
    public static string? EliminarPublicacion(int idPublicacion, int idUsuario)
    {
        using var conn = new SqlConnection(ConnectionString);
        conn.Open();
        using var tx = conn.BeginTransaction();
        var parametros = new { idPublicacion, idUsuario };

        string? imagen = conn.QueryFirstOrDefault<string>(
            "SELECT ISNULL(Imagen, '') FROM Publicaciones WHERE Id = @idPublicacion AND IdUsuario = @idUsuario",
            parametros, tx);
        if (imagen == null)
        {
            tx.Rollback();
            return null;
        }

        conn.Execute("DELETE FROM Comentarios WHERE IdPublicacion = @idPublicacion", parametros, tx);
        conn.Execute("DELETE FROM PublicacionesMeGusta WHERE [IdPublicación] = @idPublicacion", parametros, tx);
        conn.Execute("DELETE FROM Publicaciones WHERE Id = @idPublicacion AND IdUsuario = @idUsuario", parametros, tx);
        tx.Commit();
        return imagen;
    }

    // ---------- Me Gusta ----------

    // Usuarios que dieron Me Gusta a una publicación (los más recientes primero)
    public static List<Usuario> ObtenerUsuariosQueDieronMeGusta(int idPublicacion)
    {
        using var conn = new SqlConnection(ConnectionString);
        const string sql = @"
            SELECT u.Id, u.NombreUsuario, ISNULL(u.Nombre, '') AS Nombre, ISNULL(u.Apellido, '') AS Apellido
            FROM PublicacionesMeGusta m
            INNER JOIN Usuarios u ON u.Id = m.IdUsuario
            WHERE m.[IdPublicación] = @idPublicacion
            ORDER BY m.Id DESC";
        return conn.Query<Usuario>(sql, new { idPublicacion }).ToList();
    }

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
            // El NOT EXISTS evita un Me Gusta duplicado si llegan dos pedidos al mismo tiempo
            conn.Execute(@"INSERT INTO PublicacionesMeGusta ([IdPublicación], IdUsuario)
                           SELECT @idPublicacion, @idUsuario
                           WHERE NOT EXISTS(SELECT 1 FROM PublicacionesMeGusta
                                            WHERE [IdPublicación] = @idPublicacion AND IdUsuario = @idUsuario)", parametros);

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

    public static Comentario? ObtenerComentario(int idComentario)
    {
        using var conn = new SqlConnection(ConnectionString);
        return conn.QueryFirstOrDefault<Comentario>(@"
            SELECT c.Id, c.IdPublicacion, c.IdUsuarioComenta, u.NombreUsuario,
                   CAST(c.Texto AS varchar(max)) AS Texto, c.FechaComentario
            FROM Comentarios c INNER JOIN Usuarios u ON u.Id = c.IdUsuarioComenta
            WHERE c.Id = @idComentario", new { idComentario });
    }

    // Borra el comentario solo si es del usuario indicado. Devuelve cuántos comentarios le quedan a la publicación.
    public static int EliminarComentario(int idComentario, int idUsuario, int idPublicacion)
    {
        using var conn = new SqlConnection(ConnectionString);
        conn.Execute("DELETE FROM Comentarios WHERE Id = @idComentario AND IdUsuarioComenta = @idUsuario",
            new { idComentario, idUsuario });
        return conn.ExecuteScalar<int>("SELECT COUNT(*) FROM Comentarios WHERE IdPublicacion = @idPublicacion",
            new { idPublicacion });
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

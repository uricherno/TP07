-- ============================================================
-- Publicaciones de ejemplo extra (TP07)
-- Agrega 18 publicaciones para que la página principal tenga
-- más de 10 y se pueda probar el botón "Ver más".
-- NO modifica Script.sql: ejecutar DESPUÉS de Script.sql.
-- Se puede ejecutar más de una vez: no duplica publicaciones.
-- Las imágenes están en wwwroot/img/publicaciones/ejemplo-XX.svg
-- ============================================================
USE [DBRedSocial]
GO

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-01.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (2, N'Mañana de café', N'Arrancando el día con un café y un buen libro.', 'ejemplo-01.svg', '2026-08-02T09:10:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-02.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (3, N'Día de playa', N'No hay nada mejor que el sonido del mar.', 'ejemplo-02.svg', '2026-08-05T17:45:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-03.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (4, N'Noche de pelis', N'Maratón de películas con amigos. ¿Recomendaciones?', 'ejemplo-03.svg', '2026-08-08T20:30:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-04.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (5, N'Salida en bici', N'30 km antes del desayuno. Las piernas no opinan lo mismo.', 'ejemplo-04.svg', '2026-08-11T08:00:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-05.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (1, N'Asado del domingo', N'Nada como un asado en familia.', 'ejemplo-05.svg', '2026-08-14T13:20:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-06.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (2, N'Mi nueva planta', N'Se llama Rita y ya es parte de la familia.', 'ejemplo-06.svg', '2026-08-17T19:05:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-07.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (3, N'Primer día de clases', N'Nuevo cuatrimestre, nuevas materias. ¡Vamos!', 'ejemplo-07.svg', '2026-08-20T11:40:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-08.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (4, N'Luna llena', N'La luna estaba increíble esta noche.', 'ejemplo-08.svg', '2026-08-23T22:15:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-09.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (5, N'Tarde de gaming', N'Por fin pasé ese nivel que me tenía loco.', 'ejemplo-09.svg', '2026-08-26T16:50:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-10.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (1, N'Paseo con el perro', N'Toby disfrutando del sol en la plaza.', 'ejemplo-10.svg', '2026-08-29T10:25:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-11.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (2, N'Receta de brownies', N'Salieron perfectos. Si quieren la receta, avisen.', 'ejemplo-11.svg', '2026-09-02T18:35:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-12.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (3, N'Vista desde la montaña', N'Valió la pena la subida.', 'ejemplo-12.svg', '2026-09-04T09:55:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-13.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (4, N'Guitarra nueva', N'Empezando a practicar mis primeros acordes.', 'ejemplo-13.svg', '2026-09-07T21:40:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-14.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (5, N'Partido de tenis', N'Ganamos en tres sets. ¡Qué partido!', 'ejemplo-14.svg', '2026-09-10T15:15:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-15.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (1, N'Feria de libros', N'Me traje cuatro libros nuevos. Problema: no tengo más lugar.', 'ejemplo-15.svg', '2026-09-13T12:05:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-16.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (2, N'Atardecer en el río', N'El cielo se puso de todos los colores.', 'ejemplo-16.svg', '2026-09-17T19:50:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-17.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (3, N'Pizza casera, parte 2', N'Segundo intento: ahora con masa madre.', 'ejemplo-17.svg', '2026-09-21T13:30:00');

IF NOT EXISTS (SELECT 1 FROM Publicaciones WHERE Imagen = 'ejemplo-18.svg')
    INSERT INTO Publicaciones (IdUsuario, Titulo, Descripcion, Imagen, FechaPublicacion)
    VALUES (4, N'Nuevo día, nuevos objetivos', N'Arrancando la semana con todas las pilas.', 'ejemplo-18.svg', '2026-09-22T10:00:00');

-- Algunos Me Gusta y comentarios en las publicaciones nuevas
DECLARE @p1 int = (SELECT Id FROM Publicaciones WHERE Imagen = 'ejemplo-18.svg');
DECLARE @p2 int = (SELECT Id FROM Publicaciones WHERE Imagen = 'ejemplo-17.svg');
DECLARE @p3 int = (SELECT Id FROM Publicaciones WHERE Imagen = 'ejemplo-16.svg');

IF NOT EXISTS (SELECT 1 FROM PublicacionesMeGusta WHERE [IdPublicación] = @p1)
BEGIN
    INSERT INTO PublicacionesMeGusta ([IdPublicación], IdUsuario) VALUES (@p1, 2), (@p1, 3), (@p1, 5);
    INSERT INTO PublicacionesMeGusta ([IdPublicación], IdUsuario) VALUES (@p2, 1), (@p2, 4);
    INSERT INTO PublicacionesMeGusta ([IdPublicación], IdUsuario) VALUES (@p3, 1), (@p3, 3), (@p3, 4), (@p3, 5);
END

IF NOT EXISTS (SELECT 1 FROM Comentarios WHERE IdPublicacion = @p1)
BEGIN
    INSERT INTO Comentarios (IdPublicacion, IdUsuarioComenta, Texto, FechaComentario) VALUES
        (@p1, 1, N'¡Con todo esta semana!', '2026-09-22T10:30:00'),
        (@p2, 5, N'Se ve mucho mejor que la primera.', '2026-09-21T14:10:00'),
        (@p2, 2, N'¡Pasame la receta de la masa madre!', '2026-09-21T15:00:00'),
        (@p3, 4, N'Qué colores increíbles.', '2026-09-17T20:15:00');
END
GO

-- Comprobación: debería dar 25 si se ejecutó sobre Script.sql
SELECT COUNT(*) AS TotalPublicaciones FROM Publicaciones;

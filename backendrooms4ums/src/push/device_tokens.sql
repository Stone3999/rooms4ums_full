-- ============================================================================
--  Tabla de tokens FCM (Firebase Cloud Messaging)
-- ----------------------------------------------------------------------------
--  Un registro por dispositivo registrado. El token lo genera Firebase en el
--  cliente y Flutter lo envia a POST /api/push/register al iniciar sesion.
--
--  Cuando se crea un post, el backend envia el push a TODOS los tokens de la
--  tabla, por lo que la notificacion llega sin importar desde que cliente se
--  publico: web Angular, app Flutter o cualquier otro futuro.
-- ============================================================================

CREATE TABLE IF NOT EXISTS device_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL,
    token      TEXT NOT NULL UNIQUE,
    platform   TEXT NOT NULL DEFAULT 'android',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Consulta principal del push: todos los tokens (opcionalmente excluyendo al autor).
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens (user_id);

COMMENT ON TABLE device_tokens IS 'Tokens FCM por dispositivo para push remoto';

-- ----------------------------------------------------------------------------
--  Si ya existe la tabla de users (Supabase), se agrega la FK.
--  Descomentar si la tabla users existe con esa estructura:
--
--  ALTER TABLE device_tokens
--    ADD CONSTRAINT fk_device_tokens_user
--    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- ----------------------------------------------------------------------------
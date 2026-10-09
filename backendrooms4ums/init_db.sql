-- Actualizar la tabla de forums con los nuevos campos
ALTER TABLE forums 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'pixelart-icons-font-door',
ADD COLUMN IF NOT EXISTS is_interactive BOOLEAN DEFAULT false;

-- Insertar datos iniciales de Rooms (Puertas)
INSERT INTO forums (name, slug, description, icon, status, is_interactive) 
VALUES 
('General', 'general', 'Sala de discusión para todos.', 'pixelart-icons-font-message', 'ACTIVE', false),
('Gaming Zone', 'gaming', 'Torneos y retos en tiempo real.', 'pixelart-icons-font-gamepad', 'ACTIVE', true),
('Laboratorio', 'lab', 'Sala en desarrollo.', 'pixelart-icons-font-flask', 'CONSTRUCTION', false),
('Mantenimiento', 'servidor', 'Estamos limpiando los cables.', 'pixelart-icons-font-gear', 'MAINTENANCE', false)
ON CONFLICT (slug) DO UPDATE SET
    status = EXCLUDED.status,
    icon = EXCLUDED.icon,
    is_interactive = EXCLUDED.is_interactive;

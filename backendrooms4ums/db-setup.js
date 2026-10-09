const postgres = require('postgres');

const sql = postgres('postgresql://postgres.fttqqmjtlzvmhtvubbmp:F2se8J9b3999@aws-0-us-west-2.pooler.supabase.com:5432/postgres', {
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    console.log('Altering users table...');
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
    `;
    
    console.log('Creating roles table...');
    await sql`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT
      );
    `;

    console.log('Creating permissions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT
      );
    `;

    console.log('Creating role_permissions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INT REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );
    `;
    
    console.log('Adding role_id to users...');
    await sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INT REFERENCES roles(id);
    `;

    console.log('Creating audit_logs table...');
    await sql`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(255) NOT NULL,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        details JSONB
      );
    `;
    
    console.log('Inserting default roles...');
    await sql`
      INSERT INTO roles (name, description)
      VALUES 
        ('ADMIN', 'Administrador del sistema'),
        ('USER', 'Usuario normal')
      ON CONFLICT (name) DO NOTHING;
    `;

    console.log('Success!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

main();

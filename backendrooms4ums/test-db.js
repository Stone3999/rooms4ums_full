const { Client } = require('pg');
require('dotenv').config();

// Extraemos la URL del .env
const connectionString = process.env.DATABASE_URL;

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  console.log('--- Diagnóstico de Conexión ---');
  console.log('Intentando conectar a:', connectionString.split('@')[1]); // Solo mostramos el host por seguridad
  
  try {
    await client.connect();
    console.log('✅ ¡CONEXIÓN EXITOSA! Tu computadora SÍ llega a la base de datos.');
    const res = await client.query('SELECT NOW()');
    console.log('Servidor responde hora:', res.rows[0].now);
    await client.end();
  } catch (err) {
    console.error('❌ ERROR DE CONEXIÓN:', err.message);
    if (err.message.includes('tenant or user not found')) {
      console.log('👉 Tip: El usuario o el ID del proyecto en la URL están mal.');
    } else if (err.message.includes('authentication failed')) {
      console.log('👉 Tip: La contraseña es incorrecta.');
    } else if (err.message.includes('ETIMEDOUT')) {
      console.log('👉 Tip: Tu internet o un firewall están bloqueando el puerto 6543.');
    }
  }
}

test();

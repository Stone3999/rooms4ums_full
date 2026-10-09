const Redis = require('ioredis');
require('dotenv').config();

async function testRedis() {
  console.log('Host:', process.env.REDIS_HOST);
  console.log('Port:', process.env.REDIS_PORT);
  
  const client = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
    tls: {},
  });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err.message);
  });

  try {
    await client.set('test', 'Hello Upstash');
    const val = await client.get('test');
    console.log('Redis response:', val);
  } catch (err) {
    console.error('Error during Redis operation:', err.message);
  } finally {
    client.quit();
  }
}

testRedis();

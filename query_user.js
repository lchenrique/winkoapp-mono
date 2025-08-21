const postgres = require('postgres');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/whatsapp_chat';
const client = postgres(connectionString);

async function findUser() {
  try {
    const result = await client`
      SELECT id, name, email, "userStatus", "createdAt" 
      FROM users 
      WHERE email = 'lc.henriquee@gmail.com'
    `;
    
    console.log('Resultado da consulta:');
    if (result.length > 0) {
      console.log(JSON.stringify(result[0], null, 2));
    } else {
      console.log('Nenhum usuário encontrado com este email.');
    }
  } catch (error) {
    console.error('Erro na consulta:', error.message);
  } finally {
    await client.end();
  }
}

findUser();

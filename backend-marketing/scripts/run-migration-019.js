#!/usr/bin/env node
/**
 * Exécute la migration 019_channel_scoring_config.sql
 * Usage: node scripts/run-migration-019.js
 * Nécessite DATABASE_URL dans .env
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const sqlPath = path.join(__dirname, '../prisma/migrations/019_channel_scoring_config.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// Enlever les commentaires et diviser par ";" (en évitant les ; dans les strings)
const statements = sql
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

async function run() {
  console.log('Exécution de la migration 019 (channel_scoring_config)...');
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const s = statement + ';';
    if (s.length < 3) continue;
    try {
      await prisma.$executeRawUnsafe(s);
      console.log('OK:', s.substring(0, 60).replace(/\n/g, ' ') + '...');
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        console.log('Déjà appliqué (ignoré):', s.substring(0, 50).replace(/\n/g, ' ') + '...');
      } else if (err.meta?.code === '42P01' && s.includes('REFERENCES')) {
        console.warn('ATTENTION: La table Account n\'existe pas dans cette base (ou nom différent). Contrainte FK non ajoutée. Table channel_scoring_config créée.');
      } else {
        throw err;
      }
    }
  }
  console.log('Migration 019 terminée.');
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

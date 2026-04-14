-- Script d'initialisation de la base de données
-- Ce script est exécuté automatiquement lors du premier démarrage du conteneur PostgreSQL

-- Créer la base de données si elle n'existe pas
SELECT 'CREATE DATABASE feedplug'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'feedplug')\gexec

-- Créer l'utilisateur si il n'existe pas
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'feedplug') THEN

      CREATE ROLE feedplug LOGIN PASSWORD 'feedplug123';
   END IF;
END
$do$;

-- Accorder les privilèges
GRANT ALL PRIVILEGES ON DATABASE feedplug TO feedplug;

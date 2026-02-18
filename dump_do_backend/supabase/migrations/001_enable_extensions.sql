-- ============================================
-- Dump.do v0.1 - Migration 001
-- Enable Required Extensions
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector for future vector store (v0.2)
-- This prepares the database for semantic search/memory
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pg_trgm for text similarity search (fallback)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Comments for documentation
COMMENT ON EXTENSION vector IS 'Vector similarity search - prepared for Dump.do v0.2 long-term memory';

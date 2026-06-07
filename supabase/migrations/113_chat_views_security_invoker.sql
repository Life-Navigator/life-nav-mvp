-- 113_chat_views_security_invoker.sql
--
-- SECURITY FIX for migration 111.
--
-- Migration 111 created public.chat_conversations and public.chat_messages as
-- ordinary views (no security_invoker). A non-security_invoker view executes
-- its underlying table reads with the privileges of the VIEW OWNER (postgres,
-- a BYPASSRLS superuser), so the row-level security on chat.conversations /
-- chat.messages was bypassed when the client read through the views.
--
-- Live proof (caught by the RLS smoke test, 2026-06-06):
--   a NON-OWNER authenticated identity selecting from public.chat_conversations
--   returned the owner's row (count = 1) instead of 0. Direct table access
--   correctly returned 0 — only the view leaked.
--
-- Fix: mark both views security_invoker = true so underlying RLS is evaluated
-- as the querying role (authenticated), applying the owner-only policy.
-- Requires PostgreSQL 15+ (Supabase prod is 15+).
--
-- Idempotent: ALTER VIEW ... SET is safe to re-run.

ALTER VIEW public.chat_conversations SET (security_invoker = true);
ALTER VIEW public.chat_messages      SET (security_invoker = true);

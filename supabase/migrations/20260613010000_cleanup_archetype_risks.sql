-- Trust cleanup: remove archetype-derived RISKS and OPPORTUNITIES that objectives auto-created
-- (objective → archetype → risk). The life.risks and life.opportunities tables were ONLY ever populated
-- by the now-removed ROOT_OBJECTIVES decomposition in life_discovery.discover_goal — none of it is
-- grounded in the user's real data ("Outliving your assets", "Sequence-of-returns risk", "Full employer
-- 401(k) match", …). Risks/opportunities now come only from evidence (Recommendation OS, real domain
-- data, the user's own statements).
--
-- NOT removed: life.dependencies (honest open requirements/unknowns used by the decision-brain
-- missing-information view + document-upload roadmap; gated out of the dashboard "priorities" in code),
-- and life.constraints (derived from the user's own statements). Safe to re-run (plain deletes).

delete from life.risks;
delete from life.opportunities;

-- Remove the archetype graph edges these created (objective→risk / objective→opportunity). The
-- advances / requires / supports / part_of / conflicts_with edge types are kept.
delete from life.life_graph_edges where edge_type in ('threatened_by', 'accelerated_by');

notify pgrst, 'reload schema';

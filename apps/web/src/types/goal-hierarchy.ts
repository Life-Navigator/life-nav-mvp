/**
 * Goal-hierarchy types — mirror migration 076.
 *
 * The six storage tables share one row shape so the resolver layer can
 * treat them as a single edge stream.
 */

export type GoalRelationshipType =
  | 'SUPPORTS'
  | 'BLOCKS'
  | 'DEPENDS_ON'
  | 'PREREQUISITE_FOR'
  | 'CONFLICTS_WITH'
  | 'ACCELERATES'
  | 'DELAYED_BY'
  | 'COMPETES_FOR_RESOURCES'
  | 'PARENT_OF'
  | 'PRIORITIZED_OVER'
  | 'PATHWAY_STEP';

export type GoalHierarchyTable =
  | 'goal_hierarchies'
  | 'goal_dependencies'
  | 'goal_conflicts'
  | 'goal_priorities'
  | 'goal_relationships'
  | 'goal_pathways';

export interface GoalEdge {
  id: string;
  user_id: string;
  parent_goal_id: string;
  child_goal_id: string;
  relationship_type: GoalRelationshipType;
  strength_score: number;
  confidence_score: number;
  source: string;
  source_table: GoalHierarchyTable;
}

export type PathwayClassification = 'root' | 'required' | 'supporting' | 'optional' | 'blocked';

export interface PathwayNode {
  goal_id: string;
  classification: PathwayClassification;
  depth: number;
  via_edges: string[]; // edge ids that led to this classification
  cumulative_strength: number; // 0..1 — product of strengths along best path
  blocked_by?: string[]; // goal ids that block this node
}

export interface PathwayEdge {
  source: string;
  target: string;
  label: GoalRelationshipType;
  strength: number;
  confidence: number;
  source_table: GoalHierarchyTable;
}

export interface GoalPathway {
  root_goal_id: string;
  user_id: string;
  required: PathwayNode[];
  supporting: PathwayNode[];
  optional: PathwayNode[];
  blocked: PathwayNode[];
  edges: PathwayEdge[];
  topological_order: string[]; // goal ids in dependency order
  cycles: string[][]; // each inner array is a cycle (>=2 nodes)
  computed_at: string; // ISO timestamp
}

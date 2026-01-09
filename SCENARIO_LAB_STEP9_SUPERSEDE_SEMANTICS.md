# Scenario Lab - Step 9 Supersede Semantics

## Overview

This document describes the **supersede commit flow** added to Step 9, which provides safe, auditable control over scenario commitment and roadmap generation.

## Core Principles

1. **Default Behavior is Safe**: Users cannot accidentally overwrite committed roadmaps
2. **Audit Trail**: All supersede actions are logged with full context
3. **Data Preservation**: Superseded plans are never deleted, only marked as inactive
4. **User Trust**: Clear warnings and confirmations before destructive actions
5. **Fork-First**: The UI recommends forking over superseding

---

## API Changes

### POST /api/scenario-lab/scenarios/[id]/commit

**Request Body Schema**:
```typescript
{
  versionId: string;        // UUID of version to commit
  commitMessage?: string;   // Optional commit message
  supersede?: boolean;      // Default: false. Set to true to supersede existing commit
}
```

**Response Cases**:

#### Case 1: First-time commit (no existing committed version)
- Status: `201 Created`
- Response:
```json
{
  "message": "Scenario committed successfully",
  "planId": "uuid",
  "phaseCount": 5,
  "taskCount": 18,
  "supersededVersions": []
}
```

#### Case 2: Idempotent commit (same version already committed)
- Status: `200 OK`
- Response:
```json
{
  "message": "Scenario already committed",
  "planId": "uuid",
  "phaseCount": 5,
  "taskCount": 18
}
```

#### Case 3: Attempt to commit different version WITHOUT supersede flag
- Status: `409 Conflict`
- Response:
```json
{
  "error": "SCENARIO_ALREADY_COMMITTED",
  "committedVersionId": "uuid-of-current-committed-version",
  "message": "This scenario already has a committed version. Fork to change assumptions, or explicitly supersede."
}
```

#### Case 4: Commit different version WITH supersede=true
- Status: `201 Created`
- Response:
```json
{
  "message": "Scenario committed (superseded previous)",
  "planId": "uuid-of-new-plan",
  "phaseCount": 6,
  "taskCount": 22,
  "supersededVersions": [
    {
      "id": "uuid",
      "version_number": 1,
      "name": "Version 1",
      "created_at": "2025-01-08T12:00:00Z"
    }
  ]
}
```

**Server-Side Actions for Supersede**:

When `supersede=true` and a different version is already committed:

1. Mark previous committed version status: `'active'` → `'superseded'`
2. Mark previous plan status: `'active'` → `'superseded'`
3. Create audit log entry:
```typescript
{
  action: 'SCENARIO_COMMIT_SUPERSEDE',
  resource_type: 'scenario',
  resource_id: scenarioId,
  metadata: {
    from_version_id: previousVersionId,
    to_version_id: newVersionId,
    commit_message: commitMessage
  }
}
```
4. Create new plan for new committed version
5. Update scenario committed_version_id to new version

**Important**: Previous plans and versions are NEVER deleted. They remain in the database for audit and history.

---

## UI Flow

### 1. Initial Commit (No Existing Committed Version)

**User Action**: Clicks "Commit Scenario & Generate Roadmap"

**UI Behavior**:
- Show simple browser confirm dialog
- Message: "Committing will lock this scenario version and generate a roadmap. This action cannot be undone. Continue?"
- On confirm: POST with `{ versionId, supersede: false }`

---

### 2. Attempt to Commit Different Version

**User Action**: Clicks "Commit Scenario & Generate Roadmap" on a different version

**UI Behavior**:
- Detect committed version exists (committedVersionId !== versionId)
- Show `SupersedeModal` component (blocking modal)

**SupersedeModal Features**:

**Visual Elements**:
- Red warning icon
- Title: "Supersede Committed Roadmap?"
- Subtitle: "This action will replace your current committed roadmap"

**Content Sections**:

1. **Warning Box (Red)**:
   - What will happen list:
     - Current committed version → "superseded"
     - Existing roadmap preserved (read-only in History)
     - New roadmap generated
     - Action logged and audited, cannot be undone

2. **Current Version Info**:
   - Shows name of currently committed version

3. **Recommendation Box (Blue)**:
   - "💡 Recommended: Fork Instead"
   - Explanation: Forking preserves current roadmap and lets you explore alternatives

4. **Confirmation Input**:
   - Text input requiring user to type "SUPERSEDE"
   - Prevents accidental clicks

**Actions**:
- **"Fork Instead (Recommended)"** button (blue, default):
  - Routes to fork creation page
  - Preserves current committed roadmap
- **"Supersede Commit"** button (red, destructive):
  - Disabled until "SUPERSEDE" typed correctly
  - On click: POST with `{ versionId, supersede: true }`

**Modal Behavior**:
- Clicking backdrop closes modal
- Clicking X button closes modal
- Both actions cancel the supersede operation

---

### 3. View Committed Roadmap

**UI Elements**:

**Header Badge**:
- Shows "Committed" badge next to plan name
- Green background for active committed plans

**History Link**:
- Only visible if supersededVersions.length > 0
- Text: "Show History (N)" where N = count of superseded versions
- Toggles history section visibility

---

### 4. History Section

**Visibility**: Only shown when `showHistory=true` and superseded versions exist

**Layout**:
- Yellow background (warning color for historical data)
- Title: "📜 Superseded Roadmaps"
- Description: "These are previous committed versions that have been superseded. They are preserved for your reference."

**Version Cards**:
For each superseded version:
- Name and version number
- "Superseded on" date
- "View Read-Only" button → navigates to read-only view of that version

---

## Audit Trail

All supersede actions are logged to `scenario_audit_log` table:

```sql
INSERT INTO scenario_audit_log (
  user_id,
  action,
  resource_type,
  resource_id,
  metadata
) VALUES (
  'user-uuid',
  'SCENARIO_COMMIT_SUPERSEDE',
  'scenario',
  'scenario-uuid',
  '{
    "from_version_id": "old-version-uuid",
    "to_version_id": "new-version-uuid",
    "commit_message": "Updated assumptions for 2025"
  }'
);
```

**Query Supersede History**:
```sql
SELECT
  sal.created_at,
  sal.metadata->>'from_version_id' as from_version,
  sal.metadata->>'to_version_id' as to_version,
  sal.metadata->>'commit_message' as message
FROM scenario_audit_log sal
WHERE
  sal.action = 'SCENARIO_COMMIT_SUPERSEDE'
  AND sal.resource_id = 'scenario-uuid'
ORDER BY sal.created_at DESC;
```

---

## Data Integrity Rules

### Status Transitions

**scenario_versions.status**:
- `active` → `superseded` (when newer version committed)
- `superseded` → (never changes, permanent)

**plans.status**:
- `active` → `superseded` (when newer plan created)
- `superseded` → (never changes, permanent)

**scenario_labs.status**:
- `draft` → `committed` (first commit)
- `committed` → `committed` (remains, only committed_version_id changes)

### Constraints

1. **One Active Committed Version Per Scenario**:
   - Only one version can have status='active' AND be referenced by scenario.committed_version_id
   - Previous committed versions have status='superseded'

2. **Plan-Version Relationship**:
   - Each plan has exactly one scenario_version_id
   - Plans are never shared between versions
   - Plans are never deleted (status='superseded' for old plans)

3. **Audit Log Immutability**:
   - scenario_audit_log entries are append-only
   - No updates or deletes allowed

---

## Files Modified

### 1. `/apps/web/src/app/api/scenario-lab/scenarios/[id]/commit/route.ts`

**Changes**:
- Added `supersede` field to Zod schema (optional, default false)
- Added supersede flow when committedVersionId exists and differs
- Mark previous version and plan as 'superseded'
- Create SCENARIO_COMMIT_SUPERSEDE audit log entry
- Return supersededVersions array in response

**Lines Changed**: ~40 lines added

---

### 2. `/apps/web/src/components/scenario-lab/SupersedeModal.tsx` ✨ NEW

**Purpose**: Blocking modal for supersede confirmation

**Props**:
```typescript
interface SupersedeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onFork: () => void;
  committedVersionName?: string;
}
```

**Features**:
- Requires typing "SUPERSEDE" to enable confirm button
- Red destructive styling
- Blue recommendation box for forking
- Backdrop close
- Loading state during confirmation

**Lines**: 165 lines

---

### 3. `/apps/web/src/components/scenario-lab/RoadmapTab.tsx`

**Changes**:

**New State**:
```typescript
const [showSupersedeModal, setShowSupersedeModal] = useState(false);
const [committedVersionId, setCommittedVersionId] = useState<string | null>(null);
const [supersededVersions, setSupersededVersions] = useState<any[]>([]);
const [showHistory, setShowHistory] = useState(false);
```

**Updated Functions**:
- `fetchPlan()`: Now fetches scenario committed_version_id and superseded versions
- `handleCommit(supersede=false)`: Check for existing commit, show modal if needed, pass supersede flag

**New Functions**:
- `handleFork()`: Navigate to fork creation page

**New UI Elements**:
- `<SupersedeModal>` component
- "Committed" badge in header
- "Show History" toggle link
- History section with superseded version cards

**Lines Changed**: ~80 lines modified/added

---

## Testing Scenarios

### Test 1: First-Time Commit
1. Create new scenario
2. Add inputs
3. Commit version
4. **Expected**: Roadmap generated, scenario status='committed'

### Test 2: Idempotent Commit
1. Commit scenario
2. Click commit again on same version
3. **Expected**: No error, returns existing plan

### Test 3: Attempt Commit on Different Version (Default Behavior)
1. Commit scenario (version A)
2. Create new version (version B)
3. Navigate to version B, click commit
4. **Expected**: SupersedeModal appears

### Test 4: Cancel Supersede
1. Trigger supersede modal
2. Click "X" or backdrop
3. **Expected**: Modal closes, no changes

### Test 5: Fork Instead
1. Trigger supersede modal
2. Click "Fork Instead"
3. **Expected**: Navigate to fork page, original committed version unchanged

### Test 6: Supersede with Invalid Confirmation
1. Trigger supersede modal
2. Type "SUPERCEDE" (typo)
3. **Expected**: "Supersede Commit" button disabled

### Test 7: Successful Supersede
1. Trigger supersede modal
2. Type "SUPERSEDE"
3. Click "Supersede Commit"
4. **Expected**:
   - Previous version status → 'superseded'
   - Previous plan status → 'superseded'
   - New plan created
   - Audit log entry created
   - History shows 1 superseded version

### Test 8: View Superseded History
1. Supersede a committed version
2. Click "Show History"
3. **Expected**: Yellow section shows superseded version with "View Read-Only" button

### Test 9: Multiple Supersedes
1. Commit version A
2. Supersede with version B
3. Supersede with version C
4. **Expected**: History shows 2 superseded versions (A, B)

### Test 10: Audit Log Verification
1. Supersede a committed version
2. Query scenario_audit_log
3. **Expected**: Entry with action='SCENARIO_COMMIT_SUPERSEDE', metadata contains from/to version IDs

---

## Security Considerations

### Authorization
- All supersede operations require authenticated user
- RLS policies enforce user_id match on all tables
- Cannot supersede another user's scenario

### Audit Logging
- All supersede actions logged with:
  - Timestamp
  - User ID
  - From/to version IDs
  - Commit message
- Logs are immutable

### Data Integrity
- Superseded plans never deleted (preserves history)
- Status transitions are one-way (active → superseded)
- Database constraints prevent orphaned plans

---

## User Experience Principles

### 1. Fork-First Mentality
- UI recommends forking over superseding
- "Fork Instead" button is visually prominent
- Blue (safe) vs Red (destructive) color coding

### 2. Prevent Accidents
- Requires typing "SUPERSEDE" to confirm
- Blocking modal prevents background clicks
- Clear warning messages

### 3. Transparency
- Shows what will happen before action
- History section shows all superseded versions
- Audit log tracks every change

### 4. Reversibility (Soft)
- Superseded plans preserved for reference
- Can view read-only versions
- Can fork from superseded versions if needed

---

## Future Enhancements

### Potential Improvements:
1. **Diff View**: Show comparison between current and new committed version
2. **Restore Superseded**: Allow promoting a superseded version back to active
3. **Bulk Operations**: Supersede multiple scenarios at once
4. **Email Notifications**: Notify user when supersede completes
5. **Comments**: Add comment field to supersede action for context

---

## API Contract Summary

### Endpoint: `POST /api/scenario-lab/scenarios/[id]/commit`

**Request**:
```typescript
{
  versionId: string;       // Required
  commitMessage?: string;  // Optional
  supersede?: boolean;     // Optional, default false
}
```

**Response 201 (Success)**:
```typescript
{
  message: string;
  planId: string;
  phaseCount: number;
  taskCount: number;
  supersededVersions: Array<{
    id: string;
    version_number: number;
    name: string;
    created_at: string;
  }>;
}
```

**Response 409 (Conflict - Must Supersede)**:
```typescript
{
  error: "SCENARIO_ALREADY_COMMITTED";
  committedVersionId: string;
  message: "This scenario already has a committed version. Fork to change assumptions, or explicitly supersede.";
}
```

**Response 400 (Validation Error)**:
```typescript
{
  error: "Validation failed";
  details: ZodError[];
}
```

**Response 401 (Unauthorized)**:
```typescript
{
  error: "Unauthorized";
}
```

**Response 404 (Not Found)**:
```typescript
{
  error: "Scenario not found" | "Version not found";
}
```

---

## Database Schema Impact

**No schema changes required.** The implementation uses existing fields:

**scenario_versions**:
- `status` field: Now uses 'superseded' value

**plans**:
- `status` field: Now uses 'superseded' value

**scenario_audit_log**:
- `action` field: Now includes 'SCENARIO_COMMIT_SUPERSEDE' value
- `metadata` JSONB: Stores from_version_id, to_version_id, commit_message

---

## Example User Flow

### Scenario: User wants to update assumptions

**Starting State**:
- Scenario "Buy a House" has committed version 1
- Roadmap shows 5 phases, 18 tasks
- User has been tracking progress

**User Actions**:
1. User updates income assumptions in new version 2
2. User runs simulation on version 2
3. User navigates to Roadmap tab on version 2
4. User clicks "Commit Scenario & Generate Roadmap"

**System Response**:
5. System detects committedVersionId = version1, versionId = version2
6. System shows SupersedeModal

**User Sees**:
- Red warning: "This will replace your current committed roadmap"
- Blue recommendation: "Fork Instead (Recommended)"
- Confirmation input: "Type SUPERSEDE to confirm"

**User Decision A: Fork Instead**
7. User clicks "Fork Instead"
8. System navigates to `/dashboard/scenario-lab/[id]/fork`
9. User creates fork scenario "Buy a House (Alternative)"
10. Original committed roadmap preserved ✅

**User Decision B: Supersede**
7. User types "SUPERSEDE"
8. User clicks "Supersede Commit"
9. System makes API call with `supersede: true`
10. System marks version 1 as 'superseded'
11. System creates new roadmap for version 2
12. System shows success: "Roadmap superseded! Generated 6 phases and 22 tasks."
13. User sees "Committed" badge on new roadmap
14. User clicks "Show History (1)"
15. User sees version 1 in history with "View Read-Only" button ✅

---

## Conclusion

The supersede semantics provide a **safe, auditable, and user-friendly** way to update committed scenarios while preserving historical data and preventing accidental overwrites. The implementation follows these key principles:

1. **Default Safe**: 409 error prevents accidental overwrites
2. **Explicit Intent**: Requires `supersede=true` flag and "SUPERSEDE" typing
3. **Preserve History**: Never delete superseded plans/versions
4. **Audit Trail**: Log all supersede actions
5. **User Trust**: Clear warnings, recommendations, and transparency

This design ensures users can confidently manage their scenarios while maintaining a complete audit trail for compliance and reference.

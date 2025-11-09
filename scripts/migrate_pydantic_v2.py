#!/usr/bin/env python3
"""
Automated Pydantic v1 → v2 migration script.

Converts deprecated methods:
- .dict() → .model_dump()
- .from_orm() → .model_validate()
- .parse_obj() → .model_validate()
- .construct() → .model_construct()
- .schema() → .model_json_schema()
- .update_forward_refs() → .model_rebuild()
"""
import re
from pathlib import Path
from typing import Dict, List, Tuple

# Files to migrate
FILES_TO_MIGRATE = [
    "services/agents/agents/core/base_agent.py",
    "services/api/app/api/v1/endpoints/career.py",
    "services/api/app/api/v1/endpoints/integrations.py",
    "services/api/app/api/v1/endpoints/health.py",
    "services/api/app/api/v1/endpoints/agents.py",
    "services/api/app/api/v1/endpoints/finance.py",
    "services/api/app/api/v1/endpoints/goals.py",
]

# Migration patterns (old -> new)
MIGRATION_PATTERNS = [
    (r'\.dict\(', '.model_dump('),
    (r'\.from_orm\(', '.model_validate('),
    (r'\.parse_obj\(', '.model_validate('),
    (r'\.construct\(', '.model_construct('),
    (r'\.schema\(', '.model_json_schema('),
    (r'\.update_forward_refs\(', '.model_rebuild('),
]


def migrate_file(file_path: Path) -> Tuple[int, Dict[str, List[int]]]:
    """
    Migrate Pydantic v1 methods to v2 in a file.

    Returns:
        Tuple of (total_changes, dict of {pattern: [line_numbers]})
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.splitlines(keepends=True)
    except FileNotFoundError:
        print(f"⚠️  File not found: {file_path}")
        return (0, {})

    total_changes = 0
    changes_by_pattern = {old: [] for old, _ in MIGRATION_PATTERNS}

    new_lines = []
    for line_num, line in enumerate(lines, start=1):
        original_line = line
        modified = False

        for old_pattern, new_pattern in MIGRATION_PATTERNS:
            if re.search(old_pattern, line):
                line = re.sub(old_pattern, new_pattern, line)
                modified = True
                changes_by_pattern[old_pattern].append(line_num)
                total_changes += 1

        new_lines.append(line)

    if total_changes > 0:
        # Write migrated content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)

        print(f"✅ Migrated {total_changes} Pydantic method(s) in {file_path}")
        for old_pattern, line_nums in changes_by_pattern.items():
            if line_nums:
                print(f"   {old_pattern} → Lines: {', '.join(map(str, line_nums))}")
    else:
        print(f"✓  No Pydantic v1 methods found in {file_path}")

    return (total_changes, changes_by_pattern)


def main():
    """Run migration on all target files"""
    repo_root = Path(__file__).parent.parent

    print("=" * 70)
    print("PYDANTIC V1 → V2 MIGRATION")
    print("=" * 70)
    print()

    total_changes = 0
    files_modified = 0
    all_changes = {old: 0 for old, _ in MIGRATION_PATTERNS}

    for file_rel_path in FILES_TO_MIGRATE:
        file_path = repo_root / file_rel_path

        if file_path.exists():
            changes, by_pattern = migrate_file(file_path)
            if changes > 0:
                total_changes += changes
                files_modified += 1

                for pattern, count in by_pattern.items():
                    all_changes[pattern] += len(count)
        else:
            print(f"⚠️  Skipping non-existent file: {file_rel_path}")

        print()

    print("=" * 70)
    print(f"SUMMARY: Migrated {total_changes} methods across {files_modified} files")
    print("=" * 70)
    print()
    print("Changes by method:")
    for old_pattern, count in all_changes.items():
        if count > 0:
            new_pattern = next(new for old, new in MIGRATION_PATTERNS if old == old_pattern)
            print(f"  {old_pattern:30} → {new_pattern:30} ({count} occurrences)")
    print("=" * 70)


if __name__ == "__main__":
    main()

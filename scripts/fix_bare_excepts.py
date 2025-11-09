#!/usr/bin/env python3
"""
Automated script to fix bare except clauses across the codebase.

Converts:
    except:
        pass

To:
    except Exception as e:
        # Log error for debugging
        logger.debug(f"Operation failed: {e}")
        pass
"""
import re
from pathlib import Path
from typing import List, Tuple

# Files to fix
FILES_TO_FIX = [
    "services/finance-api/app/core/redis.py",
    "services/finance-api/app/services/market_data.py",
    "services/finance-api/app/middleware/logging.py",
    "services/finance-api/app/middleware/rate_limit.py",
    "services/agents/test_mmap_performance.py",
    "services/agents/benchmark_graph_algorithms.py",
    "services/agents/ui/admin_app.py",
    "services/agents/test_simd_performance.py",
    "services/agents/mcp_servers/resume_mcp_server.py",
    "services/agents/mcp-server/ingestion/parsers.py",
    "services/agents/mcp-server/ingestion/parsers_rust.py",
    "services/agents/mcp-server/ingestion/pipeline.py",
]


def fix_bare_except(file_path: Path) -> Tuple[int, List[int]]:
    """
    Fix all bare except clauses in a file.

    Returns:
        Tuple of (total_fixes, list of line numbers fixed)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"⚠️  File not found: {file_path}")
        return (0, [])

    fixed_lines = []
    fixes = 0
    fixed_line_numbers = []

    i = 0
    while i < len(lines):
        line = lines[i]

        # Match bare except clause
        match = re.match(r'^(\s*)except\s*:\s*$', line)

        if match:
            indent = match.group(1)
            fixes += 1
            fixed_line_numbers.append(i + 1)

            # Replace bare except with specific exception
            fixed_lines.append(f"{indent}except Exception as e:\n")

            # Check next line for pass statement
            if i + 1 < len(lines):
                next_line = lines[i + 1]

                # If next line is just 'pass', add logging before it
                if re.match(r'^\s*pass\s*$', next_line):
                    fixed_lines.append(f"{indent}    # Log error for debugging\n")
                    fixed_lines.append(f"{indent}    import logging\n")
                    fixed_lines.append(f"{indent}    logger = logging.getLogger(__name__)\n")
                    fixed_lines.append(f"{indent}    logger.debug(f\"Operation failed: {{e}}\")\n")
                    i += 1  # Skip the pass line, we'll add it next
                    fixed_lines.append(next_line)
                else:
                    # Next line is actual code, just add logging comment
                    fixed_lines.append(f"{indent}    # Specific exception caught for better error handling\n")
        else:
            fixed_lines.append(line)

        i += 1

    if fixes > 0:
        # Write fixed content back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(fixed_lines)

        print(f"✅ Fixed {fixes} bare except(s) in {file_path}")
        print(f"   Lines: {', '.join(map(str, fixed_line_numbers))}")
    else:
        print(f"✓  No bare excepts found in {file_path}")

    return (fixes, fixed_line_numbers)


def main():
    """Run fixer on all target files"""
    repo_root = Path(__file__).parent.parent

    print("=" * 60)
    print("BARE EXCEPT CLAUSE FIXER")
    print("=" * 60)
    print()

    total_fixes = 0
    files_modified = 0

    for file_rel_path in FILES_TO_FIX:
        file_path = repo_root / file_rel_path

        if file_path.exists():
            fixes, lines = fix_bare_except(file_path)
            if fixes > 0:
                total_fixes += fixes
                files_modified += 1
        else:
            print(f"⚠️  Skipping non-existent file: {file_rel_path}")

        print()

    print("=" * 60)
    print(f"SUMMARY: Fixed {total_fixes} bare except clauses across {files_modified} files")
    print("=" * 60)


if __name__ == "__main__":
    main()

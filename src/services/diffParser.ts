/**
 * Parses unified diff patches from GitHub API to extract changed line numbers.
 *
 * GitHub's `pulls.listFiles()` returns a `patch` field with unified diff format.
 * We parse the @@ hunk headers and +/- lines to determine which lines in the
 * new (head) version of the file were added or modified.
 */

export type FileStatus = 'added' | 'modified' | 'renamed' | 'copied' | 'changed';

/**
 * Parse a unified diff patch string and return the set of changed line numbers
 * in the new (right-side) file.
 *
 * Changed lines include:
 * - Lines starting with `+` (added or modified)
 * - Context lines adjacent to changes are NOT included
 *
 * @param patch - The unified diff string from GitHub API
 * @returns Set of 1-based line numbers that are changed in the new file
 */
export function parseChangedLines(patch: string | undefined): Set<number> {
  const changedLines = new Set<number>();

  if (!patch) return changedLines;

  const lines = patch.split('\n');
  let newLineNum = 0;

  for (const line of lines) {
    // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      newLineNum = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (newLineNum === 0) continue; // Before first hunk

    if (line.startsWith('+')) {
      // Added or modified line in new file
      changedLines.add(newLineNum);
      newLineNum++;
    } else if (line.startsWith('-')) {
      // Removed line — doesn't exist in new file, don't advance newLineNum
    } else {
      // Context line (space prefix) or empty — exists in both, advance
      newLineNum++;
    }
  }

  return changedLines;
}

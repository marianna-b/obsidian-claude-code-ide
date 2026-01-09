# Attribution: Inline Diff Implementation

This inline diff feature was inspired by the [obsidian-inlineAI](https://github.com/FBarrca/obsidian-inlineAI) plugin by @FBarrca.

## Concepts Adapted from inlineAI

- **CodeMirror 6 decorations** for inline diff visualization
- **diff-match-patch library** with semantic cleanup for character-level diffs
- **ChangeContentWidget pattern** for inline text markers
- **Focus guard** to prevent editor blur issues during widget interaction

## Our Implementation Differs By

- **Chunk-based review**: Accept/reject individual change chunks rather than all-or-nothing
- **Progress tracking**: Header widget showing "X chunks remaining"
- **Batch operations**: Accept All / Reject All buttons
- **MCP integration**: Works with Claude Code's openDiff tool protocol
- **File operations**: Handles creation, deletion, and modification workflows
- **Tab management**: Opens files in new tabs and keeps them open after review

## License

Our implementation is released under the same MIT license as the original project.

The inlineAI plugin is also MIT licensed. See: https://github.com/FBarrca/obsidian-inlineAI/blob/main/LICENSE

# Security

DSH Narrative Ledger is a read-only structural verifier. It does not execute story content, model prompts, shell commands or network requests. It rejects prose- and secret-shaped fields, absolute/traversing paths and symlinks; source contents never enter reports.

Reports are written only beneath an explicit workspace-relative `artifactDir`, atomically published by content hash and read-back verified. Do not place credentials or unpublished manuscript text in manifests or event ledgers.

The MCP surface is proof-only: it accepts bounded inline JSON/JSONL, exposes no path or artifact argument, and performs no filesystem, network, or child-process operation. Its `verified-structure` result explicitly does not claim that external canon source bytes were observed. DSH and CLI are the only filesystem surfaces.

Report vulnerabilities privately to the repository owner through GitHub Security Advisories. Do not include real manuscripts or credentials in a report.

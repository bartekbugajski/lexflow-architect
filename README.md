# LexFlow Architect - Next-Gen Legal Operating System

## Project Overview
LexFlow Architect is an AI-native legal workspace designed for an AI-first law firm. Unlike generic LLM wrappers, this system treats legal documents as "Source Code" and lawyers as "Engineers of Justice."

## Core Philosophical Pillars
1. **The Legal Object Model**: Documents are not strings of text; they are a graph of "Atomic Clauses" with hierarchical dependencies.
2. **Deterministic Formatting**: AI never overwrites a document. It generates "Legal Patches" that preserve MS Word styles, numbering, and metadata.
3. **GraphRAG Reasoning**: Retrieval is based on a Neo4j Knowledge Graph, linking Clauses to Definitions and Statutory Authorities.

## Technical Architecture
- **Parser**: Custom `Docx-to-Graph` engine using `python-docx`.
- **Database**: Neo4j (for relational legal logic) + Vector Index (for semantic search).
- **Agent Orchestration**: LangGraph for iterative research and patch validation.
- **Frontend**: Next.js (Cursor-like editor for legal docs).

## Goal
To automate low-leverage work (formatting, cross-referencing, repetitive drafting) while keeping the lawyer in total control of the "Judgment Layer."
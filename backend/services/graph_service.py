from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from neo4j import GraphDatabase  # type: ignore[import-untyped]

from models.legal_objects import Clause


@dataclass(frozen=True)
class Neo4jConfig:
    uri: str
    username: str
    password: str
    database: Optional[str] = None


class GraphService:
    """
    Neo4j ingestion service for LexFlow legal object graph.

    Nodes:
    - (:Document {id, file_name, ingested_at})
    - (:Clause {id, title, text, parent_id, metadata_json})

    Relationships:
    - (:Document)-[:CONTAINS]->(:Clause) for root clauses
    - (:Clause)-[:CONTAINS]->(:Clause) for nested clauses
    - (:Clause)-[:REFERENCES]->(:Clause) for intra-document references
    """

    def __init__(self, config: Neo4jConfig):
        self._config = config
        self._driver = GraphDatabase.driver(config.uri, auth=(config.username, config.password))

    @classmethod
    def from_env(cls) -> "GraphService":
        uri = os.getenv("NEO4J_URI", "neo4j://localhost:7687")
        username = os.getenv("NEO4J_USERNAME", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "neo4j")
        database = os.getenv("NEO4J_DATABASE") or None
        return cls(Neo4jConfig(uri=uri, username=username, password=password, database=database))

    def close(self) -> None:
        self._driver.close()

    def ensure_constraints(self) -> None:
        queries = [
            "CREATE CONSTRAINT document_id_unique IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE",
            "CREATE CONSTRAINT clause_id_unique IF NOT EXISTS FOR (c:Clause) REQUIRE c.id IS UNIQUE",
        ]
        with self._driver.session(database=self._config.database) as session:
            for q in queries:
                session.run(q)

    def ingest_document(
        self,
        *,
        document_id: str,
        file_name: str,
        clauses: List[Clause],
        references: Optional[List[Dict[str, str]]] = None,
    ) -> None:
        ingested_at = datetime.now(timezone.utc).isoformat()

        roots = [c.id for c in clauses if not c.parent_id]
        contains_pairs = [{"parent_id": c.parent_id, "child_id": c.id} for c in clauses if c.parent_id]
        clause_rows = [self._clause_row(c) for c in clauses]
        references = references or []

        with self._driver.session(database=self._config.database) as session:
            session.execute_write(
                self._ingest_tx,
                document_id,
                file_name,
                ingested_at,
                clause_rows,
                roots,
                contains_pairs,
                references,
            )

    @staticmethod
    def _clause_row(c: Clause) -> Dict[str, Any]:
        return {
            "id": c.id,
            "title": c.title,
            "text": c.text,
            "parent_id": c.parent_id,
            "metadata_json": json.dumps(c.metadata or {}, ensure_ascii=False, separators=(",", ":")),
        }

    @staticmethod
    def _ingest_tx(
        tx,
        document_id: str,
        file_name: str,
        ingested_at: str,
        clauses: List[Dict[str, Any]],
        root_clause_ids: List[str],
        contains_pairs: List[Dict[str, str]],
        references: List[Dict[str, str]],
    ) -> None:
        tx.run(
            """
            MERGE (d:Document {id: $document_id})
            SET d.file_name = $file_name,
                d.ingested_at = $ingested_at
            """,
            document_id=document_id,
            file_name=file_name,
            ingested_at=ingested_at,
        )

        if clauses:
            tx.run(
                """
                UNWIND $clauses AS c
                MERGE (cl:Clause {id: c.id})
                SET cl.title = c.title,
                    cl.text = c.text,
                    cl.parent_id = c.parent_id,
                    cl.metadata_json = c.metadata_json
                """,
                clauses=clauses,
            )

        if root_clause_ids:
            tx.run(
                """
                MATCH (d:Document {id: $document_id})
                UNWIND $root_ids AS cid
                MATCH (c:Clause {id: cid})
                MERGE (d)-[:CONTAINS]->(c)
                """,
                document_id=document_id,
                root_ids=root_clause_ids,
            )

        if contains_pairs:
            tx.run(
                """
                UNWIND $pairs AS p
                MATCH (parent:Clause {id: p.parent_id})
                MATCH (child:Clause {id: p.child_id})
                MERGE (parent)-[:CONTAINS]->(child)
                """,
                pairs=contains_pairs,
            )

        if references:
            tx.run(
                """
                UNWIND $refs AS r
                MATCH (src:Clause {id: r.src})
                MATCH (dst:Clause {id: r.dst})
                MERGE (src)-[rel:REFERENCES]->(dst)
                SET rel.kind = coalesce(r.kind, rel.kind)
                """,
                refs=references,
            )


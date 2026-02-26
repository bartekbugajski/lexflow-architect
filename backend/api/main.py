from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.graph_service import GraphService
from services.agent_service import PatchAgent, PatchAgentConfigError
from services.parser import LegalDocParser
from services.export_service import DocumentExporter, DocumentNotFoundError
from models.legal_objects import LegalPatch


@asynccontextmanager
async def lifespan(app: FastAPI):
    graph = GraphService.from_env()
    graph.ensure_constraints()
    app.state.graph = graph
    try:
        yield
    finally:
        graph.close()


app = FastAPI(title="LexFlow Architect", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/ingest")
async def ingest(file: UploadFile = File(...)) -> Dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported.")

    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read upload: {e}") from e

    parser = LegalDocParser()
    try:
        clauses = parser.parse_bytes(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse .docx: {e}") from e

    document_id = str(uuid.uuid4())
    references = parser.extract_references(clauses)

    graph: GraphService = app.state.graph
    try:
        graph.ingest_document(
            document_id=document_id,
            file_name=file.filename,
            clauses=clauses,
            references=references,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to write to Neo4j: {e}") from e

    return {
        "document_id": document_id,
        "file_name": file.filename,
        "clause_count": len(clauses),
        "reference_count": len(references),
    }


class PatchRequest(BaseModel):
    instruction: str
    clause_id: str


@app.post("/patch", response_model=LegalPatch)
async def generate_patch(request: PatchRequest) -> LegalPatch:
    graph: GraphService = app.state.graph

    clause = graph.get_clause_by_id(request.clause_id)
    if clause is None:
        raise HTTPException(status_code=404, detail=f"Clause not found for id: {request.clause_id}")

    try:
        agent = PatchAgent.from_env()
    except PatchAgentConfigError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize PatchAgent: {e}") from e

    try:
        patch = agent.generate_patch(
            instruction=request.instruction,
            original_text=clause.text,
            clause_id=clause.id,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to generate patch: {e}") from e

    try:
        graph.run_write(
            "MATCH (c:Clause {id: $clause_id}) SET c.text = $new_text",
            clause_id=request.clause_id,
            new_text=patch.proposed_text,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to persist patch to Neo4j: {e}",
        ) from e

    return patch


@app.get("/document/{document_id}")
def get_document(document_id: str) -> list:
    """Return all clauses for a document (id, title, text)."""
    graph: GraphService = app.state.graph
    clauses = graph.get_document_clauses(document_id)
    return [{"id": c.id, "title": c.title, "text": c.text} for c in clauses]


@app.get("/export/{document_id}")
async def export_document(document_id: str):
    graph: GraphService = app.state.graph

    try:
        buffer = DocumentExporter.export_to_docx(document_id=document_id, graph_service=graph)
    except DocumentNotFoundError:
        raise HTTPException(status_code=404, detail=f"Document not found for id: {document_id}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to export document: {e}") from e

    headers = {
        "Content-Disposition": 'attachment; filename="lexflow_exported_document.docx"'
    }

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers=headers,
    )


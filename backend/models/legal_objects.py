from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field


class Clause(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., description="Stable unique identifier for this clause node.")
    order_index: int = Field(
        default=0,
        description="Stable, zero-based order of this clause within its document.",
    )
    title: Optional[str] = Field(
        default=None,
        description="Header text for the clause (e.g., 'Article 1 — Definitions').",
    )
    text: str = Field(
        default="",
        description="Plain text content of the clause body (paragraphs joined).",
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Rich metadata for reconstruction (e.g., paragraph formatting, header type).",
    )
    parent_id: Optional[str] = Field(
        default=None,
        description="Parent clause id for nested structure; null when root-level.",
    )


class LegalPatchChangeType(str, Enum):
    replace = "replace"
    insert_before = "insert_before"
    insert_after = "insert_after"
    append = "append"
    delete = "delete"


class LegalPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_clause_id: str = Field(..., description="Clause id this patch applies to.")
    change_type: LegalPatchChangeType = Field(..., description="Type of patch operation.")
    proposed_text: str = Field(
        default="",
        description="Proposed replacement/inserted/append text (empty for delete).",
    )
    reasoning: str = Field(..., description="Model/human rationale for the change.")


from __future__ import annotations

from typing import List

from models.legal_objects import Clause, LegalPatch, LegalPatchChangeType


class LegalPatchApplier:
    """
    Deterministically applies a LegalPatch to an in-memory Clause list.

    Notes:
    - This operates on the clause's `text` and its `metadata["paragraphs"]` representation.
    - Formatting for inserted text is inherited from the nearest existing paragraph when possible.
    """

    def apply(self, clauses: List[Clause], patch: LegalPatch) -> List[Clause]:
        updated = [self._copy_clause(c) for c in clauses]
        target = next((c for c in updated if c.id == patch.target_clause_id), None)
        if target is None:
            raise ValueError(f"Unknown target_clause_id: {patch.target_clause_id}")

        paragraphs = target.metadata.get("paragraphs")
        if not isinstance(paragraphs, list):
            paragraphs = []
            target.metadata["paragraphs"] = paragraphs

        default_fmt = {"bold": False, "italic": False, "alignment": None, "style": None}
        first_fmt = (paragraphs[0].get("formatting") if paragraphs else None) or default_fmt
        last_fmt = (paragraphs[-1].get("formatting") if paragraphs else None) or default_fmt

        if patch.change_type == LegalPatchChangeType.replace:
            paragraphs[:] = [{"text": patch.proposed_text, "formatting": first_fmt}]
        elif patch.change_type == LegalPatchChangeType.insert_before:
            paragraphs.insert(0, {"text": patch.proposed_text, "formatting": first_fmt})
        elif patch.change_type in (LegalPatchChangeType.insert_after, LegalPatchChangeType.append):
            paragraphs.append({"text": patch.proposed_text, "formatting": last_fmt})
        elif patch.change_type == LegalPatchChangeType.delete:
            paragraphs[:] = []
        else:
            raise ValueError(f"Unsupported change_type: {patch.change_type}")

        target.text = "\n\n".join((p.get("text") or "").strip() for p in paragraphs).strip()
        target.metadata.setdefault("legal_patches", []).append(self._patch_dump(patch))
        return updated

    @staticmethod
    def _patch_dump(patch: LegalPatch) -> dict:
        if hasattr(patch, "model_dump"):
            return patch.model_dump()
        return patch.dict()  # pydantic v1 fallback

    @staticmethod
    def _copy_clause(clause: Clause) -> Clause:
        if hasattr(clause, "model_copy"):
            return clause.model_copy(deep=True)
        return clause.copy(deep=True)  # pydantic v1 fallback


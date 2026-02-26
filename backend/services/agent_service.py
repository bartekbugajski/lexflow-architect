from __future__ import annotations

import os
from typing import Optional

from langchain_core.output_parsers import PydanticOutputParser  # type: ignore[import-untyped]
from langchain_core.prompts import ChatPromptTemplate  # type: ignore[import-untyped]
from langchain_openai import ChatOpenAI  # type: ignore[import-untyped]

from models.legal_objects import LegalPatch


class PatchAgentConfigError(RuntimeError):
    """Configuration error for PatchAgent (e.g., missing API key)."""


class PatchAgent:
    """
    LLM-backed agent that proposes structured LegalPatch objects for a target clause.

    Uses LangChain structured output to guarantee the response conforms to the
    LegalPatch schema.
    """

    def __init__(self, llm: ChatOpenAI):
        self._llm = llm
        self._parser = PydanticOutputParser(pydantic_object=LegalPatch)

        format_instructions = self._parser.get_format_instructions()
        self._prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    (
                        "You are a senior commercial contracts lawyer assisting with editing clauses. "
                        "Given a drafting instruction and the original clause text, propose a precise, "
                        "implementation-ready patch.\n\n"
                        "You MUST respond using the exact JSON schema described in the format instructions below.\n\n"
                        "Change types:\n"
                        "- 'replace': Replace the entire existing clause text with the proposed_text.\n"
                        "- 'insert_before': Insert proposed_text immediately before the existing clause text.\n"
                        "- 'insert_after': Insert proposed_text immediately after the existing clause text.\n"
                        "- 'append': Append proposed_text as an additional paragraph at the end.\n"
                        "- 'delete': Remove the clause entirely; proposed_text should be an empty string.\n\n"
                        f"{format_instructions}"
                    ),
                ),
                (
                    "human",
                    (
                        "Instruction:\n"
                        "{instruction}\n\n"
                        "Target clause id:\n"
                        "{clause_id}\n\n"
                        "Original clause text:\n"
                        "{original_text}"
                    ),
                ),
            ]
        )

    @classmethod
    def from_env(cls) -> "PatchAgent":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise PatchAgentConfigError(
                "OPENAI_API_KEY is not set; cannot initialize PatchAgent. "
                "Set the environment variable and try again."
            )

        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        temperature_raw: Optional[str] = os.getenv("OPENAI_TEMPERATURE")
        try:
            temperature = float(temperature_raw) if temperature_raw is not None else 0.2
        except ValueError:
            temperature = 0.2

        llm = ChatOpenAI(model=model, api_key=api_key, temperature=temperature)
        return cls(llm=llm)

    def generate_patch(self, instruction: str, original_text: str, clause_id: str) -> LegalPatch:
        """
        Generate a LegalPatch for the given clause and instruction.
        """
        chain = self._prompt | self._llm | self._parser

        patch: LegalPatch = chain.invoke(
            {
                "instruction": instruction,
                "original_text": original_text,
                "clause_id": clause_id,
            }
        )

        # Ensure the patch is always explicitly tied to the requested clause id.
        if patch.target_clause_id != clause_id:
            if hasattr(patch, "model_copy"):
                patch = patch.model_copy(update={"target_clause_id": clause_id})
            else:  # pydantic v1 fallback
                patch = LegalPatch(**{**patch.dict(), "target_clause_id": clause_id})

        return patch


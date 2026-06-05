from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib import error, request
from uuid import uuid4

import chromadb

from app.core.config import settings
from app.schemas.inference import (
    AddDocRequest,
    AddDocResponse,
    SearchRequest,
    SearchResponse,
    SearchResult,
)


class SearchService:
    def __init__(self) -> None:
        self._client = self._create_client()
        self._collection = self._client.get_or_create_collection(
            name=settings.chromadb_collection,
            metadata={"hnsw:space": "cosine"},
        )

    def _create_client(self) -> Any:
        try:
            return chromadb.HttpClient(
                host=settings.chromadb_host,
                port=settings.chromadb_port,
            )
        except Exception:
            return chromadb.PersistentClient(path=str(Path(settings.chromadb_path)))

    def _embed(self, texts: list[str]) -> list[list[float]]:
        body = json.dumps({
            "model": "qwen3-embedding-8b",
            "input": texts,
            "encoding_format": "float",
        }).encode("utf-8")
        req = request.Request(
            f"{settings.llama_url.rstrip('/')}/v1/embeddings",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.litellm_api_key}",
            },
        )
        with request.urlopen(req, timeout=30) as resp:
            data: dict[str, Any] = json.loads(resp.read().decode("utf-8"))
        return [entry["embedding"] for entry in data.get("data", [])]

    def add_document(self, payload: AddDocRequest) -> AddDocResponse:
        doc_id = payload.doc_id or str(uuid4())
        vectors = self._embed([payload.text])
        kwargs: dict = {
            "ids": [doc_id],
            "embeddings": vectors,
            "documents": [payload.text],
        }
        if payload.metadata:
            kwargs["metadatas"] = [payload.metadata]
        self._collection.upsert(**kwargs)
        return AddDocResponse(doc_id=doc_id, dimensions=len(vectors[0]))

    def search(self, payload: SearchRequest) -> SearchResponse:
        vectors = self._embed([payload.query])
        results = self._collection.query(
            query_embeddings=vectors,
            n_results=min(payload.n_results, self._collection.count() or 1),
            include=["documents", "metadatas", "distances"],
        )
        hits: list[SearchResult] = []
        ids = (results.get("ids") or [[]])[0]
        docs = (results.get("documents") or [[]])[0]
        metas = (results.get("metadatas") or [[]])[0]
        distances = (results.get("distances") or [[]])[0]
        for doc_id, text, meta, dist in zip(ids, docs, metas, distances):
            hits.append(SearchResult(
                doc_id=str(doc_id),
                text=str(text),
                metadata={str(k): str(v) for k, v in (meta or {}).items()},
                distance=float(dist),
            ))
        return SearchResponse(results=hits, query=payload.query)

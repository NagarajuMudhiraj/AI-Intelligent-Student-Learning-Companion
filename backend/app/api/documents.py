from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, BackgroundTasks
from app.api.deps import get_current_user
from app.models.user import UserOut
from app.models.document import DocumentInDB, DocumentOut
from app.db.database import get_database
from app.services.rag_service import process_and_store_document
from typing import List
from bson import ObjectId
import io

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".pptx", ".ppt", ".txt"}
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
    "text/plain",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: UserOut = Depends(get_current_user),
):
    import os

    file_ext = os.path.splitext(file.filename or "")[1].lower()

    if file_ext not in ALLOWED_EXTENSIONS or file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_ext}")

    # Read entire file into memory so we can track real size
    content = await file.read()
    size_bytes = len(content)

    if size_bytes > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 50 MB.")

    if size_bytes == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    db = get_database()

    # Create DB record with real size
    doc_in_db = DocumentInDB(
        filename=file.filename,
        original_name=file.filename,
        file_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
        user_id=current_user.id,
    )

    result = await db["documents"].insert_one(doc_in_db.dict())
    document_id = str(result.inserted_id)

    # Wrap content back into a file-like UploadFile for the background task
    file.file = io.BytesIO(content)
    file._size = size_bytes

    # Process in background (chunking + ChromaDB embedding)
    background_tasks.add_task(
        process_and_store_document,
        file,
        document_id,
        current_user.id,
        content,        # Pass raw bytes so background task doesn't need to re-read
    )

    return DocumentOut(
        id=document_id,
        filename=doc_in_db.filename,
        original_name=doc_in_db.original_name,
        file_type=doc_in_db.file_type,
        size_bytes=doc_in_db.size_bytes,
        user_id=doc_in_db.user_id,
        created_at=doc_in_db.created_at,
    )


@router.get("/", response_model=List[DocumentOut])
async def get_documents(current_user: UserOut = Depends(get_current_user)):
    db = get_database()
    cursor = db["documents"].find({"user_id": current_user.id}).sort("created_at", -1)
    documents = await cursor.to_list(length=100)

    return [
        DocumentOut(
            id=str(doc["_id"]),
            filename=doc["filename"],
            original_name=doc["original_name"],
            file_type=doc["file_type"],
            size_bytes=doc.get("size_bytes", 0),
            user_id=doc["user_id"],
            created_at=doc["created_at"],
        )
        for doc in documents
    ]


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: UserOut = Depends(get_current_user),
):
    db = get_database()
    doc = await db["documents"].find_one(
        {"_id": ObjectId(document_id), "user_id": current_user.id}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Remove DB record
    await db["documents"].delete_one({"_id": ObjectId(document_id)})

    # Remove from ChromaDB
    from app.services.rag_service import vectorstore
    try:
        vectorstore.delete(where={"document_id": document_id})
    except Exception:
        pass  # Best-effort deletion from vector store

    return {"message": "Document deleted"}

"""
Life Navigator Admin UI - Document Ingestion
Beautiful Reflex application for uploading and managing documents
"""

import reflex as rx
from typing import List, Dict, Any
import os
from pathlib import Path
import asyncio

# Import the ingestion pipeline
import sys
sys.path.append(str(Path(__file__).parent.parent))

from mcp_server.ingestion import ParserFactory


class AdminState(rx.State):
    """State management for admin UI"""

    # File upload
    uploaded_files: List[str] = []
    upload_progress: int = 0
    is_uploading: bool = False

    # Document type selection
    is_centralized: bool = False
    selected_user_id: str = "admin"

    # Ingestion jobs
    current_jobs: List[Dict[str, Any]] = []
    job_history: List[Dict[str, Any]] = []

    # Supported file types
    supported_types: List[str] = [
        ".txt", ".md", ".pdf", ".docx", ".doc",
        ".html", ".htm", ".csv", ".json"
    ]

    # Statistics
    total_documents: int = 0
    total_entities: int = 0
    total_concepts: int = 0

    async def handle_upload(self, files: List[rx.UploadFile]):
        """Handle file upload"""
        self.is_uploading = True
        self.upload_progress = 0

        upload_dir = Path("./uploads")
        upload_dir.mkdir(exist_ok=True)

        for i, file in enumerate(files):
            # Save file
            file_path = upload_dir / file.filename
            with open(file_path, "wb") as f:
                f.write(await file.read())

            self.uploaded_files.append(str(file_path))
            self.upload_progress = int(((i + 1) / len(files)) * 100)

            # Create ingestion job
            await self.create_ingestion_job(str(file_path))

        self.is_uploading = False
        return rx.toast.success(f"Uploaded {len(files)} file(s)")

    async def create_ingestion_job(self, file_path: str):
        """Create an ingestion job for a file"""
        # This would call the actual pipeline
        # For now, we'll create a mock job

        import uuid
        job_id = str(uuid.uuid4())

        job = {
            "job_id": job_id,
            "file_path": file_path,
            "file_name": Path(file_path).name,
            "status": "pending",
            "progress": 0,
            "user_id": self.selected_user_id if not self.is_centralized else "centralized",
            "is_centralized": self.is_centralized,
            "created_at": "Just now",
        }

        self.current_jobs.append(job)

        # Simulate processing
        await self.simulate_processing(job_id)

    async def simulate_processing(self, job_id: str):
        """Simulate job processing (replace with actual pipeline call)"""
        # Find the job
        job = next((j for j in self.current_jobs if j["job_id"] == job_id), None)
        if not job:
            return

        # Simulate progress
        for progress in [20, 40, 60, 80, 100]:
            await asyncio.sleep(1)
            job["progress"] = progress

            if progress == 100:
                job["status"] = "completed"
                self.total_documents += 1
                self.total_entities += 15  # Mock
                self.total_concepts += 5  # Mock

                # Move to history
                self.job_history.insert(0, job)
                self.current_jobs.remove(job)

    def toggle_centralized(self):
        """Toggle centralized vs user-specific"""
        self.is_centralized = not self.is_centralized

    def set_user_id(self, user_id: str):
        """Set user ID for uploads"""
        self.selected_user_id = user_id


def header() -> rx.Component:
    """Application header"""
    return rx.box(
        rx.hstack(
            rx.heading(
                "Life Navigator Admin",
                size="9",
                weight="bold",
            ),
            rx.spacer(),
            rx.badge(
                "Data Ingestion",
                color_scheme="blue",
                size="3",
            ),
            justify="between",
            align="center",
            width="100%",
        ),
        padding="1.5em",
        background="linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color="white",
        border_radius="8px 8px 0 0",
    )


def stats_card(title: str, value: str, icon: str, color: str) -> rx.Component:
    """Statistics card component"""
    return rx.card(
        rx.vstack(
            rx.hstack(
                rx.icon(icon, size=24, color=color),
                rx.spacer(),
            ),
            rx.heading(value, size="8", weight="bold"),
            rx.text(title, size="2", color="gray"),
            spacing="2",
            align="start",
        ),
        width="100%",
    )


def statistics_section() -> rx.Component:
    """Statistics display"""
    return rx.vstack(
        rx.heading("System Statistics", size="6", weight="bold"),
        rx.grid(
            stats_card(
                "Total Documents",
                AdminState.total_documents,
                "file-text",
                "#667eea"
            ),
            stats_card(
                "Entities Extracted",
                AdminState.total_entities,
                "network",
                "#764ba2"
            ),
            stats_card(
                "Concepts Identified",
                AdminState.total_concepts,
                "lightbulb",
                "#f093fb"
            ),
            stats_card(
                "Active Jobs",
                AdminState.current_jobs.length(),
                "activity",
                "#4facfe"
            ),
            columns="4",
            spacing="4",
            width="100%",
        ),
        spacing="4",
        width="100%",
    )


def upload_section() -> rx.Component:
    """File upload section"""
    return rx.card(
        rx.vstack(
            rx.hstack(
                rx.heading("Upload Documents", size="6", weight="bold"),
                rx.spacer(),
                rx.badge(
                    rx.cond(
                        AdminState.is_centralized,
                        "Centralized Knowledge",
                        f"User: {AdminState.selected_user_id}"
                    ),
                    color_scheme=rx.cond(
                        AdminState.is_centralized,
                        "green",
                        "blue"
                    ),
                    size="2",
                ),
                width="100%",
                align="center",
            ),

            # Upload type selection
            rx.hstack(
                rx.text("Upload Type:", weight="bold", size="3"),
                rx.switch(
                    checked=AdminState.is_centralized,
                    on_change=AdminState.toggle_centralized,
                ),
                rx.text(
                    rx.cond(
                        AdminState.is_centralized,
                        "Centralized (Shared)",
                        "User-Specific (RLS)"
                    ),
                    size="2",
                ),
                spacing="3",
                align="center",
            ),

            # User ID input (only for user-specific)
            rx.cond(
                ~AdminState.is_centralized,
                rx.hstack(
                    rx.text("User ID:", weight="bold", size="3"),
                    rx.input(
                        value=AdminState.selected_user_id,
                        on_change=AdminState.set_user_id,
                        placeholder="Enter user ID",
                        width="300px",
                    ),
                    spacing="3",
                    align="center",
                ),
            ),

            # Upload zone
            rx.upload(
                rx.vstack(
                    rx.button(
                        "Select Files",
                        color_scheme="purple",
                        size="3",
                    ),
                    rx.text(
                        "Or drag and drop files here",
                        size="2",
                        color="gray",
                    ),
                    rx.text(
                        f"Supported: {', '.join(AdminState.supported_types)}",
                        size="1",
                        color="gray",
                    ),
                    spacing="2",
                    align="center",
                    padding="4em",
                    border="2px dashed #CBD5E0",
                    border_radius="8px",
                    background=rx.cond(
                        AdminState.is_uploading,
                        "#EDF2F7",
                        "transparent"
                    ),
                ),
                id="upload_zone",
                multiple=True,
                accept={
                    "text/*": [".txt", ".md"],
                    "application/pdf": [".pdf"],
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
                    "text/html": [".html", ".htm"],
                    "text/csv": [".csv"],
                    "application/json": [".json"],
                },
            ),

            # Upload button
            rx.button(
                "Process Uploads",
                on_click=rx.upload_files(
                    upload_id="upload_zone",
                    on_upload_progress=AdminState.handle_upload,
                ),
                color_scheme="purple",
                size="3",
                width="100%",
                disabled=AdminState.is_uploading,
            ),

            # Progress bar
            rx.cond(
                AdminState.is_uploading,
                rx.vstack(
                    rx.progress(value=AdminState.upload_progress, width="100%"),
                    rx.text(
                        f"Uploading... {AdminState.upload_progress}%",
                        size="2",
                        color="gray",
                    ),
                    spacing="2",
                    width="100%",
                ),
            ),

            spacing="4",
            width="100%",
        ),
        width="100%",
    )


def job_card(job: Dict) -> rx.Component:
    """Individual job card"""
    return rx.card(
        rx.vstack(
            rx.hstack(
                rx.icon(
                    "file",
                    size=20,
                    color="#667eea",
                ),
                rx.text(
                    job["file_name"],
                    weight="bold",
                    size="3",
                ),
                rx.spacer(),
                rx.badge(
                    job["status"].capitalize(),
                    color_scheme=rx.cond(
                        job["status"] == "completed",
                        "green",
                        rx.cond(
                            job["status"] == "failed",
                            "red",
                            "blue"
                        )
                    ),
                ),
                width="100%",
                align="center",
            ),

            rx.text(
                f"User: {job['user_id']}",
                size="2",
                color="gray",
            ),

            rx.cond(
                job["status"] == "processing",
                rx.vstack(
                    rx.progress(value=job["progress"], width="100%"),
                    rx.text(
                        f"{job['progress']}%",
                        size="1",
                        color="gray",
                    ),
                    spacing="1",
                    width="100%",
                ),
            ),

            rx.text(
                job["created_at"],
                size="1",
                color="gray",
            ),

            spacing="2",
            width="100%",
        ),
        width="100%",
    )


def jobs_section() -> rx.Component:
    """Active jobs section"""
    return rx.card(
        rx.vstack(
            rx.heading("Active Jobs", size="6", weight="bold"),

            rx.cond(
                AdminState.current_jobs.length() > 0,
                rx.foreach(
                    AdminState.current_jobs,
                    job_card,
                ),
                rx.text(
                    "No active jobs",
                    size="3",
                    color="gray",
                    padding="2em",
                    text_align="center",
                ),
            ),

            spacing="3",
            width="100%",
        ),
        width="100%",
    )


def history_section() -> rx.Component:
    """Job history section"""
    return rx.card(
        rx.vstack(
            rx.heading("Recent History", size="6", weight="bold"),

            rx.cond(
                AdminState.job_history.length() > 0,
                rx.foreach(
                    AdminState.job_history[:5],  # Show last 5
                    job_card,
                ),
                rx.text(
                    "No history yet",
                    size="3",
                    color="gray",
                    padding="2em",
                    text_align="center",
                ),
            ),

            spacing="3",
            width="100%",
        ),
        width="100%",
    )


def index() -> rx.Component:
    """Main page"""
    return rx.container(
        rx.vstack(
            header(),

            # Main content
            rx.box(
                rx.vstack(
                    statistics_section(),

                    rx.grid(
                        upload_section(),
                        rx.vstack(
                            jobs_section(),
                            history_section(),
                            spacing="4",
                            width="100%",
                        ),
                        columns="2",
                        spacing="4",
                        width="100%",
                    ),

                    spacing="6",
                    width="100%",
                ),
                padding="2em",
            ),

            spacing="0",
            width="100%",
        ),
        max_width="1400px",
        padding="2em",
    )


# Create the app
app = rx.App(
    theme=rx.theme(
        appearance="light",
        has_background=True,
        radius="large",
        accent_color="purple",
    )
)

app.add_page(
    index,
    title="Life Navigator Admin - Document Ingestion",
    description="Upload and manage documents for Life Navigator's GraphRAG system",
)

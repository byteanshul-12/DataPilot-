import asyncio
import logging
import os
import uuid
from typing import Any, Optional

from app.graph.workflow import build_collection_graph

logger = logging.getLogger(__name__)


async def bounded_states(graph, state):
    async with asyncio.timeout(float(os.getenv("WORKFLOW_TIMEOUT_SECONDS", "180"))):
        async for snapshot in graph.astream(state, config={"recursion_limit": 50}, stream_mode="values"):
            yield snapshot


class TaskManager:
    """In-memory task manager for tracking background LangGraph collection workflows."""

    _instance: Optional["TaskManager"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TaskManager, cls).__new__(cls)
            cls._instance._tasks = {}
            cls._instance._async_tasks = {}
            cls._instance._graph = build_collection_graph()
        return cls._instance

    def create_task(self, user_requirement: str) -> str:
        task_id = str(uuid.uuid4())
        self._tasks[task_id] = {
            "task_id": task_id,
            "user_requirement": user_requirement,
            "status": "queued",
            "progress": {
                "sources_discovered": 0,
                "records_extracted": 0,
                "records_validated": 0,
                "records_deduplicated": 0,
                "emails_outreached": 0
            },
            "result_records": [],
            "outreach_emails": [],
            "errors": [],
            "specification": {},
            "plan": {}
        }
        return task_id

    def start_task_background(self, task_id: str):
        if task_id in self._tasks:
            async_task = asyncio.create_task(self._run_workflow_async(task_id))
            self._async_tasks[task_id] = async_task

    async def _run_workflow_async(self, task_id: str):
        task_info = self._tasks.get(task_id)
        if not task_info:
            return

        task_info["status"] = "running"
        logger.info(f"Starting background workflow for task_id={task_id}")

        initial_state = {
            "task_id": task_id,
            "user_requirement": task_info["user_requirement"],
            "specification": task_info.get("specification", {}),
            "search_queries": [],
            "discovered_sources": [],
            "raw_documents": [],
            "extracted_records": [],
            "validated_records": [],
            "deduplicated_records": [],
            "outreach_emails": [],
            "errors": [],
            "target_count": 10,
            "iteration": 1,
            "status": "started"
        }

        try:
            final_state = initial_state
            async for snapshot in bounded_states(self._graph, initial_state):
                final_state = snapshot
                task_info["specification"] = snapshot.get("specification", {})
                task_info["result_records"] = snapshot.get("deduplicated_records", [])
                task_info["errors"] = snapshot.get("errors", [])
                task_info["progress"] = {
                    "sources_discovered": len(snapshot.get("discovered_sources", [])),
                    "records_extracted": len(snapshot.get("extracted_records", [])),
                    "records_validated": len(snapshot.get("validated_records", [])),
                    "records_deduplicated": len(snapshot.get("deduplicated_records", [])),
                }

            from app.services.request_policy import response_status, reply_for
            route = response_status(final_state.get("specification", {}))
            task_info["status"] = "completed" if route == "ready" else route
            task_info["reply"] = reply_for(final_state.get("specification", {}))
            task_info["specification"] = final_state.get("specification", {})
            task_info["result_records"] = final_state.get("deduplicated_records", [])
            task_info["outreach_emails"] = final_state.get("outreach_emails", [])
            task_info["errors"] = final_state.get("errors", [])
            requested = final_state.get("target_count", 10)
            if route == "ready" and len(task_info["result_records"]) < requested:
                task_info["status"] = "partial"
                task_info["errors"].append(f"Partial result: {len(task_info['result_records'])} of {requested} requested records passed evidence and relevance checks.")
            task_info["progress"] = {
                "sources_discovered": len(final_state.get("discovered_sources", [])),
                "records_extracted": len(final_state.get("extracted_records", [])),
                "records_validated": len(final_state.get("validated_records", [])),
                "records_deduplicated": len(final_state.get("deduplicated_records", [])),
                "emails_outreached": len(final_state.get("outreach_emails", []))
            }
            logger.info(f"Task task_id={task_id} completed successfully with {len(task_info['result_records'])} records.")
        except TimeoutError:
            task_info["status"] = "partial" if task_info["result_records"] else "failed"
            task_info["errors"].append("Collection time budget exhausted. Any previously validated results have been retained.")
        except asyncio.CancelledError:
            task_info["status"] = "cancelled"
            logger.warning(f"Task task_id={task_id} was cancelled.")
        except Exception as e:
            task_info["status"] = "failed"
            task_info["errors"].append(str(e))
            logger.error(f"Task task_id={task_id} failed with error: {e}")
        finally:
            self._async_tasks.pop(task_id, None)

    def get_task_status(self, task_id: str) -> Optional[dict[str, Any]]:
        return self._tasks.get(task_id)

    def cancel_task(self, task_id: str) -> bool:
        if task_id not in self._tasks:
            return False

        task_info = self._tasks[task_id]
        if task_info["status"] in ("completed", "partial", "answered", "needs_clarification", "failed", "cancelled"):
            return True

        async_task = self._async_tasks.get(task_id)
        if async_task and not async_task.done():
            async_task.cancel()

        task_info["status"] = "cancelled"
        return True

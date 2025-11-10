"""
Graceful Shutdown Handler
Handles SIGTERM and SIGINT signals for graceful shutdowns in Kubernetes.
"""

import signal
import sys
import asyncio
from typing import Callable, Optional
import logging

logger = logging.getLogger(__name__)


class GracefulShutdownHandler:
    """
    Handles graceful shutdown for FastAPI applications.

    Usage:
        shutdown_handler = GracefulShutdownHandler()
        shutdown_handler.setup(cleanup_func=my_cleanup_function)
    """

    def __init__(self):
        self.shutdown_requested = False
        self.cleanup_func: Optional[Callable] = None

    def setup(self, cleanup_func: Optional[Callable] = None):
        """
        Setup signal handlers for graceful shutdown.

        Args:
            cleanup_func: Optional async function to call during shutdown
        """
        self.cleanup_func = cleanup_func

        # Register signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)

        logger.info("Graceful shutdown handlers registered for SIGTERM and SIGINT")

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        signal_name = "SIGTERM" if signum == signal.SIGTERM else "SIGINT"
        logger.info(f"Received {signal_name}, initiating graceful shutdown...")

        self.shutdown_requested = True

        # If cleanup function provided, run it
        if self.cleanup_func:
            try:
                if asyncio.iscoroutinefunction(self.cleanup_func):
                    # Run async cleanup
                    loop = asyncio.get_event_loop()
                    loop.run_until_complete(self.cleanup_func())
                else:
                    # Run sync cleanup
                    self.cleanup_func()

                logger.info("Cleanup completed successfully")
            except Exception as e:
                logger.error(f"Error during cleanup: {e}", exc_info=True)

        logger.info("Graceful shutdown complete")
        sys.exit(0)

    def is_shutdown_requested(self) -> bool:
        """Check if shutdown has been requested"""
        return self.shutdown_requested


# Singleton instance
_shutdown_handler = GracefulShutdownHandler()


def get_shutdown_handler() -> GracefulShutdownHandler:
    """Get the global shutdown handler instance"""
    return _shutdown_handler

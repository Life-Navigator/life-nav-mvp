"""Message Bus for Agent-to-Agent Communication"""

import asyncio
from collections import defaultdict
from typing import Dict, List, Set, Optional, Callable, Any
from datetime import datetime
import structlog

from .message import Message, MessageType

logger = structlog.get_logger(__name__)


class MessageBus:
    """
    Central message bus for agent-to-agent communication.

    Features:
    - Direct messaging (agent → specific agent)
    - Broadcast messaging (agent → all agents)
    - Topic-based messaging (pub/sub)
    - Request-response patterns with timeout
    - Message queuing and delivery
    - Dead letter queue for failed messages

    Usage:
        bus = MessageBus()

        # Subscribe to messages
        await bus.subscribe("agent1", handler_func)

        # Subscribe to topics
        await bus.subscribe_topic("agent1", "task.completed", handler_func)

        # Send direct message
        await bus.send(message)

        # Broadcast message
        await bus.broadcast(message)

        # Request-response pattern
        response = await bus.request(message, timeout=30.0)
    """

    def __init__(self):
        # Agent subscriptions: agent_id -> handler function
        self._subscribers: Dict[str, Callable] = {}

        # Topic subscriptions: topic -> set of (agent_id, handler)
        self._topic_subscribers: Dict[str, Set[tuple]] = defaultdict(set)

        # Pending responses: message_id -> asyncio.Future
        self._pending_responses: Dict[str, asyncio.Future] = {}

        # Message queues: agent_id -> list of messages
        self._queues: Dict[str, List[Message]] = defaultdict(list)

        # Dead letter queue for failed deliveries
        self._dead_letter_queue: List[tuple] = []

        # Statistics
        self._stats = {
            "messages_sent": 0,
            "messages_delivered": 0,
            "messages_failed": 0,
            "broadcasts": 0,
        }

        self._running = False
        self._delivery_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start the message bus delivery loop"""
        if self._running:
            logger.warning("message_bus_already_running")
            return

        self._running = True
        self._delivery_task = asyncio.create_task(self._delivery_loop())
        logger.info("message_bus_started")

    async def stop(self) -> None:
        """Stop the message bus"""
        if not self._running:
            return

        self._running = False

        if self._delivery_task:
            self._delivery_task.cancel()
            try:
                await self._delivery_task
            except asyncio.CancelledError:
                pass

        logger.info(
            "message_bus_stopped",
            stats=self._stats,
            dead_letter_queue_size=len(self._dead_letter_queue)
        )

    async def subscribe(
        self,
        agent_id: str,
        handler: Callable[[Message], Any]
    ) -> None:
        """
        Subscribe an agent to receive direct messages.

        Args:
            agent_id: Agent identifier
            handler: Async function to handle messages
        """
        self._subscribers[agent_id] = handler
        logger.info("agent_subscribed", agent_id=agent_id)

    async def unsubscribe(self, agent_id: str) -> None:
        """Unsubscribe an agent from direct messages"""
        if agent_id in self._subscribers:
            del self._subscribers[agent_id]
            logger.info("agent_unsubscribed", agent_id=agent_id)

    async def subscribe_topic(
        self,
        agent_id: str,
        topic: str,
        handler: Callable[[Message], Any]
    ) -> None:
        """
        Subscribe an agent to a topic.

        Args:
            agent_id: Agent identifier
            topic: Topic name (e.g., "task.completed", "user.query")
            handler: Async function to handle topic messages
        """
        self._topic_subscribers[topic].add((agent_id, handler))
        logger.info("topic_subscribed", agent_id=agent_id, topic=topic)

    async def unsubscribe_topic(
        self,
        agent_id: str,
        topic: str
    ) -> None:
        """Unsubscribe an agent from a topic"""
        # Remove all handlers for this agent on this topic
        self._topic_subscribers[topic] = {
            (aid, handler)
            for aid, handler in self._topic_subscribers[topic]
            if aid != agent_id
        }
        logger.info("topic_unsubscribed", agent_id=agent_id, topic=topic)

    async def send(self, message: Message) -> bool:
        """
        Send a message to a specific agent or topic.

        Args:
            message: Message to send

        Returns:
            True if message was queued successfully
        """
        self._stats["messages_sent"] += 1

        # If it's a broadcast, handle separately
        if message.is_broadcast():
            return await self.broadcast(message)

        # If it's a topic message
        if message.topic:
            return await self._send_to_topic(message)

        # Direct message to specific agent
        if not message.recipient:
            logger.error(
                "message_no_recipient",
                message_id=message.id,
                sender=message.sender
            )
            return False

        # Queue the message
        self._queues[message.recipient].append(message)

        logger.debug(
            "message_queued",
            message_id=message.id,
            sender=message.sender,
            recipient=message.recipient,
            type=message.type
        )

        return True

    async def broadcast(self, message: Message) -> bool:
        """
        Broadcast message to all subscribed agents.

        Args:
            message: Message to broadcast (recipient should be None)

        Returns:
            True if broadcast was successful
        """
        self._stats["broadcasts"] += 1

        # Send to all subscribers except the sender
        for agent_id in self._subscribers:
            if agent_id != message.sender:
                # Create a copy for each recipient
                agent_message = message.model_copy()
                agent_message.recipient = agent_id
                self._queues[agent_id].append(agent_message)

        logger.info(
            "message_broadcast",
            message_id=message.id,
            sender=message.sender,
            recipients=len(self._subscribers) - 1
        )

        return True

    async def _send_to_topic(self, message: Message) -> bool:
        """Send message to all topic subscribers"""
        if not message.topic:
            return False

        subscribers = self._topic_subscribers.get(message.topic, set())

        for agent_id, _ in subscribers:
            if agent_id != message.sender:
                agent_message = message.model_copy()
                agent_message.recipient = agent_id
                self._queues[agent_id].append(agent_message)

        logger.debug(
            "message_sent_to_topic",
            message_id=message.id,
            topic=message.topic,
            subscribers=len(subscribers)
        )

        return True

    async def request(
        self,
        message: Message,
        timeout: float = 30.0
    ) -> Optional[Message]:
        """
        Send a message and wait for a response.

        Args:
            message: Message to send (requires_response should be True)
            timeout: Timeout in seconds

        Returns:
            Response message or None if timeout
        """
        if not message.requires_response:
            message.requires_response = True

        # Create a future for the response
        future = asyncio.Future()
        self._pending_responses[message.id] = future

        # Send the message
        await self.send(message)

        # Wait for response with timeout
        try:
            response = await asyncio.wait_for(future, timeout=timeout)
            return response
        except asyncio.TimeoutError:
            logger.warning(
                "request_timeout",
                message_id=message.id,
                recipient=message.recipient,
                timeout=timeout
            )
            # Clean up
            del self._pending_responses[message.id]
            return None

    async def _delivery_loop(self) -> None:
        """Background loop to deliver queued messages"""
        while self._running:
            try:
                await self._deliver_messages()
                await asyncio.sleep(0.01)  # Small delay to prevent CPU spinning
            except Exception as e:
                logger.error(
                    "delivery_loop_error",
                    error=str(e),
                    exc_info=True
                )

    async def _deliver_messages(self) -> None:
        """Deliver queued messages to subscribers"""
        for agent_id, queue in list(self._queues.items()):
            if not queue:
                continue

            # Get the handler for this agent
            handler = self._subscribers.get(agent_id)
            if not handler:
                # No handler, move to dead letter queue
                for msg in queue:
                    self._dead_letter_queue.append((
                        datetime.utcnow(),
                        msg,
                        "no_handler"
                    ))
                    self._stats["messages_failed"] += 1
                queue.clear()
                continue

            # Deliver messages in the queue
            messages_to_deliver = queue.copy()
            queue.clear()

            for message in messages_to_deliver:
                try:
                    # Deliver the message
                    await self._deliver_message(agent_id, message, handler)
                    self._stats["messages_delivered"] += 1

                except Exception as e:
                    logger.error(
                        "message_delivery_failed",
                        message_id=message.id,
                        agent_id=agent_id,
                        error=str(e),
                        exc_info=True
                    )
                    # Add to dead letter queue
                    self._dead_letter_queue.append((
                        datetime.utcnow(),
                        message,
                        str(e)
                    ))
                    self._stats["messages_failed"] += 1

    async def _deliver_message(
        self,
        agent_id: str,
        message: Message,
        handler: Callable
    ) -> None:
        """Deliver a single message to an agent"""
        logger.debug(
            "delivering_message",
            message_id=message.id,
            agent_id=agent_id,
            type=message.type
        )

        # If this is a response to a pending request, resolve the future
        if message.type == MessageType.RESPONSE and message.reply_to:
            if message.reply_to in self._pending_responses:
                future = self._pending_responses.pop(message.reply_to)
                if not future.done():
                    future.set_result(message)
                return

        # Call the handler
        result = handler(message)
        if asyncio.iscoroutine(result):
            await result

    def get_stats(self) -> Dict[str, Any]:
        """Get message bus statistics"""
        return {
            **self._stats,
            "subscribers": len(self._subscribers),
            "topic_subscriptions": sum(
                len(subs) for subs in self._topic_subscribers.values()
            ),
            "pending_responses": len(self._pending_responses),
            "queued_messages": sum(len(q) for q in self._queues.values()),
            "dead_letter_queue": len(self._dead_letter_queue),
        }

    def get_dead_letters(
        self,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get messages from dead letter queue"""
        return [
            {
                "timestamp": timestamp.isoformat(),
                "message": message.model_dump(),
                "reason": reason
            }
            for timestamp, message, reason in self._dead_letter_queue[-limit:]
        ]

    async def clear_dead_letters(self) -> int:
        """Clear dead letter queue and return count"""
        count = len(self._dead_letter_queue)
        self._dead_letter_queue.clear()
        logger.info("dead_letter_queue_cleared", count=count)
        return count

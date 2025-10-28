"""
Life Navigator Admin Dashboard

Comprehensive admin interface for:
- Document ingestion to centralized GraphRAG
- System usage metrics
- Guardrail monitoring
- Traffic and query analytics
- User analytics (queries per person)
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
from pathlib import Path
import asyncio
import sys
from typing import Dict, Any, List, Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Import project modules
try:
    from graphrag.client import get_graphrag_client
    from graphrag.document_ingestion import get_ingestion_pipeline
    from utils.logging import get_logger
except ImportError as e:
    st.error(f"Failed to import modules: {e}")
    st.stop()

logger = get_logger(__name__)

# Page config
st.set_page_config(
    page_title="Life Navigator Admin",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1f77b4;
        margin-bottom: 1rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        padding: 1.5rem;
        border-radius: 0.5rem;
        border-left: 4px solid #1f77b4;
    }
    .success-box {
        background-color: #d4edda;
        border: 1px solid #c3e6cb;
        border-radius: 0.25rem;
        padding: 1rem;
        margin: 1rem 0;
    }
    .error-box {
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 0.25rem;
        padding: 1rem;
        margin: 1rem 0;
    }
    .info-box {
        background-color: #d1ecf1;
        border: 1px solid #bee5eb;
        border-radius: 0.25rem;
        padding: 1rem;
        margin: 1rem 0;
    }
</style>
""", unsafe_allow_html=True)


# Initialize session state
if 'graphrag_client' not in st.session_state:
    st.session_state.graphrag_client = None
if 'ingestion_pipeline' not in st.session_state:
    st.session_state.ingestion_pipeline = None
if 'mock_mode' not in st.session_state:
    st.session_state.mock_mode = True  # Use mock data for demo


# Mock data generators for demo
def get_mock_usage_stats() -> Dict[str, Any]:
    """Generate mock usage statistics"""
    return {
        "total_queries": 12453,
        "total_users": 342,
        "queries_today": 856,
        "active_users_today": 124,
        "avg_response_time_ms": 1247.5,
        "success_rate": 0.987,
        "guardrails_triggered": 23,
        "guardrails_passed": 5,
        "queries_by_hour": [
            {"hour": f"{i}:00", "queries": 30 + i * 40 + (i % 3) * 20}
            for i in range(24)
        ],
        "queries_by_agent": [
            {"agent": "Budget Specialist", "count": 3421},
            {"agent": "Tax Specialist", "count": 2876},
            {"agent": "Investment Specialist", "count": 2145},
            {"agent": "Resume Specialist", "count": 1532},
            {"agent": "Job Search Specialist", "count": 1289},
            {"agent": "Goal Planner", "count": 890},
            {"agent": "Risk Assessor", "count": 300}
        ],
        "top_users": [
            {"user_id": "user_789", "name": "John D.", "queries": 234, "last_active": "2 hours ago"},
            {"user_id": "user_456", "name": "Sarah M.", "queries": 189, "last_active": "5 hours ago"},
            {"user_id": "user_123", "name": "Michael K.", "queries": 156, "last_active": "1 hour ago"},
            {"user_id": "user_321", "name": "Emily R.", "queries": 142, "last_active": "30 min ago"},
            {"user_id": "user_567", "name": "David L.", "queries": 98, "last_active": "3 hours ago"}
        ],
        "least_active_users": [
            {"user_id": "user_999", "name": "Anna P.", "queries": 2, "last_active": "5 days ago"},
            {"user_id": "user_888", "name": "Tom W.", "queries": 3, "last_active": "4 days ago"},
            {"user_id": "user_777", "name": "Lisa B.", "queries": 5, "last_active": "3 days ago"}
        ]
    }


def get_mock_guardrail_data() -> Dict[str, Any]:
    """Generate mock guardrail monitoring data"""
    return {
        "total_checks": 12453,
        "blocked_count": 23,
        "warning_count": 67,
        "passed_through_count": 5,  # False negatives
        "block_rate": 0.0018,
        "false_negative_rate": 0.0004,
        "checks_by_type": [
            {"type": "PII Detection", "blocked": 8, "warnings": 15, "passed": 2},
            {"type": "Financial Advice Compliance", "blocked": 6, "warnings": 22, "passed": 1},
            {"type": "Tax Law Accuracy", "blocked": 4, "warnings": 12, "passed": 1},
            {"type": "Inappropriate Content", "blocked": 3, "warnings": 8, "passed": 1},
            {"type": "Data Leakage", "blocked": 2, "warnings": 10, "passed": 0}
        ],
        "recent_blocks": [
            {
                "timestamp": "2025-10-27 14:23:15",
                "user_id": "user_456",
                "query": "What's John Smith's social security number?",
                "reason": "PII request detected",
                "severity": "high"
            },
            {
                "timestamp": "2025-10-27 13:45:32",
                "user_id": "user_789",
                "query": "Tell me the exact stocks to buy",
                "reason": "Specific investment recommendation (compliance violation)",
                "severity": "medium"
            },
            {
                "timestamp": "2025-10-27 12:18:47",
                "user_id": "user_234",
                "query": "Can you guarantee this tax strategy is legal?",
                "reason": "Unauthorized legal guarantee",
                "severity": "high"
            }
        ],
        "passed_through": [
            {
                "timestamp": "2025-10-27 11:32:21",
                "user_id": "user_567",
                "query": "Show me all users' account balances",
                "flagged_by": "manual_review",
                "reason": "Data leakage attempt - should have been blocked"
            }
        ]
    }


def get_mock_traffic_data() -> Dict[str, Any]:
    """Generate mock traffic analytics"""
    dates = [(datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(30, 0, -1)]
    return {
        "daily_queries": [
            {"date": date, "queries": 350 + i * 10 + (i % 7) * 50}
            for i, date in enumerate(dates)
        ],
        "peak_hours": [
            {"hour": "09:00", "avg_queries": 87},
            {"hour": "10:00", "avg_queries": 142},
            {"hour": "11:00", "avg_queries": 156},
            {"hour": "14:00", "avg_queries": 134},
            {"hour": "15:00", "avg_queries": 128}
        ],
        "response_times": {
            "p50": 1.2,
            "p95": 2.8,
            "p99": 4.5,
            "max": 12.3
        },
        "error_rate": 0.013
    }


# Sidebar navigation
st.sidebar.markdown('<div class="main-header">🎯 Admin Dashboard</div>', unsafe_allow_html=True)
page = st.sidebar.selectbox(
    "Navigate to",
    [
        "📊 Overview",
        "📤 Document Ingestion",
        "📈 Usage Analytics",
        "🛡️ Guardrail Monitoring",
        "🚦 Traffic & Performance",
        "👥 User Analytics"
    ]
)

# Connection status
if st.session_state.mock_mode:
    st.sidebar.warning("⚠️ Running in MOCK MODE (demo data)")
else:
    st.sidebar.success("✅ Connected to Live System")

# Toggle mock mode
if st.sidebar.button("Toggle Mock/Live Mode"):
    st.session_state.mock_mode = not st.session_state.mock_mode
    st.rerun()


# ============================================================================
# PAGE: Overview
# ============================================================================

if page == "📊 Overview":
    st.markdown('<div class="main-header">📊 System Overview</div>', unsafe_allow_html=True)

    stats = get_mock_usage_stats()
    guardrails = get_mock_guardrail_data()

    # Key metrics
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric(
            "Total Queries",
            f"{stats['total_queries']:,}",
            f"+{stats['queries_today']} today"
        )

    with col2:
        st.metric(
            "Active Users",
            f"{stats['total_users']:,}",
            f"{stats['active_users_today']} today"
        )

    with col3:
        st.metric(
            "Success Rate",
            f"{stats['success_rate']*100:.1f}%",
            f"Avg {stats['avg_response_time_ms']:.0f}ms"
        )

    with col4:
        st.metric(
            "Guardrails",
            f"{guardrails['blocked_count']} blocked",
            f"{guardrails['passed_through_count']} passed"
        )

    st.divider()

    # Quick stats
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("🔥 Top Agents (Last 7 Days)")
        df_agents = pd.DataFrame(stats['queries_by_agent'])
        fig = px.bar(
            df_agents,
            x='agent',
            y='count',
            title='Queries by Agent',
            color='count',
            color_continuous_scale='Blues'
        )
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.subheader("⏰ Query Distribution (Today)")
        df_hours = pd.DataFrame(stats['queries_by_hour'])
        fig = px.line(
            df_hours,
            x='hour',
            y='queries',
            title='Queries by Hour',
            markers=True
        )
        st.plotly_chart(fig, use_container_width=True)

    st.divider()

    # Recent activity
    st.subheader("📋 Recent Guardrail Blocks")
    for block in guardrails['recent_blocks'][:5]:
        severity_color = {"high": "🔴", "medium": "🟡", "low": "🟢"}[block['severity']]
        st.markdown(f"""
        <div class="info-box">
            {severity_color} <b>{block['timestamp']}</b> - User: {block['user_id']}<br>
            Query: "{block['query']}"<br>
            Reason: <b>{block['reason']}</b>
        </div>
        """, unsafe_allow_html=True)


# ============================================================================
# PAGE: Document Ingestion
# ============================================================================

elif page == "📤 Document Ingestion":
    st.markdown('<div class="main-header">📤 Document Ingestion</div>', unsafe_allow_html=True)

    st.markdown("""
    Upload documents to the centralized GraphRAG knowledge base. Supported formats:
    - **PDF**: FINRA regulations, CFP guidelines, IRS documents
    - **HTML**: Web-scraped regulatory content
    - **Markdown/Text**: Policy documents, best practices
    """)

    st.divider()

    # Upload form
    st.subheader("📁 Upload Document")

    with st.form("document_upload"):
        uploaded_file = st.file_uploader(
            "Choose a file",
            type=["pdf", "html", "htm", "md", "markdown", "txt"],
            help="Upload regulatory documents, guidelines, or reference materials"
        )

        col1, col2 = st.columns(2)

        with col1:
            doc_type = st.selectbox(
                "Document Type",
                [
                    ("finra", "FINRA Regulations"),
                    ("cfp", "CFP Guidelines"),
                    ("tax_law", "Tax Laws & IRS"),
                    ("regulation", "General Regulations"),
                    ("compliance", "Compliance Guidelines"),
                    ("best_practice", "Best Practices")
                ],
                format_func=lambda x: x[1]
            )

        with col2:
            source = st.text_input("Source", placeholder="e.g., FINRA Manual 2024")

        date_input = st.date_input("Document Date", datetime.now())

        description = st.text_area(
            "Description (optional)",
            placeholder="Brief description of the document contents..."
        )

        replace_existing = st.checkbox(
            "Replace existing document with same content",
            help="If checked, will replace any existing document with identical content hash"
        )

        submitted = st.form_submit_button("Upload Document", type="primary")

    if submitted and uploaded_file is not None:
        # Save uploaded file
        temp_path = Path(f"/tmp/{uploaded_file.name}")
        temp_path.write_bytes(uploaded_file.getvalue())

        try:
            st.info(f"📤 Ingesting document: {uploaded_file.name}...")

            if st.session_state.mock_mode:
                # Mock ingestion
                import time
                time.sleep(2)  # Simulate processing

                result = {
                    "document_id": "doc_abc123",
                    "file_name": uploaded_file.name,
                    "document_type": doc_type[0],
                    "chunks_stored": 42,
                    "relationships_created": 83,
                    "duplicate": False,
                    "status": "success",
                    "processing_time_ms": 1847.3
                }
            else:
                # Real ingestion
                # Initialize pipeline if needed
                if st.session_state.ingestion_pipeline is None:
                    graphrag_client = await get_graphrag_client()
                    st.session_state.ingestion_pipeline = await get_ingestion_pipeline(graphrag_client)

                result = await st.session_state.ingestion_pipeline.ingest_document(
                    file_path=str(temp_path),
                    document_type=doc_type[0],
                    metadata={
                        "source": source,
                        "date": date_input.isoformat(),
                        "description": description
                    },
                    replace_existing=replace_existing
                )

            # Show results
            if result['status'] == 'success':
                st.markdown(f"""
                <div class="success-box">
                    <h4>✅ Document Ingested Successfully!</h4>
                    <ul>
                        <li><b>Document ID:</b> {result['document_id']}</li>
                        <li><b>Chunks Created:</b> {result['chunks_stored']}</li>
                        <li><b>Relationships:</b> {result['relationships_created']}</li>
                        <li><b>Processing Time:</b> {result['processing_time_ms']:.2f}ms</li>
                    </ul>
                </div>
                """, unsafe_allow_html=True)
            elif result['status'] == 'duplicate_skipped':
                st.markdown(f"""
                <div class="info-box">
                    <h4>ℹ️ Document Already Exists</h4>
                    <p>A document with identical content has already been ingested.</p>
                    <p><b>Existing Document ID:</b> {result['document_id']}</p>
                </div>
                """, unsafe_allow_html=True)

        except Exception as e:
            st.markdown(f"""
            <div class="error-box">
                <h4>❌ Ingestion Failed</h4>
                <p>{str(e)}</p>
            </div>
            """, unsafe_allow_html=True)
            logger.error(f"Document ingestion error: {e}")

        finally:
            # Cleanup
            if temp_path.exists():
                temp_path.unlink()

    st.divider()

    # Document library
    st.subheader("📚 Document Library")

    # Mock document list
    mock_documents = [
        {"id": "doc_001", "name": "FINRA Rule 2111 - Suitability", "type": "finra", "chunks": 45, "date": "2024-01-15"},
        {"id": "doc_002", "name": "CFP Board Standards", "type": "cfp", "chunks": 67, "date": "2024-02-01"},
        {"id": "doc_003", "name": "IRS Publication 590-A", "type": "tax_law", "chunks": 123, "date": "2024-03-10"},
        {"id": "doc_004", "name": "FINRA Rule 3110 - Supervision", "type": "finra", "chunks": 38, "date": "2024-01-20"},
        {"id": "doc_005", "name": "SEC Regulation Best Interest", "type": "regulation", "chunks": 89, "date": "2024-04-05"}
    ]

    df_docs = pd.DataFrame(mock_documents)
    st.dataframe(
        df_docs,
        column_config={
            "id": "Document ID",
            "name": "Document Name",
            "type": "Type",
            "chunks": st.column_config.NumberColumn("Chunks", format="%d"),
            "date": st.column_config.DateColumn("Date")
        },
        use_container_width=True,
        hide_index=True
    )


# ============================================================================
# PAGE: Usage Analytics
# ============================================================================

elif page == "📈 Usage Analytics":
    st.markdown('<div class="main-header">📈 Usage Analytics</div>', unsafe_allow_html=True)

    stats = get_mock_usage_stats()
    traffic = get_mock_traffic_data()

    # Time period selector
    time_period = st.selectbox(
        "Time Period",
        ["Last 24 Hours", "Last 7 Days", "Last 30 Days", "Last 90 Days"]
    )

    st.divider()

    # Key metrics
    col1, col2, col3 = st.columns(3)

    with col1:
        st.metric("Total Queries", f"{stats['total_queries']:,}")
        st.metric("Queries Today", f"{stats['queries_today']:,}")

    with col2:
        st.metric("Total Users", f"{stats['total_users']:,}")
        st.metric("Active Today", f"{stats['active_users_today']:,}")

    with col3:
        st.metric("Avg Response Time", f"{stats['avg_response_time_ms']:.0f}ms")
        st.metric("Success Rate", f"{stats['success_rate']*100:.1f}%")

    st.divider()

    # Charts
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("📊 Queries by Agent")
        df_agents = pd.DataFrame(stats['queries_by_agent'])
        fig = px.pie(
            df_agents,
            values='count',
            names='agent',
            title='Distribution of Queries by Agent'
        )
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.subheader("📈 Daily Query Trend")
        df_daily = pd.DataFrame(traffic['daily_queries'])
        fig = px.area(
            df_daily,
            x='date',
            y='queries',
            title='Queries Over Time'
        )
        st.plotly_chart(fig, use_container_width=True)

    st.divider()

    # Response time distribution
    st.subheader("⚡ Response Time Percentiles")
    response_times = traffic['response_times']
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("P50 (Median)", f"{response_times['p50']:.1f}s")
    with col2:
        st.metric("P95", f"{response_times['p95']:.1f}s")
    with col3:
        st.metric("P99", f"{response_times['p99']:.1f}s")
    with col4:
        st.metric("Max", f"{response_times['max']:.1f}s")


# ============================================================================
# PAGE: Guardrail Monitoring
# ============================================================================

elif page == "🛡️ Guardrail Monitoring":
    st.markdown('<div class="main-header">🛡️ Guardrail Monitoring</div>', unsafe_allow_html=True)

    guardrails = get_mock_guardrail_data()

    st.markdown("""
    Monitor the effectiveness of content guardrails and safety measures.
    Track blocked queries, warnings, and potential false negatives.
    """)

    st.divider()

    # Key metrics
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric("Total Checks", f"{guardrails['total_checks']:,}")

    with col2:
        st.metric("Blocked", f"{guardrails['blocked_count']}", f"{guardrails['block_rate']*100:.2f}%")

    with col3:
        st.metric("Warnings", f"{guardrails['warning_count']}")

    with col4:
        st.metric(
            "False Negatives",
            f"{guardrails['passed_through_count']}",
            f"{guardrails['false_negative_rate']*100:.3f}%",
            delta_color="inverse"
        )

    st.divider()

    # Checks by type
    st.subheader("📊 Guardrail Checks by Type")
    df_checks = pd.DataFrame(guardrails['checks_by_type'])

    fig = go.Figure()
    fig.add_trace(go.Bar(name='Blocked', x=df_checks['type'], y=df_checks['blocked'], marker_color='red'))
    fig.add_trace(go.Bar(name='Warnings', x=df_checks['type'], y=df_checks['warnings'], marker_color='orange'))
    fig.add_trace(go.Bar(name='Passed Through', x=df_checks['type'], y=df_checks['passed'], marker_color='yellow'))

    fig.update_layout(barmode='group', title='Guardrail Activity by Type')
    st.plotly_chart(fig, use_container_width=True)

    st.divider()

    # Recent blocks
    st.subheader("🚫 Recent Blocked Queries")
    for block in guardrails['recent_blocks']:
        severity_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}[block['severity']]
        st.markdown(f"""
        <div class="info-box">
            {severity_emoji} <b>{block['severity'].upper()}</b> - {block['timestamp']}<br>
            <b>User:</b> {block['user_id']}<br>
            <b>Query:</b> "{block['query']}"<br>
            <b>Reason:</b> {block['reason']}
        </div>
        """, unsafe_allow_html=True)

    st.divider()

    # False negatives (passed through but shouldn't have)
    st.subheader("⚠️ Potential False Negatives")
    if guardrails['passed_through']:
        for item in guardrails['passed_through']:
            st.markdown(f"""
            <div class="error-box">
                <b>🔴 ALERT</b> - {item['timestamp']}<br>
                <b>User:</b> {item['user_id']}<br>
                <b>Query:</b> "{item['query']}"<br>
                <b>Flagged by:</b> {item['flagged_by']}<br>
                <b>Issue:</b> {item['reason']}
            </div>
            """, unsafe_allow_html=True)
    else:
        st.success("✅ No false negatives detected!")


# ============================================================================
# PAGE: Traffic & Performance
# ============================================================================

elif page == "🚦 Traffic & Performance":
    st.markdown('<div class="main-header">🚦 Traffic & Performance</div>', unsafe_allow_html=True)

    traffic = get_mock_traffic_data()
    stats = get_mock_usage_stats()

    st.divider()

    # Peak hours
    st.subheader("⏰ Peak Usage Hours")
    df_peak = pd.DataFrame(traffic['peak_hours'])
    fig = px.bar(
        df_peak,
        x='hour',
        y='avg_queries',
        title='Average Queries by Hour',
        color='avg_queries',
        color_continuous_scale='Reds'
    )
    st.plotly_chart(fig, use_container_width=True)

    st.divider()

    # Daily trend
    st.subheader("📈 30-Day Query Trend")
    df_daily = pd.DataFrame(traffic['daily_queries'])
    fig = px.line(
        df_daily,
        x='date',
        y='queries',
        title='Queries per Day',
        markers=True
    )
    st.plotly_chart(fig, use_container_width=True)

    st.divider()

    # Performance metrics
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("⚡ Response Time Distribution")
        response_times = traffic['response_times']
        fig = go.Figure()
        fig.add_trace(go.Bar(
            x=['P50', 'P95', 'P99', 'Max'],
            y=[response_times['p50'], response_times['p95'], response_times['p99'], response_times['max']],
            marker_color=['green', 'orange', 'red', 'darkred']
        ))
        fig.update_layout(title='Response Time Percentiles (seconds)')
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.subheader("📊 System Health")
        st.metric("Error Rate", f"{traffic['error_rate']*100:.2f}%")
        st.metric("Success Rate", f"{stats['success_rate']*100:.1f}%")
        st.metric("Avg Response Time", f"{stats['avg_response_time_ms']:.0f}ms")


# ============================================================================
# PAGE: User Analytics
# ============================================================================

elif page == "👥 User Analytics":
    st.markdown('<div class="main-header">👥 User Analytics</div>', unsafe_allow_html=True)

    stats = get_mock_usage_stats()

    st.markdown("""
    Analyze user engagement patterns, identify power users, and monitor inactive accounts.
    """)

    st.divider()

    # User summary
    col1, col2, col3 = st.columns(3)

    with col1:
        st.metric("Total Users", f"{stats['total_users']:,}")

    with col2:
        avg_queries = stats['total_queries'] / stats['total_users']
        st.metric("Avg Queries/User", f"{avg_queries:.1f}")

    with col3:
        st.metric("Active Today", f"{stats['active_users_today']:,}")

    st.divider()

    # Top users
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("🏆 Most Active Users")
        df_top = pd.DataFrame(stats['top_users'])
        st.dataframe(
            df_top,
            column_config={
                "user_id": "User ID",
                "name": "Name",
                "queries": st.column_config.NumberColumn("Queries", format="%d"),
                "last_active": "Last Active"
            },
            use_container_width=True,
            hide_index=True
        )

    with col2:
        st.subheader("💤 Least Active Users")
        df_least = pd.DataFrame(stats['least_active_users'])
        st.dataframe(
            df_least,
            column_config={
                "user_id": "User ID",
                "name": "Name",
                "queries": st.column_config.NumberColumn("Queries", format="%d"),
                "last_active": "Last Active"
            },
            use_container_width=True,
            hide_index=True
        )

    st.divider()

    # Query distribution
    st.subheader("📊 Query Distribution Across Users")
    query_counts = [user['queries'] for user in stats['top_users']] + \
                   [user['queries'] for user in stats['least_active_users']]

    fig = px.histogram(
        x=query_counts,
        nbins=20,
        title='Distribution of Queries per User',
        labels={'x': 'Number of Queries', 'y': 'Number of Users'}
    )
    st.plotly_chart(fig, use_container_width=True)


# Footer
st.divider()
st.markdown("""
<div style='text-align: center; color: #666; padding: 2rem;'>
    <p>Life Navigator Admin Dashboard v1.0</p>
    <p>Powered by GraphRAG + Multi-Agent AI</p>
</div>
""", unsafe_allow_html=True)

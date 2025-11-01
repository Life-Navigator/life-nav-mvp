#!/usr/bin/env python3
"""
Complete Integration Test Suite for Life Navigator
Tests all components end-to-end with Maverick LLM
"""

import asyncio
import httpx
import time
from pathlib import Path
import json
import sys

# Color codes for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'


class IntegrationTester:
    """Integration test runner"""

    def __init__(self):
        self.maverick_url = "http://localhost:8090"
        self.results = {
            "passed": [],
            "failed": [],
            "skipped": []
        }

    def print_header(self, text):
        """Print section header"""
        print(f"\n{BLUE}{'=' * 70}{RESET}")
        print(f"{BLUE}{text:^70}{RESET}")
        print(f"{BLUE}{'=' * 70}{RESET}\n")

    def print_test(self, name, status, details=""):
        """Print test result"""
        if status == "PASS":
            print(f"{GREEN}✓{RESET} {name}")
            if details:
                print(f"  {details}")
            self.results["passed"].append(name)
        elif status == "FAIL":
            print(f"{RED}✗{RESET} {name}")
            if details:
                print(f"  {RED}{details}{RESET}")
            self.results["failed"].append(name)
        elif status == "SKIP":
            print(f"{YELLOW}⊘{RESET} {name}")
            if details:
                print(f"  {YELLOW}{details}{RESET}")
            self.results["skipped"].append(name)

    async def test_maverick_connection(self):
        """Test 1: Maverick LLM Connection"""
        self.print_header("Test 1: Maverick LLM Connection")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Health check
                response = await client.get(f"{self.maverick_url}/health")
                if response.status_code == 200:
                    self.print_test(
                        "Maverick health check",
                        "PASS",
                        f"Status: {response.json()['status']}"
                    )
                else:
                    self.print_test(
                        "Maverick health check",
                        "FAIL",
                        f"Status code: {response.status_code}"
                    )
                    return False

                # Test completion
                response = await client.post(
                    f"{self.maverick_url}/v1/chat/completions",
                    json={
                        "model": "maverick",
                        "messages": [
                            {"role": "user", "content": "Say 'test successful'"}
                        ],
                        "max_tokens": 10
                    }
                )

                if response.status_code == 200:
                    result = response.json()
                    content = result["choices"][0]["message"]["content"]
                    self.print_test(
                        "Maverick completion",
                        "PASS",
                        f"Response: {content[:50]}"
                    )
                else:
                    self.print_test(
                        "Maverick completion",
                        "FAIL",
                        f"Status: {response.status_code}"
                    )
                    return False

            return True

        except Exception as e:
            self.print_test("Maverick connection", "FAIL", str(e))
            return False

    async def test_entity_extraction(self):
        """Test 2: Entity Extraction with Maverick"""
        self.print_header("Test 2: Entity Extraction")

        test_text = """
        Apple Inc. is an American technology company headquartered in Cupertino, California.
        Tim Cook is the CEO. The company was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne in 1976.
        """

        try:
            # Import entity extractor
            sys.path.append(str(Path(__file__).parent.parent))
            from mcp_server.ingestion.extractors import EntityExtractor

            extractor = EntityExtractor(llm_endpoint=f"{self.maverick_url}/v1/chat/completions")

            result = await extractor.extract_entities(test_text)

            entities = result.get("entities", [])
            relationships = result.get("relationships", [])

            if len(entities) > 0:
                self.print_test(
                    "Entity extraction",
                    "PASS",
                    f"Extracted {len(entities)} entities, {len(relationships)} relationships"
                )

                # Show some entities
                for entity in entities[:3]:
                    print(f"    - {entity.get('name')} ({entity.get('type')})")

                await extractor.close()
                return True
            else:
                self.print_test(
                    "Entity extraction",
                    "FAIL",
                    "No entities extracted"
                )
                await extractor.close()
                return False

        except Exception as e:
            self.print_test("Entity extraction", "FAIL", str(e))
            return False

    async def test_concept_extraction(self):
        """Test 3: Concept Extraction"""
        self.print_header("Test 3: Concept Extraction")

        test_text = """
        Artificial intelligence and machine learning are transforming healthcare.
        Deep learning models can analyze medical images to detect diseases early.
        Natural language processing helps extract insights from patient records.
        """

        try:
            sys.path.append(str(Path(__file__).parent.parent))
            from mcp_server.ingestion.extractors import ConceptExtractor

            extractor = ConceptExtractor(llm_endpoint=f"{self.maverick_url}/v1/chat/completions")

            concepts = await extractor.extract_concepts(test_text)

            if len(concepts) > 0:
                self.print_test(
                    "Concept extraction",
                    "PASS",
                    f"Extracted {len(concepts)} concepts"
                )

                for concept in concepts[:3]:
                    print(f"    - {concept.get('name')}: {concept.get('description', '')[:50]}")

                await extractor.close()
                return True
            else:
                self.print_test(
                    "Concept extraction",
                    "FAIL",
                    "No concepts extracted"
                )
                await extractor.close()
                return False

        except Exception as e:
            self.print_test("Concept extraction", "FAIL", str(e))
            return False

    async def test_embedding_generation(self):
        """Test 4: Embedding Generation"""
        self.print_header("Test 4: Embedding Generation")

        test_texts = [
            "This is a test sentence.",
            "Another test sentence with different content.",
            "Machine learning is fascinating."
        ]

        try:
            sys.path.append(str(Path(__file__).parent.parent))
            from mcp_server.ingestion.extractors import EmbeddingGenerator

            generator = EmbeddingGenerator(use_local=True)

            embeddings = await generator.generate_embeddings(test_texts)

            if len(embeddings) == len(test_texts):
                embedding_dim = len(embeddings[0])
                self.print_test(
                    "Embedding generation",
                    "PASS",
                    f"Generated {len(embeddings)} embeddings of dimension {embedding_dim}"
                )
                return True
            else:
                self.print_test(
                    "Embedding generation",
                    "FAIL",
                    f"Expected {len(test_texts)} embeddings, got {len(embeddings)}"
                )
                return False

        except Exception as e:
            self.print_test("Embedding generation", "FAIL", str(e))
            return False

    async def test_document_parsing(self):
        """Test 5: Document Parsing"""
        self.print_header("Test 5: Document Parsing")

        # Create a test markdown file
        test_file = Path("/tmp/test_document.md")
        test_file.write_text("""# Test Document

This is a test document for the Life Navigator system.

## Section 1

Content for section 1 with **important** information.

## Section 2

More content here with different topics.
""")

        try:
            sys.path.append(str(Path(__file__).parent.parent))
            from mcp_server.ingestion.parsers import ParserFactory

            result = ParserFactory.parse_document(str(test_file))

            if result and result.get("text"):
                self.print_test(
                    "Document parsing",
                    "PASS",
                    f"Parsed {len(result['text'])} chars, {len(result['chunks'])} chunks"
                )
                return True
            else:
                self.print_test("Document parsing", "FAIL", "No text extracted")
                return False

        except Exception as e:
            self.print_test("Document parsing", "FAIL", str(e))
            return False
        finally:
            # Cleanup
            if test_file.exists():
                test_file.unlink()

    def test_database_connections(self):
        """Test 6: Database Connections (Placeholder)"""
        self.print_header("Test 6: Database Connections")

        # This would require actual database setup
        # For now, we'll skip this test
        self.print_test(
            "PostgreSQL connection",
            "SKIP",
            "Requires database configuration"
        )
        self.print_test(
            "Redis connection",
            "SKIP",
            "Requires database configuration"
        )
        self.print_test(
            "Neo4j connection",
            "SKIP",
            "Requires database configuration"
        )
        self.print_test(
            "Qdrant connection",
            "SKIP",
            "Requires database configuration"
        )

        return True

    async def run_all_tests(self):
        """Run all integration tests"""
        print(f"\n{BLUE}{'=' * 70}{RESET}")
        print(f"{BLUE}{'Life Navigator Integration Test Suite':^70}{RESET}")
        print(f"{BLUE}{'=' * 70}{RESET}")

        start_time = time.time()

        # Run tests
        await self.test_maverick_connection()
        await self.test_entity_extraction()
        await self.test_concept_extraction()
        await self.test_embedding_generation()
        await self.test_document_parsing()
        self.test_database_connections()

        # Summary
        duration = time.time() - start_time

        self.print_header("Test Summary")
        print(f"{GREEN}Passed:{RESET}  {len(self.results['passed'])}")
        print(f"{RED}Failed:{RESET}  {len(self.results['failed'])}")
        print(f"{YELLOW}Skipped:{RESET} {len(self.results['skipped'])}")
        print(f"\nDuration: {duration:.2f}s")

        if self.results["failed"]:
            print(f"\n{RED}Failed tests:{RESET}")
            for test in self.results["failed"]:
                print(f"  - {test}")
            return False
        else:
            print(f"\n{GREEN}All tests passed!{RESET}")
            return True


async def main():
    """Main test runner"""
    tester = IntegrationTester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())

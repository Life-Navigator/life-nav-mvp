# ===========================================================================
# GraphDB on GKE Module - RDF Triple Store & SPARQL Endpoint
# ===========================================================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "env" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "cluster_name" {
  description = "GKE cluster name"
  type        = string
}

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "databases"
}

variable "graphdb_version" {
  description = "GraphDB version"
  type        = string
  default     = "10.5.1"
}

variable "disk_size_gb" {
  description = "Persistent disk size in GB"
  type        = number
  default     = 100
}

variable "memory_request" {
  description = "Memory request (e.g., 4Gi)"
  type        = string
  default     = "4Gi"
}

variable "cpu_request" {
  description = "CPU request (e.g., 2)"
  type        = string
  default     = "2"
}

variable "heap_size" {
  description = "Java heap size (e.g., 2g)"
  type        = string
  default     = "2g"
}

variable "repository_id" {
  description = "GraphDB repository ID"
  type        = string
  default     = "life-navigator"
}

variable "enable_reasoning" {
  description = "Enable RDFS+ reasoning"
  type        = bool
  default     = true
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}

# Persistent Volume Claim for GraphDB data
resource "kubernetes_persistent_volume_claim" "graphdb_data" {
  metadata {
    name      = "graphdb-data-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    access_modes = ["ReadWriteOnce"]
    resources {
      requests = {
        storage = "${var.disk_size_gb}Gi"
      }
    }
    storage_class_name = "standard-rwo"
  }
}

# ConfigMap for GraphDB settings
resource "kubernetes_config_map" "graphdb_config" {
  metadata {
    name      = "graphdb-config-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    "graphdb.properties" = <<-EOT
      # GraphDB Configuration
      graphdb.home=/opt/graphdb/home
      graphdb.workbench.importDirectory=/opt/graphdb/home/graphdb-import
      graphdb.workbench.cors.enable=true

      # Performance tuning
      graphdb.entity.pool.implementation=transactional
      graphdb.page.cache.size=2G
      graphdb.query.timeout=300

      # Security
      graphdb.auth.enabled=true
      graphdb.workbench.security.enabled=true

      # Logging
      logging.level.root=INFO
      logging.level.org.eclipse.rdf4j=INFO
      logging.level.com.ontotext.graphdb=INFO
    EOT

    "logback.xml" = <<-EOT
      <configuration>
        <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
          <encoder>
            <pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n</pattern>
          </encoder>
        </appender>

        <root level="${var.env == "prod" ? "INFO" : "DEBUG"}">
          <appender-ref ref="STDOUT" />
        </root>
      </configuration>
    EOT

    # Repository configuration (loaded via REST API after startup)
    "repo-config.ttl" = <<-EOT
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      @prefix rep: <http://www.openrdf.org/config/repository#> .
      @prefix sr: <http://www.openrdf.org/config/repository/sail#> .
      @prefix sail: <http://www.openrdf.org/config/sail#> .
      @prefix graphdb: <http://www.ontotext.com/config/graphdb#> .

      [] a rep:Repository ;
        rep:repositoryID "${var.repository_id}" ;
        rdfs:label "Life Navigator Knowledge Graph" ;
        rep:repositoryImpl [
          rep:repositoryType "graphdb:SailRepository" ;
          sr:sailImpl [
            sail:sailType "graphdb:Sail" ;
            graphdb:ruleset "${var.enable_reasoning ? "rdfsplus-optimized" : "empty"}" ;
            graphdb:base-URL "https://ln.life/ontology#" ;
            graphdb:defaultNS "https://ln.life/ontology#" ;
            graphdb:entity-index-size "10000000" ;
            graphdb:entity-id-size "32" ;
            graphdb:imports "" ;
            graphdb:repository-type "file-repository" ;
            graphdb:storage-folder "storage" ;
            graphdb:enable-context-index "true" ;
            graphdb:enablePredicateList "true" ;
            graphdb:in-memory-literal-properties "true" ;
            graphdb:enable-literal-index "true" ;
            graphdb:check-for-inconsistencies "false" ;
            graphdb:disable-sameAs "false" ;
            graphdb:query-timeout "300" ;
            graphdb:query-limit-results "0" ;
            graphdb:throw-QueryEvaluationException-on-timeout "false" ;
            graphdb:read-only "false" ;
          ]
        ] .
    EOT
  }
}

# Secret for GraphDB admin password
resource "random_password" "graphdb_password" {
  length  = 32
  special = true
}

resource "kubernetes_secret" "graphdb_auth" {
  metadata {
    name      = "graphdb-auth-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    GRAPHDB_ADMIN_PASSWORD = random_password.graphdb_password.result
  }
}

# Store password in Secret Manager
resource "google_secret_manager_secret" "graphdb_password" {
  secret_id = "graphdb-password-${var.env}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = var.labels
}

resource "google_secret_manager_secret_version" "graphdb_password" {
  secret = google_secret_manager_secret.graphdb_password.id

  secret_data = random_password.graphdb_password.result
}

# GraphDB StatefulSet
resource "kubernetes_stateful_set" "graphdb" {
  metadata {
    name      = "graphdb-${var.env}"
    namespace = var.namespace
    labels = merge(
      var.labels,
      {
        app       = "graphdb"
        component = "triplestore"
      }
    )
  }

  spec {
    service_name = "graphdb"
    replicas     = 1

    selector {
      match_labels = {
        app = "graphdb"
        env = var.env
      }
    }

    template {
      metadata {
        labels = {
          app = "graphdb"
          env = var.env
        }
      }

      spec {
        container {
          name  = "graphdb"
          image = "ontotext/graphdb:${var.graphdb_version}"

          env {
            name  = "GDB_HEAP_SIZE"
            value = var.heap_size
          }

          env {
            name  = "GDB_MIN_MEM"
            value = var.heap_size
          }

          env {
            name  = "GDB_MAX_MEM"
            value = var.heap_size
          }

          env {
            name = "GRAPHDB_ADMIN_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.graphdb_auth.metadata[0].name
                key  = "GRAPHDB_ADMIN_PASSWORD"
              }
            }
          }

          env {
            name  = "GDB_JAVA_OPTS"
            value = "-Xms${var.heap_size} -Xmx${var.heap_size} -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
          }

          port {
            name           = "http"
            container_port = 7200
            protocol       = "TCP"
          }

          port {
            name           = "rpc"
            container_port = 7300
            protocol       = "TCP"
          }

          volume_mount {
            name       = "data"
            mount_path = "/opt/graphdb/home"
          }

          volume_mount {
            name       = "config"
            mount_path = "/opt/graphdb/home/conf"
          }

          resources {
            requests = {
              cpu    = var.cpu_request
              memory = var.memory_request
            }
            limits = {
              cpu    = "${tonumber(var.cpu_request) * 2}"
              memory = var.memory_request
            }
          }

          liveness_probe {
            http_get {
              path = "/protocol"
              port = 7200
            }
            initial_delay_seconds = 120
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/protocol"
              port = 7200
            }
            initial_delay_seconds = 60
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }

          startup_probe {
            http_get {
              path = "/protocol"
              port = 7200
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 10
          }
        }

        volume {
          name = "data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.graphdb_data.metadata[0].name
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.graphdb_config.metadata[0].name
          }
        }
      }
    }
  }
}

# Service for GraphDB (HTTP/SPARQL endpoint)
resource "kubernetes_service" "graphdb" {
  metadata {
    name      = "graphdb-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = {
      app = "graphdb"
      env = var.env
    }

    port {
      name        = "http"
      port        = 7200
      target_port = 7200
      protocol    = "TCP"
    }

    port {
      name        = "rpc"
      port        = 7300
      target_port = 7300
      protocol    = "TCP"
    }

    type = "ClusterIP"
  }
}

# Headless service for StatefulSet
resource "kubernetes_service" "graphdb_headless" {
  metadata {
    name      = "graphdb"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    selector = {
      app = "graphdb"
      env = var.env
    }

    port {
      name        = "http"
      port        = 7200
      target_port = 7200
    }

    port {
      name        = "rpc"
      port        = 7300
      target_port = 7300
    }

    cluster_ip = "None"
  }
}

# ConfigMap for repository initialization script
resource "kubernetes_config_map" "graphdb_init" {
  metadata {
    name      = "graphdb-init-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  data = {
    "init-repo.sh" = <<-EOT
      #!/bin/bash
      set -e

      GRAPHDB_URL="http://localhost:7200"
      REPOSITORY_ID="${var.repository_id}"

      # Wait for GraphDB to be ready
      echo "Waiting for GraphDB to start..."
      until curl -f "$GRAPHDB_URL/protocol" > /dev/null 2>&1; do
        sleep 5
      done
      echo "GraphDB is ready!"

      # Check if repository exists
      if curl -f "$GRAPHDB_URL/repositories/$REPOSITORY_ID" > /dev/null 2>&1; then
        echo "Repository '$REPOSITORY_ID' already exists"
        exit 0
      fi

      # Create repository
      echo "Creating repository '$REPOSITORY_ID'..."
      curl -X POST "$GRAPHDB_URL/rest/repositories" \
        -H "Content-Type: application/x-turtle" \
        -d @/opt/graphdb/home/conf/repo-config.ttl

      echo "Repository created successfully!"
    EOT
  }
}

# Job to initialize repository (runs once after GraphDB starts)
resource "kubernetes_job" "graphdb_init" {
  metadata {
    name      = "graphdb-init-${var.env}"
    namespace = var.namespace
    labels    = var.labels
  }

  spec {
    template {
      metadata {
        labels = {
          app = "graphdb-init"
          env = var.env
        }
      }

      spec {
        restart_policy = "OnFailure"

        init_container {
          name  = "wait-for-graphdb"
          image = "curlimages/curl:8.5.0"
          command = [
            "sh",
            "-c",
            "until curl -f http://graphdb-${var.env}.${var.namespace}.svc.cluster.local:7200/protocol; do echo waiting for graphdb; sleep 5; done"
          ]
        }

        container {
          name  = "init-repo"
          image = "ontotext/graphdb:${var.graphdb_version}"
          command = ["/bin/bash"]
          args    = ["/scripts/init-repo.sh"]

          volume_mount {
            name       = "init-scripts"
            mount_path = "/scripts"
          }

          volume_mount {
            name       = "config"
            mount_path = "/opt/graphdb/home/conf"
          }
        }

        volume {
          name = "init-scripts"
          config_map {
            name         = kubernetes_config_map.graphdb_init.metadata[0].name
            default_mode = "0755"
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.graphdb_config.metadata[0].name
          }
        }
      }
    }

    backoff_limit = 4
  }

  depends_on = [
    kubernetes_stateful_set.graphdb
  ]
}

# Outputs
output "service_name" {
  description = "GraphDB service name"
  value       = kubernetes_service.graphdb.metadata[0].name
}

output "sparql_endpoint" {
  description = "GraphDB SPARQL endpoint URL"
  value       = "http://${kubernetes_service.graphdb.metadata[0].name}.${var.namespace}.svc.cluster.local:7200/repositories/${var.repository_id}"
}

output "http_uri" {
  description = "GraphDB HTTP URI"
  value       = "http://${kubernetes_service.graphdb.metadata[0].name}.${var.namespace}.svc.cluster.local:7200"
}

output "repository_id" {
  description = "GraphDB repository ID"
  value       = var.repository_id
}

output "password_secret" {
  description = "Secret Manager secret name for GraphDB password"
  value       = google_secret_manager_secret.graphdb_password.secret_id
}

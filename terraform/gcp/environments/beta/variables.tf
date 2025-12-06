variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "lifenav-prod"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "alert_email" {
  description = "Email for alerts"
  type        = string
  default     = "timothy.riffe@lifenavigator.tech"
}

variable "dgx_spark_url" {
  description = "DGX-Spark API URL for heavy AI workloads"
  type        = string
  default     = "https://dgx-spark.lifenavigator.tech"
}

variable "cloud_run_suffix" {
  description = "Cloud Run URL suffix (project hash)"
  type        = string
  default     = ""
}

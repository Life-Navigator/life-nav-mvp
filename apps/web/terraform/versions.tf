terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.85.0"
    }
    
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.47.0"
    }
    
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6.0"
    }
    
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2.0"
    }
  }
  
  # Backend configuration for state management
  backend "azurerm" {
    # These will be configured during terraform init
    # terraform init -backend-config="backend.tfvars"
    # resource_group_name  = "terraform-state-rg"
    # storage_account_name = "tfstatelifenavigator"
    # container_name       = "tfstate"
    # key                  = "prod.terraform.tfstate"
  }
}
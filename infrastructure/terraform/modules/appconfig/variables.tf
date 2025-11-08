# Variables for AppConfig Module

variable "application_name" {
  description = "Name of the AppConfig application"
  type        = string
  default     = "global-gaming-platform"
}

variable "environments" {
  description = "Map of environments with their configuration"
  type = map(object({
    monitors = list(object({
      alarm_arn      = string
      alarm_role_arn = string
    }))
  }))
  default = {
    development = {
      monitors = []
    }
    staging = {
      monitors = []
    }
    production = {
      monitors = []
    }
  }
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "global-gaming-platform"
    Environment = "shared"
    ManagedBy   = "terraform"
  }
}